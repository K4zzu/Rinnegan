# Correlación facial cross-scan (Fase 4) — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Guardar las huellas faciales (descriptores) de cada escaneo en la bóveda, y en cada escaneo nuevo comparar sus caras contra la bóveda para avisar "esta cara ya la viste investigando a X (NN%)".

**Architecture:** Los descriptores se calculan en el navegador (`faceCluster`, ya existe) y se guardan en una caché en memoria (`faceCache`, por `image_url`). Al archivar, `useTerminal` construye `faces[]` desde la caché y los manda a `/vault/save` (Fase 1 ya persiste descriptores). En cada galería, `MediaGallery` consulta `POST /faces/match` por cara y muestra la alerta. Backend nuevo: `POST /faces/match` (prompt 21).

**Tech Stack:** Frontend React 19 + Vite + Vitest. Backend FastAPI (entregado como prompt).

**Spec:** `specs/v3-graph-vault-intelligence-design.md` (§5.4, §6.4)

## Global Constraints

- JSX sin TypeScript; ESLint flat config; `no-unused-vars` ignora `^[A-Z_]`. `npm run lint` 0 errores.
- Build sale a `docs/`; nunca escribir specs/planes bajo `docs/`; no commitear `docs/` en la rama.
- Backend = repo separado; se entrega como `specs/backend-prompts/21-faces-match.md`.
- Vitest (jsdom). Tests verifican comportamiento real; mockear face-api/red con promesas.
- **Rulings de Fase 4:**
  - Descriptores en caché en memoria (`faceCache`, por `image_url`): `faceCluster` escribe, `MediaGallery`+guardado leen. Umbral facial 0.55 (igual que el clustering intra-escaneo), aplicado en el backend para el match.
  - `faces` persistidas se atan al nodo **raíz** del payload (coherente con Fase 3).
  - `/faces/match` se llama **por cara** (no batch).

---

### Task 1: Prompt de backend (POST /faces/match)

**Files:**
- Create: `specs/backend-prompts/21-faces-match.md`

- [ ] **Step 1: Escribir el prompt**

Crear `specs/backend-prompts/21-faces-match.md` con este contenido exacto:

```markdown
# Prompt backend — v3 Fase 4: POST /faces/match (correlación facial cross-scan)

> Continúa en el MISMO repo `rinnegan-api`. Copia el bloque y pásaselo al agente.

---

Añade `POST /faces/match` (protegido con la auth existente; token por header o `?token=`). Compara un descriptor facial contra las caras guardadas del usuario (tabla `faces`, ya creada en la Fase 1) y devuelve las coincidencias. La tabla `faces` ya guarda `descriptor` (BLOB de 128 floats vía `struct.pack`) cuando el frontend lo manda en `/vault/save`; aquí solo se consulta.

## Endpoint

`POST /faces/match`, body `{ "descriptor": [/* 128 floats */] }`.

- Recorre las `faces` del usuario actual con `descriptor` no nulo; desempaqueta cada BLOB a 128 floats.
- Calcula la **distancia euclidiana** entre el descriptor de entrada y cada cara guardada.
- Considera coincidencia si `distancia < 0.55` (env opcional `FACE_MATCH_THRESHOLD`, default 0.55).
- Ordena por distancia ascendente. Devuelve, uniendo con `nodes`/`scans` para el contexto:

```json
{ "matches": [
  { "node_id": 12, "kind": "name", "value": "Carlos Sánchez", "label": "Carlos Sánchez",
    "image_url": "…", "distance": 0.41, "probability": 84 }
] }
```

- `probability` = entero 0–100 derivado de la distancia (p. ej. `round((1 - distancia/0.55) * 100)` acotado a [0,100]).
- Sin coincidencias → `{ "matches": [] }`. Sin token → 401. Nunca 500 por datos vacíos.
- Ligero en RAM: es solo aritmética de vectores en Python (numpy si ya está, o loop). No cargues ML.

## Tests (pytest)

- Con caras guardadas mockeadas (dos personas distintas), un descriptor cercano a una devuelve esa como match con `distance < 0.55` y `probability` alto; un descriptor lejano → `matches: []`.
- Solo compara contra caras del usuario actual (aislamiento por `user_id`).
- Sin token → 401. `ruff` limpio. README.

## Criterios de aceptación

1. `POST /faces/match {descriptor}` devuelve las caras guardadas del usuario dentro del umbral, con `node_id`/`value`/`label`/`image_url`/`distance`/`probability`, ordenadas por distancia.
2. Aislamiento por usuario; 401 sin token; nunca 500 por vacío. Tests + `ruff` + README.

## NO hagas

- No recalcules descriptores en el server (llegan del navegador). No compares contra caras de otros usuarios. No añadas todavía `/usage`.
```

