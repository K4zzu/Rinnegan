import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import DossierView from "./DossierView";

describe("DossierView", () => {
  it("muestra identidad, ocupación, cuentas y familia", () => {
    const data = {
      identity: { name: "Thiago Navarro", confidence: 0.82, verified_by: "http://u/x" },
      occupation: "Estudiante",
      personal_info: ["Vive en Bogotá"],
      accounts: [{ platform: "instagram", url: "http://ig/t", handle: "thiago" }],
      photos: [{ image_url: "http://x/a.jpg", source: "instagram" }],
      family: [{ name: "María Navarro", relation: "madre", note: "rectora de X", url: "http://u/m" }],
      sources: ["http://u/x"],
      note: "completo",
    };
    render(<DossierView data={data} />);
    expect(screen.getByText("Thiago Navarro")).toBeTruthy();
    expect(screen.getByText(/Estudiante/)).toBeTruthy();
    expect(screen.getByText(/instagram/)).toBeTruthy();
    expect(screen.getByText(/María Navarro/)).toBeTruthy();
    expect(screen.getByText(/madre/)).toBeTruthy();
  });

  it("maneja un dossier no concluyente sin romper", () => {
    render(<DossierView data={{ note: "no determinable", identity: null }} />);
    expect(screen.getByText(/identidad no determinable/i)).toBeTruthy();
  });
});
