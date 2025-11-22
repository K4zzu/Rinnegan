// src/components/Terminal.jsx
import { useRef, useEffect, useState } from "react";
import { useTerminal } from "../hooks/useTerminal";
import { useClientInfo, useSystemStats } from "../hooks/useClientInfo";
import PromptLine from "./PromptLine";
import OutputLine from "./OutputLine";
import AsciiBanner from "./AsciiBanner";
import { THEMES, AVAILABLE_THEMES } from "../theme/themes";

// Líneas de boot (solo texto, el color lo da el tema)
const BOOT_LINES = [
  "OSINT Terminal v0.1 (qminds)",
  "[BOOT] Iniciando OSINT Terminal...",
  "[OK] Verificando entorno cliente...",
  "[OK] Cargando módulos de interfaz...",
  "[OK] Inicializando motor de comandos...",
  "[OK] Inicializando módulos OSINT: ip, domain, email, user...",
  "[OK] Cargando perfil: default@qminds",
  "[OK] Configurando canal seguro con backend FastAPI...",
  "[OK] Comprobando latencia con API...",
  "[READY] Todos los sistemas en línea.",
  'Sistema listo. Escribe "help" para ver los comandos.',
];

function BootScreen({ onFinish, theme }) {
  const [currentLine, setCurrentLine] = useState(0);
  const [currentChar, setCurrentChar] = useState(0);
  const [renderedLines, setRenderedLines] = useState(
    () => BOOT_LINES.map(() => "")
  );

  const colors = theme?.colors || {};
  const lineClass = colors.bodyText || "text-green-300/90";
  const bannerClass = colors.bannerText || "text-green-400/90";

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
    }, 15);

    return () => clearTimeout(timeout);
  }, [currentLine, currentChar, onFinish]);

  return (
    <div className="h-[calc(100%-2.5rem)] flex flex-col justify-center items-start text-xs md:text-sm">
      {/* Banner ASCII basado en el tema */}
      <AsciiBanner
        className={`mb-4 ${bannerClass}`}
        banner={theme?.banner}
      />
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

export default function Terminal() {
  const { history, isProcessing, handleCommand } = useTerminal();
  const clientInfo = useClientInfo();
  const systemStats = useSystemStats();

  // Tema activo
  const [themeKey, setThemeKey] = useState("darknet");
  const theme = THEMES[themeKey] ?? THEMES.qminds;
  const colors = theme.colors || {};

  const [currentInput, setCurrentInput] = useState("");
  const [isBooting, setIsBooting] = useState(true);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  const onSubmit = (e) => {
    e.preventDefault();
    if (!currentInput.trim()) return;

    // Pasamos TODO el contexto al hook (tema, stats, user, etc.)
    handleCommand(currentInput, {
      systemStats,
      clientInfo,
      theme,
      themeKey,
      setThemeKey,
      availableThemes: AVAILABLE_THEMES,
    });
    setCurrentInput("");
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
      {/* Header de la ventana + info del usuario + monitor */}
      <div
        className={`flex flex-col gap-1 mb-3 text-xs ${colors.headerText || "text-green-300/70"
          }`}
      >
        {/* Línea de “ventana” con los 3 puntitos */}
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <span className="w-3 h-3 rounded-full bg-red-500/70" />
            <span className="w-3 h-3 rounded-full bg-yellow-500/70" />
            <span className="w-3 h-3 rounded-full bg-green-500/70" />
          </div>
          <span className="ml-3 truncate">
            {theme.label || "OSINT Terminal"}: ~
          </span>
        </div>

        {/* Línea con datos del usuario */}
        <div
          className={`flex flex-wrap gap-x-4 gap-y-1 pl-8 text-[0.65rem] md:text-[0.7rem] ${colors.headerSubText || "text-green-400/80"
            }`}
        >
          <span>user: {clientInfo.username}</span>
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
          {history.map((entry, index) => (
            <OutputLine key={index} entry={entry} theme={theme} />
          ))}

          {isProcessing && (
            <div className="text-xs text-green-300 animate-pulse mt-1">
              [*] Procesando consulta...
            </div>
          )}

          <form onSubmit={onSubmit} className="mt-2">
            <PromptLine
              value={currentInput}
              onChange={setCurrentInput}
              inputRef={inputRef}
              theme={theme}
            />
          </form>
        </div>
      )}
    </div>
  );
}
