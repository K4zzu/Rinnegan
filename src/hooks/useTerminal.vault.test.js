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
});
