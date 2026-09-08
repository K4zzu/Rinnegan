// src/components/Terminal.jsx
import { useRef, useEffect, useState } from "react";
import { useTerminal } from "../hooks/useTerminal";
import { useClientInfo, useSystemStats } from "../hooks/useClientInfo";
import PromptLine from "./PromptLine";
import OutputLine from "./OutputLine";
import GodEye from "./GodEye";
import UsageIndicator from "./UsageIndicator";
import AsciiBanner from "./AsciiBanner";
import { THEMES, AVAILABLE_THEMES } from "../theme/themes";
import { sound } from "../utils/sound";

// Secuencia de arranque de godeye.
const BOOT_LINES = [
  "rinnegan // all-source intelligence terminal",
  "[boot] inicializando núcleo rinnegan…",
  "[ok]   enlace seguro establecido (tls)",
  "[ok]   módulos: usuario · email · dominio · ip · teléfono · nombre · imagen",
  "[ok]   motor de correlación ia en línea",
  "[ok]   calibrando el ojo…",
  "[ready] todos los sensores activos.",
  'escribe un objetivo (nombre, usuario, email…) o "help".',
];

function BootScreen({ onFinish, theme }) {
  const [currentLine, setCurrentLine] = useState(0);
  const [currentChar, setCurrentChar] = useState(0);
  const [renderedLines, setRenderedLines] = useState(
    () => BOOT_LINES.map(() => "")
  );

  const colors = theme?.colors || {};
  const lineClass = colors.bodyText || "text-green-300/90";
  const accentText = colors.bannerText || "text-green-400/90";

  // Sonido de encendido, una vez.
  useEffect(() => {
    sound.unlock();
    sound.boot();
  }, []);

  useEffect(() => {
    if (currentLine >= BOOT_LINES.length) {
      onFinish?.();
      return;
    }

    const fullText = BOOT_LINES[currentLine];

    const timeout = setTimeout(() => {
      setRenderedLines((prev) => {
        const copy = [...prev];
        copy[currentLine] = fullText.slice(0, currentChar + 1);
        return copy;
      });

      if (currentChar + 1 >= fullText.length) {
        setCurrentLine((prev) => prev + 1);
        setCurrentChar(0);
      } else {
        setCurrentChar((prev) => prev + 1);
      }
    }, 16);

    return () => clearTimeout(timeout);
  }, [currentLine, currentChar, onFinish]);

  return (
    <div className="h-[calc(100%-2.5rem)] flex flex-col justify-center items-start text-xs md:text-sm">
      {/* Banner ASCII del tema — el alma de terminal del boot loader */}
      <AsciiBanner className={`phosphor mb-4 ${accentText}`} banner={theme?.banner} />
      <div className="space-y-1">
        {renderedLines.map((text, idx) => (
          <p key={idx} className={lineClass}>
            {text}
          </p>
        ))}
      </div>
    </div>
  );
}

