# Grafo + Auto-pivot best-first (Fase 3) — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Los escaneos auto/NL orquestan un auto-pivot best-first en el backend (de un objetivo → sus usuarios/emails/fotos → nuevos perfiles, hasta un presupuesto de nodos), y el frontend dibuja el grafo resultante (SVG radial) y lo guarda con su estructura en la bóveda.

**Architecture:** El backend (repo aparte) expone `GET /osint/graph/stream` que emite los eventos actuales MÁS `node`/`edge` (prompt 20). El frontend: `api.js` abre ese stream y reconoce los nuevos eventos; `scanRecord` acumula nodos/aristas y los incluye en el payload de guardado; `useTerminal` enruta los escaneos auto/NL al stream con grafo y, al `done`, empuja una entrada `graph`; `GraphView` (lazy, como `RouteMap`) la dibuja.

**Tech Stack:** Frontend React 19 + Vite + Vitest. Backend FastAPI (entregado como prompt, no implementado aquí).

**Spec:** `specs/v3-graph-vault-intelligence-design.md` (§5.1, §6.1, §6.2)

## Global Constraints

- JSX sin TypeScript; ESLint flat config; `no-unused-vars` ignora `^[A-Z_]`. `npm run lint` debe pasar con 0 errores.
- Build sale a `docs/`; nunca escribir specs/planes bajo `docs/`; no commitear `docs/` en la rama.
- Backend = repo separado; su trabajo se entrega como `specs/backend-prompts/20-graph-autopivot.md`.
- Vitest (jsdom). Tests deben verificar comportamiento real, no solo mocks. Mockear face-api/heavy con promesas pendientes cuando aplique.
- **Rulings de Fase 3 (contrato):**
  - Eventos nuevos en el stream: `node` `{id, kind, value, label, parent_id}` y `edge` `{src, dst, relation, confidence}`. `id`/refs son ids temporales de cliente (strings), coherentes con `/vault/save` (Fase 1).
  - El grafo se renderiza al `done` (no en vivo); los findings siguen fluyendo en vivo.
  - Findings/media/ai se guardan en el scan del nodo **raíz** (nodo sin `parent_id`); los nodos pivote se guardan sin scan propio (atribución por-nodo diferida).
  - Solo `runAutoScan` (auto/NL) usa `/osint/graph/stream`; los `osint <cat>` explícitos siguen en `/osint/<cat>/stream`.
  - `GraphView` = SVG radial por anillos de profundidad, nodos no-interactivos.

---

### Task 1: Prompt de backend (graph stream + auto-pivot)

**Files:**
- Create: `specs/backend-prompts/20-graph-autopivot.md`

- [ ] **Step 1: Escribir el prompt**

Crear `specs/backend-prompts/20-graph-autopivot.md` con este contenido exacto:

