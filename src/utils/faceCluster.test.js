// src/utils/faceCluster.test.js
import { describe, it, expect } from "vitest";
import { clusterResults } from "./faceCluster";

// Descriptores sintéticos: dimensión pequeña, pero la lógica es idéntica.
// "Misma persona" = puntos casi idénticos; "otra persona" = lejos (> umbral).
const A = [0, 0, 0];
const A2 = [0.05, 0.02, 0.01]; // cerca de A → mismo cluster
const A3 = [0.03, 0.04, 0.0]; // cerca de A → mismo cluster
const B = [5, 5, 5]; // lejos → otro cluster

const item = (source) => ({ source, image_url: `http://x/${source}.jpg` });

describe("clusterResults", () => {
  it("agrupa fotos de la misma persona y calcula 100% si todas coinciden", () => {
    const res = clusterResults([
      { item: item("github"), descriptor: A },
      { item: item("twitter"), descriptor: A2 },
      { item: item("instagram"), descriptor: A3 },
    ]);
    expect(res.facesFound).toBe(3);
    expect(res.dominantCount).toBe(3);
    expect(res.probability).toBe(100);
    expect(res.annotated.every((a) => a.inDominant)).toBe(true);
  });

  it("separa a un intruso: 3 de 4 caras → 75% y el intruso queda fuera", () => {
    const res = clusterResults([
      { item: item("github"), descriptor: A },
      { item: item("twitter"), descriptor: A2 },
      { item: item("otro"), descriptor: B },
      { item: item("instagram"), descriptor: A3 },
    ]);
    expect(res.facesFound).toBe(4);
    expect(res.dominantCount).toBe(3);
    expect(res.probability).toBe(75);
    const intruso = res.annotated.find((a) => a.source === "otro");
    expect(intruso.inDominant).toBe(false);
    expect(intruso.hasFace).toBe(true);
  });

  it("marca fotos sin rostro (descriptor null) como hasFace:false y las ignora en el %", () => {
    const res = clusterResults([
      { item: item("github"), descriptor: A },
      { item: item("twitter"), descriptor: A2 },
      { item: item("paisaje"), descriptor: null },
    ]);
    expect(res.totalPhotos).toBe(3);
    expect(res.facesFound).toBe(2);
    expect(res.dominantCount).toBe(2);
    expect(res.probability).toBe(100);
    const sinRostro = res.annotated.find((a) => a.source === "paisaje");
    expect(sinRostro.hasFace).toBe(false);
    expect(sinRostro.inDominant).toBe(false);
  });

  it("sin rostros detectables → 0% y sin cluster dominante", () => {
    const res = clusterResults([
      { item: item("a"), descriptor: null },
      { item: item("b"), descriptor: null },
    ]);
    expect(res.facesFound).toBe(0);
    expect(res.dominantCount).toBe(0);
    expect(res.probability).toBe(0);
  });

  it("preserva el orden original en las anotaciones", () => {
    const res = clusterResults([
      { item: item("uno"), descriptor: A },
      { item: item("dos"), descriptor: B },
      { item: item("tres"), descriptor: A2 },
    ]);
    expect(res.annotated.map((a) => a.source)).toEqual(["uno", "dos", "tres"]);
  });
});
