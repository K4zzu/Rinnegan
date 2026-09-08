// src/components/GraphView.jsx
// Grafo del escaneo (raíz + pivotes) como SVG radial: la raíz al centro y los
// pivotes en anillos por profundidad. Se carga en chunk aparte (lazy) desde
// OutputLine. No interactivo: el auto-pivot es automático en el backend.
import { useMemo } from "react";

const KIND_COLOR = {
  name: "#c8ff2f",
  username: "#ff004d",
  email: "#34d399",
  phone: "#fbbf24",
  domain: "#38bdf8",
  ip: "#94a3b8",
  image: "#fb7185",
};
const RING = 90; // radio por nivel de profundidad
const NODE_R = 6;

function computeLayout(nodes) {
  const root = nodes.find((n) => !n.parent_id) || nodes[0];
  const depth = { [root.id]: 0 };
  const children = {};
  for (const n of nodes) {
    if (n.parent_id && n.parent_id !== n.id) {
      (children[n.parent_id] ||= []).push(n.id);
    }
  }
  const queue = [root.id];
  while (queue.length) {
    const id = queue.shift();
    for (const c of children[id] || []) {
      if (depth[c] == null) {
        depth[c] = depth[id] + 1;
        queue.push(c);
      }
    }
  }
  // Huérfanos (parent desconocido): anillo 1.
  for (const n of nodes) if (depth[n.id] == null) depth[n.id] = 1;

  const byDepth = {};
  for (const n of nodes) (byDepth[depth[n.id]] ||= []).push(n.id);
  const maxDepth = Math.max(0, ...Object.keys(byDepth).map(Number));
  const radius = maxDepth * RING + 48;
  const size = radius * 2;
  const cx = radius;
  const cy = radius;

  const pos = {};
  for (const [d, ids] of Object.entries(byDepth)) {
    const dd = Number(d);
    if (dd === 0) {
      pos[ids[0]] = { x: cx, y: cy };
      continue;
    }
    const step = (2 * Math.PI) / ids.length;
    ids.forEach((id, i) => {
      const ang = i * step - Math.PI / 2;
      pos[id] = {
        x: cx + Math.cos(ang) * dd * RING,
        y: cy + Math.sin(ang) * dd * RING,
      };
    });
  }
  return { pos, size, rootId: root.id };
}

export default function GraphView({ data }) {
  const layout = useMemo(
    () => {
      const nodes = data?.nodes || [];
      return nodes.length ? computeLayout(nodes) : null;
    },
    [data]
  );

  const nodes = data?.nodes || [];
  const edges = data?.edges || [];

  if (!layout) {
    return (
      <div className="my-2 text-xs text-white/40">◌ sin grafo para este escaneo.</div>
    );
  }

  const { pos, size, rootId } = layout;

  return (
    <div className="ai-reveal my-2 rounded-md border border-white/10 bg-white/[0.02] p-3">
      <div className="mb-2 flex items-center gap-2 text-[0.7rem] uppercase tracking-widest text-[#ff004d]/80">
        <span>◇</span>
        <span>Grafo · {nodes.length} nodo{nodes.length === 1 ? "" : "s"}</span>
        <span className="h-px flex-1 bg-current/20" />
      </div>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${size} ${size}`}
          className="mx-auto block"
          style={{ width: Math.min(size, 320), height: Math.min(size, 320) }}
          role="img"
          aria-label="grafo del escaneo"
        >
          {edges.map((e, i) => {
            const a = pos[e.src];
            const b = pos[e.dst];
            if (!a || !b) return null;
            return (
              <line
                key={i}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke="#c8ff2f55"
                strokeWidth="1"
              />
            );
          })}
          {nodes.map((n) => {
            const p = pos[n.id];
            if (!p) return null;
            const color = KIND_COLOR[n.kind] || "#c4b5fd";
            const isRoot = n.id === rootId;
            return (
              <g key={n.id}>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={isRoot ? NODE_R + 2 : NODE_R}
                  fill={color}
                  stroke={isRoot ? "#fff" : "#00000055"}
                  strokeWidth={isRoot ? 1.5 : 1}
                />
                <text
                  x={p.x}
                  y={p.y - (isRoot ? NODE_R + 6 : NODE_R + 4)}
                  textAnchor="middle"
                  fontSize="9"
                  fill="#e9d5ff"
                >
                  {n.label || n.value}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
