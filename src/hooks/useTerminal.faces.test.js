import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useTerminal } from "./useTerminal";
import * as api from "../services/api";
import { setDescriptor, clearDescriptors } from "../utils/faceCache";
import { analyzeFaces } from "../utils/faceCluster";

vi.mock("../utils/faceCluster", () => ({
  analyzeFaces: vi.fn().mockResolvedValue({}),
}));

beforeEach(() => {
  clearDescriptors();
  analyzeFaces.mockClear();
});
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
    // Con descriptor ya cacheado, pending está vacío: no hace falta re-analizar.
    expect(analyzeFaces).not.toHaveBeenCalled();
  });

  it("si el usuario archiva antes de que MediaGallery termine el análisis (race), calcula el descriptor faltante al guardar", async () => {
    // Nada precacheado: simula que analyzeFaces de MediaGallery aún no corrió.
    analyzeFaces.mockImplementation(async (items) => {
      for (const it of items) setDescriptor(it.image_url, [0.4, 0.5, 0.6]);
      return {};
    });

    vi.spyOn(api, "streamOsint").mockImplementation((cat, val, h) => {
      h.meta?.({});
      h.media?.({ items: [{ source: "github", image_url: "http://x/pending.jpg", page_url: "http://gh/u" }] });
      h.done?.({ summary: { findings: 0, errors: 0, elapsed_ms: 1000 } });
      return { close: () => {} };
    });
    vi.spyOn(api, "saveVault").mockResolvedValue({ graph_id: 6 });

    const { result } = renderHook(() => useTerminal());
    await act(async () => {
      await result.current.handleCommand("osint user carlos");
    });
    await act(async () => {
      await result.current.handleCommand("s");
    });

    await waitFor(() => expect(api.saveVault).toHaveBeenCalled());
    expect(analyzeFaces).toHaveBeenCalledTimes(1);
    const analyzedItems = analyzeFaces.mock.calls[0][0];
    expect(analyzedItems.map((it) => it.image_url)).toEqual(["http://x/pending.jpg"]);

    const payload = api.saveVault.mock.calls[0][0];
    expect(payload.faces).toHaveLength(1);
    expect(payload.faces[0]).toMatchObject({
      node: payload.root,
      image_url: "http://x/pending.jpg",
      descriptor: [0.4, 0.5, 0.6],
    });
  });
});
