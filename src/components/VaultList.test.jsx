import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import VaultList from "./VaultList";

describe("VaultList", () => {
  it("lista los nodos guardados con su valor y conteo de escaneos", () => {
    const data = {
      nodes: [
        { id: 1, kind: "name", value: "Carlos Sánchez", label: "Carlos Sánchez", scan_count: 2 },
        { id: 2, kind: "username", value: "k4zzu", label: "k4zzu", scan_count: 1 },
      ],
      edges: [],
    };
    render(<VaultList data={data} />);
    expect(screen.getByText("Carlos Sánchez")).toBeTruthy();
    expect(screen.getByText("k4zzu")).toBeTruthy();
  });

  it("muestra un estado vacío cuando no hay nodos", () => {
    render(<VaultList data={{ nodes: [], edges: [] }} />);
    expect(screen.getByText(/bóveda vacía/i)).toBeTruthy();
  });
});