- [ ] **Step 2: Commit**

```bash
git add specs/backend-prompts/21-faces-match.md
git commit -m "docs: backend prompt 21 (faces match cross-scan)"
```

---

### Task 2: `faceCache` + escritura desde `faceCluster`

**Files:**
- Create: `src/utils/faceCache.js`
- Modify: `src/utils/faceCluster.js`
- Test: `src/utils/faceCache.test.js`

**Interfaces:**
- Produces: `setDescriptor(url, descriptor)`, `getDescriptor(url) → number[]|null`, `clearDescriptors()`.
- `analyzeFaces` (en `faceCluster.js`) escribe cada descriptor calculado en la caché.

- [ ] **Step 1: Escribir los tests que fallan**

Crear `src/utils/faceCache.test.js`:

```js
import { describe, it, expect, beforeEach } from "vitest";
import { setDescriptor, getDescriptor, clearDescriptors } from "./faceCache";

beforeEach(() => clearDescriptors());

describe("faceCache", () => {
  it("guarda y recupera un descriptor por url", () => {
    const d = [0.1, 0.2, 0.3];
    setDescriptor("http://x/a.jpg", d);
    expect(getDescriptor("http://x/a.jpg")).toEqual(d);
  });

  it("devuelve null para una url desconocida", () => {
    expect(getDescriptor("http://x/desconocida.jpg")).toBeNull();
  });

  it("no guarda si falta url o descriptor", () => {
    setDescriptor("", [1, 2, 3]);
    setDescriptor("http://x/b.jpg", null);
    expect(getDescriptor("")).toBeNull();
    expect(getDescriptor("http://x/b.jpg")).toBeNull();
  });

  it("clearDescriptors vacía la caché", () => {
    setDescriptor("http://x/a.jpg", [1]);
    clearDescriptors();
    expect(getDescriptor("http://x/a.jpg")).toBeNull();
  });
});
```

- [ ] **Step 2: Correr los tests y verlos fallar**

Run: `npm test -- src/utils/faceCache.test.js`
Expected: FAIL — módulo no existe.

- [ ] **Step 3: Implementar `faceCache.js`**

Crear `src/utils/faceCache.js`:

```js
// src/utils/faceCache.js
// Caché en memoria de descriptores faciales (128-d) por URL de imagen.
// La llena faceCluster durante el análisis; la leen MediaGallery (para la
// correlación cross-scan) y useTerminal (para guardar las caras en la bóveda).
// Es solo una caché de cómputo por sesión; la fuente de verdad del match es la
// bóveda en el backend.
const cache = new Map();

export function setDescriptor(url, descriptor) {
  if (url && descriptor) cache.set(url, descriptor);
}

export function getDescriptor(url) {
  return cache.get(url) || null;
}

export function clearDescriptors() {
  cache.clear();
}
```

- [ ] **Step 4: Escribir el descriptor en `faceCluster.js`**

En `src/utils/faceCluster.js`:

(a) Añadir el import al inicio (junto al import de `imgProxyUrl`):

```js
import { setDescriptor } from "./faceCache";
```

(b) En `analyzeFaces`, dentro del `for (const it of items)`, tras `results.push({ item: it, descriptor });`, cachear el descriptor cuando exista. Reemplazar:

```js
    results.push({ item: it, descriptor });
```

