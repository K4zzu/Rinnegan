import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useTerminal } from "./useTerminal";
import * as api from "../services/api";

afterEach(() => vi.restoreAllMocks());

describe("useTerminal · investigate", () => {
  it("el comando 'investigar' abre streamInvestigate y renderiza reasoning + dossier", async () => {
    vi.spyOn(api, "streamInvestigate").mockImplementation((seed, hint, h) => {
      h.meta?.({});
      h.reasoning?.({ step: 1, thought: "busco la rectora", action: "web_search" });
      h.dossier?.({ identity: { name: "Thiago Navarro", confidence: 0.8 }, family: [], accounts: [], photos: [] });
      h.done?.({ summary: { findings: 3, errors: 0, elapsed_ms: 5000 }, cost: { usd: 0.02, breakdown: [] } });
      return { close: () => {} };
    });
    const { result } = renderHook(() => useTerminal());
    await act(async () => {
      await result.current.handleCommand("investigar Thiago Navarro · hijo de rectora");
    });
    await waitFor(() => {
      const reasoning = result.current.history.find((e) => e.scan === "reasoning");
      const dossier = result.current.history.find((e) => e.type === "dossier");
      expect(reasoning).toBeTruthy();
      expect(dossier.data.identity.name).toBe("Thiago Navarro");
    });
    const [seed, hint] = api.streamInvestigate.mock.calls[0];
    expect(seed).toBe("Thiago Navarro");
    expect(hint).toBe("hijo de rectora");
  });

  it("un evento candidate empuja una entrada 'candidates' y NO pide guardar", async () => {
    vi.spyOn(api, "streamInvestigate").mockImplementation((seed, hint, h) => {
      h.candidate?.({ candidates: [{ id: "c1", name: "A" }, { id: "c2", name: "B" }] });
      h.done?.({ summary: {}, cost: null });
      return { close: () => {} };
    });
    const { result } = renderHook(() => useTerminal());
    await act(async () => {
      await result.current.handleCommand("investigar Ana");
    });
    await waitFor(() => {
      expect(result.current.history.find((e) => e.type === "candidates")).toBeTruthy();
    });
    // sin prompt de guardado tras candidate
    expect(result.current.history.find((e) => e.text === "◈ ¿archivar en la bóveda? [s/n]")).toBeFalsy();
  });
});