```markdown
# Prompt backend — v3 Fase 3: /osint/graph/stream (auto-pivot best-first + grafo)

> Continúa en el MISMO repo `rinnegan-api`. Copia el bloque y pásaselo al agente.

---

Añade `GET /osint/graph/stream?value=<v>&kind=<k>` (protegido con la auth existente; token por header o `?token=`). Es un escaneo AUTO que además **auto-pivota** y emite la estructura del grafo. NO rompas los endpoints/streams existentes (`/osint/auto/stream` sigue tal cual).

## Comportamiento

1. Corre el escaneo raíz sobre `value` (los providers que apliquen, incluido el `social` de la Fase 2 y el reverse-image sobre la mejor foto).
2. **Auto-pivot best-first:** mantén una cola de entidades candidatas descubiertas (usuarios/handles, emails, dominios, y perfiles hallados por dorks/reverse-image), priorizadas por confianza. Convierte las de mayor confianza en nodos nuevos y escanéalas (providers gratis; reverse-image en la mejor foto de cada nodo, como en Fase 2). Repite hasta agotar el presupuesto **`PIVOT_MAX_NODES`** (env, default 10). No hay límite de profundidad; el único tope es el total de nodos.

## Eventos (protocolo SSE existente + 2 nuevos)

Emite los eventos actuales (`meta`, `progress`, `finding`, `source_error`, `media`, `ai_report`, `done`) igual que `/osint/auto/stream`, MÁS:

- `node` → `{ "id": "n0", "kind": "name", "value": "Carlos Sánchez", "label": "Carlos Sánchez", "parent_id": null }`
  - El nodo raíz lleva `parent_id: null`. Cada pivote lleva el `id` del nodo del que nació. Los `id` son strings temporales estables durante el stream (ej. `n0`, `n1`, …), los mismos que luego el frontend manda a `/vault/save`.
- `edge` → `{ "src": "n0", "dst": "n1", "relation": "pivot", "confidence": 0.8 }`
  - `relation`: `pivot` (derivado del auto-pivot) | `reverse_image` (perfil hallado por reverse-image) | `same_face` (reservado).

Emite el `node` raíz al empezar y cada `node`/`edge` de pivote conforme los descubres (antes o junto a sus findings). El `ai_report` y el `done` se emiten una vez al final (síntesis global). El costo por escaneo llega en una fase posterior.

## Tests (pytest + respx, todo mockeado)

- El stream emite el `node` raíz (`parent_id: null`) y, con entidades pivotables mockeadas, nodos/edges adicionales hasta `PIVOT_MAX_NODES` (verifica el tope).
- Best-first: con confianzas distintas, los nodos de mayor confianza se expanden primero.
- Los eventos existentes (`finding`/`media`/`ai_report`/`done`) siguen emitiéndose.
- Sin token → 401. `ruff` limpio. README.

## Criterios de aceptación

1. `GET /osint/graph/stream` corre auto-pivot best-first con tope `PIVOT_MAX_NODES` (default 10) y emite `node`/`edge` además de los eventos actuales.
2. No rompe `/osint/auto/stream` ni los demás endpoints.
3. Protegido (401 sin token). Tests verdes + `ruff` + README.

## NO hagas

- No elimines `/osint/auto/stream`. No hagas fan-out sin tope (respeta `PIVOT_MAX_NODES`). No añadas todavía `/faces/match` ni `/usage`.
```

- [ ] **Step 2: Commit**

```bash
git add specs/backend-prompts/20-graph-autopivot.md
git commit -m "docs: backend prompt 20 (graph stream + auto-pivot)"
```

---

### Task 2: `api.js` — `streamOsintGraph` + eventos `node`/`edge`

**Files:**
- Modify: `src/services/api.js`
- Test: `src/services/api.test.js`

**Interfaces:**
- Consumes: patrón de `streamOsint` existente (EventSource + `SSE_EVENTS`).
- Produces: `streamOsintGraph(value, kind, handlers) → { close }`; `SSE_EVENTS` incluye `"node"` y `"edge"`.

- [ ] **Step 1: Escribir los tests que fallan**

Añadir a `src/services/api.test.js`:

```js
import { streamOsintGraph } from "./api";

describe("streamOsintGraph", () => {
  it("abre /osint/graph/stream con value y kind, y despacha node/edge", () => {
    const node = vi.fn();
    const edge = vi.fn();
    streamOsintGraph("Carlos", "name", { node, edge });
    expect(FakeEventSource.last.url).toContain("/osint/graph/stream");
    expect(FakeEventSource.last.url).toContain("value=Carlos");
    expect(FakeEventSource.last.url).toContain("kind=name");

    FakeEventSource.last.emit("node", JSON.stringify({ id: "n0", kind: "name", value: "Carlos", parent_id: null }));
    FakeEventSource.last.emit("edge", JSON.stringify({ src: "n0", dst: "n1", relation: "pivot" }));
    expect(node).toHaveBeenCalledWith({ id: "n0", kind: "name", value: "Carlos", parent_id: null });
    expect(edge).toHaveBeenCalledWith({ src: "n0", dst: "n1", relation: "pivot" });
  });
});
```

**Importante (scoping de `FakeEventSource`):** en `src/services/api.test.js` la clase `FakeEventSource` está declarada DENTRO de `describe("streamOsint", () => { … })`, así que el nuevo `describe` no la ve. Haz esto exactamente:
1. **Mueve la declaración `class FakeEventSource { … }` a nivel de módulo** (arriba del archivo, tras los imports), fuera de `describe("streamOsint")`. Los tests de `streamOsint` siguen funcionando igual (su `beforeEach` que hace `vi.stubGlobal("EventSource", FakeEventSource)` ahora referencia la clase de módulo).
2. En el nuevo `describe("streamOsintGraph", …)`, añade su propio `beforeEach(() => vi.stubGlobal("EventSource", FakeEventSource));` antes del `it`.

