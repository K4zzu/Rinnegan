// src/components/DossierView.jsx
// Dossier de una investigación: identidad + ocupación + info + cuentas + fotos
// + familia, con enlaces a las fuentes. Renderiza defensivamente (campos
// opcionales) y un estado "no concluyente".
import { platformIcon } from "../utils/platformIcon";

function Section({ title, children }) {
  return (
    <div className="mt-2">
      <div className="text-[0.6rem] uppercase tracking-widest text-white/40">{title}</div>
      <div className="text-xs md:text-sm text-white/85">{children}</div>
    </div>
  );
}

export default function DossierView({ data }) {
  const d = data || {};
  const id = d.identity || null;
  const pct = typeof id?.confidence === "number" ? Math.round(id.confidence * 100) : null;

  return (
    <div className="ai-reveal my-2 rounded-md border border-[#ff004d]/20 bg-white/[0.02] p-3">
      <div className="mb-1 flex items-center gap-2 text-[0.7rem] uppercase tracking-widest text-[#ff004d]/90">
        <span>◉</span>
        <span>Dossier</span>
        <span className="h-px flex-1 bg-current/20" />
        {d.note ? <span className="text-white/40">{d.note}</span> : null}
      </div>

      {id?.name ? (
        <div className="text-sm md:text-base font-semibold text-white">
          {id.name}
          {pct != null ? <span className="ml-2 text-[0.7rem] text-emerald-300">{pct}% confianza</span> : null}
          {id.verified_by ? (
            <a href={id.verified_by} target="_blank" rel="noreferrer" className="ml-2 text-[0.6rem] text-[#00e5ff]/70 underline decoration-dotted">fuente</a>
          ) : null}
        </div>
      ) : (
        <div className="text-xs text-white/60">Identidad no determinable con la info dada.</div>
      )}

      {d.occupation ? <Section title="Ocupación">{d.occupation}</Section> : null}

      {d.personal_info?.length ? (
        <Section title="Info personal">
          <ul className="list-disc pl-4">{d.personal_info.map((x, i) => <li key={i}>{x}</li>)}</ul>
        </Section>
      ) : null}

      {d.accounts?.length ? (
        <Section title="Cuentas">
          <ul className="space-y-0.5">
            {d.accounts.map((a, i) => (
              <li key={i} className="flex items-center gap-2">
                <span aria-hidden="true">{platformIcon(a.platform) || "•"}</span>
                <a href={a.url} target="_blank" rel="noreferrer" className="underline decoration-dotted hover:opacity-80">
                  {a.platform}{a.handle ? ` · @${a.handle}` : ""}
                </a>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {d.photos?.length ? (
        <Section title="Fotos">
          <div className="flex flex-wrap gap-2">
            {d.photos.map((p, i) => (
              <a key={i} href={p.source || p.image_url} target="_blank" rel="noreferrer" title={p.source}>
                <img src={p.image_url} alt={p.source || "foto"} loading="lazy" className="h-14 w-14 rounded object-cover border border-white/10" />
              </a>
            ))}
          </div>
        </Section>
      ) : null}

      {d.family?.length ? (
        <Section title="Familia">
          <ul className="space-y-0.5">
            {d.family.map((f, i) => (
              <li key={i}>
                <span className="text-[#ff004d]/80">{f.relation}</span>: <span className="text-white/90">{f.name}</span>
                {f.note ? <span className="text-white/50"> — {f.note}</span> : null}
                {f.url ? <a href={f.url} target="_blank" rel="noreferrer" className="ml-1 text-[0.6rem] text-[#00e5ff]/70 underline decoration-dotted">fuente</a> : null}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <div className="mt-2 text-[0.6rem] text-white/30">— datos OSINT sin verificación legal; validar antes de actuar.</div>
    </div>
  );
}
