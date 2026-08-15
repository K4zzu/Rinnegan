import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import UsagePanel from "./UsagePanel";

describe("UsagePanel", () => {
  it("lista proveedores con uso/límite y el total", () => {
    const data = {
      period: "month",
      providers: [
        { name: "serpapi", used: 37, limit: 100, unit: "búsquedas", resets_at: "2026-09-01", cost_usd: 0 },
        { name: "openai", used: 128000, limit: null, unit: "tokens", resets_at: null, cost_usd: 0.42 },
      ],
      total_cost_usd: 0.42,
    };
    render(<UsagePanel data={data} />);
    expect(screen.getByText("serpapi")).toBeTruthy();
    expect(screen.getByText("openai")).toBeTruthy();
    expect(screen.getByText(/37\/100/)).toBeTruthy();
    expect(screen.getByText(/total/i)).toBeTruthy();
  });

  it("estado vacío sin proveedores", () => {
    render(<UsagePanel data={{ providers: [], total_cost_usd: 0 }} />);
    expect(screen.getByText(/sin datos de uso/i)).toBeTruthy();
  });
});
