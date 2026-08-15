# Provider social + Reverse-image (Fase 2) — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enriquecer los escaneos con búsqueda social (dorks a Instagram/Facebook/LinkedIn/TikTok/X) y con reverse-image (¿dónde más aparece esta foto?), mostrando los matches de reverse-image como una fila aparte en la galería que también entra al análisis facial.

**Architecture:** El grueso es backend (repo aparte `rinnegan-api`), entregado como prompt `specs/backend-prompts/19-social-reverse-image.md`. El frontend solo cambia `MediaGallery`: separa los items de `media` en "fotos de perfil" vs "reverse-image" (por el campo `origin`), renderiza la fila "aparece también en…", y corre el análisis facial sobre TODOS los items (perfil + reverse).

**Tech Stack:** Frontend React 19 + Vite + Vitest. Backend FastAPI + httpx + SerpApi (tier gratis) — entregado como prompt, no implementado aquí.

**Spec:** `specs/v3-graph-vault-intelligence-design.md` (§5.2, §5.3, §6.5)

## Global Constraints

- JSX sin TypeScript; ESLint flat config; `no-unused-vars` ignora `^[A-Z_]`. `npm run lint` debe pasar con 0 errores.
- Build sale a `docs/`; nunca escribir specs/planes bajo `docs/`; no commitear `docs/` en la rama (el build de deploy va en main).
- El backend es repo separado: su trabajo se entrega como `specs/backend-prompts/19-social-reverse-image.md`; no se implementa backend aquí.
- Vitest (jsdom). Tests deben verificar comportamiento real, no solo mocks.
- **Contrato de reverse-image (ruling de Fase 2):** el backend emite los matches de reverse-image como items del evento `media` existente, cada uno con `origin: "reverse"` y opcional `matched_from: { source, image_url }`. Las fotos de perfil llevan `origin` ausente o `"profile"`. Esto reusa el pipeline de medios (los rostros de los matches entran al análisis facial, spec §6.5) sin añadir un evento SSE nuevo. `useTerminal` ya pasa `d.items` tal cual → no requiere cambios en `api.js`/`useTerminal`.

---

### Task 1: Prompt de backend (social + reverse-image)

Deliverable de documentación (no TDD): el prompt que el usuario pasará al agente de backend.

**Files:**
- Create: `specs/backend-prompts/19-social-reverse-image.md`

- [ ] **Step 1: Escribir el prompt**

Crear `specs/backend-prompts/19-social-reverse-image.md` con este contenido exacto:

```markdown
# Prompt backend — v3 Fase 2: provider social (dorks) + reverse-image (SerpApi)

> Continúa en el MISMO repo `rinnegan-api`. Copia el bloque y pásaselo al agente.

---

Añade dos capacidades, ambas protegidas con la auth existente (token por header `Authorization` o `?token=`). NO cambies el protocolo de eventos salvo lo que se indica (nuevos items en el evento `media` ya existente). Livianas en RAM.

## 1. Provider `social` (dorks multi-plataforma) — se integra en los escaneos de nombre y AUTO

Para búsquedas de persona (nombre, y AUTO cuando detecta nombre/usuario), corre dorks dirigidos por plataforma pública sin cuenta:
- `"<valor>" site:instagram.com`
- `"<valor>" site:facebook.com`
- `"<valor>" site:linkedin.com/in`
- `"<valor>" site:tiktok.com`
- `"<valor>" (site:x.com OR site:twitter.com)`
- una consulta plana `"<valor>"`

**Fuente:** base = HTML de **DuckDuckGo + Bing** (sin key, ilimitado), fusiona y **deduplica por URL de perfil**. Refuerzo = si `SERPAPI_API_KEY` está configurada y queda cuota, corre además algunos dorks por SerpApi (Google) y fusiona. Extrae por resultado `{ profile_url, handle, platform, title, snippet, image_url? }`.

Emite cada resultado como un evento `finding` del protocolo existente: `source` = plataforma (ej. `instagram`), `title` = título/handle, `data.url` = `profile_url`, `confidence` según señal (coincidencia fuerte del nombre → high; solo snippet → medium). Si extraes una imagen de perfil pública, emítela como item del evento `media` con `origin: "profile"`.

Robustez: si DDG/Bing bloquea o cambia el HTML, salta esa plataforma y emite `source_error` (provider `social`), no tumbes el escaneo.

## 2. `POST /osint/reverse-image` (SerpApi) + integración en el escaneo

Endpoint `POST /osint/reverse-image`, body `{ "image_url": "<url>" }` (protegido). Llama SerpApi reverse image (Google/Yandex). Devuelve:
```json
{ "matches": [ { "url": "…", "title": "…", "thumbnail": "…", "page_url": "…", "source": "instagram.com" } ] }
```
SerpApi caído/sin key/cuota agotada → `{ "matches": [], "note": "…" }` (nunca 500). Requiere env `SERPAPI_API_KEY`. Registra el uso (para la fase de cuotas; aquí basta un log o contador simple).

**Integración en el escaneo:** dentro del escaneo de nombre/AUTO, sobre **la mejor foto de perfil encontrada** (la de mayor confianza), llama reverse-image y **emite cada match como item del evento `media` existente** con:
```json
{ "origin": "reverse", "matched_from": { "source": "github", "image_url": "…" },
  "source": "instagram.com", "image_url": "<thumbnail>", "page_url": "<page_url>", "title": "…", "confidence": "medium" }
