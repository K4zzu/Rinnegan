import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// face-api es pesado y asíncrono: lo mockeamos con una promesa PENDIENTE para
// probar solo el render de las filas sin disparar un setState fuera de act()
// (eso mantiene el output de los tests limpio). El análisis queda en "loading".
vi.mock("../utils/faceCluster", () => ({
  analyzeFaces: vi.fn(() => new Promise(() => {})),
}));

import MediaGallery from "./MediaGallery";
import { analyzeFaces } from "../utils/faceCluster";

beforeEach(() => vi.clearAllMocks());

describe("MediaGallery", () => {
  it("renderiza una fila aparte de reverse-image cuando hay items origin='reverse'", () => {
    const items = [
      { source: "github", image_url: "http://x/a.jpg", origin: "profile" },
      { source: "instagram.com", image_url: "http://x/b.jpg", origin: "reverse", page_url: "http://insta/p" },
    ];
    render(<MediaGallery items={items} accentText="" />);
    expect(screen.getByText(/aparece también en/i)).toBeTruthy();
    expect(screen.getByText("github")).toBeTruthy();
    expect(screen.getByText("instagram.com")).toBeTruthy();
  });

  it("no muestra la fila reverse cuando no hay items reverse", () => {
    const items = [
      { source: "github", image_url: "http://x/a.jpg" },
      { source: "gitlab", image_url: "http://x/b.jpg" },
    ];
    render(<MediaGallery items={items} accentText="" />);
    expect(screen.queryByText(/aparece también en/i)).toBeNull();
  });

  it("corre el análisis facial sobre TODOS los items (perfil + reverse)", () => {
    const items = [
      { source: "github", image_url: "http://x/a.jpg" },
      { source: "insta", image_url: "http://x/b.jpg", origin: "reverse" },
    ];
    render(<MediaGallery items={items} accentText="" />);
    expect(analyzeFaces).toHaveBeenCalledWith(items);
  });
});