No dupliques la clase; debe existir una sola vez a nivel de módulo.

- [ ] **Step 2: Correr los tests y verlos fallar**

Run: `npm test -- src/services/api.test.js`
Expected: FAIL — `streamOsintGraph is not a function`.

- [ ] **Step 3: Implementar**

En `src/services/api.js`:

(a) Añadir `"node"` y `"edge"` a `SSE_EVENTS` (la lista existente ~línea 148). Debe quedar:

```js
const SSE_EVENTS = [
  "meta",
  "progress",
  "finding",
  "source_error",
  "media",
  "ai_report",
  "node",
  "edge",
  "done",
];
```

(b) Refactor mínimo para no duplicar la lógica de EventSource: extraer el cuerpo de `streamOsint` a un helper que reciba la URL ya construida, y que tanto `streamOsint` como `streamOsintGraph` la usen. Reemplazar la función `streamOsint` existente por:

```js
// Abre un EventSource contra `url` (con ?token=) y despacha SSE_EVENTS a handlers.
function openEventStream(url, handlers) {
  const token = getToken();
  if (token) url.searchParams.set("token", token);

  const source = new EventSource(url.toString());
  let finished = false;

  const parse = (raw) => {
    try {
      return raw ? JSON.parse(raw) : null;
    } catch {
      return raw;
    }
  };

  for (const name of SSE_EVENTS) {
    source.addEventListener(name, (e) => {
      if (name === "done") finished = true;
      handlers[name]?.(parse(e.data));
      if (name === "done") source.close();
    });
  }

  source.onerror = () => {
    if (finished) return;
    handlers.error?.(
      new Error("No se pudo conectar con el backend o se perdió la conexión.")
    );
    source.close();
  };

  return {
    close: () => {
      finished = true;
      source.close();
    },
  };
}

/**
 * Abre un stream SSE contra GET /osint/<category>/stream?value=...
 * El token va como ?token= porque EventSource no admite cabeceras.
 */
export function streamOsint(category, value, handlers = {}) {
  const url = new URL(`/osint/${category}/stream`, BASE_URL);
  url.searchParams.set("value", value);
  return openEventStream(url, handlers);
}

/**
 * Igual que streamOsint pero contra /osint/graph/stream (auto-pivot + grafo):
 * además de los eventos normales, emite `node` y `edge`.
 */
export function streamOsintGraph(value, kind, handlers = {}) {
  const url = new URL("/osint/graph/stream", BASE_URL);
  url.searchParams.set("value", value);
  if (kind) url.searchParams.set("kind", kind);
  return openEventStream(url, handlers);
}
```

(Verifica que no queden restos de la implementación anterior de `streamOsint` que abrían el EventSource inline; la nueva `streamOsint` delega en `openEventStream`.)

- [ ] **Step 4: Correr los tests y verlos pasar**

Run: `npm test -- src/services/api.test.js`
Expected: PASS (incluidos los tests de `streamOsint` existentes, que siguen verdes con el refactor).

- [ ] **Step 5: Commit**

```bash
git add src/services/api.js src/services/api.test.js
git commit -m "feat(api): streamOsintGraph + node/edge SSE events"
```

---

### Task 3: `scanRecord` — acumular nodos/aristas + payload multi-nodo

**Files:**
- Modify: `src/utils/scanRecord.js`
- Test: `src/utils/scanRecord.test.js`

**Interfaces:**
- Consumes: eventos `{ scan: "node", ... }` / `{ scan: "edge", ... }` (los empujará `useTerminal`).
- Produces: `createScanRecord` inicializa `nodes:[]`, `edges:[]`; `applyScanEvent` maneja `node`/`edge`; `toSavePayload` emite el grafo acumulado (raíz + pivotes) atando el scan al nodo raíz, con fallback al nodo sintético `n0` si no hubo eventos de grafo.

- [ ] **Step 1: Escribir los tests que fallan**

Añadir a `src/utils/scanRecord.test.js`:

