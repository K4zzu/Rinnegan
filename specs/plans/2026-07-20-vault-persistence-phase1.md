# Bóveda + Persistencia (Fase 1) — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que al terminar un escaneo se pregunte `¿archivar en la bóveda? [s/n]`, y al aceptar se persista el objetivo + snapshot del escaneo en el backend (SQLite); más un comando `boveda` para listar lo guardado.

**Architecture:** El frontend acumula los eventos del stream en un "registro de escaneo" (util pura). Al `done`, entra en modo pregunta; la respuesta `s` envía el payload a `POST /vault/save`. El backend (repo aparte `rinnegan-api`, vía prompt) crea las tablas y los endpoints `/vault/*`. La lógica pura (acumulación, payload, parseo de respuesta) va en utils testeables; el hook solo cablea.

**Tech Stack:** React 19 + Vite + Vitest. Backend FastAPI + SQLAlchemy/SQLite (entregado como prompt, no implementado aquí).

**Spec:** `specs/v3-graph-vault-intelligence-design.md`

## Global Constraints

- JSX sin TypeScript; ESLint flat config; `no-unused-vars` ignora nombres `^[A-Z_]`.
- Build sale a `docs/` (no `dist/`); `base: '/Rinnegan/'`. **Nunca** escribir specs/planes bajo `docs/` (el build lo vacía).
- El backend es un repo separado: su trabajo se entrega como archivo en `specs/backend-prompts/NN-*.md`, que el usuario pasa al agente de backend. No se implementa backend en este repo.
- Auth: token por header `Authorization: Bearer` (peticiones normales) o `?token=` (SSE/img). `request()` en `api.js` ya añade el header.
- Contrato de refs del grafo (forward-compat con Fase 3): en el payload de `/vault/save`, los `id` de nodo y los refs `src/dst/node` son **ids temporales de cliente** (strings tipo `"n0"`); el backend hace upsert por `(kind,value)` y remapea a ids reales.
- Tests: `npm test` (vitest) verde; `npm run lint` limpio; `npm run build` OK antes de cerrar la fase.

---

### Task 1: Prompt de backend (bóveda + persistencia)

Deliverable de documentación (no TDD): el prompt que el usuario pasará al agente de backend. Debe existir antes de que el frontend tenga contra qué hablar en verificación real, pero el frontend se desarrolla contra el contrato con mocks.

**Files:**
- Create: `specs/backend-prompts/18-vault-persistence.md`

- [ ] **Step 1: Escribir el prompt**

Crear `specs/backend-prompts/18-vault-persistence.md` con este contenido exacto:

