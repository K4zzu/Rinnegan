// src/utils/commandParser.js

export function parseCommand(input) {
  // Normalizamos el input y lo separamos por espacios
  const trimmed = input.trim();
  if (!trimmed) {
    return { command: "", args: [], category: "empty" };
  }

  const parts = trimmed.split(" ").filter(Boolean);
  const [first, second, ...rest] = parts;

  // --- Comandos core simples (sin subcomandos especiales) ---
  // help, clear, banner, netstat, sysinfo
  if (["help", "clear", "banner", "netstat", "sysinfo"].includes(first)) {
    return {
      command: first,
      args: rest,
      category: "core",
    };
  }

  // --- Comando theme ---
  // theme list
  // theme <id>
  if (first === "theme") {
    // Pasamos todo lo que venga después como args,
    // el hook decidirá si es "list" o un id de tema.
    return {
      command: "theme",
      args: parts.slice(1), // puede ser ["list"] o ["darknet"], etc.
      category: "core",
    };
  }

  // --- osint self (local, no va a backend) ---
  if (first === "osint" && second === "self") {
    return {
      command: "osint self",
      args: rest, // normalmente vacío, pero por si acaso
      category: "core",
    };
  }

  // --- OSINT genéricos que llaman al backend ---
  // osint ip <valor>
  // osint domain <valor>
  // osint email <valor>
  // osint user <valor>
  if (first === "osint") {
    const sub = second || "";
    const args = rest;
    const fullCommand = `osint ${sub}`; // ej: "osint ip"

    return {
      command: fullCommand,
      args,
      category: "osint",
    };
  }

  // --- Fallback: comando desconocido ---
  return {
    command: trimmed,
    args: [],
    category: "unknown",
  };
}
