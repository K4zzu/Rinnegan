import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import LiveTheater from "./LiveTheater";

const base = {
  status: "running", kind: "investigate", query: "Thiago",
  reasoning: [{ step: 1, thought: "busco la rectora", action: "web_search" }],
  findings: 42, providers: ["maigret", "serpapi"],
  media: [{ source: "github", image_url: "http://x/a.jpg" }], startedAt: Date.now(),
};

describe("LiveTheater", () => {
  it("muestra razonamiento, contadores, providers y caras cuando running", () => {
    render(<LiveTheater liveScan={base} statusText="rastreando…" />);
    expect(screen.getByText(/busco la rectora/)).toBeTruthy();
    expect(screen.getByText("42")).toBeTruthy();
    expect(screen.getByText(/maigret/)).toBeTruthy();
    expect(screen.getByText(/EN VIVO/i)).toBeTruthy();
  });

  it("no renderiza nada cuando status es idle", () => {
    const { container } = render(<LiveTheater liveScan={{ ...base, status: "idle" }} />);
    expect(container.firstChild).toBeNull();
  });
});
