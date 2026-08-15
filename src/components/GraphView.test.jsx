import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import GraphView from "./GraphView";

describe("GraphView", () => {
  it("dibuja los nodos con sus labels y una arista", () => {
    const data = {
      nodes: [
        { id: "n0", kind: "name", value: "Carlos", label: "Carlos", parent_id: null },
        { id: "n1", kind: "username", value: "carlos99", label: "carlos99", parent_id: "n0" },
      ],
      edges: [{ src: "n0", dst: "n1", relation: "pivot" }],
    };
    const { container } = render(<GraphView data={data} />);
    expect(screen.getByText("Carlos")).toBeTruthy();
    expect(screen.getByText("carlos99")).toBeTruthy();
    // una arista => un <line>
    expect(container.querySelectorAll("line").length).toBe(1);
  });

  it("estado vacío cuando no hay nodos", () => {
    render(<GraphView data={{ nodes: [], edges: [] }} />);
    expect(screen.getByText(/sin grafo/i)).toBeTruthy();
  });
});
