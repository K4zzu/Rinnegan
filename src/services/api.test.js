// src/services/api.test.js
import { describe, it, expect, vi, afterEach } from "vitest";
import { osintLookupIp } from "./api";

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("api request", () => {
  it("hace fetch a la ruta correcta con el value como query param", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ip: "8.8.8.8", ok: true }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await osintLookupIp("8.8.8.8");

    expect(result).toEqual({ ip: "8.8.8.8", ok: true });
    const calledUrl = fetchMock.mock.calls[0][0];
    expect(calledUrl).toContain("/osint/ip");
    expect(calledUrl).toContain("value=8.8.8.8");
  });

  it("lanza error con el status cuando la respuesta no es ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => "boom",
      })
    );

    await expect(osintLookupIp("1.1.1.1")).rejects.toThrow("HTTP 500");
  });

  it("envuelve los errores de red en un mensaje legible", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("connection refused")));

    await expect(osintLookupIp("1.1.1.1")).rejects.toThrow("Error de red");
  });

  it("aborta y lanza error de timeout si el backend no responde a tiempo", async () => {
    vi.useFakeTimers();

    // fetch que solo rechaza cuando se aborta la señal.
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url, opts) =>
          new Promise((_resolve, reject) => {
            opts.signal.addEventListener("abort", () => {
              reject(new DOMException("aborted", "AbortError"));
            });
          })
      )
    );

    const promise = osintLookupIp("1.1.1.1");
    // Adjuntamos la aserción antes de avanzar el reloj para que la
    // rejection ya esté "siendo esperada" y no se marque como no manejada.
    const assertion = expect(promise).rejects.toThrow("Tiempo de espera agotado");
    // Adelantamos el reloj para disparar el setTimeout que aborta.
    await vi.advanceTimersByTimeAsync(10_000);
    await assertion;
  });
});
