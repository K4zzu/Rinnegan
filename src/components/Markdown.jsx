// src/components/Markdown.jsx
// Renderer de markdown compacto y seguro para el reporte de IA. Cubre el
// subconjunto que produce el analista (encabezados ##, viñetas, **negrita**,
// `código`). Construye nodos React (no usa dangerouslySetInnerHTML → sin XSS).

const INLINE = /(\*\*([^*]+)\*\*|`([^`]+)`)/g;

function renderInline(text, keyBase) {
  const nodes = [];
  let last = 0;
  let i = 0;
  let m;
  INLINE.lastIndex = 0;
  while ((m = INLINE.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    if (m[2] !== undefined) {
      nodes.push(
        <strong key={`${keyBase}-b${i}`} className="font-semibold text-white">
          {m[2]}
        </strong>
      );
    } else if (m[3] !== undefined) {
      nodes.push(
        <code
          key={`${keyBase}-c${i}`}
          className="rounded bg-white/10 px-1 text-[0.85em]"
        >
          {m[3]}
        </code>
      );
    }
    last = m.index + m[0].length;
    i++;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export default function Markdown({ text, className = "" }) {
  const lines = (text || "").split("\n");
  const blocks = [];
  let list = null;

  const flushList = (key) => {
    if (list) {
      blocks.push(
        <ul key={key} className="my-1 space-y-0.5">
          {list}
        </ul>
      );
      list = null;
    }
  };

  lines.forEach((line, idx) => {
    const l = line.trimEnd();

    if (/^#{1,3}\s+/.test(l)) {
      flushList(`fl-${idx}`);
      blocks.push(
        <div
          key={idx}
          className="mt-2 mb-1 text-[0.7rem] font-semibold uppercase tracking-widest opacity-90"
        >
          {renderInline(l.replace(/^#{1,3}\s+/, ""), `h-${idx}`)}
        </div>
      );
    } else if (/^\s*[-•*]\s+/.test(l)) {
      list ||= [];
      list.push(
        <li key={idx} className="flex gap-2">
          <span className="select-none opacity-50">▸</span>
          <span className="min-w-0">
            {renderInline(l.replace(/^\s*[-•*]\s+/, ""), `li-${idx}`)}
          </span>
        </li>
      );
    } else if (l === "") {
      flushList(`fl-${idx}`);
    } else {
      flushList(`fl-${idx}`);
      blocks.push(
        <p key={idx} className="my-1">
          {renderInline(l, `p-${idx}`)}
        </p>
      );
    }
  });

  flushList("fl-end");

  return <div className={`break-words leading-snug ${className}`}>{blocks}</div>;
}
