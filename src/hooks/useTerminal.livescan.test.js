import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useTerminal } from "./useTerminal";
import * as api from "../services/api";

afterEach(() => vi.restoreAllMocks());

describe("useTerminal · liveScan", () => {
  it("acumula estado en vivo durante el escaneo y vuelve a idle en done", async () => {
    vi.spyOn(api, "streamOsint").mockImplementation((cat, val, h) => {
      h.meta?.({ providers: ["maigret"] });
      h.finding?.({ provider: "maigret", source: "github", title: "gh", confidence: "high" });
      h.finding?.({ provider: "ddg", source: "web", title: "w", confidence: "low" });
      h.media?.({ items: [{ source: "github", image_url: "http://x/a.jpg" }] });
      h.done?.({ summary: { findings: 2, errors: 0, elapsed_ms: 1000 } });
      return { close: () => {} };
    });
    const { result } = renderHook(() => useTerminal());
    await act(async () => {
      await result.current.handleCommand("osint user carlos");
    });
    await waitFor(() => {
      expect(result.current.liveScan.status).toBe("idle"); // done → idle
    });
    // durante el escaneo se acumuló (validamos el conteo/proveedores capturados)
    expect(result.current.liveScan.findings).toBe(2);
    expect(result.current.liveScan.providers).toContain("maigret");
    expect(result.current.liveScan.media.length).toBeGreaterThan(0);
  });
});
