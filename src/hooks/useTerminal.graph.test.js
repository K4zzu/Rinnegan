import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useTerminal } from "./useTerminal";
import * as api from "../services/api";

afterEach(() => vi.restoreAllMocks());

describe("useTerminal · grafo", () => {
  it("un escaneo auto/NL usa streamOsintGraph y, al done, empuja una entrada 'graph'", async () => {
    vi.spyOn(api, "streamOsintGraph").mockImplementation((value, kind, h) => {
      h.meta?.({});
      h.node?.({ id: "n0", kind: "name", value: "Carlos", label: "Carlos", parent_id: null });
      h.node?.({ id: "n1", kind: "username", value: "carlos99", label: "carlos99", parent_id: "n0" });
      h.edge?.({ src: "n0", dst: "n1", relation: "pivot", confidence: 0.8 });
      h.done?.({ summary: { findings: 0, errors: 0, elapsed_ms: 1000 } });
      return { close: () => {} };
    });

    const { result } = renderHook(() => useTerminal());
    await act(async () => {
      await result.current.handleCommand("osint carlos"); // AUTO → graph stream
    });

    await waitFor(() => {
      const graph = result.current.history.find((e) => e.type === "graph");
      expect(graph).toBeTruthy();
      expect(graph.data.nodes).toHaveLength(2);
      expect(graph.data.edges).toHaveLength(1);
    });
    expect(api.streamOsintGraph).toHaveBeenCalled();
  });
});
