import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useTerminal } from "./useTerminal";
import * as api from "../services/api";

afterEach(() => vi.restoreAllMocks());

describe("useTerminal · bóveda", () => {
  it("el comando 'boveda' consulta el grafo y lo empuja al historial", async () => {
    vi.spyOn(api, "getVaultGraph").mockResolvedValue({
      nodes: [{ id: 1, kind: "name", value: "Carlos", label: "Carlos", scan_count: 2 }],
      edges: [],
    });
    const { result } = renderHook(() => useTerminal());

    await act(async () => {
      await result.current.handleCommand("boveda");
    });

    await waitFor(() => {
      const vault = result.current.history.find((e) => e.type === "vault");
      expect(vault).toBeTruthy();
      expect(vault.data.nodes[0].value).toBe("Carlos");
    });
    expect(api.getVaultGraph).toHaveBeenCalled();
  });

  it("al terminar un escaneo y responder 's', guarda el registro vía saveVault(toSavePayload(...))", async () => {
    vi.spyOn(api, "streamOsint").mockImplementation((category, value, handlers) => {
      handlers.meta?.({});
      handlers.finding?.({
        provider: "maigret",
        source: "github",
        title: "gh",
        data: { url: "https://github.com/carlos" },
        confidence: "high",
      });
      handlers.done?.({ summary: { findings: 1, errors: 0, elapsed_ms: 1234 } });
      return { close: () => {} };
    });
    vi.spyOn(api, "saveVault").mockResolvedValue({ graph_id: 1 });

    const { result } = renderHook(() => useTerminal());

    await act(async () => {
      await result.current.handleCommand("osint user carlos");
    });

    await waitFor(() => {
      const prompt = result.current.history.find(
        (e) => e.type === "output" && e.text.includes("¿archivar en la bóveda?")
      );
      expect(prompt).toBeTruthy();
    });

    await act(async () => {
      await result.current.handleCommand("s");
    });

    await waitFor(() => {
      expect(api.saveVault).toHaveBeenCalledTimes(1);
    });

    const payload = api.saveVault.mock.calls[0][0];
    expect(payload.nodes[0].value).toBe("carlos");
    expect(payload.scans[0].node).toBe("n0");
    expect(payload.scans[0].findings).toHaveLength(1);
    expect(payload.scans[0].elapsed_ms).toBe(1234);

    await waitFor(() => {
      const done = result.current.history.find(
        (e) => e.type === "output" && e.text.includes("✓ archivado")
      );
      expect(done).toBeTruthy();
    });
  });
});