por:

```js
    if (descriptor) setDescriptor(it.image_url, descriptor);
    results.push({ item: it, descriptor });
```

- [ ] **Step 5: Correr los tests y verlos pasar**

Run: `npm test -- src/utils/faceCache.test.js`
Expected: PASS. (Nota: la escritura en `faceCluster` no rompe sus tests existentes — `clusterResults` es pura y no se toca.)

- [ ] **Step 6: Commit**

```bash
git add src/utils/faceCache.js src/utils/faceCache.test.js src/utils/faceCluster.js
git commit -m "feat(faces): faceCache; faceCluster writes descriptors to it"
```

---

### Task 3: `api.js` — `facesMatch`

**Files:**
- Modify: `src/services/api.js`
- Test: `src/services/api.test.js`

**Interfaces:**
- Produces: `facesMatch(descriptor) → Promise<{matches}>`.

- [ ] **Step 1: Escribir el test que falla**

Añadir a `src/services/api.test.js`:

```js
import { facesMatch } from "./api";

describe("facesMatch", () => {
  it("hace POST a /faces/match con el descriptor", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ matches: [] }) })
    );
    const res = await facesMatch([0.1, 0.2]);
    expect(res).toEqual({ matches: [] });
    const [url, opts] = vi.mocked(fetch).mock.calls[0];
    expect(url).toContain("/faces/match");
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body)).toEqual({ descriptor: [0.1, 0.2] });
  });
});
```

- [ ] **Step 2: Correr el test y verlo fallar**

Run: `npm test -- src/services/api.test.js`
Expected: FAIL — `facesMatch is not a function`.

- [ ] **Step 3: Implementar**

En `src/services/api.js`, junto a las funciones de bóveda (tras `deleteVaultNode`):

```js
// Compara un descriptor facial contra las caras guardadas del usuario.
export function facesMatch(descriptor) {
  return request("/faces/match", { method: "POST", json: { descriptor } });
}
```

- [ ] **Step 4: Correr el test y verlo pasar**

Run: `npm test -- src/services/api.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/api.js src/services/api.test.js
git commit -m "feat(api): facesMatch (cross-scan face lookup)"
```

---

### Task 4: `scanRecord` — `buildFaces` (payload de caras)

**Files:**
- Modify: `src/utils/scanRecord.js`
- Test: `src/utils/scanRecord.test.js`

**Interfaces:**
- Produces: `buildFaces(media, nodeId, getDescriptor) → faces[]` — pura; `getDescriptor(url)` es inyectado.

- [ ] **Step 1: Escribir los tests que fallan**

Añadir a `src/utils/scanRecord.test.js`:

```js
import { buildFaces } from "./scanRecord";

describe("buildFaces", () => {
  it("arma faces solo para media con descriptor cacheado, atadas al nodo", () => {
    const media = [
      { source: "github", image_url: "http://x/a.jpg", page_url: "http://gh/u" },
      { source: "insta", image_url: "http://x/b.jpg" }, // sin descriptor
    ];
    const cache = { "http://x/a.jpg": [0.1, 0.2, 0.3] };
    const get = (url) => cache[url] || null;
    const faces = buildFaces(media, "n0", get);
    expect(faces).toHaveLength(1);
    expect(faces[0]).toEqual({
      node: "n0",
      source: "github",
      image_url: "http://x/a.jpg",
      page_url: "http://gh/u",
      descriptor: [0.1, 0.2, 0.3],
    });
  });

  it("devuelve [] si no hay media o ninguna tiene descriptor", () => {
    expect(buildFaces([], "n0", () => null)).toEqual([]);
    expect(buildFaces([{ source: "x", image_url: "u" }], "n0", () => null)).toEqual([]);
  });
});
```

- [ ] **Step 2: Correr los tests y verlos fallar**

Run: `npm test -- src/utils/scanRecord.test.js`
Expected: FAIL — `buildFaces is not a function`.

- [ ] **Step 3: Implementar**

En `src/utils/scanRecord.js`, añadir (al final del archivo):