```markdown
# Prompt backend — v3 Fase 1: bóveda (persistencia de investigaciones)

> Continúa en el MISMO repo `rinnegan-api`. Copia el bloque y pásaselo al agente.

---

Añade persistencia para investigaciones guardadas (la "bóveda") sobre el SQLite/SQLAlchemy que ya existe (el mismo `DB_PATH` de la auth). Tablas nuevas + endpoints, todos protegidos con la auth existente (token por header `Authorization` o `?token=`). NO toques la lógica OSINT ni el protocolo de streaming.

## Tablas (todas con `user_id`, creadas al arrancar)

- `nodes`: `id` (pk), `user_id` (fk users), `kind`, `value`, `label`, `created_at`. **Único `(user_id, kind, value)`**.
- `edges`: `id` (pk), `user_id`, `src_node_id` (fk nodes), `dst_node_id` (fk nodes), `relation`, `confidence` (float, nullable), `created_at`.
- `scans`: `id` (pk), `user_id`, `node_id` (fk nodes), `query`, `findings_json`, `media_json`, `ai_report` (text, null), `elapsed_ms` (int, null), `cost_usd` (float, default 0), `cost_breakdown_json` (null), `created_at`.
- `faces`: `id` (pk), `user_id`, `node_id` (fk nodes), `scan_id` (fk scans, null), `source`, `image_url`, `page_url` (null), `descriptor` (BLOB, null), `created_at`.

## Endpoints (todos bajo el usuario actual; 401 sin token)

- `POST /vault/save` — body:
  ```json
  {
    "root": "n0",
    "nodes": [{ "id": "n0", "kind": "name", "value": "Carlos Sánchez", "label": "Carlos Sánchez" }],
    "edges": [{ "src": "n0", "dst": "n1", "relation": "pivot", "confidence": 0.8 }],
    "scans": [{ "node": "n0", "query": "Carlos Sánchez", "findings": [], "media": [], "ai_report": "…", "elapsed_ms": 7800 }],
    "faces": [{ "node": "n0", "source": "github", "image_url": "…", "page_url": "…", "descriptor": [/*128 floats*/] }]
  }
  ```
  Los `id` de nodo y los refs `src/dst/node` son **ids temporales de cliente** (strings). Haz **upsert de cada nodo por `(user_id, kind, value)`**, construye un mapa `temp_id → id_real`, remapea `edges`/`scans`/`faces` y guarda. `findings`/`media` se guardan como JSON. `descriptor` (si viene) es lista de 128 floats → guárdalo como bytes (`struct.pack`). Devuelve `{ "graph_id": <id real del nodo root> }`. `cost_usd` queda en 0 en esta fase (el costo llega en una fase posterior).

- `GET /vault/graph` → `{ "nodes": [{ id, kind, value, label, created_at, scan_count }], "edges": [{ src, dst, relation, confidence }] }` del usuario.

- `GET /vault/node/{id}` → `{ "node": {…}, "scans": [{ id, query, findings, media, ai_report, elapsed_ms, cost_usd, created_at }], "faces": [{ id, source, image_url, page_url }] }`. 404 si el nodo no es del usuario.

- `DELETE /vault/node/{id}` → borra el nodo y sus `edges`/`scans`/`faces`. 204. 404 si no es del usuario.

## Tests (pytest)

- `/vault/save` roundtrip: guardar y leer; **upsert dedupe** (guardar dos veces el mismo `(kind,value)` reusa el nodo, no duplica).
- `/vault/graph` lista nodos+edges con `scan_count`.
- `/vault/node/{id}` devuelve scans+faces; **aislamiento por usuario** (user A no ve/borra nodos de user B → 404).
- `DELETE` borra en cascada.
- Auth: 401 sin token en los cuatro endpoints.
- `ruff` limpio. README actualizado.

## Criterios de aceptación

1. `POST /vault/save` persiste y **deduplica** nodos por `(kind,value)`; remapea refs temporales.
2. `GET /vault/graph`, `GET /vault/node/{id}`, `DELETE /vault/node/{id}` funcionan y respetan pertenencia.
3. Todo protegido (401 sin token). Tests verdes + `ruff` + README.

## NO hagas

- No rompas OSINT/streaming. No expongas datos de otros usuarios. `descriptor` nullable (la correlación facial llega en una fase posterior). No añadas todavía `/faces/match`, `/usage`, ni el grafo con pivot.
```

- [ ] **Step 2: Commit**

```bash
git add specs/backend-prompts/18-vault-persistence.md
git commit -m "docs: backend prompt 18 (vault persistence)"
```

---

### Task 2: Cliente de bóveda en `api.js`

**Files:**
- Modify: `src/services/api.js` (añadir 4 funciones tras `interpret`, ~línea 136)
- Test: `src/services/api.test.js`

**Interfaces:**
- Consumes: `request(path, opts)` existente de `api.js`.
- Produces: `saveVault(payload) → Promise<{graph_id}>`, `getVaultGraph() → Promise<{nodes,edges}>`, `getVaultNode(id) → Promise<object>`, `deleteVaultNode(id) → Promise<null>`.

- [ ] **Step 1: Escribir los tests que fallan**

Añadir a `src/services/api.test.js`:

