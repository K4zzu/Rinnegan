// src/utils/faceCluster.js
// Análisis facial EN EL NAVEGADOR (face-api.js). Carga los modelos empaquetados
// (public/models), calcula el descriptor de cada foto (vía el proxy /img), y
// agrupa las caras: el grupo más grande = la cara que más se repite entre
// perfiles → probabilidad de que sean la misma persona.
// face-api se importa dinámicamente (chunk aparte, no infla el bundle inicial).
import { imgProxyUrl } from "../services/api";

let faceapi = null;
let modelsLoaded = false;
const THRESHOLD = 0.55; // distancia euclidiana: < = misma cara

async function ensureLoaded() {
  if (!faceapi) {
    faceapi = await import("@vladmandic/face-api");
    if (faceapi.tf?.ready) await faceapi.tf.ready();
  }
  if (!modelsLoaded) {
    const url = `${import.meta.env.BASE_URL}models`;
    await faceapi.nets.tinyFaceDetector.loadFromUri(url);
    await faceapi.nets.faceLandmark68Net.loadFromUri(url);
    await faceapi.nets.faceRecognitionNet.loadFromUri(url);
    modelsLoaded = true;
  }
  return faceapi;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("img load failed"));
    img.src = src;
  });
}

function euclidean(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

function meanDescriptor(descs) {
  const len = descs[0].length;
  const out = new Float32Array(len);
  for (const d of descs) for (let i = 0; i < len; i++) out[i] += d[i];
  for (let i = 0; i < len; i++) out[i] /= descs.length;
  return out;
}

/**
 * Lógica pura de agrupamiento (sin face-api, testeable). Recibe los resultados
 * por foto `[{ item, descriptor|null }]` en el orden original y devuelve el
 * resumen del análisis + una anotación por foto (misma order).
 */
export function clusterResults(results, threshold = THRESHOLD) {
  const withFace = results.filter((r) => r.descriptor);

  // Agrupamiento voraz por similitud (distancia euclidiana al centroide).
  const clusters = []; // { members: [descriptor...], items: [item...], centroid }
  for (const r of withFace) {
    let best = null;
    let bestDist = Infinity;
    for (const c of clusters) {
      const d = euclidean(r.descriptor, c.centroid);
      if (d < bestDist) {
        bestDist = d;
        best = c;
      }
    }
    if (best && bestDist < threshold) {
      best.members.push(r.descriptor);
      best.items.push(r.item);
      best.centroid = meanDescriptor(best.members);
    } else {
      clusters.push({ members: [r.descriptor], items: [r.item], centroid: r.descriptor });
    }
  }
  clusters.sort((a, b) => b.members.length - a.members.length);

  const dominant = clusters[0];
  const facesFound = withFace.length;
  const dominantItems = new Set(dominant ? dominant.items : []);
  const probability =
    dominant && facesFound > 0
      ? Math.round((dominant.members.length / facesFound) * 100)
      : 0;

  return {
    probability,
    dominantCount: dominant ? dominant.members.length : 0,
    facesFound,
    totalPhotos: results.length,
    annotated: results.map((r) => ({
      source: r.item.source,
      inDominant: r.descriptor ? dominantItems.has(r.item) : false,
      hasFace: !!r.descriptor,
    })),
  };
}

export async function analyzeFaces(items) {
  const fa = await ensureLoaded();
  const opts = new fa.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.4 });

  // Descriptor por foto (o null si no hay cara / no cargó).
  const results = [];
  for (const it of items) {
    let descriptor = null;
    try {
      const img = await loadImage(imgProxyUrl(it.image_url));
      const det = await fa
        .detectSingleFace(img, opts)
        .withFaceLandmarks()
        .withFaceDescriptor();
      descriptor = det ? Array.from(det.descriptor) : null;
    } catch {
      descriptor = null;
    }
    results.push({ item: it, descriptor });
  }

  return clusterResults(results);
}
