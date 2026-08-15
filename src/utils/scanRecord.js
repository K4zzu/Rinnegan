// src/utils/scanRecord.js
// Acumula los eventos de un escaneo en un registro y lo convierte en el payload
// de /vault/save. Lógica pura y testeable (el hook solo la cablea).

export function createScanRecord({ kind, query } = {}) {
  return {
    kind: kind || "auto",
    query: query || "",
    findings: [],
    media: [],
    nodes: [],
    edges: [],
    ai_report: null,
    summary: null,
  };
}

// `entry` es la misma entrada {type:"scan", scan, …} que va al historial.
export function applyScanEvent(record, entry) {
  switch (entry?.scan) {
    case "start":
      return {
        ...record,
        kind: entry.kind ?? record.kind,
        query: entry.query ?? record.query,
      };
    case "finding":
      return {
        ...record,
        findings: [
          ...record.findings,
          {
            provider: entry.provider,
            source: entry.source,
            title: entry.title,
            url: entry.url ?? null,
            confidence: entry.confidence ?? "low",
          },
        ],
      };
    case "media":
      return { ...record, media: [...record.media, ...(entry.items || [])] };
    case "ai":
      return { ...record, ai_report: entry.text ?? record.ai_report };
    case "done":
      return {
        ...record,
        summary: {
          findings: entry.findings ?? 0,
          errors: entry.errors ?? 0,
          elapsed: typeof entry.elapsed === "number" ? entry.elapsed : null,
        },
      };
    case "node":
      return {
        ...record,
        nodes: [
          ...record.nodes,
          {
            id: entry.id,
            kind: entry.kind,
            value: entry.value,
            label: entry.label,
            parent_id: entry.parent_id ?? null,
          },
        ],
      };
    case "edge":
      return {
        ...record,
        edges: [
          ...record.edges,
          {
            src: entry.src,
            dst: entry.dst,
            relation: entry.relation,
            confidence: entry.confidence ?? null,
          },
        ],
      };
    default:
      return record;
  }
}

export function toSavePayload(record) {
  const scan = {
    query: record.query,
    findings: record.findings,
    media: record.media,
    ai_report: record.ai_report,
    elapsed_ms: record.summary?.elapsed ?? null,
  };

  if (record.nodes.length) {
    const root =
      record.nodes.find((n) => !n.parent_id) || record.nodes[0];
    return {
      root: root.id,
      nodes: record.nodes.map((n) => ({
        id: n.id,
        kind: n.kind,
        value: n.value,
        label: n.label,
      })),
      edges: record.edges.map((e) => ({
        src: e.src,
        dst: e.dst,
        relation: e.relation,
        confidence: e.confidence,
      })),
      scans: [{ node: root.id, ...scan }],
      faces: [],
    };
  }

  // Fallback (compat Fase 1): un solo nodo sintético raíz.
  const rootId = "n0";
  return {
    root: rootId,
    nodes: [
      { id: rootId, kind: record.kind, value: record.query, label: record.query },
    ],
    edges: [],
    scans: [{ node: rootId, ...scan }],
    faces: [],
  };
}

const SAVE_WORDS = ["s", "si", "sí", "y", "yes", "guardar"];
const DISCARD_WORDS = ["n", "no", "descartar"];

export function parseSaveAnswer(input) {
  const a = (input || "").trim().toLowerCase();
  if (SAVE_WORDS.includes(a)) return "save";
  if (DISCARD_WORDS.includes(a)) return "discard";
  return "invalid";
}