```js
import { saveVault, getVaultGraph, getVaultNode, deleteVaultNode } from "./api";

describe("vault client", () => {
  it("saveVault hace POST a /vault/save con el payload", async () => {
    const payload = { root: "n0", nodes: [], edges: [], scans: [], faces: [] };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ graph_id: 7 }) })
    );
    const res = await saveVault(payload);
    expect(res).toEqual({ graph_id: 7 });
    const [url, opts] = vi.mocked(fetch).mock.calls[0];
    expect(url).toContain("/vault/save");
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body)).toEqual(payload);
  });

  it("getVaultGraph hace GET a /vault/graph", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ nodes: [], edges: [] }) })
    );
    const res = await getVaultGraph();
    expect(res).toEqual({ nodes: [], edges: [] });
    expect(vi.mocked(fetch).mock.calls[0][0]).toContain("/vault/graph");
  });

  it("deleteVaultNode hace DELETE a /vault/node/{id}", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 204 })
    );
    const res = await deleteVaultNode(42);
    expect(res).toBeNull();
    const [url, opts] = vi.mocked(fetch).mock.calls[0];
    expect(url).toContain("/vault/node/42");
    expect(opts.method).toBe("DELETE");
  });
});
```

- [ ] **Step 2: Correr los tests y verlos fallar**

Run: `npm test -- src/services/api.test.js`
Expected: FAIL — `saveVault is not a function` (no exportadas aún).

- [ ] **Step 3: Implementar las funciones**

En `src/services/api.js`, tras la función `interpret` (~línea 136), añadir:

```js
// ── Bóveda (investigaciones persistidas) ───────────────────────────────────
export function saveVault(payload) {
  return request("/vault/save", { method: "POST", json: payload });
}

export function getVaultGraph() {
  return request("/vault/graph");
}

export function getVaultNode(id) {
  return request(`/vault/node/${id}`);
}

export function deleteVaultNode(id) {
  return request(`/vault/node/${id}`, { method: "DELETE" });
}
```

- [ ] **Step 4: Correr los tests y verlos pasar**

Run: `npm test -- src/services/api.test.js`
Expected: PASS (todos).

- [ ] **Step 5: Commit**

```bash
git add src/services/api.js src/services/api.test.js
git commit -m "feat(api): vault client (save/graph/node/delete)"
```

---

### Task 3: Util `scanRecord` (acumulación + payload + respuesta)

**Files:**
- Create: `src/utils/scanRecord.js`
- Test: `src/utils/scanRecord.test.js`

**Interfaces:**
- Produces:
  - `createScanRecord({kind, query}) → record`
  - `applyScanEvent(record, entry) → record` (entry = la MISMA entrada `{type:"scan", scan, …}` que se envía al historial)
  - `toSavePayload(record) → {root, nodes, edges, scans, faces}`
  - `parseSaveAnswer(input) → "save" | "discard" | "invalid"`

- [ ] **Step 1: Escribir los tests que fallan**

Crear `src/utils/scanRecord.test.js`:

