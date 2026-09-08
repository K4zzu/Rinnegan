import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ScanEntry from "./ScanEntry";

describe("ScanEntry · reasoning", () => {
  it("renderiza el paso de razonamiento con thought y action", () => {
    const entry = { type: "scan", scan: "reasoning", step: 2, thought: "busco la rectora", action: "web_search: rectora Navarro" };
    render(<ScanEntry entry={entry} theme={{}} />);
    expect(screen.getByText(/busco la rectora/)).toBeTruthy();
    expect(screen.getByText(/web_search/)).toBeTruthy();
  });
});