```js
// Arma el array `faces` del payload de guardado a partir de la media del
// escaneo y los descriptores cacheados. `getDescriptor(url)` inyectado
// (normalmente el de faceCache). Solo incluye media con descriptor.
export function buildFaces(media, nodeId, getDescriptor) {
  if (!media || !media.length) return [];
  const faces = [];
  for (const it of media) {
    const descriptor = getDescriptor(it.image_url);
    if (!descriptor) continue;
    faces.push({
      node: nodeId,
      source: it.source,
      image_url: it.image_url,
      page_url: it.page_url ?? null,
      descriptor,
    });
  }
  return faces;
}
```

- [ ] **Step 4: Correr los tests y verlos pasar**

Run: `npm test -- src/utils/scanRecord.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/scanRecord.js src/utils/scanRecord.test.js
git commit -m "feat(faces): buildFaces payload helper"
```

---

### Task 5: `useTerminal` — persistir caras al archivar

**Files:**
- Modify: `src/hooks/useTerminal.js`
- Test: `src/hooks/useTerminal.faces.test.js`

**Interfaces:**
- Consumes: `buildFaces` (Task 4), `getDescriptor` (Task 2).

- [ ] **Step 1: Escribir el test que falla**

Crear `src/hooks/useTerminal.faces.test.js`:

```js
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useTerminal } from "./useTerminal";
import * as api from "../services/api";
import { setDescriptor, clearDescriptors } from "../utils/faceCache";

beforeEach(() => clearDescriptors());
afterEach(() => vi.restoreAllMocks());

describe("useTerminal · guardar caras", () => {
  it("al archivar, incluye faces con descriptor de la caché atadas a la raíz", async () => {
    // El descriptor de la foto ya está cacheado (lo haría MediaGallery).
    setDescriptor("http://x/a.jpg", [0.1, 0.2, 0.3]);

    vi.spyOn(api, "streamOsint").mockImplementation((cat, val, h) => {
      h.meta?.({});
      h.media?.({ items: [{ source: "github", image_url: "http://x/a.jpg", page_url: "http://gh/u" }] });
      h.done?.({ summary: { findings: 0, errors: 0, elapsed_ms: 1000 } });
      return { close: () => {} };
    });
    vi.spyOn(api, "saveVault").mockResolvedValue({ graph_id: 5 });

    const { result } = renderHook(() => useTerminal());
    await act(async () => {
      await result.current.handleCommand("osint user carlos"); // explícito → streamOsint
    });
    await act(async () => {
      await result.current.handleCommand("s"); // archivar
    });

    await waitFor(() => expect(api.saveVault).toHaveBeenCalled());
    const payload = api.saveVault.mock.calls[0][0];
    expect(payload.faces).toHaveLength(1);
    expect(payload.faces[0]).toMatchObject({
      node: payload.root,
      image_url: "http://x/a.jpg",
      descriptor: [0.1, 0.2, 0.3],
    });
  });
});
```

- [ ] **Step 2: Correr el test y verlo fallar**

Run: `npm test -- src/hooks/useTerminal.faces.test.js`
Expected: FAIL — `payload.faces` está vacío (aún `faces: []`).

- [ ] **Step 3: Implementar**

En `src/hooks/useTerminal.js`:

(a) Ampliar los imports:

```js
import {
  createScanRecord,
  applyScanEvent,
  toSavePayload,
  parseSaveAnswer,
  buildFaces,
} from "../utils/scanRecord";
import { getDescriptor } from "../utils/faceCache";
```

(b) En `saveCurrentScan`, construir el payload, enriquecer `faces` desde la caché, y guardar. Reemplazar el cuerpo de `saveCurrentScan` (la parte del `try`) para que quede:

```js
  const saveCurrentScan = async (record) => {
    pushToHistory({ type: "output", text: "[bóveda] archivando…" });
    try {
      const payload = toSavePayload(record);
      payload.faces = buildFaces(record.media, payload.root, getDescriptor);
      const { graph_id } = await saveVault(payload);
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
```