```js
import { describe, it, expect } from "vitest";
import {
  createScanRecord,
  applyScanEvent,
  toSavePayload,
  parseSaveAnswer,
} from "./scanRecord";

describe("scanRecord", () => {
  it("acumula start/finding/media/ai/done en el registro", () => {
    let r = createScanRecord({ kind: "auto", query: "Carlos" });
    r = applyScanEvent(r, { scan: "start", kind: "name", query: "Carlos Sánchez" });
    r = applyScanEvent(r, {
      scan: "finding", provider: "ddg", source: "instagram",
      title: "@carlos", url: "https://instagram.com/carlos", confidence: "high",
    });
    r = applyScanEvent(r, {
      scan: "media", items: [{ source: "github", image_url: "http://x/a.jpg" }],
    });
    r = applyScanEvent(r, { scan: "ai", text: "## Resumen" });
    r = applyScanEvent(r, { scan: "done", findings: 1, errors: 0, elapsed: 7800 });

    expect(r.kind).toBe("name");
    expect(r.query).toBe("Carlos Sánchez");
    expect(r.findings).toHaveLength(1);
    expect(r.findings[0].source).toBe("instagram");
    expect(r.media).toHaveLength(1);
    expect(r.ai_report).toBe("## Resumen");
    expect(r.summary.elapsed).toBe(7800);
  });

  it("toSavePayload arma un nodo raíz con el scan referenciándolo", () => {
    let r = createScanRecord({ kind: "name", query: "Carlos" });
    r = applyScanEvent(r, { scan: "finding", provider: "p", source: "s", title: "t", url: null, confidence: "low" });
    r = applyScanEvent(r, { scan: "done", findings: 1, errors: 0, elapsed: 100 });
    const p = toSavePayload(r);

    expect(p.root).toBe("n0");
    expect(p.nodes).toHaveLength(1);
    expect(p.nodes[0]).toMatchObject({ id: "n0", kind: "name", value: "Carlos", label: "Carlos" });
    expect(p.edges).toEqual([]);
    expect(p.scans).toHaveLength(1);
    expect(p.scans[0]).toMatchObject({ node: "n0", query: "Carlos", elapsed_ms: 100 });
    expect(p.scans[0].findings).toHaveLength(1);
    expect(p.faces).toEqual([]);
  });

  it("parseSaveAnswer reconoce guardar/descartar/inválido", () => {
    expect(parseSaveAnswer("s")).toBe("save");
    expect(parseSaveAnswer("Sí")).toBe("save");
    expect(parseSaveAnswer("yes")).toBe("save");
    expect(parseSaveAnswer("n")).toBe("discard");
    expect(parseSaveAnswer("no")).toBe("discard");
    expect(parseSaveAnswer("hola")).toBe("invalid");
  });
});
```

- [ ] **Step 2: Correr los tests y verlos fallar**

Run: `npm test -- src/utils/scanRecord.test.js`
Expected: FAIL — módulo no existe.

- [ ] **Step 3: Implementar el util**

Crear `src/utils/scanRecord.js`:

```js
// src/utils/scanRecord.js
// Acumula los eventos de un escaneo en un registro y lo convierte en el payload
// de /vault/save. Lógica pura y testeable (el hook solo la cablea).

export function createScanRecord({ kind, query } = {}) {
  return {
    kind: kind || "auto",
    query: query || "",
    findings: [],
    media: [],
    ai_report: null,
    summary: null,
  };
}

// `entry` es la misma entrada {type:"scan", scan, …} que va al historial.
export function applyScanEvent(record, entry) {
  switch (entry?.scan) {
    case "start":
      return {
        ...record,
        kind: entry.kind ?? record.kind,
        query: entry.query ?? record.query,
      };
    case "finding":
      return {
        ...record,
        findings: [
          ...record.findings,
          {
            provider: entry.provider,
            source: entry.source,
            title: entry.title,
            url: entry.url ?? null,
            confidence: entry.confidence ?? "low",
          },
        ],
      };
    case "media":
      return { ...record, media: [...record.media, ...(entry.items || [])] };
    case "ai":
      return { ...record, ai_report: entry.text ?? record.ai_report };
    case "done":
      return {
        ...record,
        summary: {
          findings: entry.findings ?? 0,
          errors: entry.errors ?? 0,
          elapsed: entry.elapsed ?? null,
        },
      };
    default:
      return record;
  }
}

// Fase 1: un solo nodo raíz, sin edges ni descriptores faciales.
export function toSavePayload(record) {
  const rootId = "n0";
  return {
    root: rootId,
    nodes: [
      { id: rootId, kind: record.kind, value: record.query, label: record.query },
    ],
    edges: [],
    scans: [
      {
        node: rootId,
        query: record.query,
        findings: record.findings,
        media: record.media,
        ai_report: record.ai_report,
        elapsed_ms: record.summary?.elapsed ?? null,
      },
    ],
    faces: [],
  };
}

const SAVE_WORDS = ["s", "si", "sí", "y", "yes", "guardar"];
const DISCARD_WORDS = ["n", "no", "descartar"];

export function parseSaveAnswer(input) {
  const a = (input || "").trim().toLowerCase();
  if (SAVE_WORDS.includes(a)) return "save";
  if (DISCARD_WORDS.includes(a)) return "discard";
  return "invalid";
}
```