```js
describe("scanRecord · grafo", () => {
  it("acumula eventos node/edge en el registro", () => {
    let r = createScanRecord({ kind: "name", query: "Carlos" });
    r = applyScanEvent(r, { scan: "node", id: "n0", kind: "name", value: "Carlos", label: "Carlos", parent_id: null });
    r = applyScanEvent(r, { scan: "node", id: "n1", kind: "username", value: "carlos99", label: "carlos99", parent_id: "n0" });
    r = applyScanEvent(r, { scan: "edge", src: "n0", dst: "n1", relation: "pivot", confidence: 0.8 });
    expect(r.nodes).toHaveLength(2);
    expect(r.nodes[1]).toMatchObject({ id: "n1", kind: "username", parent_id: "n0" });
    expect(r.edges).toEqual([{ src: "n0", dst: "n1", relation: "pivot", confidence: 0.8 }]);
  });

  it("toSavePayload emite el grafo acumulado y ata el scan al nodo raíz (sin parent_id)", () => {
    let r = createScanRecord({ kind: "name", query: "Carlos" });
    r = applyScanEvent(r, { scan: "node", id: "n0", kind: "name", value: "Carlos", label: "Carlos", parent_id: null });
    r = applyScanEvent(r, { scan: "node", id: "n1", kind: "username", value: "carlos99", label: "carlos99", parent_id: "n0" });
    r = applyScanEvent(r, { scan: "edge", src: "n0", dst: "n1", relation: "pivot", confidence: 0.8 });
    r = applyScanEvent(r, { scan: "finding", provider: "ddg", source: "instagram", title: "@carlos", url: null, confidence: "high" });
    r = applyScanEvent(r, { scan: "done", findings: 1, errors: 0, elapsed: 5000 });
    const p = toSavePayload(r);
    expect(p.root).toBe("n0");
    expect(p.nodes.map((n) => n.id)).toEqual(["n0", "n1"]);
    expect(p.edges).toHaveLength(1);
    expect(p.scans).toHaveLength(1);
    expect(p.scans[0].node).toBe("n0");
    expect(p.scans[0].findings).toHaveLength(1);
    expect(p.scans[0].elapsed_ms).toBe(5000);
  });

  it("sin eventos de grafo, cae al nodo sintético n0 (compat Fase 1)", () => {
    let r = createScanRecord({ kind: "username", query: "carlos99" });
    r = applyScanEvent(r, { scan: "done", findings: 0, errors: 0, elapsed: 100 });
    const p = toSavePayload(r);
    expect(p.root).toBe("n0");
    expect(p.nodes).toEqual([{ id: "n0", kind: "username", value: "carlos99", label: "carlos99" }]);
    expect(p.edges).toEqual([]);
    expect(p.scans[0].node).toBe("n0");
  });
});
```

- [ ] **Step 2: Correr los tests y verlos fallar**

Run: `npm test -- src/utils/scanRecord.test.js`
Expected: FAIL — `node`/`edge` no se acumulan; `toSavePayload` aún sintetiza siempre `n0`.

- [ ] **Step 3: Implementar**

En `src/utils/scanRecord.js`:

(a) En `createScanRecord`, añadir `nodes: []` y `edges: []`:

```js
export function createScanRecord({ kind, query } = {}) {
  return {
    kind: kind || "auto",
    query: query || "",
    findings: [],
    media: [],
    nodes: [],
    edges: [],
    ai_report: null,
    summary: null,
  };
}
```

(b) En `applyScanEvent`, añadir los casos `node` y `edge` (antes del `default`):

```js
    case "node":
      return {
        ...record,
        nodes: [
          ...record.nodes,
          {
            id: entry.id,
            kind: entry.kind,
            value: entry.value,
            label: entry.label,
            parent_id: entry.parent_id ?? null,
          },
        ],
      };
    case "edge":
      return {
        ...record,
        edges: [
          ...record.edges,
          {
            src: entry.src,
            dst: entry.dst,
            relation: entry.relation,
            confidence: entry.confidence ?? null,
          },
        ],
      };
```

(c) Reemplazar `toSavePayload` por la versión que usa el grafo acumulado con fallback:

