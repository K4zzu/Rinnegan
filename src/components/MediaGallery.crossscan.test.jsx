import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

// analyzeFaces resuelto (análisis terminado) para disparar el efecto de match.
vi.mock("../utils/faceCluster", () => ({
  analyzeFaces: vi.fn(() =>
    Promise.resolve({ probability: 0, dominantCount: 0, facesFound: 0, totalPhotos: 1, annotated: [] })
  ),
}));
vi.mock("../utils/faceCache", () => ({
  getDescriptor: vi.fn(() => [0.1, 0.2, 0.3]),
}));
vi.mock("../services/api", () => ({
  facesMatch: vi.fn(() =>
    Promise.resolve({ matches: [{ node_id: 7, label: "Carlos Sánchez", probability: 84, distance: 0.4 }] })
  ),
}));

import MediaGallery from "./MediaGallery";
import { facesMatch } from "../services/api";

beforeEach(() => vi.clearAllMocks());

describe("MediaGallery · cross-scan", () => {
  it("muestra 'visto antes' cuando una cara coincide con la bóveda", async () => {
    const items = [
      { source: "github", image_url: "http://x/a.jpg" },
      { source: "gitlab", image_url: "http://x/b.jpg" },
    ];
    render(<MediaGallery items={items} accentText="" />);
    await waitFor(() => {
      expect(facesMatch).toHaveBeenCalled();
      expect(screen.getAllByText(/visto antes/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Carlos Sánchez/).length).toBeGreaterThan(0);
    });
  });
});
