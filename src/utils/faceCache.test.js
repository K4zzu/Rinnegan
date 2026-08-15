import { describe, it, expect, beforeEach } from "vitest";
import { setDescriptor, getDescriptor, clearDescriptors } from "./faceCache";

beforeEach(() => clearDescriptors());

describe("faceCache", () => {
  it("guarda y recupera un descriptor por url", () => {
    const d = [0.1, 0.2, 0.3];
    setDescriptor("http://x/a.jpg", d);
    expect(getDescriptor("http://x/a.jpg")).toEqual(d);
  });

  it("devuelve null para una url desconocida", () => {
    expect(getDescriptor("http://x/desconocida.jpg")).toBeNull();
  });

  it("no guarda si falta url o descriptor", () => {
    setDescriptor("", [1, 2, 3]);
    setDescriptor("http://x/b.jpg", null);
    expect(getDescriptor("")).toBeNull();
    expect(getDescriptor("http://x/b.jpg")).toBeNull();
  });

  it("clearDescriptors vacía la caché", () => {
    setDescriptor("http://x/a.jpg", [1]);
    clearDescriptors();
    expect(getDescriptor("http://x/a.jpg")).toBeNull();
  });
});
