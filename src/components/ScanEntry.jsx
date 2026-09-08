// src/components/ScanEntry.jsx
// Renderiza cada evento de un escaneo OSINT con estética HUD. El color y el
// glifo codifican la "confianza" del hallazgo para que se distingan de un
// vistazo (verde=alta, ámbar=media, gris=baja, rojo=error).
import Markdown from "./Markdown";
import MediaGallery from "./MediaGallery";
import { platformIcon } from "../utils/platformIcon";

const CONFIDENCE = {
  high: { color: "#34d399", glyph: "◉", label: "HIGH" },
  medium: { color: "#fbbf24", glyph: "◎", label: "MED" },
  low: { color: "#94a3b8", glyph: "◌", label: "LOW" },
};

const ERROR_COLOR = "#f87171";

const fmtUsd = (n) =>
  typeof n === "number" ? `$${n.toFixed(n < 0.01 ? 4 : 2)}` : "$0";

function fmtBreakdown(b) {
  const amount =
    typeof b.tokens === "number"
      ? `${Math.round(b.tokens / 100) / 10}k tok`
      : `×${b.units ?? 1}`;
  return `${b.provider} ${amount} ${fmtUsd(b.usd)}`;
}

function Badge({ children }) {
  return (
    <span className="shrink-0 text-[0.55rem] uppercase tracking-wider px-1 py-px rounded-sm bg-white/5 border border-white/10 text-white/70">
      {children}
    </span>
  );
}

export default function ScanEntry({ entry, theme }) {
  const accentText = theme?.colors?.bannerText || "text-green-400/90";

  switch (entry.scan) {
    case "start":
      return (
        <div className="relative overflow-hidden my-1 py-1 pl-2 border-y border-white/10 ds-sweep">
          <span className="hud-sweep" aria-hidden="true" />
          <div className={`relative flex flex-wrap items-center gap-x-2 gap-y-1 text-xs ${accentText}`}>
            <span className="font-bold tracking-widest ds-glitch">▸ SCAN</span>
            <span className="uppercase opacity-70">{entry.kind}</span>
            <span className="text-white/90">&quot;{entry.query}&quot;</span>
            {entry.providers?.length ? <span className="opacity-40">·</span> : null}
            {entry.providers?.map((p) => (
              <span
                key={p}
                className="text-[0.55rem] uppercase tracking-wider px-1 rounded-sm border border-current opacity-80"
              >
                {p}
              </span>
            ))}
          </div>
        </div>
      );

    case "finding": {
      const c = CONFIDENCE[entry.confidence] || CONFIDENCE.low;
      const label = entry.source ? `${entry.provider}·${entry.source}` : entry.provider;
      const icon = platformIcon(entry.source);
      return (
        <div
          className="finding-in flex items-center gap-2 py-[3px] pl-2 border-l-2 text-xs md:text-sm"
          style={{ borderColor: c.color }}
        >
          <span style={{ color: c.color }} className="select-none text-[0.7rem]">
            {c.glyph}
          </span>
          {icon ? (
            <span className="select-none text-[0.8rem] leading-none" aria-hidden="true">
              {icon}
            </span>
          ) : null}
          <Badge>{label}</Badge>
          <span className="min-w-0 flex-1 truncate">
            {entry.url ? (
              <a
                href={entry.url}
                target="_blank"
                rel="noreferrer"
                className="underline decoration-dotted underline-offset-2 hover:opacity-80"
              >
                {entry.title}
              </a>
            ) : (
              entry.title
            )}
          </span>
          <span
            className="shrink-0 text-[0.55rem] uppercase tracking-wider"
            style={{ color: c.color }}
          >
            {c.label}
          </span>
        </div>
      );
    }

    case "source-error":
      return (
        <div
          className="finding-in flex items-center gap-2 py-[3px] pl-2 border-l-2 text-xs md:text-sm"
          style={{ borderColor: ERROR_COLOR }}
        >
          <span style={{ color: ERROR_COLOR }} className="text-[0.7rem]">
            ⚠
          </span>
          <Badge>{entry.provider}</Badge>
          <span className="min-w-0 flex-1 truncate text-red-300/80">
            {entry.error}
          </span>
          <span className="shrink-0 text-[0.55rem] uppercase tracking-wider text-red-400">
            ERR
          </span>
        </div>
      );

    case "media":
      if (!entry.items?.length) return null;
      return <MediaGallery items={entry.items} accentText={accentText} />;

    case "ai":
      return (
        <div className="ai-reveal my-2 rounded-md border border-white/10 bg-white/[0.02] p-3">
          <div className={`flex items-center gap-2 text-[0.7rem] uppercase tracking-widest mb-2 ${accentText}`}>
            <span>◈</span>
            <span>Análisis · IA</span>
            <span className="flex-1 h-px bg-current/20" />
          </div>
          <Markdown text={entry.text} className="text-xs md:text-sm text-white/85" />
        </div>
      );

    case "reasoning":
      return (
        <div className="finding-in flex items-start gap-2 py-[2px] pl-2 border-l-2 text-[0.7rem] md:text-xs" style={{ borderColor: "#ff004d" }}>
          <span className="select-none text-[#ff004d]/80">◇</span>
          <span className="text-white/40 shrink-0">paso {entry.step}</span>
          <span className="min-w-0 flex-1">
            <span className="text-white/80">{entry.thought}</span>
            {entry.action ? (
              <span className="text-[#ff004d]/70"> → {entry.action}</span>
            ) : null}
          </span>
        </div>
      );

    case "done":
      return (
        <div className="scan-done mt-1 mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-white/10 pt-1 text-[0.65rem] uppercase tracking-wider">
          <span style={{ color: CONFIDENCE.high.color }}>
            ✓ {entry.findings} {entry.findings === 1 ? "hallazgo" : "hallazgos"}
          </span>
          {entry.errors ? (
            <span style={{ color: CONFIDENCE.medium.color }}>
              {entry.errors} {entry.errors === 1 ? "error" : "errores"}
            </span>
          ) : null}
          <span className="text-white/40">{entry.elapsed}ms</span>
          {entry.cost && (entry.cost.usd || entry.cost.breakdown?.length) ? (
            <span className="normal-case text-white/50">
              costo {fmtUsd(entry.cost.usd)}
              {entry.cost.breakdown?.length ? (
                <span className="text-white/35">
                  {" "}
                  ({entry.cost.breakdown.map((b) => fmtBreakdown(b)).join(" · ")})
                </span>
              ) : null}
            </span>
          ) : null}
        </div>
      );

    default:
      return null;
  }
}