```
(En esta fase solo la foto raíz; el reverse-image por-nodo del auto-pivot llega en la Fase 3.)

## Tests (pytest + respx, todo mockeado)

- `social`: DDG+Bing HTML mock → parsea perfiles, deduplica por URL, emite `finding` con `data.url`; SerpApi mock de refuerzo se fusiona cuando hay key; plataforma bloqueada → `source_error`, no tumba.
- `/osint/reverse-image`: SerpApi mock → 200 con `matches`; sin key / error / cuota → `{matches:[], note}` (no 500); sin token → 401.
- Integración: un escaneo con una foto de perfil produce items `media` con `origin:"reverse"` y `matched_from`.
- `ruff` limpio. README.

## Criterios de aceptación

1. Los escaneos de nombre/AUTO ahora traen perfiles de redes sociales (findings) vía dorks DDG+Bing (+SerpApi si hay key).
2. `POST /osint/reverse-image` devuelve matches y degrada a `{matches:[]}` sin tumbar; el escaneo emite los matches como `media` con `origin:"reverse"`.
3. Todo protegido (401 sin token). Tests verdes + `ruff` + README.

## NO hagas

- No rompas los providers/eventos existentes (los items `media` de perfil siguen igual; solo añades el campo `origin` y, para reverse, items nuevos). No hagas scraping con navegador headless (RAM). No añadas todavía el grafo/auto-pivot ni `/usage`.
```

- [ ] **Step 2: Commit**

```bash
git add specs/backend-prompts/19-social-reverse-image.md
git commit -m "docs: backend prompt 19 (social provider + reverse-image)"
```

---

### Task 2: `MediaGallery` — fila de reverse-image + análisis facial sobre todos los items

**Files:**
- Modify: `src/components/MediaGallery.jsx`
- Test: `src/components/MediaGallery.test.jsx` (nuevo)

**Interfaces:**
- Consumes: items del evento `media` con forma `{ source, image_url, page_url?, title?, confidence?, origin? }` donde `origin === "reverse"` marca un match de reverse-image.
- Produces: (sin exports nuevos) — comportamiento: dos grupos de miniaturas (perfil / reverse-image) y `analyzeFaces` corre sobre TODOS los items.

- [ ] **Step 1: Escribir los tests que fallan**

Crear `src/components/MediaGallery.test.jsx`:

```jsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// face-api es pesado y asíncrono: lo mockeamos con una promesa PENDIENTE para
// probar solo el render de las filas sin disparar un setState fuera de act()
// (eso mantiene el output de los tests limpio). El análisis queda en "loading".
vi.mock("../utils/faceCluster", () => ({
  analyzeFaces: vi.fn(() => new Promise(() => {})),
}));

import MediaGallery from "./MediaGallery";
import { analyzeFaces } from "../utils/faceCluster";

beforeEach(() => vi.clearAllMocks());

describe("MediaGallery", () => {
  it("renderiza una fila aparte de reverse-image cuando hay items origin='reverse'", () => {
    const items = [
      { source: "github", image_url: "http://x/a.jpg", origin: "profile" },
      { source: "instagram.com", image_url: "http://x/b.jpg", origin: "reverse", page_url: "http://insta/p" },
    ];
    render(<MediaGallery items={items} accentText="" />);
    expect(screen.getByText(/aparece también en/i)).toBeTruthy();
    expect(screen.getByText("github")).toBeTruthy();
    expect(screen.getByText("instagram.com")).toBeTruthy();
  });

  it("no muestra la fila reverse cuando no hay items reverse", () => {
    const items = [
      { source: "github", image_url: "http://x/a.jpg" },
      { source: "gitlab", image_url: "http://x/b.jpg" },
    ];
    render(<MediaGallery items={items} accentText="" />);
    expect(screen.queryByText(/aparece también en/i)).toBeNull();
  });

  it("corre el análisis facial sobre TODOS los items (perfil + reverse)", () => {
    const items = [
      { source: "github", image_url: "http://x/a.jpg" },
      { source: "insta", image_url: "http://x/b.jpg", origin: "reverse" },
    ];
    render(<MediaGallery items={items} accentText="" />);
    expect(analyzeFaces).toHaveBeenCalledWith(items);
  });
});
```