- [ ] **Step 4: Correr los tests y verlos pasar**

Run: `npm test -- src/utils/scanRecord.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/scanRecord.js src/utils/scanRecord.test.js
git commit -m "feat(vault): scanRecord util (accumulate/payload/answer)"
```

---

### Task 4: Cablear en `useTerminal` (acumular + preguntar + guardar + `boveda`)

**Files:**
- Modify: `src/hooks/useTerminal.js`
- Test: `src/hooks/useTerminal.vault.test.js`

**Interfaces:**
- Consumes: `saveVault`, `getVaultGraph` (Task 2); `createScanRecord`, `applyScanEvent`, `toSavePayload`, `parseSaveAnswer` (Task 3).
- Produces: comando `boveda` que empuja `{ type: "vault", data }`; flujo de guardado por `[s/n]` tras `done`.

- [ ] **Step 1: Escribir el test que falla (comando `boveda`)**

Crear `src/hooks/useTerminal.vault.test.js`:

```js
import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useTerminal } from "./useTerminal";
import * as api from "../services/api";

afterEach(() => vi.restoreAllMocks());

describe("useTerminal · bóveda", () => {
  it("el comando 'boveda' consulta el grafo y lo empuja al historial", async () => {
    vi.spyOn(api, "getVaultGraph").mockResolvedValue({
      nodes: [{ id: 1, kind: "name", value: "Carlos", label: "Carlos", scan_count: 2 }],
      edges: [],
    });
    const { result } = renderHook(() => useTerminal());

    await act(async () => {
      await result.current.handleCommand("boveda");
    });

    await waitFor(() => {
      const vault = result.current.history.find((e) => e.type === "vault");
      expect(vault).toBeTruthy();
      expect(vault.data.nodes[0].value).toBe("Carlos");
    });
    expect(api.getVaultGraph).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Correr el test y verlo fallar**

Run: `npm test -- src/hooks/useTerminal.vault.test.js`
Expected: FAIL — `boveda` no reconocido (empuja entrada de error, no `type:"vault"`).

- [ ] **Step 3: Implementar el cableado**

En `src/hooks/useTerminal.js`:

(a) Ampliar los imports (líneas 4-10):

```js
import {
  streamOsint,
  streamOsintImage,
  planRoute,
  interpret,
  saveVault,
  getVaultGraph,
} from "../services/api";
import {
  createScanRecord,
  applyScanEvent,
  toSavePayload,
  parseSaveAnswer,
} from "../utils/scanRecord";
```

(b) Añadir `"boveda"` a `EXPLICIT_SINGLE` (línea ~25):

```js
const EXPLICIT_SINGLE = [
  "help",
  "clear",
  "about",
  "banner",
  "netstat",
  "sysinfo",
  "demo",
  "logout",
  "boveda",
];
```

(c) Dentro de `useTerminal()`, junto a los otros refs (~línea 56), añadir:

```js
  // Registro del escaneo en curso (para poder archivarlo) y la pregunta pendiente.
  const currentScanRef = useRef(null);
  const pendingSaveRef = useRef(null);