- [ ] **Step 4: Correr el test y verlo pasar**

Run: `npm test -- src/hooks/useTerminal.faces.test.js`
Expected: PASS.

- [ ] **Step 5: Suite completa + lint**

Run: `npm test && npm run lint`
Expected: verdes (incl. `useTerminal.vault.test.js`, `useTerminal.graph.test.js`), 0 errores.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useTerminal.js src/hooks/useTerminal.faces.test.js
git commit -m "feat(faces): persist face descriptors to the vault on save"
```

---

### Task 6: `MediaGallery` — alerta de coincidencia cross-scan

**Files:**
- Modify: `src/components/MediaGallery.jsx`
- Test: `src/components/MediaGallery.crossscan.test.jsx` (nuevo)

**Interfaces:**
- Consumes: `getDescriptor` (Task 2), `facesMatch` (Task 3).

- [ ] **Step 1: Escribir el test que falla**

Crear `src/components/MediaGallery.crossscan.test.jsx`:

```jsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

// analyzeFaces resuelto (análisis terminado) para disparar el efecto de match.
vi.mock("../utils/faceCluster", () => ({
  analyzeFaces: vi.fn(() =>
    Promise.resolve({ probability: 0, dominantCount: 0, facesFound: 0, totalPhotos: 1, annotated: [] })
  ),
}));
vi.mock("../utils/faceCache", () => ({
  getDescriptor: vi.fn(() => [0.1, 0.2, 0.3]),
}));
vi.mock("../services/api", () => ({
  facesMatch: vi.fn(() =>
    Promise.resolve({ matches: [{ node_id: 7, label: "Carlos Sánchez", probability: 84, distance: 0.4 }] })
  ),
}));

import MediaGallery from "./MediaGallery";
import { facesMatch } from "../services/api";

beforeEach(() => vi.clearAllMocks());

describe("MediaGallery · cross-scan", () => {
  it("muestra 'visto antes' cuando una cara coincide con la bóveda", async () => {
    const items = [
      { source: "github", image_url: "http://x/a.jpg" },
      { source: "gitlab", image_url: "http://x/b.jpg" },
    ];
    render(<MediaGallery items={items} accentText="" />);
    await waitFor(() => {
      expect(facesMatch).toHaveBeenCalled();
      expect(screen.getAllByText(/visto antes/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Carlos Sánchez/).length).toBeGreaterThan(0);
    });
  });
});
```

- [ ] **Step 2: Correr el test y verlo fallar**

Run: `npm test -- src/components/MediaGallery.crossscan.test.jsx`
Expected: FAIL — no existe la alerta "visto antes".

- [ ] **Step 3: Implementar (MediaGallery.jsx completo)**

Reemplazar `src/components/MediaGallery.jsx` por:

```jsx
// src/components/MediaGallery.jsx
// Galería de imágenes de un escaneo OSINT + análisis facial en el navegador.
// Separa fotos de perfil de matches de reverse-image ("aparece también en…"),
// corre el análisis facial (face-api.js, lazy) sobre TODAS las fotos, y además
// consulta la bóveda (POST /faces/match) por cada cara para avisar si esa
// persona ya apareció en un escaneo guardado ("visto antes").
import { useEffect, useState } from "react";
import { analyzeFaces } from "../utils/faceCluster";
import { getDescriptor } from "../utils/faceCache";
import { facesMatch } from "../services/api";

const CONFIDENCE = {
  high: { color: "#34d399" },
  medium: { color: "#fbbf24" },
  low: { color: "#94a3b8" },
};

