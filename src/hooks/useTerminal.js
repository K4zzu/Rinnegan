// src/hooks/useTerminal.js
import { useState } from "react";
import { parseCommand } from "../utils/commandParser";
import {
  osintLookupIp,
  osintLookupDomain,
  osintLookupEmail,
  osintLookupUser,
} from "../services/api";

export function useTerminal() {
  // history: array de objetos { type: 'input'|'output'|'error', text: string }
  const [history, setHistory] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const pushToHistory = (entry) => {
    setHistory((prev) => [...prev, entry]);
  };

  const clearHistory = () => setHistory([]);

  /**
   * rawInput -> comando que escribe el usuario
   * context -> viene desde Terminal.jsx, ejemplo:
   *   {
   *     systemStats,
   *     clientInfo,
   *     theme,          // objeto tema actual (con .banner)
   *     themeKey,       // id tema actual (string)
   *     setThemeKey,    // fn para cambiar tema
   *     availableThemes // [{ id, label }, ...] (opcional)
   *   }
   */
  const handleCommand = async (rawInput, context = {}) => {
    const input = rawInput.trim();
    if (!input) return;

    // Guardamos el comando que escribió el usuario
    pushToHistory({ type: "input", text: input });

    const { command, args, category } = parseCommand(input);

    // Comandos locales/core
    if (command === "clear") {
      clearHistory();
      return;
    }

    if (command === "help") {
      handleHelp();
      return;
    }

    if (command === "banner") {
      handleBanner(context);
      return;
    }

    if (command === "theme") {
      handleTheme(args, context);
      return;
    }

    if (command === "netstat") {
      handleNetstat(context);
      return;
    }

    if (command === "sysinfo") {
      handleSysinfo(context);
      return;
    }

    if (command === "osint self") {
      handleOsintSelf(context);
      return;
    }

    // Comandos OSINT que pegan al backend
    if (category === "osint") {
      await handleOsintCommand(command, args);
      return;
    }

    // Si no coincide con nada conocido
    pushToHistory({
      type: "error",
      text: `Comando no reconocido: "${input}". Escribe "help" para ver opciones.`,
    });
  };

  const handleHelp = () => {
    pushToHistory({
      type: "output",
      text: [
        "Comandos disponibles:",
        "",
        "  help                     - Muestra esta ayuda",
        "  clear                    - Limpia la pantalla",
        "  banner                   - Muestra el banner ASCII del tema actual",
        "  theme list               - Lista temas/proyectos OSINT disponibles",
        "  theme <id>               - Cambia el tema/proyecto activo",
        "  netstat                  - Info de red y sistema en texto",
        "  sysinfo                  - Resumen extendido del cliente",
        "  osint self               - JSON con fingerprint del cliente",
        "",
        "  osint ip <ip>            - Lookup de IP",
        "  osint domain <dominio>   - Lookup de dominio",
        "  osint email <email>      - Lookup de email",
        "  osint user <username>    - Lookup de usuario",
      ].join("\n"),
    });
  };

  const handleBanner = (context = {}) => {
    const banner =
      context.theme?.banner ||
      `
OSINT TERMINAL
(no se recibió banner desde el tema actual)
`.trim();

    pushToHistory({
      type: "output",
      text: banner,
    });
  };

  const handleTheme = (args = [], context = {}) => {
    const { setThemeKey, themeKey, availableThemes = [] } = context;

    if (!setThemeKey) {
      pushToHistory({
        type: "error",
        text:
          'theme: no se recibió setThemeKey desde el componente padre. ' +
          'Pásalo en el "context" cuando llames a handleCommand.',
      });
      return;
    }

    const sub = args[0];

    // Sin args o "list" -> listar temas disponibles
    if (!sub || sub === "list") {
      if (!availableThemes.length) {
        pushToHistory({
          type: "output",
          text:
            "[THEMES] No hay temas definidos desde el padre.\n" +
            'Define algo como: [{ id: "qminds", label: "Qminds OSINT" }, ...] ' +
            "y pásalo como availableThemes.",
        });
        return;
      }

      const lines = [
        "[THEMES] Temas / proyectos OSINT disponibles",
        "",
        ...availableThemes.map(
          (t) =>
            `  ${t.id.padEnd(10)} - ${t.label}${
              t.id === themeKey ? "   [ACTIVO]" : ""
            }`
        ),
      ];

      pushToHistory({
        type: "output",
        text: lines.join("\n"),
      });
      return;
    }

    // theme <id> -> cambiar tema
    const targetKey = sub.toLowerCase();

    const target =
      availableThemes.find((t) => t.id.toLowerCase() === targetKey) || null;

    if (!target) {
      pushToHistory({
        type: "error",
        text: `Tema/proyecto "${targetKey}" no encontrado. Usa "theme list" para ver opciones.`,
      });
      return;
    }

    setThemeKey(target.id);

    pushToHistory({
      type: "output",
      text: `Tema activo cambiado a: ${target.label} (${target.id})`,
    });
  };

  const handleNetstat = ({ systemStats, clientInfo } = {}) => {
    if (!systemStats && !clientInfo) {
      pushToHistory({
        type: "error",
        text:
          'netstat: contexto de sistema no disponible en esta vista. ' +
          "Asegúrate de usar la terminal principal.",
      });
      return;
    }

    const s = systemStats || {};
    const c = clientInfo || {};

    const deviceType = s.deviceType || "N/D";
    const online = s.online ? "online" : "offline";
    const networkType = s.networkType || "N/D";

    const downlinkLabel =
      typeof s.downlinkMbps === "number"
        ? `${s.downlinkMbps.toFixed(1)} Mb/s`
        : "N/D";

    const rttLabel =
      typeof s.rttMs === "number" ? `${s.rttMs} ms` : "N/D";

    const ramUsed =
      typeof s.memoryUsedMb === "number"
        ? `${s.memoryUsedMb.toFixed(0)} MB`
        : "N/D";
    const ramLimit =
      typeof s.memoryLimitMb === "number"
        ? `${s.memoryLimitMb.toFixed(0)} MB`
        : "N/D";

    const batteryLabel =
      typeof s.batteryLevel === "number"
        ? `${Math.round(s.batteryLevel * 100)}%${
            s.batteryCharging ? " (⚡)" : ""
          }`
        : s.batterySupported === false
        ? "N/D"
        : "N/D";

    const username = c.username || "guest";
    const ip = c.ip || "pendiente backend";
    const time = c.timeString || "N/D";
    const tz = c.timeZone || "N/D";
    const location = c.locationLabel || "N/D";

    const lines = [
      "[NETSTAT] Información de cliente",
      "",
      `  user        : ${username}`,
      `  ip          : ${ip}`,
      `  hora        : ${time}`,
      `  timezone    : ${tz}`,
      `  ubicación   : ${location}`,
      "",
      "  --- Red ---",
      `  estado      : ${online}`,
      `  tipo        : ${networkType}`,
      `  downlink    : ${downlinkLabel}`,
      `  rtt         : ${rttLabel}`,
      "",
      "  --- Sistema ---",
      `  device      : ${deviceType}`,
      `  ram         : ${ramUsed} / ${ramLimit}`,
      `  batería     : ${batteryLabel}`,
    ].join("\n");

    pushToHistory({
      type: "output",
      text: lines,
    });
  };

  const handleSysinfo = ({ systemStats, clientInfo } = {}) => {
    if (!systemStats && !clientInfo) {
      pushToHistory({
        type: "error",
        text:
          'sysinfo: contexto de sistema no disponible en esta vista. ' +
          "Asegúrate de usar la terminal principal.",
      });
      return;
    }

    const s = systemStats || {};
    const c = clientInfo || {};

    const lines = [
      "[SYSINFO] Resumen del entorno cliente",
      "",
      "  Usuario",
      `    username   : ${c.username || "guest"}`,
      `    ip         : ${c.ip || "pendiente backend"}`,
      `    hora       : ${c.timeString || "N/D"}`,
      `    timezone   : ${c.timeZone || "N/D"}`,
      `    ubicación  : ${c.locationLabel || "N/D"}`,
      "",
      "  Red",
      `    estado     : ${s.online ? "online" : "offline"}`,
      `    tipo       : ${s.networkType || "N/D"}`,
      `    downlink   : ${
        typeof s.downlinkMbps === "number"
          ? `${s.downlinkMbps.toFixed(1)} Mb/s`
          : "N/D"
      }`,
      `    rtt        : ${
        typeof s.rttMs === "number" ? `${s.rttMs} ms` : "N/D"
      }`,
      "",
      "  Sistema",
      `    device     : ${s.deviceType || "N/D"}`,
      `    ram used   : ${
        typeof s.memoryUsedMb === "number"
          ? `${s.memoryUsedMb.toFixed(0)} MB`
          : "N/D"
      }`,
      `    ram limit  : ${
        typeof s.memoryLimitMb === "number"
          ? `${s.memoryLimitMb.toFixed(0)} MB`
          : "N/D"
      }`,
      `    batería    : ${
        typeof s.batteryLevel === "number"
          ? `${Math.round(s.batteryLevel * 100)}%${
              s.batteryCharging ? " (⚡)" : ""
            }`
          : s.batterySupported === false
          ? "N/D"
          : "N/D"
      }`,
    ].join("\n");

    pushToHistory({
      type: "output",
      text: lines,
    });
  };

  const handleOsintSelf = ({ systemStats, clientInfo } = {}) => {
    if (!systemStats && !clientInfo) {
      pushToHistory({
        type: "error",
        text:
          'osint self: contexto de sistema no disponible en esta vista. ' +
          "Asegúrate de usar la terminal principal.",
      });
      return;
    }

    const s = systemStats || {};
    const c = clientInfo || {};

    const payload = {
      user: {
        username: c.username || "guest",
        ip: c.ip || null,
        time: c.timeString || null,
        timezone: c.timeZone || null,
        location: c.locationLabel || null,
      },
      system: {
        online: !!s.online,
        deviceType: s.deviceType || null,
        networkType: s.networkType || null,
        downlinkMbps:
          typeof s.downlinkMbps === "number" ? s.downlinkMbps : null,
        rttMs: typeof s.rttMs === "number" ? s.rttMs : null,
        memoryUsedMb:
          typeof s.memoryUsedMb === "number" ? s.memoryUsedMb : null,
        memoryLimitMb:
          typeof s.memoryLimitMb === "number" ? s.memoryLimitMb : null,
        batterySupported: !!s.batterySupported,
        batteryLevel:
          typeof s.batteryLevel === "number" ? s.batteryLevel : null,
        batteryCharging:
          typeof s.batteryCharging === "boolean"
            ? s.batteryCharging
            : null,
      },
      meta: {
        collectedAt: new Date().toISOString(),
        source: "frontend-osint-terminal",
      },
    };

    const prettyJson = JSON.stringify(payload, null, 2);

    pushToHistory({
      type: "output",
      text: prettyJson,
    });
  };

  const handleOsintCommand = async (command, args) => {
    if (!args[0]) {
      pushToHistory({
        type: "error",
        text: `Debes proporcionar un valor. Ejemplo: ${command} 8.8.8.8`,
      });
      return;
    }

    const value = args[0];
    setIsProcessing(true);

    try {
      let result;

      if (command === "osint ip") {
        result = await osintLookupIp(value);
      } else if (command === "osint domain") {
        result = await osintLookupDomain(value);
      } else if (command === "osint email") {
        result = await osintLookupEmail(value);
      } else if (command === "osint user") {
        result = await osintLookupUser(value);
      } else {
        pushToHistory({
          type: "error",
          text: `Comando OSINT no reconocido: ${command}`,
        });
        return;
      }

      const prettyJson = JSON.stringify(result, null, 2);
      pushToHistory({ type: "output", text: prettyJson });
    } catch (error) {
      console.error(error);
      pushToHistory({
        type: "error",
        text:
          "Error al consultar el backend: " +
          (error.message || "Error desconocido"),
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    history,
    isProcessing,
    handleCommand,
  };
}
