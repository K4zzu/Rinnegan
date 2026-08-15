import { describe, it, expect } from "vitest";
import {
  createScanRecord,
  applyScanEvent,
  toSavePayload,
  parseSaveAnswer,
  buildFaces,
} from "./scanRecord";

describe("scanRecord", () => {
  it("acumula start/finding/media/ai/done en el registro", () => {
    let r = createScanRecord({ kind: "auto", query: "Carlos" });
    r = applyScanEvent(r, { scan: "start", kind: "name", query: "Carlos Sánchez" });
    r = applyScanEvent(r, {
      scan: "finding", provider: "ddg", source: "instagram",
      title: "@carlos", url: "https://instagram.com/carlos", confidence: "high",
    });
    r = applyScanEvent(r, {
      scan: "media", items: [{ source: "github", image_url: "http://x/a.jpg" }],
    });
    r = applyScanEvent(r, { scan: "ai", text: "## Resumen" });
    r = applyScanEvent(r, { scan: "done", findings: 1, errors: 0, elapsed: 7800 });

    expect(r.kind).toBe("name");
    expect(r.query).toBe("Carlos Sánchez");
    expect(r.findings).toHaveLength(1);
    expect(r.findings[0].source).toBe("instagram");
    expect(r.media).toHaveLength(1);
    expect(r.ai_report).toBe("## Resumen");
    expect(r.summary.elapsed).toBe(7800);
  });

  it("toSavePayload arma un nodo raíz con el scan referenciándolo", () => {
    let r = createScanRecord({ kind: "name", query: "Carlos" });
    r = applyScanEvent(r, { scan: "finding", provider: "p", source: "s", title: "t", url: null, confidence: "low" });
    r = applyScanEvent(r, { scan: "done", findings: 1, errors: 0, elapsed: 100 });
    const p = toSavePayload(r);

    expect(p.root).toBe("n0");
    expect(p.nodes).toHaveLength(1);
    expect(p.nodes[0]).toMatchObject({ id: "n0", kind: "name", value: "Carlos", label: "Carlos" });
    expect(p.edges).toEqual([]);
    expect(p.scans).toHaveLength(1);
    expect(p.scans[0]).toMatchObject({ node: "n0", query: "Carlos", elapsed_ms: 100 });
    expect(p.scans[0].findings).toHaveLength(1);
    expect(p.faces).toEqual([]);
  });

  it("coerciona el sentinel de display '?' a null en elapsed (no debe llegar al payload)", () => {
    let r = createScanRecord({ kind: "username", query: "carlos" });
    r = applyScanEvent(r, { scan: "done", findings: 1, errors: 0, elapsed: "?" });

    expect(r.summary.elapsed).toBeNull();
    expect(toSavePayload(r).scans[0].elapsed_ms).toBeNull();
  });

  it("mantiene el caso numérico existente (elapsed sigue siendo number)", () => {
    let r = createScanRecord({ kind: "username", query: "carlos" });
    r = applyScanEvent(r, { scan: "done", findings: 1, errors: 0, elapsed: 4321 });

    expect(r.summary.elapsed).toBe(4321);
    expect(toSavePayload(r).scans[0].elapsed_ms).toBe(4321);
  });

  it("parseSaveAnswer reconoce guardar/descartar/inválido", () => {
    expect(parseSaveAnswer("s")).toBe("save");
    expect(parseSaveAnswer("Sí")).toBe("save");
    expect(parseSaveAnswer("yes")).toBe("save");
    expect(parseSaveAnswer("n")).toBe("discard");
    expect(parseSaveAnswer("no")).toBe("discard");
    expect(parseSaveAnswer("hola")).toBe("invalid");
  });
});