```js
export function toSavePayload(record) {
  const scan = {
    query: record.query,
    findings: record.findings,
    media: record.media,
    ai_report: record.ai_report,
    elapsed_ms: record.summary?.elapsed ?? null,
  };

  if (record.nodes.length) {
    const root =
      record.nodes.find((n) => !n.parent_id) || record.nodes[0];
    return {
      root: root.id,
      nodes: record.nodes.map((n) => ({
        id: n.id,
        kind: n.kind,
        value: n.value,
        label: n.label,
      })),
      edges: record.edges.map((e) => ({
        src: e.src,
        dst: e.dst,
        relation: e.relation,
        confidence: e.confidence,
      })),
      scans: [{ node: root.id, ...scan }],
      faces: [],
    };
  }

  // Fallback (compat Fase 1): un solo nodo sintético raíz.
  const rootId = "n0";
  return {
    root: rootId,
    nodes: [
      { id: rootId, kind: record.kind, value: record.query, label: record.query },
    ],
    edges: [],
    scans: [{ node: rootId, ...scan }],
    faces: [],
  };
}
```

- [ ] **Step 4: Correr los tests y verlos pasar**

Run: `npm test -- src/utils/scanRecord.test.js`
Expected: PASS (incluidos los tests previos de scanRecord, que siguen verdes — el fallback reproduce el comportamiento Fase 1).

- [ ] **Step 5: Commit**

```bash
git add src/utils/scanRecord.js src/utils/scanRecord.test.js
git commit -m "feat(vault): accumulate graph nodes/edges; multi-node save payload"
```

---

### Task 4: `GraphView` (SVG radial, lazy) + wiring en `OutputLine`

**Files:**
- Create: `src/components/GraphView.jsx`
- Test: `src/components/GraphView.test.jsx`
- Modify: `src/components/OutputLine.jsx`

**Interfaces:**
- Consumes: entrada `{ type: "graph", data: { nodes, edges } }`.
- Produces: `<GraphView data={…} />` (default export) — dibuja el grafo; lazy-loaded desde `OutputLine`.

- [ ] **Step 1: Escribir el test que falla**

Crear `src/components/GraphView.test.jsx`:

```jsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import GraphView from "./GraphView";

describe("GraphView", () => {
  it("dibuja los nodos con sus labels y una arista", () => {
    const data = {
      nodes: [
        { id: "n0", kind: "name", value: "Carlos", label: "Carlos", parent_id: null },
        { id: "n1", kind: "username", value: "carlos99", label: "carlos99", parent_id: "n0" },
      ],
      edges: [{ src: "n0", dst: "n1", relation: "pivot" }],
    };
    const { container } = render(<GraphView data={data} />);
    expect(screen.getByText("Carlos")).toBeTruthy();
    expect(screen.getByText("carlos99")).toBeTruthy();
    // una arista => un <line>
    expect(container.querySelectorAll("line").length).toBe(1);
  });

  it("estado vacío cuando no hay nodos", () => {
    render(<GraphView data={{ nodes: [], edges: [] }} />);
    expect(screen.getByText(/sin grafo/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Correr el test y verlo fallar**

Run: `npm test -- src/components/GraphView.test.jsx`
Expected: FAIL — módulo no existe.

- [ ] **Step 3: Implementar `GraphView.jsx`**

Crear `src/components/GraphView.jsx`:

```jsx
// src/components/GraphView.jsx
// Grafo del escaneo (raíz + pivotes) como SVG radial: la raíz al centro y los
// pivotes en anillos por profundidad. Se carga en chunk aparte (lazy) desde
// OutputLine. No interactivo: el auto-pivot es automático en el backend.
import { useMemo } from "react";

