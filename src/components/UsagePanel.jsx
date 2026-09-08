// src/components/UsagePanel.jsx
// Panel de cuotas + costo (comando `cuotas`). Barra por proveedor (usado/límite),
// cuándo renueva, y el costo USD acumulado del periodo.
export default function UsagePanel({ data }) {
  const providers = data?.providers || [];

  if (!providers.length) {
    return (
      <div className="my-2 text-xs text-white/40">◭ sin datos de uso todavía.</div>
    );
  }

  return (
    <div className="ai-reveal my-2 rounded-md border border-white/10 bg-white/[0.02] p-3">
      <div className="mb-2 flex items-center gap-2 text-[0.7rem] uppercase tracking-widest text-[#ff004d]/80">
        <span>◭</span>
        <span>Cuotas y costo · {data?.period === "day" ? "hoy" : "este mes"}</span>
        <span className="h-px flex-1 bg-current/20" />
      </div>
      <ul className="space-y-2 text-xs md:text-sm">
        {providers.map((p) => {
          const pct =
            p.limit ? Math.min(100, Math.round((p.used / p.limit) * 100)) : null;
          return (
            <li key={p.name}>
              <div className="flex items-center gap-2">
                <span className="text-white/90">{p.name}</span>
                <span className="ml-auto text-white/60">
                  {p.used}
                  {p.limit ? `/${p.limit}` : ""} {p.unit || ""}
                </span>
              </div>
              {pct != null ? (
                <div className="mt-1 h-1 w-full overflow-hidden rounded bg-white/10">
                  <div
                    className="h-full rounded bg-[#c8ff2f]/70"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              ) : null}
              <div className="mt-0.5 text-[0.6rem] text-white/40">
                {p.resets_at ? `renueva ${p.resets_at}` : "sin límite"}
                {typeof p.cost_usd === "number" && p.cost_usd > 0
                  ? ` · $${p.cost_usd.toFixed(2)}`
                  : ""}
              </div>
            </li>
          );
        })}
      </ul>
      <div className="mt-2 border-t border-white/10 pt-1 text-[0.7rem] text-emerald-300">
        total estimado: ${(data?.total_cost_usd ?? 0).toFixed(2)}
      </div>
    </div>
  );
}