describe("scanRecord · grafo", () => {
  it("acumula eventos node/edge en el registro", () => {
    let r = createScanRecord({ kind: "name", query: "Carlos" });
    r = applyScanEvent(r, { scan: "node", id: "n0", kind: "name", value: "Carlos", label: "Carlos", parent_id: null });
    r = applyScanEvent(r, { scan: "node", id: "n1", kind: "username", value: "carlos99", label: "carlos99", parent_id: "n0" });
    r = applyScanEvent(r, { scan: "edge", src: "n0", dst: "n1", relation: "pivot", confidence: 0.8 });
    expect(r.nodes).toHaveLength(2);
    expect(r.nodes[1]).toMatchObject({ id: "n1", kind: "username", parent_id: "n0" });
    expect(r.edges).toEqual([{ src: "n0", dst: "n1", relation: "pivot", confidence: 0.8 }]);
  });

  it("toSavePayload emite el grafo acumulado y ata el scan al nodo raíz (sin parent_id)", () => {
    let r = createScanRecord({ kind: "name", query: "Carlos" });
    r = applyScanEvent(r, { scan: "node", id: "n0", kind: "name", value: "Carlos", label: "Carlos", parent_id: null });
    r = applyScanEvent(r, { scan: "node", id: "n1", kind: "username", value: "carlos99", label: "carlos99", parent_id: "n0" });
    r = applyScanEvent(r, { scan: "edge", src: "n0", dst: "n1", relation: "pivot", confidence: 0.8 });
    r = applyScanEvent(r, { scan: "finding", provider: "ddg", source: "instagram", title: "@carlos", url: null, confidence: "high" });
    r = applyScanEvent(r, { scan: "done", findings: 1, errors: 0, elapsed: 5000 });
    const p = toSavePayload(r);
    expect(p.root).toBe("n0");
    expect(p.nodes.map((n) => n.id)).toEqual(["n0", "n1"]);
    expect(p.edges).toHaveLength(1);
    expect(p.scans).toHaveLength(1);
    expect(p.scans[0].node).toBe("n0");
    expect(p.scans[0].findings).toHaveLength(1);
    expect(p.scans[0].elapsed_ms).toBe(5000);
  });

  it("sin eventos de grafo, cae al nodo sintético n0 (compat Fase 1)", () => {
    let r = createScanRecord({ kind: "username", query: "carlos99" });
    r = applyScanEvent(r, { scan: "done", findings: 0, errors: 0, elapsed: 100 });
    const p = toSavePayload(r);
    expect(p.root).toBe("n0");
    expect(p.nodes).toEqual([{ id: "n0", kind: "username", value: "carlos99", label: "carlos99" }]);
    expect(p.edges).toEqual([]);
    expect(p.scans[0].node).toBe("n0");
  });
});

describe("buildFaces", () => {
  it("arma faces solo para media con descriptor cacheado, atadas al nodo", () => {
    const media = [
      { source: "github", image_url: "http://x/a.jpg", page_url: "http://gh/u" },
      { source: "insta", image_url: "http://x/b.jpg" }, // sin descriptor
    ];
    const cache = { "http://x/a.jpg": [0.1, 0.2, 0.3] };
    const get = (url) => cache[url] || null;
    const faces = buildFaces(media, "n0", get);
    expect(faces).toHaveLength(1);
    expect(faces[0]).toEqual({
      node: "n0",
      source: "github",
      image_url: "http://x/a.jpg",
      page_url: "http://gh/u",
      descriptor: [0.1, 0.2, 0.3],
    });
  });

  it("devuelve [] si no hay media o ninguna tiene descriptor", () => {
    expect(buildFaces([], "n0", () => null)).toEqual([]);
    expect(buildFaces([{ source: "x", image_url: "u" }], "n0", () => null)).toEqual([]);
  });

  it("excluye media con origin:'reverse' aunque tenga descriptor cacheado (no persiste caras de terceros)", () => {
    const media = [
      { source: "github", image_url: "http://x/a.jpg", page_url: "http://gh/u" },
      { source: "google", image_url: "http://x/stranger.jpg", origin: "reverse" },
    ];
    const cache = {
      "http://x/a.jpg": [0.1, 0.2, 0.3],
      "http://x/stranger.jpg": [0.9, 0.8, 0.7],
    };
    const get = (url) => cache[url] || null;
    const faces = buildFaces(media, "n0", get);
    expect(faces).toHaveLength(1);
    expect(faces[0].image_url).toBe("http://x/a.jpg");
    expect(faces.some((f) => f.image_url === "http://x/stranger.jpg")).toBe(false);
  });
});