function Thumbnail({ it, annotation: a, match }) {
  const c = CONFIDENCE[it.confidence] || CONFIDENCE.low;
  const borderColor = match ? "#f59e0b" : a?.inDominant ? "#34d399" : c.color;
  return (
    <div className="relative flex w-16 flex-col items-center gap-1" data-thumb>
      <a
        href={it.page_url || it.image_url}
        target="_blank"
        rel="noreferrer"
        className="relative"
        title={it.title || it.source}
      >
        <img
          src={it.image_url}
          alt={it.title || it.source}
          loading="lazy"
          onError={(e) => {
            const card = e.currentTarget.closest("[data-thumb]");
            if (card) card.style.display = "none";
          }}
          className="h-14 w-14 rounded object-cover border-2 hover:opacity-80"
          style={{ borderColor }}
        />
        {a ? (
          <span
            className="absolute top-0 right-0 rounded-bl px-1 text-[0.5rem] font-bold leading-tight"
            style={{
              backgroundColor: a.inDominant
                ? "rgba(16,185,129,0.85)"
                : a.hasFace
                ? "rgba(148,163,184,0.75)"
                : "rgba(0,0,0,0.6)",
              color: "#000",
            }}
            title={
              a.inDominant
                ? "coincide con la cara que más se repite"
                : a.hasFace
                ? "otra cara"
                : "sin rostro detectado"
            }
          >
            {a.inDominant ? "✓" : a.hasFace ? "≠" : "∅"}
          </span>
        ) : null}
      </a>
      <span className="max-w-full truncate text-[0.5rem] uppercase tracking-wide text-white/60">
        {it.source}
      </span>
      {match ? (
        <span
          className="max-w-full truncate text-[0.5rem] font-semibold text-amber-300"
          title={`ya apareció investigando a ${match.label}`}
        >
          ⚠ visto antes · {match.label} {match.probability}%
        </span>
      ) : null}
    </div>
  );
}

export default function MediaGallery({ items, accentText }) {
  const [face, setFace] = useState(() =>
    items && items.length >= 2 ? { status: "loading" } : { status: "idle" }
  );
  // Coincidencias cross-scan por índice de item: { [i]: match }.
  const [matches, setMatches] = useState({});

  useEffect(() => {
    if (!items || items.length < 2) return;
    let cancelled = false;
    analyzeFaces(items)
      .then((res) => !cancelled && setFace({ status: "done", res }))
      .catch(() => !cancelled && setFace({ status: "error" }));
    return () => {
      cancelled = true;
    };
  }, [items]);

  // Cuando el análisis terminó, los descriptores ya están en caché: consulta
  // la bóveda por cada cara y guarda la mejor coincidencia por item.
  useEffect(() => {
    if (face.status !== "done" || !items) return;
    let cancelled = false;
    (async () => {
      const found = {};
      for (let i = 0; i < items.length; i++) {
        const d = getDescriptor(items[i].image_url);
        if (!d) continue;
        try {
          const res = await facesMatch(d);
          const m = res?.matches?.[0];
          if (m) found[i] = m;
        } catch {
          // silencioso: la alerta cross-scan es best-effort.
        }
      }
      if (!cancelled) setMatches(found);
    })();
    return () => {
      cancelled = true;
    };
  }, [face.status, items]);

  const annotated = face.status === "done" ? face.res.annotated : null;
  const withMeta = items.map((it, i) => ({ it, i, a: annotated?.[i] }));
  const profile = withMeta.filter(({ it }) => it.origin !== "reverse");
  const reverse = withMeta.filter(({ it }) => it.origin === "reverse");

  return (
    <div className="ai-reveal my-2 rounded-md border border-white/10 bg-white/[0.02] p-3">
      <div className={`flex items-center gap-2 text-[0.7rem] uppercase tracking-widest mb-2 ${accentText}`}>
        <span>◲</span>
        <span>Medios · imágenes</span>
        <span className="flex-1 h-px bg-current/20" />
      </div>

      <div className="flex flex-wrap gap-3">
        {profile.map(({ it, i, a }) => (
          <Thumbnail key={i} it={it} annotation={a} match={matches[i]} />
        ))}
      </div>

      {reverse.length ? (
        <>
          <div className={`flex items-center gap-2 text-[0.65rem] uppercase tracking-widest mt-3 mb-2 ${accentText}`}>
            <span>⇲</span>
            <span>Aparece también en…</span>
            <span className="flex-1 h-px bg-current/20" />
          </div>
          <div className="flex flex-wrap gap-3">
            {reverse.map(({ it, i, a }) => (
              <Thumbnail key={i} it={it} annotation={a} match={matches[i]} />
            ))}
          </div>
        </>
      ) : null}

      <FaceSummary face={face} count={items.length} />
    </div>
  );
}