const KIND_COLOR = {
  name: "#a78bfa",
  username: "#f0abfc",
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
  const nodes = data?.nodes || [];
  const edges = data?.edges || [];
  const layout = useMemo(
    () => (nodes.length ? computeLayout(nodes) : null),
    [nodes]
  );

  if (!layout) {
    return (
      <div className="my-2 text-xs text-white/40">◌ sin grafo para este escaneo.</div>
    );
  }

  const { pos, size, rootId } = layout;

  return (
    <div className="ai-reveal my-2 rounded-md border border-white/10 bg-white/[0.02] p-3">
      <div className="mb-2 flex items-center gap-2 text-[0.7rem] uppercase tracking-widest text-fuchsia-300/80">
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
                stroke="#a78bfa55"
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
```

- [ ] **Step 4: Correr el test y verlo pasar**

Run: `npm test -- src/components/GraphView.test.jsx`
Expected: PASS.

- [ ] **Step 5: Cablear en `OutputLine` (lazy, como `RouteMap`)**

En `src/components/OutputLine.jsx`:

(a) Añadir el lazy import junto al de `RouteMap` (~línea 6):

```js
const GraphView = lazy(() => import("./GraphView"));
```

(b) Añadir el caso, tras el bloque `if (entry.type === "vault")` (o tras `scan` si no existe vault en este punto del árbol — colócalo junto a los otros `if (entry.type === …)`):

```js
  if (entry.type === "graph") {
    return (
      <Suspense
        fallback={
          <div className="my-2 text-xs text-violet-300/60">[grafo] dibujando…</div>
        }
      >
        <GraphView data={entry.data} />
      </Suspense>
    );
  }
```

- [ ] **Step 6: Correr la suite + lint**

Run: `npm test && npm run lint`
Expected: verdes, 0 errores.

- [ ] **Step 7: Commit**

```bash
git add src/components/GraphView.jsx src/components/GraphView.test.jsx src/components/OutputLine.jsx
git commit -m "feat(graph): radial GraphView (lazy) + OutputLine wiring"
```

---

### Task 5: `useTerminal` — enrutar auto/NL al graph stream + render del grafo

**Files:**
- Modify: `src/hooks/useTerminal.js`
- Test: `src/hooks/useTerminal.graph.test.js`

**Interfaces:**
- Consumes: `streamOsintGraph` (Task 2); `applyScanEvent` con casos `node`/`edge` (Task 3).
- Produces: `runAutoScan` usa `streamOsintGraph`; `beginScan` maneja `node`/`edge` (acumula, sin push por-nodo) y al `done` empuja `{ type: "graph", data }` si hubo nodos.

- [ ] **Step 1: Escribir el test que falla**

Crear `src/hooks/useTerminal.graph.test.js`:

```js
import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useTerminal } from "./useTerminal";
import * as api from "../services/api";

afterEach(() => vi.restoreAllMocks());

describe("useTerminal · grafo", () => {
  it("un escaneo auto/NL usa streamOsintGraph y, al done, empuja una entrada 'graph'", async () => {
    vi.spyOn(api, "streamOsintGraph").mockImplementation((value, kind, h) => {
      h.meta?.({});
      h.node?.({ id: "n0", kind: "name", value: "Carlos", label: "Carlos", parent_id: null });
      h.node?.({ id: "n1", kind: "username", value: "carlos99", label: "carlos99", parent_id: "n0" });
      h.edge?.({ src: "n0", dst: "n1", relation: "pivot", confidence: 0.8 });
      h.done?.({ summary: { findings: 0, errors: 0, elapsed_ms: 1000 } });
      return { close: () => {} };
    });

    const { result } = renderHook(() => useTerminal());
    await act(async () => {
      await result.current.handleCommand("osint carlos"); // AUTO → graph stream
    });

    await waitFor(() => {
      const graph = result.current.history.find((e) => e.type === "graph");
      expect(graph).toBeTruthy();
      expect(graph.data.nodes).toHaveLength(2);
      expect(graph.data.edges).toHaveLength(1);
    });
    expect(api.streamOsintGraph).toHaveBeenCalled();
  });
});
```

(Nota: `osint carlos` sin subtipo cae en AUTO → `handleOsintCommand("osint auto", ["carlos"])`. Este test exige que el modo AUTO use `streamOsintGraph`. `runAutoScan` ya es el punto AUTO para NL; en este task también el AUTO explícito (`osint <valor>`) debe pasar por el graph stream — ver Step 3(c).)

- [ ] **Step 2: Correr el test y verlo fallar**

Run: `npm test -- src/hooks/useTerminal.graph.test.js`
Expected: FAIL — AUTO usa `streamOsint("auto", …)`, no `streamOsintGraph`; no se empuja entrada `graph`.

- [ ] **Step 3: Implementar**

En `src/hooks/useTerminal.js`:

(a) Ampliar el import de `../services/api` para incluir `streamOsintGraph`:

```js
import {
  streamOsint,
  streamOsintGraph,
  streamOsintImage,
  planRoute,
  interpret,
  saveVault,
  getVaultGraph,
} from "../services/api";
```

(b) Cambiar `runAutoScan` para usar el graph stream (pasa `kind` opcional; por defecto deja que el backend detecte):

```js
  // Corre el escaneo AUTO con grafo + auto-pivot (detección + fan-out en backend).
  const runAutoScan = (value, kind) => {
    beginScan((handlers) => streamOsintGraph(value, kind, handlers), {
      kind: kind || "auto",
      queryFallback: value,
    });
  };
```

(c) En `handleOsintCommand`, enrutar el modo AUTO (`command === "osint auto"`) por `runAutoScan` (graph stream), dejando los subtipos explícitos en `streamOsint`. Reemplazar el cuerpo final de `handleOsintCommand` (la parte que llama `beginScan((handlers) => streamOsint(category, value, handlers), …)`) por:

```js
    if (command === "osint auto") {
      runAutoScan(value);
      return;
    }

    beginScan((handlers) => streamOsint(category, value, handlers), {
      kind: category,
      queryFallback: value,
    });
```

(d) En `beginScan`, añadir los handlers `node` y `edge` al objeto pasado a `openStream({ … })` (usan `pushScan`-style pero SIN empujar al historial: solo acumulan en el registro). Añadir, junto a los otros handlers (p. ej. tras `media`):

```js
      node: (d) => {
        if (!d) return;
        currentScanRef.current = applyScanEvent(currentScanRef.current, {
          scan: "node",
          id: d.id,
          kind: d.kind,
          value: d.value,
          label: d.label,
          parent_id: d.parent_id ?? null,
        });
      },
      edge: (d) => {
        if (!d) return;
        currentScanRef.current = applyScanEvent(currentScanRef.current, {
          scan: "edge",
          src: d.src,
          dst: d.dst,
          relation: d.relation,
          confidence: d.confidence ?? null,
        });
      },
```

(e) En el handler `done` de `beginScan`, ANTES de fijar `pendingSaveRef` y empujar el prompt de guardado (Fase 1), empujar la entrada del grafo si hubo nodos. Es decir, tras `pushScan({ … scan: "done" … })`:

```js
        if (currentScanRef.current?.nodes?.length) {
          pushToHistory({
            type: "graph",
            data: {
              nodes: currentScanRef.current.nodes,
              edges: currentScanRef.current.edges,
            },
          });
        }
```

(Deja el resto del handler `done` igual: el `pendingSaveRef.current = currentScanRef.current`, el prompt `◈ ¿archivar…`, y `finish()`.)

- [ ] **Step 4: Correr el test y verlo pasar**

Run: `npm test -- src/hooks/useTerminal.graph.test.js`
Expected: PASS.

- [ ] **Step 5: Correr toda la suite + lint**

Run: `npm test && npm run lint`
Expected: todas verdes (incluidos `useTerminal.vault.test.js` y los demás), 0 errores.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useTerminal.js src/hooks/useTerminal.graph.test.js
git commit -m "feat(graph): route auto/NL scans through graph stream; render graph on done"
```

---

### Task 6: Verificación de la fase

- [ ] **Step 1: Lint + suite + build**

Run: `npm run lint && npm test && npm run build`
Expected: lint 0, todos los tests verdes, build OK (verifica que `GraphView` sale en su propio chunk lazy).

- [ ] **Step 2: Verificación en navegador (con el backend del prompt 20 desplegado)**

Con sesión iniciada y el prompt 20 desplegado:
1. Correr un escaneo NL/auto de una persona.
2. Confirmar que los hallazgos fluyen en vivo y, al terminar, aparece el panel "◇ Grafo · N nodos" con la raíz al centro y los pivotes en anillos.
3. Responder `s` al prompt de guardado; ejecutar `boveda` y confirmar que los nodos pivote quedaron guardados (estructura del grafo).

- [ ] **Step 3: (No commitear `docs/` en la rama.)**

---

## Notas de handoff

- Fase 3 del spec v3 (§9), la pieza mayor. El grueso de la orquestación best-first vive en el backend (prompt 20); el frontend acumula y visualiza.
- Rulings: grafo al `done` (no en vivo); findings guardados en el scan de la raíz (atribución por-nodo diferida); solo auto/NL usa el graph stream.
- Fase 4 = correlación facial cross-scan (`/faces/match` + alertas en `MediaGallery`). Fase 5 = cuotas + costo USD.
- Contrato clave: eventos `node`/`edge` con ids temporales de cliente, coherentes con `/vault/save` (Fase 1) y con el prompt 20.