```

(d) Al inicio de `handleCommand`, justo después de `if (!input) return;` (línea ~102), interceptar la respuesta a la pregunta de guardado:

```js
    // Si hay una pregunta de guardado pendiente, la respuesta la consume.
    if (pendingSaveRef.current) {
      pushToHistory({ type: "input", text: input });
      const answer = parseSaveAnswer(input);
      if (answer === "invalid") {
        pushToHistory({ type: "output", text: "Responde s (guardar) o n (descartar)." });
        return;
      }
      const record = pendingSaveRef.current;
      pendingSaveRef.current = null;
      if (answer === "discard") {
        pushToHistory({ type: "output", text: "— descartado (sesión efímera)." });
        return;
      }
      await saveCurrentScan(record);
      return;
    }
```

(e) Añadir el handler `saveCurrentScan` y `handleVault` (antes del `return` del hook, ~línea 864):

```js
  const saveCurrentScan = async (record) => {
    pushToHistory({ type: "output", text: "[bóveda] archivando…" });
    try {
      const { graph_id } = await saveVault(toSavePayload(record));
      pushToHistory({ type: "output", text: `✓ archivado en la bóveda (#${graph_id}).` });
    } catch (err) {
      pushToHistory({
        type: "error",
        text:
          "⚠ no se pudo archivar: " +
          (err?.message || "error") +
          " (la sesión sigue en memoria).",
      });
    }
  };

  const handleVault = async () => {
    pushToHistory({ type: "output", text: "[bóveda] cargando…" });
    try {
      const data = await getVaultGraph();
      pushToHistory({ type: "vault", data });
    } catch (err) {
      pushToHistory({
        type: "error",
        text: "No se pudo cargar la bóveda: " + (err?.message || "error"),
      });
    }
  };
```

(f) Añadir el caso del comando en `handleCommand`, junto a los otros (después del bloque `demo`, ~línea 155):

```js
    if (command === "boveda") {
      await handleVault();
      return;
    }
```

(g) En `beginScan`, acumular el escaneo. Al inicio de `beginScan` (tras `sound.unlock();`, ~línea 735), inicializar el registro:

```js
    currentScanRef.current = createScanRecord({ kind, query: queryFallback });
