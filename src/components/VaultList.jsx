// src/components/VaultList.jsx
// Lista los objetivos guardados en la bóveda (grafo persistido). En Fase 1 es
// una lista; la vista de grafo visual llega en una fase posterior.
const KIND_ICON = {
  name: "👤",
  username: "@",
  email: "✉",
  phone: "☎",
  domain: "🌐",
  ip: "▤",
  image: "🖼",
};

export default function VaultList({ data }) {
  const nodes = data?.nodes || [];

  if (!nodes.length) {
    return (
      <div className="my-2 text-xs text-white/40">
        ◈ bóveda vacía — archiva un escaneo respondiendo <b>s</b> al terminar.
      </div>
    );
  }

  return (
    <div className="ai-reveal my-2 rounded-md border border-white/10 bg-white/[0.02] p-3">
      <div className="mb-2 flex items-center gap-2 text-[0.7rem] uppercase tracking-widest text-[#ff004d]/80">
        <span>◈</span>
        <span>Bóveda · {nodes.length} objetivo{nodes.length === 1 ? "" : "s"}</span>
        <span className="h-px flex-1 bg-current/20" />
      </div>
      <ul className="space-y-1 text-xs md:text-sm">
        {nodes.map((n) => (
          <li key={n.id} className="flex items-center gap-2">
            <span className="w-4 select-none text-center text-white/60" aria-hidden="true">
              {KIND_ICON[n.kind] || "•"}
            </span>
            <span className="text-white/90">{n.label || n.value}</span>
            <span className="text-[0.6rem] uppercase tracking-wide text-white/40">
              {n.kind}
            </span>
            {typeof n.scan_count === "number" ? (
              <span className="ml-auto text-[0.6rem] text-white/40">
                {n.scan_count} escaneo{n.scan_count === 1 ? "" : "s"}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
