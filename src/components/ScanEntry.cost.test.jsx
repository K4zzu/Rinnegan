import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ScanEntry from "./ScanEntry";

describe("ScanEntry · costo", () => {
  it("muestra la línea de costo en el done cuando viene cost", () => {
    const entry = {
      type: "scan",
      scan: "done",
      findings: 9,
      errors: 1,
      elapsed: 7800,
      cost: {
        usd: 0.014,
        breakdown: [
          { provider: "openai", units: 1, tokens: 3100, usd: 0.004 },
          { provider: "serpapi", units: 5, tokens: null, usd: 0.01 },
        ],
      },
    };
    render(<ScanEntry entry={entry} theme={{}} />);
    expect(screen.getByText(/costo/i)).toBeTruthy();
    expect(screen.getByText(/openai/)).toBeTruthy();
    expect(screen.getByText(/serpapi/)).toBeTruthy();
  });

  it("no muestra costo cuando no viene", () => {
    const entry = { type: "scan", scan: "done", findings: 1, errors: 0, elapsed: 100 };
    render(<ScanEntry entry={entry} theme={{}} />);
    expect(screen.queryByText(/costo/i)).toBeNull();
  });
});
