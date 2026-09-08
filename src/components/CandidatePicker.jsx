// src/components/CandidatePicker.jsx
// Cuando la investigación encuentra varios candidatos ambiguos, muestra tarjetas
// clicables. Al elegir uno, onPick(candidate) re-lanza la investigación enfocada.
export default function CandidatePicker({ items, onPick }) {
  const candidates = items || [];
  if (!candidates.length) return null;

  return (
    <div className="ai-reveal my-2 rounded-md border border-amber-400/30 bg-white/[0.02] p-3">
      <div className="mb-2 flex items-center gap-2 text-[0.7rem] uppercase tracking-widest text-amber-300/90">
        <span>⚠</span>
        <span>Varios candidatos · elige a quien reconozcas</span>
        <span className="h-px flex-1 bg-current/20" />
      </div>
      <div className="flex flex-wrap gap-2">
        {candidates.map((c) => {
          const pct = typeof c.confidence === "number" ? Math.round(c.confidence * 100) : null;
          return (
            <button
              key={c.id || c.name}
              type="button"
              onClick={() => onPick?.(c)}
              className="flex w-40 flex-col gap-1 rounded border border-white/10 bg-white/[0.03] p-2 text-left hover:border-amber-300/60"
            >
              <div className="flex items-center gap-2">
                {c.image_url ? (
                  <img src={c.image_url} alt={c.name} loading="lazy" className="h-8 w-8 rounded object-cover" />
                ) : (
                  <span className="flex h-8 w-8 items-center justify-center rounded bg-white/5 text-white/40">?</span>
                )}
                <span className="min-w-0 flex-1 truncate text-xs font-semibold text-white/90">{c.name}</span>
              </div>
              {c.why ? <span className="text-[0.6rem] leading-tight text-white/50">{c.why}</span> : null}
              {pct != null ? <span className="text-[0.55rem] text-emerald-300/80">{pct}%</span> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
