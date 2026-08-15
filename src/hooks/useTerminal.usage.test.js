import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useTerminal } from "./useTerminal";
import * as api from "../services/api";

afterEach(() => vi.restoreAllMocks());

describe("useTerminal · cuotas y costo", () => {
  it("el comando 'cuotas' consulta /usage y empuja una entrada 'usage'", async () => {
    vi.spyOn(api, "getUsage").mockResolvedValue({
      period: "month",
      providers: [{ name: "serpapi", used: 3, limit: 100, unit: "búsquedas" }],
      total_cost_usd: 0.1,
    });
    const { result } = renderHook(() => useTerminal());
    await act(async () => {
      await result.current.handleCommand("cuotas");
    });
    await waitFor(() => {
      const usage = result.current.history.find((e) => e.type === "usage");
      expect(usage).toBeTruthy();
      expect(usage.data.providers[0].name).toBe("serpapi");
    });
    expect(api.getUsage).toHaveBeenCalled();
  });

  it("el done del escaneo propaga cost al historial", async () => {
    vi.spyOn(api, "streamOsint").mockImplementation((cat, val, h) => {
      h.meta?.({});
      h.done?.({
        summary: { findings: 0, errors: 0, elapsed_ms: 1000 },
        cost: { usd: 0.01, breakdown: [{ provider: "serpapi", units: 5, usd: 0.01 }] },
      });
      return { close: () => {} };
    });
    const { result } = renderHook(() => useTerminal());
    await act(async () => {
      await result.current.handleCommand("osint user carlos");
    });
    await waitFor(() => {
      const done = result.current.history.find((e) => e.type === "scan" && e.scan === "done");
      expect(done).toBeTruthy();
      expect(done.cost.usd).toBe(0.01);
    });
  });
});
