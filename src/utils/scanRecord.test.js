import { describe, it, expect } from "vitest";
import {
  createScanRecord,
  applyScanEvent,
  toSavePayload,
  parseSaveAnswer,
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
