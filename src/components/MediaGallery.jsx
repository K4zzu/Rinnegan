// src/components/MediaGallery.jsx
// Galería de imágenes de un escaneo OSINT + análisis facial en el navegador.
// Separa fotos de perfil de matches de reverse-image ("aparece también en…"),
// corre el análisis facial (face-api.js, lazy) sobre TODAS las fotos, y además
// consulta la bóveda (POST /faces/match) por cada cara para avisar si esa
// persona ya apareció en un escaneo guardado ("visto antes").
import { useEffect, useState } from "react";
import { analyzeFaces } from "../utils/faceCluster";
import { getDescriptor } from "../utils/faceCache";
import { facesMatch } from "../services/api";

const CONFIDENCE = {
  high: { color: "#34d399" },
  medium: { color: "#fbbf24" },
  low: { color: "#94a3b8" },
};

function Thumbnail({ it, annotation: a, match }) {
  const c = CONFIDENCE[it.confidence] || CONFIDENCE.low;
  const borderColor = match ? "#f59e0b" : a?.inDominant ? "#34d399" : c.color;
  return (
    <div className="relative flex w-16 flex-col items-center gap-1" data-thumb>
      <a
        href={it.page_url || it.image_url}
        target="_blank"
        rel="noreferrer"
        className="relative"
        title={it.title || it.source}
      >
        <img
          src={it.image_url}
          alt={it.title || it.source}
          loading="lazy"
          onError={(e) => {
            const card = e.currentTarget.closest("[data-thumb]");
            if (card) card.style.display = "none";
          }}
          className="h-14 w-14 rounded object-cover border-2 hover:opacity-80"
          style={{ borderColor }}
        />
        {a ? (
          <span
            className="absolute top-0 right-0 rounded-bl px-1 text-[0.5rem] font-bold leading-tight"
            style={{
              backgroundColor: a.inDominant
                ? "rgba(16,185,129,0.85)"
                : a.hasFace
                ? "rgba(148,163,184,0.75)"
                : "rgba(0,0,0,0.6)",
              color: "#000",
            }}
            title={
              a.inDominant
                ? "coincide con la cara que más se repite"
                : a.hasFace
                ? "otra cara"
                : "sin rostro detectado"
            }
          >
            {a.inDominant ? "✓" : a.hasFace ? "≠" : "∅"}
          </span>
        ) : null}
      </a>
      <span className="max-w-full truncate text-[0.5rem] uppercase tracking-wide text-white/60">
        {it.source}
      </span>
      {match ? (
        <span
          className="max-w-full truncate text-[0.5rem] font-semibold text-amber-300"
          title={`ya apareció investigando a ${match.label}`}
        >
          ⚠ visto antes · {match.label} {match.probability}%
        </span>
      ) : null}
    </div>
  );
}

export default function MediaGallery({ items, accentText }) {
  const [face, setFace] = useState(() =>
    items && items.length >= 2 ? { status: "loading" } : { status: "idle" }
  );
  // Coincidencias cross-scan por índice de item: { [i]: match }.
  const [matches, setMatches] = useState({});

  useEffect(() => {
    if (!items || items.length < 2) return;
    let cancelled = false;
    analyzeFaces(items)
      .then((res) => !cancelled && setFace({ status: "done", res }))
      .catch(() => !cancelled && setFace({ status: "error" }));
    return () => {
      cancelled = true;
    };
  }, [items]);

  // Cuando el análisis terminó, los descriptores ya están en caché: consulta
  // la bóveda por cada cara y guarda la mejor coincidencia por item.
  useEffect(() => {
    if (face.status !== "done" || !items) return;
    let cancelled = false;
    (async () => {
      const found = {};
      for (let i = 0; i < items.length; i++) {
        const d = getDescriptor(items[i].image_url);
        if (!d) continue;
        try {
          const res = await facesMatch(d);
          const m = res?.matches?.[0];
          if (m) found[i] = m;
        } catch {
          // silencioso: la alerta cross-scan es best-effort.
        }
      }
      if (!cancelled) setMatches(found);
    })();
    return () => {
      cancelled = true;
    };
  }, [face.status, items]);

  const annotated = face.status === "done" ? face.res.annotated : null;
  const withMeta = items.map((it, i) => ({ it, i, a: annotated?.[i] }));
  const profile = withMeta.filter(({ it }) => it.origin !== "reverse");
  const reverse = withMeta.filter(({ it }) => it.origin === "reverse");

  return (
    <div className="ai-reveal my-2 rounded-md border border-white/10 bg-white/[0.02] p-3">
      <div className={`flex items-center gap-2 text-[0.7rem] uppercase tracking-widest mb-2 ${accentText}`}>
        <span>◲</span>
        <span>Medios · imágenes</span>
        <span className="flex-1 h-px bg-current/20" />
      </div>

      <div className="flex flex-wrap gap-3">
        {profile.map(({ it, i, a }) => (
          <Thumbnail key={i} it={it} annotation={a} match={matches[i]} />
        ))}
      </div>

      {reverse.length ? (
        <>
          <div className={`flex items-center gap-2 text-[0.65rem] uppercase tracking-widest mt-3 mb-2 ${accentText}`}>
            <span>⇲</span>
            <span>Aparece también en…</span>
            <span className="flex-1 h-px bg-current/20" />
          </div>
          <div className="flex flex-wrap gap-3">
            {reverse.map(({ it, i, a }) => (
              <Thumbnail key={i} it={it} annotation={a} match={matches[i]} />
            ))}
          </div>
        </>
      ) : null}

      <FaceSummary face={face} count={items.length} />
    </div>
  );
}

function FaceSummary({ face, count }) {
  if (count < 2) return null;

  if (face.status === "loading")
    return (
      <div className="mt-2 flex items-center gap-2 text-[0.7rem] text-[#ff004d]/70">
        <span className="animate-pulse">◉</span> analizando rostros…
      </div>
    );

  if (face.status === "error")
    return (
      <div className="mt-2 text-[0.7rem] text-white/40">
        — análisis facial no disponible en este navegador.
      </div>
    );

  if (face.status !== "done") return null;

  const { probability, dominantCount, facesFound, totalPhotos } = face.res;

  if (facesFound < 2)
    return (
      <div className="mt-2 text-[0.7rem] text-white/40">
        — rostros insuficientes para comparar ({facesFound} de {totalPhotos} con
        cara detectable).
      </div>
    );

  return (
    <div className="mt-2 text-[0.72rem] leading-relaxed">
      <span className="text-[#ff004d]">◉ análisis facial · </span>
      <span className="text-emerald-300 font-semibold">{dominantCount}</span>
      <span className="text-white/70"> de {facesFound} fotos con cara son la misma persona → </span>
      <span className="font-bold text-emerald-300">{probability}%</span>
      <span className="text-white/70"> de coincidencia.</span>
      <div className="text-white/35 mt-px">
        — consistencia de la cara recurrente entre perfiles, no identidad verificada.
      </div>
    </div>
  );
}