- [ ] **Step 2: Correr los tests y verlos fallar**

Run: `npm test -- src/components/MediaGallery.test.jsx`
Expected: FAIL — no existe la fila "aparece también en" (el componente aún no separa por `origin`).

- [ ] **Step 3: Refactorizar `MediaGallery.jsx`**

Reemplazar el cuerpo del `return` del componente y extraer una miniatura reutilizable (para no duplicar el JSX entre los dos grupos). El archivo completo queda así:

```jsx
// src/components/MediaGallery.jsx
// Galería de imágenes de un escaneo OSINT + análisis facial en el navegador.
// Separa las fotos de perfil de los matches de reverse-image ("aparece también
// en…"), pero corre el análisis facial (face-api.js, lazy) sobre TODAS las
// fotos: así una cara que aparece en un reverse-image entra al agrupamiento.
// La identidad no se "verifica": es consistencia de la cara que más se repite.
import { useEffect, useState } from "react";
import { analyzeFaces } from "../utils/faceCluster";

const CONFIDENCE = {
  high: { color: "#34d399" },
  medium: { color: "#fbbf24" },
  low: { color: "#94a3b8" },
};

function Thumbnail({ it, annotation: a }) {
  const c = CONFIDENCE[it.confidence] || CONFIDENCE.low;
  // Borde: si el análisis marcó la cara dominante, resáltala en verde.
  const borderColor = a?.inDominant ? "#34d399" : c.color;
  return (
    <a
      href={it.page_url || it.image_url}
      target="_blank"
      rel="noreferrer"
      className="relative flex w-16 flex-col items-center gap-1"
      title={it.title || it.source}
    >
      <img
        src={it.image_url}
        alt={it.title || it.source}
        loading="lazy"
        onError={(e) => {
          e.currentTarget.parentElement.style.display = "none";
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
      <span className="max-w-full truncate text-[0.5rem] uppercase tracking-wide text-white/60">
        {it.source}
      </span>
    </a>
  );
}

export default function MediaGallery({ items, accentText }) {
  const [face, setFace] = useState(() =>
    items && items.length >= 2 ? { status: "loading" } : { status: "idle" }
  );

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

  // Anotación por foto (misma order que items), si el análisis terminó.
  const annotated = face.status === "done" ? face.res.annotated : null;

  // Conserva el índice original para mapear la anotación tras separar en grupos.
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
          <Thumbnail key={i} it={it} annotation={a} />
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
              <Thumbnail key={i} it={it} annotation={a} />
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

- [ ] **Step 4: Correr los tests y verlos pasar**

Run: `npm test -- src/components/MediaGallery.test.jsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Correr toda la suite + lint**

Run: `npm test && npm run lint`
Expected: todas verdes, lint 0 errores.

- [ ] **Step 6: Commit**

```bash
git add src/components/MediaGallery.jsx src/components/MediaGallery.test.jsx
git commit -m "feat(media): separate reverse-image row; face analysis over all photos"
```

---

### Task 3: Verificación de la fase

Cierre de fase. No TDD.

- [ ] **Step 1: Lint + suite + build**

Run: `npm run lint && npm test && npm run build`
Expected: lint 0, todos los tests verdes, build OK.

- [ ] **Step 2: Verificación en navegador (con el backend del prompt 19 desplegado)**

Requiere que el usuario haya pasado el prompt 19 al agente de backend y desplegado. Con sesión iniciada:
1. Correr un escaneo de nombre (ej. una persona con fotos públicas).
2. Confirmar que aparecen perfiles de redes sociales en los hallazgos (instagram/facebook/linkedin/tiktok/x).
3. Si hay reverse-image, confirmar la fila "Aparece también en…" con thumbnails que enlazan a la página fuente.
4. Confirmar que el % de análisis facial cuenta también las caras de los matches de reverse-image.

- [ ] **Step 3: (No commitear `docs/` en la rama — el build de deploy va en main.)**

---

## Notas de handoff

- Fase 2 del spec v3 (§9). El grueso es backend (prompt 19); el frontend es solo la separación en `MediaGallery`.
- La correlación facial cross-scan contra la bóveda (`/faces/match`) es Fase 4 — aquí el análisis facial sigue siendo intra-escaneo, ahora incluyendo los matches de reverse-image.
- El grafo + auto-pivot (reverse-image por-nodo) es Fase 3.
- Contrato clave: reverse-image llega como items `media` con `origin:"reverse"` — el backend (prompt 19) y el frontend (Task 2) deben coincidir en ese campo.
