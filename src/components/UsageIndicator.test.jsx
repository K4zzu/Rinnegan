import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("../services/api", () => ({
  getUsage: vi.fn(() =>
    Promise.resolve({
      providers: [{ name: "serpapi", used: 63, limit: 100 }],
      total_cost_usd: 0.42,
    })
  ),
}));

import UsageIndicator from "./UsageIndicator";
import { getUsage } from "../services/api";

afterEach(() => vi.clearAllMocks());

describe("UsageIndicator", () => {
  it("muestra la cuota escasa (serp) y el costo total tras cargar", async () => {
    render(<UsageIndicator />);
    await waitFor(() => {
      expect(getUsage).toHaveBeenCalled();
      expect(screen.getByText(/serp 63\/100/i)).toBeTruthy();
      expect(screen.getByText(/\$0\.42/)).toBeTruthy();
    });
  });
});
