import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useTerminal } from "./useTerminal";
import * as api from "../services/api";
import { setDescriptor, clearDescriptors } from "../utils/faceCache";

beforeEach(() => clearDescriptors());
afterEach(() => vi.restoreAllMocks());

describe("useTerminal · guardar caras", () => {
  it("al archivar, incluye faces con descriptor de la caché atadas a la raíz", async () => {
    // El descriptor de la foto ya está cacheado (lo haría MediaGallery).
    setDescriptor("http://x/a.jpg", [0.1, 0.2, 0.3]);

    vi.spyOn(api, "streamOsint").mockImplementation((cat, val, h) => {
      h.meta?.({});
      h.media?.({ items: [{ source: "github", image_url: "http://x/a.jpg", page_url: "http://gh/u" }] });
      h.done?.({ summary: { findings: 0, errors: 0, elapsed_ms: 1000 } });
      return { close: () => {} };
    });
    vi.spyOn(api, "saveVault").mockResolvedValue({ graph_id: 5 });

    const { result } = renderHook(() => useTerminal());
    await act(async () => {
      await result.current.handleCommand("osint user carlos"); // explícito → streamOsint
    });
    await act(async () => {
      await result.current.handleCommand("s"); // archivar
    });

    await waitFor(() => expect(api.saveVault).toHaveBeenCalled());
    const payload = api.saveVault.mock.calls[0][0];
    expect(payload.faces).toHaveLength(1);
    expect(payload.faces[0]).toMatchObject({
      node: payload.root,
      image_url: "http://x/a.jpg",
      descriptor: [0.1, 0.2, 0.3],
    });
  });
});
