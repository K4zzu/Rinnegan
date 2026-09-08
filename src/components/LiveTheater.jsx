// src/components/LiveTheater.jsx
// Panel-teatro en vivo (consola dividida DedSec): mientras corre un escaneo,
// muestra el razonamiento en streaming (izq), las caras + contadores (der) y
// los providers activos (abajo). Puramente presentacional sobre `liveScan`.
import GodEye from "./GodEye";

export default function LiveTheater({ liveScan, statusText }) {
  if (!liveScan || liveScan.status !== "running") return null;
  const { reasoning = [], findings = 0, providers = [], media = [] } = liveScan;
  const lastReasoning = reasoning.slice(-5);
  const lastMedia = media.slice(-4);

  return (
    <div className="ds-grunge ds-scanlines datamosh-in my-2 rounded-md border border-[#c8ff2f]/25 bg-[#0b0b0d]/80 p-3">
      <div className="mb-2 flex items-center gap-2 text-[0.7rem] uppercase tracking-widest text-[#c8ff2f]">
        <span className="h-4 w-4 shrink-0"><GodEye state="scanning" /></span>
        <span className="ds-glitch font-bold">RINNEGAN</span>
        <span className="text-white/40">// {liveScan.kind}</span>
        <span className="ml-auto text-[#ff004d] animate-pulse">■ EN VIVO</span>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1.1fr_1fr]">
        {/* Razonamiento (izq) */}
        <div className="min-w-0 text-[0.7rem] leading-relaxed">
          <div className="text-white/40 uppercase tracking-widest text-[0.55rem] mb-1">Razonamiento</div>
          {lastReasoning.length ? (
            lastReasoning.map((r, i) => (
              <div key={i} className="datamosh-in truncate">
                <span className="text-[#ff2bd6]">◇ {r.step}</span>{" "}
                <span className="text-white/80">{r.thought}</span>
                {r.action ? <span className="text-[#00e5ff]"> → {r.action}</span> : null}
              </div>
            ))
          ) : (
            <div className="text-white/40 animate-pulse">{statusText || "procesando…"}</div>
          )}
        </div>

        {/* Caras + contadores (der) */}
        <div className="min-w-0">
          {lastMedia.length ? (
            <div className="flex flex-wrap gap-2">
              {lastMedia.map((m, i) => (
                <div key={i} className="ds-sweep h-12 w-12 overflow-hidden rounded border border-[#c8ff2f]/40">
                  <img src={m.image_url} alt={m.source || "cara"} loading="lazy" className="h-full w-full object-cover opacity-80" />
                </div>
              ))}
            </div>
          ) : null}
          <div className="mt-2 flex gap-3 text-[0.6rem]">
            <span><span className="text-[#c8ff2f] text-sm font-bold">{findings}</span> hallazgos</span>
            <span><span className="text-[#00e5ff] text-sm font-bold">{providers.length}</span> providers</span>
          </div>
        </div>
      </div>

      {/* Providers activos (abajo) */}
      {providers.length ? (
        <div className="mt-2 flex flex-wrap gap-1.5 border-t border-white/10 pt-2">
          {providers.map((p) => (
            <span key={p} className="ds-neon text-[0.55rem] uppercase tracking-wide border border-[#c8ff2f]/40 rounded px-1 text-[#c8ff2f]">
              {p}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-2 text-[0.55rem] text-white/30">ctrl+c para abortar</div>
    </div>
  );
}