export default function Terminal({ user, onLogout }) {
  const {
    history,
    isProcessing,
    statusText,
    scanProgress,
    handleCommand,
    cancelActiveStream,
    runImageScan,
    pickCandidate,
  } = useTerminal();

  const fileInputRef = useRef(null);

  // Abre el selector de archivo (lo pide el comando `osint image`).
  const requestImageUpload = () => {
    sound.unlock();
    fileInputRef.current?.click();
  };

  const onFileSelected = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite re-elegir el mismo archivo
    runImageScan(file); // valida y reporta dentro del hook
  };
  const clientInfo = useClientInfo();
  const systemStats = useSystemStats();

  // Tema activo (persistido en localStorage para sobrevivir reloads)
  const THEME_STORAGE_KEY = "rinnegan:theme";
  const [themeKey, setThemeKey] = useState(() => {
    const saved =
      typeof localStorage !== "undefined"
        ? localStorage.getItem(THEME_STORAGE_KEY)
        : null;
    return saved && THEMES[saved] ? saved : "darknet";
  });
  const theme = THEMES[themeKey] ?? THEMES.qminds;
  const colors = theme.colors || {};

  useEffect(() => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, themeKey);
    } catch {
      // localStorage no disponible (modo privado, etc.) — se ignora.
    }
  }, [themeKey]);

  const [currentInput, setCurrentInput] = useState("");
  const [isBooting, setIsBooting] = useState(true);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  // Estado del ojo: scanning se deriva de isProcessing; al terminar un
  // escaneo se dispara un flash "locked" (objetivo fijado) transitorio.
  const [locked, setLocked] = useState(false);
  const wasProcessing = useRef(false);
  useEffect(() => {
    if (isProcessing) {
      wasProcessing.current = true;
      return;
    }
    if (!wasProcessing.current) return;
    wasProcessing.current = false;
    // En callbacks async (no síncrono en el effect) para no encadenar renders.
    const on = setTimeout(() => setLocked(true), 0);
    const off = setTimeout(() => setLocked(false), 1100);
    return () => {
      clearTimeout(on);
      clearTimeout(off);
    };
  }, [isProcessing]);
  const eyeState = isProcessing ? "scanning" : locked ? "locked" : "idle";

  // Historial de comandos enviados para navegar con flechas ↑/↓.
  // commandHistory: más antiguo primero. historyIndex: -1 = no navegando.
  const [commandHistory, setCommandHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const onSubmit = (e) => {
    e.preventDefault();
    if (!currentInput.trim()) return;

    // El envío es un gesto de usuario: habilita el audio del navegador.
    sound.unlock();

    // Pasamos TODO el contexto al hook (tema, stats, user, etc.)
    handleCommand(currentInput, {
      systemStats,
      clientInfo,
      theme,
      themeKey,
      setThemeKey,
      availableThemes: AVAILABLE_THEMES,
      requestImageUpload,
      onLogout,
    });

    setCommandHistory((prev) => [...prev, currentInput]);
    setHistoryIndex(-1);
    setCurrentInput("");
  };

  // Navegación por el historial con ↑/↓ (estilo terminal) y Ctrl+C.
  const onInputKeyDown = (e) => {
    if (e.key === "c" && e.ctrlKey) {
      // Cancela un escaneo en curso (no interfiere si no hay ninguno).
      cancelActiveStream();
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!commandHistory.length) return;
      const nextIndex =
        historyIndex === -1
          ? commandHistory.length - 1
          : Math.max(0, historyIndex - 1);
      setHistoryIndex(nextIndex);
      setCurrentInput(commandHistory[nextIndex]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex === -1) return;
      const nextIndex = historyIndex + 1;
      if (nextIndex >= commandHistory.length) {
        // Pasamos del último: volvemos a una línea vacía.
        setHistoryIndex(-1);
        setCurrentInput("");
      } else {
        setHistoryIndex(nextIndex);
        setCurrentInput(commandHistory[nextIndex]);
      }
    }
  };

  useEffect(() => {
    if (!isBooting && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history, isProcessing, isBooting]);

  const handleTerminalClick = () => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleBootFinish = () => {
    setIsBooting(false);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  // Labels de monitor
  const ramLabel =
    systemStats.memoryUsedMb != null
      ? `${systemStats.memoryUsedMb.toFixed(0)} / ${systemStats.memoryLimitMb
        ? systemStats.memoryLimitMb.toFixed(0)
        : "?"
      } MB`
      : "N/D";

  const batteryLabel =
    systemStats.batteryLevel != null
      ? `${Math.round(systemStats.batteryLevel * 100)}%${systemStats.batteryCharging ? " (⚡)" : ""
      }`
      : systemStats.batterySupported === false
        ? "N/D"
        : "…";

  const downlinkLabel =
    typeof systemStats.downlinkMbps === "number"
      ? `${systemStats.downlinkMbps.toFixed(1)} Mb/s`
      : "N/D";

  const rttLabel =
    typeof systemStats.rttMs === "number"
      ? `${systemStats.rttMs} ms`
      : "N/D";

  const netTypeLabel =
    systemStats.networkType && systemStats.networkType !== "desconocido"
      ? systemStats.networkType
      : "net";

  const netLabel = `${netTypeLabel} · ${downlinkLabel} · rtt ${rttLabel}`;

  return (
    <div
      className="
      relative 
      h-full 
      font-mono 
      text-[11px] 
      sm:text-xs 
      md:text-sm 
      p-3 
      sm:p-4 
      md:p-6
    "
      onClick={handleTerminalClick}
    >
      {/* Input de archivo oculto para `osint image` */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={onFileSelected}
        className="hidden"
      />

      {/* Header de la ventana + info del usuario + monitor */}
      <div
        className={`flex flex-col gap-1 mb-3 text-xs ${colors.headerText || "text-green-300/70"
          }`}
      >
        {/* Barra de ventana: ojo vivo + wordmark GODEYE + tema activo */}
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <span className="w-3 h-3 rounded-full bg-red-500/70" />
            <span className="w-3 h-3 rounded-full bg-yellow-500/70" />
            <span className="w-3 h-3 rounded-full bg-green-500/70" />
          </div>
          <span className={`ml-2 h-5 w-5 shrink-0 ${colors.bannerText || "text-green-400/90"}`}>
            <GodEye state={eyeState} />
          </span>
          <span className={`phosphor font-semibold tracking-[0.3em] ds-glitch ${colors.bannerText || "text-green-400/90"}`}>
            RINNEGAN
          </span>
          <span className="ml-1 truncate opacity-50">· {theme.label}</span>
          <UsageIndicator className="ml-auto shrink-0" />
        </div>

        {/* Línea con datos del usuario */}
        <div
          className={`flex flex-wrap gap-x-4 gap-y-1 pl-8 text-[0.65rem] md:text-[0.7rem] ${colors.headerSubText || "text-green-400/80"
            }`}
        >
          <span>user: {user?.username || clientInfo.username}</span>
          <span>ip: {clientInfo.ip || "pendiente backend"}</span>
          <span>hora: {clientInfo.timeString}</span>
          <span>tz: {clientInfo.timeZone}</span>
          <span>{clientInfo.locationLabel}</span>
        </div>

        {/* Línea tipo “monitor de recursos” */}
        <div
          className={`flex flex-wrap gap-x-4 gap-y-1 pl-8 text-[0.65rem] md:text-[0.7rem] items-center ${colors.headerMetricsText || "text-green-400/60"
            }`}
        >
          <span>device: {systemStats.deviceType}</span>
          <span>estado: {systemStats.online ? "online" : "offline"}</span>

          {/* Bloque net con sparkline */}
          <div className="flex items-center gap-1">
            <span>net:</span>
            <div className="flex items-end h-4 gap-[1px]">
              {systemStats.netHistory.map((v, i) => (
                <span
                  key={i}
                  className={`w-[2px] ${colors.netBar || "bg-green-500/80"
                    }`}
                  style={{ height: `${30 + v * 70}%` }} // 30% min, 100% max
                />
              ))}
            </div>
            <span className="ml-1 opacity-70">{netLabel}</span>
          </div>

          <span>ram: {ramLabel}</span>
          <span>batería: {batteryLabel}</span>
        </div>
      </div>

      {/* Contenido: boot con ASCII + typing effect o terminal real */}
      {isBooting ? (
        <BootScreen onFinish={handleBootFinish} theme={theme} />
      ) : (
        <div
          ref={scrollRef}
          className="h-[calc(100%-2.5rem)] overflow-y-auto space-y-1 pr-2 custom-scrollbar"
        >
          {history.length === 0 && !isProcessing && (
            <div className="mt-2 text-[0.7rem] opacity-45 leading-relaxed">
              <span className={colors.bannerText || "text-green-400/90"}>
                ▸ el ojo está abierto.
              </span>{" "}
              escribe un objetivo y presiona enter — un nombre, usuario, email,
              teléfono, dominio o IP. `osint image` para una foto. `help` para
              todo.
            </div>
          )}

          {history.map((entry, index) => (
            <OutputLine key={index} entry={entry} theme={theme} onPickCandidate={pickCandidate} />
          ))}

          {isProcessing && (
            <div className="mt-2 text-xs">
              <div
                className={`flex items-center gap-2 ${colors.headerMetricsText || "text-green-300"}`}
              >
                <span className="h-4 w-4 shrink-0">
                  <GodEye state="scanning" className={colors.bannerText || ""} />
                </span>
                <span className="animate-pulse">
                  {statusText || "rastreando…"}
                </span>
                <span className="opacity-40">· ctrl+c para abortar</span>
              </div>
              {scanProgress?.total ? (
                <div className="mt-1.5 h-[3px] w-full max-w-md overflow-hidden rounded-full bg-white/5">
                  <div
                    className={`h-full rounded-full transition-[width] duration-200 ease-out ${colors.netBar || "bg-green-500/80"}`}
                    style={{
                      width: `${Math.min(
                        100,
                        Math.round((scanProgress.checked / scanProgress.total) * 100)
                      )}%`,
                      boxShadow: "0 0 6px currentColor",
                    }}
                  />
                </div>
              ) : null}
            </div>
          )}

          <form onSubmit={onSubmit} className="mt-2">
            <PromptLine
              value={currentInput}
              onChange={setCurrentInput}
              onKeyDown={onInputKeyDown}
              inputRef={inputRef}
              theme={theme}
            />
          </form>
        </div>
      )}
    </div>
  );
}
