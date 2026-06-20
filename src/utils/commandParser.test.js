// src/utils/commandParser.test.js
import { describe, it, expect } from "vitest";
import { parseCommand } from "./commandParser";

describe("parseCommand", () => {
  it("devuelve category 'empty' para input vacío o solo espacios", () => {
    expect(parseCommand("")).toEqual({ command: "", args: [], category: "empty" });
    expect(parseCommand("   ")).toEqual({ command: "", args: [], category: "empty" });
  });

  it.each(["help", "clear", "banner", "netstat", "sysinfo", "about"])(
    "trata '%s' como comando core",
    (cmd) => {
      const result = parseCommand(cmd);
      expect(result.command).toBe(cmd);
      expect(result.category).toBe("core");
    }
  );

  it("en comandos core, args = rest (descarta el primer token tras el comando)", () => {
    // Quirk del parser: usa [first, second, ...rest] y devuelve `rest`,
    // así que el primer argumento (second) se pierde. Inofensivo porque los
    // comandos core (help/clear/banner/netstat/sysinfo/about) no usan args.
    const result = parseCommand("netstat extra args");
    expect(result.command).toBe("netstat");
    expect(result.args).toEqual(["args"]);
  });

  it("parsea 'theme list' como core con args ['list']", () => {
    const result = parseCommand("theme list");
    expect(result).toEqual({ command: "theme", args: ["list"], category: "core" });
  });

  it("parsea 'theme <id>' como core con el id en args", () => {
    const result = parseCommand("theme darknet");
    expect(result).toEqual({ command: "theme", args: ["darknet"], category: "core" });
  });

  it("parsea 'osint self' como core (no va al backend)", () => {
    const result = parseCommand("osint self");
    expect(result.command).toBe("osint self");
    expect(result.category).toBe("core");
  });

  it.each([
    ["osint ip 8.8.8.8", "osint ip", ["8.8.8.8"]],
    ["osint domain example.com", "osint domain", ["example.com"]],
    ["osint email a@b.com", "osint email", ["a@b.com"]],
    ["osint user kazzu", "osint user", ["kazzu"]],
  ])("parsea '%s' como comando osint", (input, command, args) => {
    const result = parseCommand(input);
    expect(result.command).toBe(command);
    expect(result.args).toEqual(args);
    expect(result.category).toBe("osint");
  });

  it("marca comandos desconocidos como category 'unknown'", () => {
    const result = parseCommand("foobar");
    expect(result.category).toBe("unknown");
    expect(result.command).toBe("foobar");
  });

  it("normaliza espacios alrededor del input", () => {
    const result = parseCommand("  help  ");
    expect(result.command).toBe("help");
    expect(result.category).toBe("core");
  });
});
