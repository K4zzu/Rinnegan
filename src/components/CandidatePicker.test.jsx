import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import CandidatePicker from "./CandidatePicker";

describe("CandidatePicker", () => {
  it("lista candidatos y llama onPick al elegir uno", () => {
    const items = [
      { id: "c1", name: "Thiago A", why: "hijo de rectora X", confidence: 0.7, image_url: "http://x/a.jpg" },
      { id: "c2", name: "Thiago B", why: "otro", confidence: 0.4 },
    ];
    const onPick = vi.fn();
    render(<CandidatePicker items={items} onPick={onPick} />);
    expect(screen.getByText("Thiago A")).toBeTruthy();
    expect(screen.getByText(/hijo de rectora X/)).toBeTruthy();
    fireEvent.click(screen.getByText("Thiago A"));
    expect(onPick).toHaveBeenCalledWith(items[0]);
  });
});
