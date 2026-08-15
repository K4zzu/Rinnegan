// src/services/api.test.js
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { whoami, streamOsint, streamOsintGraph, saveVault, getVaultGraph, deleteVaultNode } from "./api";

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

// EventSource falso: captura la URL, permite emitir eventos y registra close().
class FakeEventSource {
  constructor(url) {
    this.url = url;
    this.listeners = {};
    this.closed = false;
    this.onerror = null;
    FakeEventSource.last = this;
  }
  addEventListener(name, cb) {
    (this.listeners[name] ||= []).push(cb);
  }
  emit(name, data) {
    (this.listeners[name] || []).forEach((cb) => cb({ data }));
  }
  close() {
    this.closed = true;
  }
}

describe("whoami", () => {
  it("devuelve el JSON del backend en éxito", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ip: "1.2.3.4", geo: { country: "CO" } }),
      })
    );

    const result = await whoami();
    expect(result).toEqual({ ip: "1.2.3.4", geo: { country: "CO" } });
    expect(vi.mocked(fetch).mock.calls[0][0]).toContain("/whoami");
  });

  it("lanza error con el status cuando la respuesta no es ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        text: async () => "down",
      })
    );

    await expect(whoami()).rejects.toThrow("HTTP 503");
  });
});

describe("streamOsint", () => {
  beforeEach(() => {
    vi.stubGlobal("EventSource", FakeEventSource);
  });

  it("construye la URL con categoría y value", () => {
    streamOsint("domain", "example.com", {});
    expect(FakeEventSource.last.url).toContain("/osint/domain/stream");
    expect(FakeEventSource.last.url).toContain("value=example.com");
  });

  it("parsea el JSON y despacha cada evento a su handler", () => {
    const finding = vi.fn();
    const done = vi.fn();
    streamOsint("ip", "8.8.8.8", { finding, done });

    FakeEventSource.last.emit(
      "finding",
      JSON.stringify({ provider: "dns", source: "A", title: "1.1.1.1" })
    );
    FakeEventSource.last.emit("done", JSON.stringify({ summary: { findings: 1 } }));

    expect(finding).toHaveBeenCalledWith({
      provider: "dns",
      source: "A",
      title: "1.1.1.1",
    });
    expect(done).toHaveBeenCalledWith({ summary: { findings: 1 } });
  });

  it("cierra el stream cuando llega 'done'", () => {
    streamOsint("ip", "8.8.8.8", {});
    FakeEventSource.last.emit("done", JSON.stringify({ summary: {} }));
    expect(FakeEventSource.last.closed).toBe(true);
  });

  it("invoca el handler de error ante fallo de conexión", () => {
    const error = vi.fn();
    streamOsint("ip", "8.8.8.8", { error });
    FakeEventSource.last.onerror();
    expect(error).toHaveBeenCalled();
    expect(FakeEventSource.last.closed).toBe(true);
  });

  it("no reporta error si el fallo llega después de 'done'", () => {
    const error = vi.fn();
    streamOsint("ip", "8.8.8.8", { error });
    FakeEventSource.last.emit("done", JSON.stringify({ summary: {} }));
    FakeEventSource.last.onerror(); // el server cerró tras done
    expect(error).not.toHaveBeenCalled();
  });

  it("close() detiene el stream", () => {
    const control = streamOsint("ip", "8.8.8.8", {});
    control.close();
    expect(FakeEventSource.last.closed).toBe(true);
  });
});

describe("streamOsintGraph", () => {
  beforeEach(() => {
    vi.stubGlobal("EventSource", FakeEventSource);
  });

  it("abre /osint/graph/stream con value y kind, y despacha node/edge", () => {
    const node = vi.fn();
    const edge = vi.fn();
    streamOsintGraph("Carlos", "name", { node, edge });
    expect(FakeEventSource.last.url).toContain("/osint/graph/stream");
    expect(FakeEventSource.last.url).toContain("value=Carlos");
    expect(FakeEventSource.last.url).toContain("kind=name");

    FakeEventSource.last.emit("node", JSON.stringify({ id: "n0", kind: "name", value: "Carlos", parent_id: null }));
    FakeEventSource.last.emit("edge", JSON.stringify({ src: "n0", dst: "n1", relation: "pivot" }));
    expect(node).toHaveBeenCalledWith({ id: "n0", kind: "name", value: "Carlos", parent_id: null });
    expect(edge).toHaveBeenCalledWith({ src: "n0", dst: "n1", relation: "pivot" });
  });
});

describe("vault client", () => {
  it("saveVault hace POST a /vault/save con el payload", async () => {
    const payload = { root: "n0", nodes: [], edges: [], scans: [], faces: [] };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ graph_id: 7 }) })
    );
    const res = await saveVault(payload);
    expect(res).toEqual({ graph_id: 7 });
    const [url, opts] = vi.mocked(fetch).mock.calls[0];
    expect(url).toContain("/vault/save");
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body)).toEqual(payload);
  });

  it("getVaultGraph hace GET a /vault/graph", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ nodes: [], edges: [] }) })
    );
    const res = await getVaultGraph();
    expect(res).toEqual({ nodes: [], edges: [] });
    expect(vi.mocked(fetch).mock.calls[0][0]).toContain("/vault/graph");
  });

  it("deleteVaultNode hace DELETE a /vault/node/{id}", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 204 })
    );
    const res = await deleteVaultNode(42);
    expect(res).toBeNull();
    const [url, opts] = vi.mocked(fetch).mock.calls[0];
    expect(url).toContain("/vault/node/42");
    expect(opts.method).toBe("DELETE");
  });
});