```

Añadir un helper local justo antes de `activeStreamRef.current = openStream({` (~línea 744):

```js
    // Empuja al historial y a la vez acumula el evento en el registro guardable.
    const pushScan = (entry) => {
      pushToHistory(entry);
      currentScanRef.current = applyScanEvent(currentScanRef.current, entry);
    };
```

Reemplazar, dentro de los handlers de `openStream`, las llamadas `pushToHistory({ type: "scan", … })` por `pushScan({ type: "scan", … })` en `meta`, `finding`, `source_error`, `media`, `ai_report` y `done`. (Son 6 reemplazos; el handler `error` sigue usando `pushToHistory`.)

En el handler `done`, tras `pushScan({ … scan: "done" … })` y antes de `finish();`, disparar la pregunta:

```js
        pendingSaveRef.current = currentScanRef.current;
        pushToHistory({ type: "output", text: "◈ ¿archivar en la bóveda? [s/n]" });
```

- [ ] **Step 4: Correr el test y verlo pasar**

Run: `npm test -- src/hooks/useTerminal.vault.test.js`
Expected: PASS.

- [ ] **Step 5: Correr toda la suite (no romper nada)**

Run: `npm test`
Expected: PASS (todas las suites).

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useTerminal.js src/hooks/useTerminal.vault.test.js
git commit -m "feat(vault): save prompt on scan done + 'boveda' command"
```

---

### Task 5: Vista de bóveda (`VaultList`) + wiring en `OutputLine`

**Files:**
- Create: `src/components/VaultList.jsx`
- Test: `src/components/VaultList.test.jsx`
- Modify: `src/components/OutputLine.jsx` (añadir el caso `type === "vault"`)

**Interfaces:**
- Consumes: entrada `{ type: "vault", data: { nodes, edges } }` del historial.
- Produces: `<VaultList data={…} />` que lista los objetivos guardados.

- [ ] **Step 1: Escribir el test que falla**

Crear `src/components/VaultList.test.jsx`:

```js
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import VaultList from "./VaultList";

describe("VaultList", () => {
  it("lista los nodos guardados con su valor y conteo de escaneos", () => {
    const data = {
      nodes: [
        { id: 1, kind: "name", value: "Carlos Sánchez", label: "Carlos Sánchez", scan_count: 2 },
        { id: 2, kind: "username", value: "k4zzu", label: "k4zzu", scan_count: 1 },
      ],
      edges: [],
    };
    render(<VaultList data={data} />);
    expect(screen.getByText("Carlos Sánchez")).toBeTruthy();
    expect(screen.getByText("k4zzu")).toBeTruthy();
  });

  it("muestra un estado vacío cuando no hay nodos", () => {
    render(<VaultList data={{ nodes: [], edges: [] }} />);
    expect(screen.getByText(/bóveda vacía/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Correr el test y verlo fallar**

Run: `npm test -- src/components/VaultList.test.jsx`
Expected: FAIL — módulo no existe.

- [ ] **Step 3: Implementar el componente**

Crear `src/components/VaultList.jsx`:

```jsx
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
      <div className="mb-2 flex items-center gap-2 text-[0.7rem] uppercase tracking-widest text-fuchsia-300/80">
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
```

- [ ] **Step 4: Correr el test y verlo pasar**

Run: `npm test -- src/components/VaultList.test.jsx`
Expected: PASS.

- [ ] **Step 5: Cablear en `OutputLine`**

En `src/components/OutputLine.jsx`, añadir el import (tras la línea 3):

```js
import VaultList from "./VaultList";
```

Y el caso, tras el bloque `if (entry.type === "scan")` (línea ~14):

```js
  if (entry.type === "vault") {
    return <VaultList data={entry.data} />;
  }
```

- [ ] **Step 6: Correr toda la suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/VaultList.jsx src/components/VaultList.test.jsx src/components/OutputLine.jsx
git commit -m "feat(vault): VaultList view + OutputLine wiring"
```

---

### Task 6: Verificación de la fase (lint + build + navegador)

Cierre de fase. No TDD; verificación real antes de dar por hecha la fase.

**Files:** (ninguno nuevo)

- [ ] **Step 1: Lint + suite completa + build**

Run: `npm run lint && npm test && npm run build`
Expected: lint sin errores, todos los tests verdes, build OK (sale a `docs/`).

- [ ] **Step 2: Verificación en navegador (con el backend del prompt 18 desplegado)**

Requiere que el usuario haya pasado el prompt 18 al agente de backend y desplegado. Con sesión iniciada:
1. Correr un escaneo (ej. `osint user k4zzu` o una frase NL).
2. Al `done`, confirmar que aparece `◈ ¿archivar en la bóveda? [s/n]`.
3. Responder `s` → confirmar `✓ archivado en la bóveda (#N)`.
4. Ejecutar `boveda` → confirmar que el objetivo aparece en la lista.
5. Repetir el mismo escaneo y archivar de nuevo → en `boveda` NO debe duplicarse (upsert por `(kind,value)`), pero el `scan_count` sube.

- [ ] **Step 3: Commit del build**

```bash
git add docs
git commit -m "build: vault persistence phase 1"
```

---

## Notas de handoff

- Esta es la **Fase 1** del spec v3 (§9). Las siguientes fases (provider social + reverse-image, grafo + auto-pivot, correlación facial cross-scan, cuotas + costo) son planes aparte.
- El `scan_id` que enlaza con `usage` (costo) NO se envía en esta fase; el backend deja `cost_usd = 0`. Llega en la fase de cuotas.
- Las `faces` con descriptor se persisten vacías en Fase 1 (`faces: []`); se pueblan cuando aterrice la correlación facial cross-scan.
- El payload usa refs temporales (`n0`) desde ya para no reescribir el contrato al añadir el grafo multi-nodo en la Fase 3.
