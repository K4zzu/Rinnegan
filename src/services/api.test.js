// src/services/api.test.js
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { whoami, streamOsint } from "./api";

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

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
