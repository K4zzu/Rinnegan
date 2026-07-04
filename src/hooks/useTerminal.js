// src/hooks/useTerminal.js
import { useState, useRef } from "react";
import { parseCommand } from "../utils/commandParser";
import { streamOsint, streamOsintImage } from "../services/api";
import { sound } from "../utils/sound";

// Mapea el comando parseado a la categoría del endpoint del backend.
const CATEGORY_BY_COMMAND = {
  "osint auto": "auto",
  "osint ip": "ip",
  "osint domain": "domain",
  "osint email": "email",
  "osint user": "username",
  "osint phone": "phone",
  "osint name": "name",
};

export function useTerminal() {
  // history: array de objetos { type: 'input'|'output'|'error', text: string }
  const [history, setHistory] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  // Estado de progreso en vivo del escaneo (ej. "[maigret] 312/500").
  const [statusText, setStatusText] = useState(null);
  // Progreso numérico para la barra HUD: { provider, checked, total } | null.
  const [scanProgress, setScanProgress] = useState(null);
  // Control del stream SSE activo, para poder cancelarlo.
  const activeStreamRef = useRef(null);
  // Timers de la demo local (para poder cancelarla).
  const demoTimersRef = useRef([]);

  const pushToHistory = (entry) => {
    setHistory((prev) => [...prev, entry]);
  };

  const clearHistory = () => setHistory([]);

  const clearDemoTimers = () => {
    demoTimersRef.current.forEach(clearTimeout);
    demoTimersRef.current = [];
  };

  const closeActiveStream = () => {
    if (activeStreamRef.current) {
      activeStreamRef.current.close();
      activeStreamRef.current = null;
    }
    clearDemoTimers();
  };

  // Cancelación por el usuario (Ctrl+C).
  const cancelActiveStream = () => {
    const wasActive = activeStreamRef.current || demoTimersRef.current.length;
    if (!wasActive) return;
    closeActiveStream();
    setIsProcessing(false);
    setStatusText(null);
    setScanProgress(null);
    pushToHistory({ type: "error", text: "^C escaneo cancelado." });
  };

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

    if (command === "about") {
      handleAbout();
      return;
    }

    if (command === "sound") {
      handleSound(args);
      return;
    }

    if (command === "demo") {
      handleDemo();
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

    // Comandos OSINT que pegan al backend (streaming SSE)
    if (category === "osint") {
      // La imagen se sube por archivo: pedimos el selector a Terminal.jsx.
      if (command === "osint image") {
        if (context.requestImageUpload) {
          context.requestImageUpload();
        } else {
          pushToHistory({
            type: "error",
            text: "Subida de imagen no disponible en esta vista.",
          });
        }
        return;
      }
      handleOsintCommand(command, args);
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
        "  about                    - Información sobre Rinnegan",
        "  demo                     - Escaneo simulado (previsualiza la estética HUD)",
        "  sound [on|off]           - Activa/desactiva los sonidos",
        "  banner                   - Muestra el banner ASCII del tema actual",
        "  theme list               - Lista temas/proyectos OSINT disponibles",
        "  theme <id>               - Cambia el tema/proyecto activo",
        "  netstat                  - Info de red y sistema en texto",
        "  sysinfo                  - Resumen extendido del cliente",
        "  osint self               - JSON con fingerprint del cliente",
        "",
        "  osint <dato>             - AUTO: detecta el tipo y busca todo lo que aplique",
        "",
        "  osint ip <ip>            - Lookup de IP",
        "  osint domain <dominio>   - Lookup de dominio",
        "  osint email <email>      - Lookup de email",
        "  osint user <username>    - Lookup de usuario",
        "  osint phone <tel>        - Lookup de teléfono",
        "  osint name <nombre>      - Búsqueda por nombre y apellido",
        "  osint image              - Analiza una imagen (EXIF + rostros)",
      ].join("\n"),
    });
  };

  const handleSound = (args = []) => {
    const sub = (args[0] || "").toLowerCase();
    let on;
    if (sub === "on") {
      sound.setEnabled(true);
      on = true;
    } else if (sub === "off") {
      sound.setEnabled(false);
      on = false;
    } else {
      on = sound.toggle();
    }
    sound.unlock();
    pushToHistory({
      type: "output",
      text: `[SOUND] sonido ${on ? "activado" : "desactivado"}.`,
    });
  };

  // Escaneo simulado para previsualizar la estética HUD sin backend.
  const handleDemo = () => {
    closeActiveStream();
    sound.unlock();
    setIsProcessing(true);
    setStatusText("demo…");

    const items = [
      { provider: "maigret", source: "github", title: "github.com/demo_user", url: "https://github.com/demo_user", confidence: "high" },
      { provider: "maigret", source: "telegram", title: "t.me/demo_user", url: "https://t.me/demo_user", confidence: "high" },
      { provider: "maigret", source: "instagram", title: "instagram.com/demo_user", url: "https://instagram.com/demo_user", confidence: "high" },
      { provider: "maigret", source: "stackoverflow", title: "stackoverflow.com/users?search=demo_user", url: null, confidence: "medium" },
      { provider: "sherlock", source: "reddit", title: "reddit.com/user/demo_user", url: "https://reddit.com/user/demo_user", confidence: "high" },
      { provider: "holehe", source: "spotify", title: "email registrado en Spotify", url: null, confidence: "medium" },
    ];

    sound.scanStart();
    pushToHistory({
      type: "scan",
      scan: "start",
      kind: "username",
      query: "demo_user",
      providers: ["maigret", "sherlock", "holehe"],
    });

    let delay = 350;
    items.forEach((it, i) => {
      demoTimersRef.current.push(
        setTimeout(() => {
          setScanProgress({ provider: it.provider, checked: i + 1, total: items.length });
          pushToHistory({ type: "scan", scan: "finding", ...it });
          sound.finding(it.confidence);
        }, delay)
      );
      delay += 480;
    });

    demoTimersRef.current.push(
      setTimeout(() => {
        pushToHistory({
          type: "scan",
          scan: "source-error",
          provider: "sherlock",
          error: "sherlock_not_installed",
        });
        sound.error();
      }, delay)
    );
    delay += 480;

    demoTimersRef.current.push(
      setTimeout(() => {
        pushToHistory({
          type: "scan",
          scan: "media",
          items: [
            { source: "github", image_url: "https://github.com/torvalds.png", page_url: "https://github.com/torvalds", title: "GitHub", confidence: "high" },
            { source: "github", image_url: "https://github.com/gvanrossum.png", page_url: "https://github.com/gvanrossum", title: "GitHub", confidence: "high" },
            { source: "gravatar", image_url: "https://www.gravatar.com/avatar/00000000000000000000000000000000?d=identicon&s=128", page_url: "#", title: "Gravatar", confidence: "medium" },
          ],
        });
        sound.finding("high");
      }, delay)
    );
    delay += 480;

    demoTimersRef.current.push(
      setTimeout(() => {
        pushToHistory({
          type: "scan",
          scan: "ai",
          text:
            "## Resumen\n" +
            'La identidad **"demo_user"** aparece en 5 plataformas con handle consistente.\n\n' +
            "## Correlación de identidad\n" +
            "- **GitHub**, **Telegram** e **Instagram** comparten el mismo handle (señal alta).\n" +
            "- **StackOverflow** es una URL de búsqueda — posible falso positivo (media).\n" +
            "- Email vinculado detectado vía **Spotify**.\n\n" +
            "## Pivots sugeridos\n" +
            "- Extraer el email del perfil de GitHub y correr `osint email <...>`.\n\n" +
            "— Análisis automático sobre datos sin verificar; validar antes de actuar.",
        });
      }, delay)
    );
    delay += 420;

    demoTimersRef.current.push(
      setTimeout(() => {
        pushToHistory({
          type: "scan",
          scan: "done",
          findings: items.length,
          errors: 1,
          elapsed: 2600,
        });
        sound.done();
        setIsProcessing(false);
        setStatusText(null);
        setScanProgress(null);
        demoTimersRef.current = [];
      }, delay)
    );
  };

  const handleAbout = () => {
    pushToHistory({
      type: "output",
      text: [
        "Rinnegan — OSINT Terminal",
        "",
        "  SPA en React + Vite + Tailwind que simula una terminal OSINT.",
        "  Consulta un backend FastAPI para reconocimiento de IP, dominio,",
        "  email y usuario.",
        "",
        '  Escribe "help" para ver todos los comandos disponibles.',
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

  // Lógica común de escaneo (texto e imagen). `openStream(handlers)` abre el
  // transporte adecuado (EventSource o fetch/POST) y devuelve { close }.
  const beginScan = (openStream, { kind, queryFallback }) => {
    closeActiveStream();
    setIsProcessing(true);
    setStatusText("conectando…");
    setScanProgress(null);
    sound.unlock();

    const finish = () => {
      setIsProcessing(false);
      setStatusText(null);
      setScanProgress(null);
      activeStreamRef.current = null;
    };

    activeStreamRef.current = openStream({
      meta: (d) => {
        sound.scanStart();
        pushToHistory({
          type: "scan",
          scan: "start",
          kind: d?.type ?? kind,
          query: d?.query ?? queryFallback,
          providers: d?.providers ?? [],
        });
      },
      progress: (d) => {
        if (!d) return;
        setStatusText(
          d.total
            ? `[${d.provider}] ${d.checked}/${d.total}`
            : `[${d.provider}] ${d.status}`
        );
        setScanProgress(
          d.total ? { provider: d.provider, checked: d.checked, total: d.total } : null
        );
      },
      finding: (d) => {
        sound.finding(d?.confidence);
        pushToHistory({
          type: "scan",
          scan: "finding",
          provider: d?.provider,
          source: d?.source,
          title: d?.title ?? "",
          url: d?.data?.url ?? null,
          confidence: d?.confidence ?? "low",
        });
      },
      source_error: (d) => {
        sound.error();
        pushToHistory({
          type: "scan",
          scan: "source-error",
          provider: d?.provider,
          error: d?.error ?? "error",
        });
      },
      media: (d) => {
        if (!d?.items?.length) return;
        sound.finding("high");
        pushToHistory({ type: "scan", scan: "media", items: d.items });
      },
      ai_report: (d) => {
        pushToHistory({ type: "scan", scan: "ai", text: d?.text ?? "" });
      },
      done: (d) => {
        sound.done();
        const s = d?.summary || {};
        pushToHistory({
          type: "scan",
          scan: "done",
          findings: s.findings ?? 0,
          errors: s.errors ?? 0,
          elapsed: s.elapsed_ms ?? "?",
        });
        finish();
      },
      error: (err) => {
        sound.error();
        pushToHistory({
          type: "error",
          text:
            "Error al consultar el backend: " +
            (err?.message || "Error desconocido"),
        });
        finish();
      },
    });
  };

  const handleOsintCommand = (command, args) => {
    const value = (args || []).join(" ").trim();
    if (!value) {
      pushToHistory({
        type: "error",
        text: `Debes proporcionar un valor. Ejemplo: ${command} <valor>`,
      });
      return;
    }

    const category = CATEGORY_BY_COMMAND[command];
    if (!category) {
      pushToHistory({
        type: "error",
        text: `Comando OSINT no reconocido: ${command}`,
      });
      return;
    }

    beginScan((handlers) => streamOsint(category, value, handlers), {
      kind: category,
      queryFallback: value,
    });
  };

  // Lanzado desde Terminal.jsx cuando el usuario elige una imagen.
  const MAX_IMAGE_MB = 15;
  const runImageScan = (file) => {
    if (!file) return;
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
      pushToHistory({
        type: "error",
        text: `Imagen demasiado grande (máx. ${MAX_IMAGE_MB} MB).`,
      });
      return;
    }
    pushToHistory({ type: "input", text: `osint image · ${file.name}` });
    beginScan((handlers) => streamOsintImage(file, handlers), {
      kind: "image",
      queryFallback: file.name,
    });
  };

  return {
    history,
    isProcessing,
    statusText,
    scanProgress,
    handleCommand,
    cancelActiveStream,
    runImageScan,
  };
}