function FaceSummary({ face, count }) {
  if (count < 2) return null;

  if (face.status === "loading")
    return (
      <div className="mt-2 flex items-center gap-2 text-[0.7rem] text-fuchsia-300/70">
        <span className="animate-pulse">◉</span> analizando rostros…
      </div>
    );

  if (face.status === "error")
    return (
      <div className="mt-2 text-[0.7rem] text-white/40">
        — análisis facial no disponible en este navegador.
      </div>
    );

  if (face.status !== "done") return null;

  const { probability, dominantCount, facesFound, totalPhotos } = face.res;

  if (facesFound < 2)
    return (
      <div className="mt-2 text-[0.7rem] text-white/40">
        — rostros insuficientes para comparar ({facesFound} de {totalPhotos} con
        cara detectable).
      </div>
    );

  return (
    <div className="mt-2 text-[0.72rem] leading-relaxed">
      <span className="text-fuchsia-400">◉ análisis facial · </span>
      <span className="text-emerald-300 font-semibold">{dominantCount}</span>
      <span className="text-white/70"> de {facesFound} fotos con cara son la misma persona → </span>
      <span className="font-bold text-emerald-300">{probability}%</span>
      <span className="text-white/70"> de coincidencia.</span>
      <div className="text-white/35 mt-px">
        — consistencia de la cara recurrente entre perfiles, no identidad verificada.
      </div>
    </div>
  );
}
```

(Nota: la raíz de `Thumbnail` lleva `data-thumb`; el `onError` de la imagen busca `closest("[data-thumb]")` y oculta esa tarjeta. Reemplaza al antiguo `onError` que ocultaba `parentElement` — el comportamiento es el mismo: si la imagen no carga, se oculta la miniatura completa.)

- [ ] **Step 4: Correr el test y verlo pasar**

Run: `npm test -- src/components/MediaGallery.crossscan.test.jsx`
Expected: PASS.

- [ ] **Step 5: Suite completa + lint**

Run: `npm test && npm run lint`
Expected: verdes (incl. `MediaGallery.test.jsx` de Fase 2 — la separación perfil/reverse y `analyzeFaces(items)` siguen igual), 0 errores.

- [ ] **Step 6: Commit**

```bash
git add src/components/MediaGallery.jsx src/components/MediaGallery.crossscan.test.jsx
git commit -m "feat(faces): cross-scan 'seen before' alert in the media gallery"
```

---

### Task 7: Verificación de la fase

- [ ] **Step 1: Lint + suite + build**

Run: `npm run lint && npm test && npm run build`
Expected: lint 0, todos los tests verdes, build OK.

- [ ] **Step 2: Verificación en navegador (con el backend del prompt 21 desplegado)**

Con sesión y prompt 21 desplegado:
1. Escanear una persona con fotos, y **archivar** (`s`).
2. Escanear otra vez algo que traiga la misma cara → confirmar el badge "⚠ visto antes · <objetivo> · NN%" bajo esa foto.
3. Confirmar que un escaneo sin coincidencias no muestra alertas.

- [ ] **Step 3: (No commitear `docs/` en la rama.)**

---

## Notas de handoff

- Fase 4 del spec v3 (§9). Backend nuevo: prompt 21 (`/faces/match`). El resto es frontend.
- Rulings: descriptores por caché en memoria (`faceCache`); caras atadas al nodo raíz; match por-cara.
- Dependencia de datos: la alerta cross-scan solo aparece si escaneos previos se **archivaron** (con descriptores). Sin bóveda poblada, no hay contra qué comparar.
- Fase 5 (última) = cuotas + costo USD por consulta (`/usage`, tabla `usage`, costo en `done` + panel `cuotas` + indicador HUD).
```
