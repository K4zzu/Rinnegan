# DedSec rebrand + panel-teatro (v4b) — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebrand DedSec (paleta C: verde ácido + magenta + cian sobre grunge, glitch/scanlines) conservando Rinnegan+ojo re-skineados, y un panel-teatro en vivo (consola dividida) que muestra el razonamiento, las caras y los contadores mientras el sistema trabaja.

**Architecture:** Frontend + sonidos. **2A**: nuevos colores/utilidades/keyframes en `index.css` + reskin del tema `darknet` (el default) en `themes.js` + reskin dirigido de componentes de identidad + sonidos. **2B**: `useTerminal` expone `liveScan` (actualizado en `beginScan`); `LiveTheater.jsx` lo renderiza mientras `isProcessing`.

**Tech Stack:** React 19 + Vite + Tailwind 4 (arbitrary values `text-[#hex]`) + Vitest.

**Spec:** `specs/v4b-dedsec-visual-design.md`

## Global Constraints

- JSX sin TypeScript; ESLint flat config; `no-unused-vars` ignora `^[A-Z_]`. `npm run lint` 0 errores.
- Build sale a `docs/`; no commitear `docs/` en la rama.
- Vitest (jsdom). Los 81 tests actuales deben seguir verdes (no dependen de colores exactos).
- **Todo movimiento (glitch/jitter/scanline animado) gated por `prefers-reduced-motion: reduce`** — con movimiento reducido se ven colores/estáticos, sin parpadeo.
- Paleta C: neón `#c8ff2f`, magenta/rojo `#ff004d`, cian `#00e5ff`, base grunge `#0b0b0d`. Se conserva "Rinnegan" + el ojo (re-skineados). Inspiración DedSec, motivo propio (no assets de Ubisoft).
- Tema por defecto es `darknet` (`Terminal.jsx:118`); su bloque `colors` es el que se re-skinea.

---

### Task 1: Tokens + utilidades DedSec (`index.css`) + tema `darknet`

Tarea visual (sin TDD): cambia base de color, añade utilidades/keyframes glitch, y re-skinea el tema default. Verificación = lint + build + suite verde.

**Files:**
- Modify: `src/index.css`
- Modify: `src/theme/themes.js`

- [ ] **Step 1: Base grunge en `index.css`**

Reemplazar el `body { background-color: #08060d; color: #bbf7d0; ... }` (líneas ~23-27) por:

```css
body {
  background-color: #0b0b0d; /* base grunge DedSec */
  color: #c8ff2f; /* verde ácido */
  overflow-x: hidden;
}
```

- [ ] **Step 2: Utilidades + keyframes DedSec**

Añadir al final de `src/index.css`:

```css
/* ── DedSec: glitch / scanlines / grunge ─────────────────────────────────── */
.ds-neon { text-shadow: 0 0 6px currentColor; }
.ds-glitch { text-shadow: 2px 0 #ff004d, -2px 0 #00e5ff; }
.ds-glitch-anim { animation: ds-glitch 2.2s steps(2) infinite; }
@keyframes ds-glitch {
  0%, 92%, 100% { transform: translate(0, 0); text-shadow: 2px 0 #ff004d, -2px 0 #00e5ff; }
  93% { transform: translate(-1px, 1px); text-shadow: -3px 0 #ff004d, 3px 0 #00e5ff; }
  96% { transform: translate(1px, -1px); text-shadow: 3px 0 #00e5ff, -3px 0 #ff004d; }
}
.ds-scanlines { position: relative; }
.ds-scanlines::after {
  content: ""; position: absolute; inset: 0; pointer-events: none;
  background: repeating-linear-gradient(0deg, transparent 0 2px, rgba(0,0,0,0.28) 2px 3px);
  mix-blend-mode: overlay;
}
.ds-grunge {
  background-image:
    repeating-linear-gradient(45deg, rgba(255,255,255,0.02) 0 6px, transparent 6px 12px);
}
.ds-sweep { position: relative; overflow: hidden; }
.ds-sweep::before {
  content: ""; position: absolute; left: 0; right: 0; height: 2px; top: 0;
  background: #c8ff2f; box-shadow: 0 0 8px #c8ff2f;
  animation: ds-sweep-move 1.6s ease-in-out infinite;
}
@keyframes ds-sweep-move { 0% { top: 0; } 50% { top: 100%; } 100% { top: 0; } }
.datamosh-in { animation: datamosh-in 0.32s steps(3) both; }
@keyframes datamosh-in {
  0% { opacity: 0; transform: translateX(-4px) skewX(6deg); filter: hue-rotate(40deg); }
  100% { opacity: 1; transform: none; filter: none; }
}

@media (prefers-reduced-motion: reduce) {
  .ds-glitch-anim { animation: none; }
  .ds-sweep::before { animation: none; opacity: 0.5; }
  .datamosh-in { animation: none; }
}
```

- [ ] **Step 3: Re-skinear el tema `darknet` (paleta C)**

En `src/theme/themes.js`, dentro del objeto `darknet.colors`, reemplazar los valores por la paleta C (deja `id`, `label`, `banner` igual):

```js
    colors: {
      headerText: "text-[#c8ff2f]/70",
      headerSubText: "text-[#c8ff2f]/80",
      headerMetricsText: "text-[#c8ff2f]/60",
      netBar: "bg-[#c8ff2f]/80",

      bannerText: "text-[#c8ff2f]",
      bodyText: "text-[#c8ff2f]/90",

      promptUser: "text-[#ff004d]",
      promptPath: "text-[#c8ff2f]/60",
      promptSymbol: "text-[#c8ff2f]",

      commandInput: "text-[#c8ff2f]",
      commandHistory: "text-[#c8ff2f]",

      outputText: "text-[#c8ff2f]/80",
      errorText: "text-[#ff004d]",
    },
```

- [ ] **Step 4: Verificar**

Run: `npm run lint && npm test && npm run build`
Expected: lint 0, 81 tests verdes, build OK.

- [ ] **Step 5: Commit**

```bash
git add src/index.css src/theme/themes.js
git commit -m "feat(dedsec): palette C tokens + glitch/scanline/grunge utilities; reskin default theme"
```

---

### Task 2: Reskin de identidad + sonidos DedSec

Tarea visual/audio (sin TDD). Aplica el lenguaje a los componentes de identidad. Verificación = lint + suite verde + build.

**Files:**
- Modify: `src/components/GodEye.jsx`
- Modify: `src/components/Terminal.jsx` (wordmark del header)
- Modify: `src/components/ScanEntry.jsx` (acento glitch en el encabezado de scan)
- Modify: `src/components/LoginPanel.jsx` (wordmark)
- Modify: `src/components/AsciiBanner.jsx` (contenedor)
- Modify: `src/utils/sound.js`

- [ ] **Step 1: Ojo glitch (`GodEye.jsx`)**

En `GodEye.jsx`, al elemento SVG raíz (o su contenedor), añadir la clase `ds-neon` y, cuando `state === "scanning"`, `ds-glitch-anim`. Concretamente, en el `className` del `<svg>` raíz añade: `` `${state === "scanning" ? "ds-glitch-anim" : ""} ds-neon` `` (concatenado a las clases existentes). Cambia el color base del ojo (los `stroke`/`fill` violeta) a `#c8ff2f` con acentos `#ff004d`/`#00e5ff` donde haya varios trazos (mantén la estructura del SVG; solo cambia los colores hardcodeados violeta por los de la paleta C).

- [ ] **Step 2: Wordmark del header (`Terminal.jsx`)**

En el header (la barra de ventana, ~línea 307-309), al `<span>` del wordmark "RINNEGAN" añadir la clase `ds-glitch` (o `ds-glitch-anim` para animado). Debe quedar algo como:

```jsx
          <span className={`phosphor font-semibold tracking-[0.3em] ds-glitch ${colors.bannerText || "text-[#c8ff2f]"}`}>
            RINNEGAN
          </span>
```

- [ ] **Step 3: Acento glitch en el encabezado de scan (`ScanEntry.jsx`)**

En el `case "start"`, al `<span className="font-bold tracking-widest">▸ SCAN</span>` añadir la clase `ds-glitch`. Y al contenedor del `case "start"` añadir `ds-sweep` en vez de (o junto a) el `hud-sweep` existente para el barrido DedSec. Cambio mínimo:

```jsx
            <span className="font-bold tracking-widest ds-glitch">▸ SCAN</span>
```

- [ ] **Step 3b: Login + boot (`LoginPanel.jsx`, `AsciiBanner.jsx`)**

Ambos ya heredan la paleta C vía los tokens del tema (Task 1), así que principalmente re-colorean solos. Toques dirigidos:
- `LoginPanel.jsx`: al `<span>`/elemento del wordmark "RINNEGAN" añadir la clase `ds-glitch` (busca el texto "RINNEGAN" o "Rinnegan" en el panel y añade la clase a su elemento). Si hay colores violeta hardcodeados (no-token), cámbialos a `text-[#c8ff2f]`/`text-[#ff004d]`.
- `AsciiBanner.jsx`: al `<pre>`/contenedor raíz del arte ASCII añadir la clase `ds-scanlines` (y `ds-neon` si el color lo permite) para el overlay grunge. Conserva el efecto de decrypt/scramble existente; solo añade las clases.

- [ ] **Step 4: Sonidos DedSec (`sound.js`)**

En `src/utils/sound.js`, ajustar la paleta de audio a un carácter más agresivo/glitch (mantén la API pública `boot/scanStart/finding/error/lock/done/setEnabled/toggle/unlock` intacta — solo cambian las frecuencias/formas de onda internas). Concretamente: usa ondas `square`/`sawtooth` en vez de `sine` para `finding`/`error`/`lock`, y para `scanStart`/`boot` un barrido de frecuencia corto (glitch burst). No cambies las firmas ni el gating del toggle.

- [ ] **Step 5: Verificar**

Run: `npm run lint && npm test && npm run build`
Expected: lint 0, 81 tests verdes (el reskin no cambia lógica), build OK.

- [ ] **Step 6: Commit**

```bash
git add src/components/GodEye.jsx src/components/Terminal.jsx src/components/ScanEntry.jsx src/components/LoginPanel.jsx src/components/AsciiBanner.jsx src/utils/sound.js
git commit -m "feat(dedsec): reskin GodEye/header/scan/login/boot + DedSec sound palette"
```

---

### Task 3: `liveScan` en `useTerminal`

**Files:**
- Modify: `src/hooks/useTerminal.js`
- Test: `src/hooks/useTerminal.livescan.test.js`

**Interfaces:**
- Produces: el hook retorna `liveScan` (objeto): `{ status:"idle"|"running", kind, query, reasoning:[…], findings:number, providers:string[], media:[…], startedAt:number|null }`.

- [ ] **Step 1: Escribir el test que falla**

Crear `src/hooks/useTerminal.livescan.test.js`:

```js
import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useTerminal } from "./useTerminal";
import * as api from "../services/api";

afterEach(() => vi.restoreAllMocks());

describe("useTerminal · liveScan", () => {
  it("acumula estado en vivo durante el escaneo y vuelve a idle en done", async () => {
    vi.spyOn(api, "streamOsint").mockImplementation((cat, val, h) => {
      h.meta?.({ providers: ["maigret"] });
      h.finding?.({ provider: "maigret", source: "github", title: "gh", confidence: "high" });
      h.finding?.({ provider: "ddg", source: "web", title: "w", confidence: "low" });
      h.media?.({ items: [{ source: "github", image_url: "http://x/a.jpg" }] });
      h.done?.({ summary: { findings: 2, errors: 0, elapsed_ms: 1000 } });
      return { close: () => {} };
    });
    const { result } = renderHook(() => useTerminal());
    await act(async () => {
      await result.current.handleCommand("osint user carlos");
    });
    await waitFor(() => {
      expect(result.current.liveScan.status).toBe("idle"); // done → idle
    });
    // durante el escaneo se acumuló (validamos el conteo/proveedores capturados)
    expect(result.current.liveScan.findings).toBe(2);
    expect(result.current.liveScan.providers).toContain("maigret");
    expect(result.current.liveScan.media.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Correr el test y verlo fallar**

Run: `npm test -- src/hooks/useTerminal.livescan.test.js`
Expected: FAIL — `result.current.liveScan` es `undefined`.

- [ ] **Step 3: Implementar**

En `src/hooks/useTerminal.js`:

(a) Añadir el estado (junto a los otros `useState`, p. ej. tras `scanProgress`):

```js
  const [liveScan, setLiveScan] = useState({
    status: "idle", kind: null, query: "", reasoning: [], findings: 0, providers: [], media: [], startedAt: null,
  });
```

(b) Al inicio de `beginScan` (donde se resetea `currentScanRef`), inicializar el estado en vivo:

```js
    setLiveScan({
      status: "running", kind, query: queryFallback, reasoning: [], findings: 0, providers: [], media: [], startedAt: Date.now(),
    });
```

(c) En los handlers de `beginScan`, actualizar `liveScan` (además de lo que ya hacen):
- en `meta`: `setLiveScan((s) => ({ ...s, providers: Array.from(new Set([...s.providers, ...(d?.providers || [])])) }));`
- en `finding`: `setLiveScan((s) => ({ ...s, findings: s.findings + 1, providers: d?.provider ? Array.from(new Set([...s.providers, d.provider])) : s.providers }));`
- en `media`: `setLiveScan((s) => ({ ...s, media: [...s.media, ...(d?.items || [])] }));`
- en `reasoning`: `setLiveScan((s) => ({ ...s, reasoning: [...s.reasoning, { step: d.step, thought: d.thought, action: d.action }] }));` (dentro del handler `reasoning` ya existente, añade esta línea)

(d) En `finish()` (que corre en `done` y `error`), marcar idle:

```js
      setLiveScan((s) => ({ ...s, status: "idle" }));
```

(e) Exponer en el `return` del hook: `liveScan,`.

- [ ] **Step 4: Correr el test y verlo pasar**

Run: `npm test -- src/hooks/useTerminal.livescan.test.js`
Expected: PASS.

- [ ] **Step 5: Suite completa + lint**

Run: `npm test && npm run lint`
Expected: verdes, 0 errores.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useTerminal.js src/hooks/useTerminal.livescan.test.js
git commit -m "feat(theater): liveScan state in useTerminal"
```

---

### Task 4: `LiveTheater.jsx` + montaje en `Terminal`

**Files:**
- Create: `src/components/LiveTheater.jsx`
- Test: `src/components/LiveTheater.test.jsx`
- Modify: `src/components/Terminal.jsx`

**Interfaces:**
- Consumes: `liveScan` (Task 3); `GodEye`.
- Produces: `<LiveTheater liveScan={…} statusText={…} onlineProviders />` (default export) — la consola dividida.

- [ ] **Step 1: Escribir el test que falla**

Crear `src/components/LiveTheater.test.jsx`:

```jsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import LiveTheater from "./LiveTheater";

const base = {
  status: "running", kind: "investigate", query: "Thiago",
  reasoning: [{ step: 1, thought: "busco la rectora", action: "web_search" }],
  findings: 42, providers: ["maigret", "serpapi"],
  media: [{ source: "github", image_url: "http://x/a.jpg" }], startedAt: Date.now(),
};

describe("LiveTheater", () => {
  it("muestra razonamiento, contadores, providers y caras cuando running", () => {
    render(<LiveTheater liveScan={base} statusText="rastreando…" />);
    expect(screen.getByText(/busco la rectora/)).toBeTruthy();
    expect(screen.getByText("42")).toBeTruthy();
    expect(screen.getByText(/maigret/)).toBeTruthy();
    expect(screen.getByText(/EN VIVO/i)).toBeTruthy();
  });

  it("no renderiza nada cuando status es idle", () => {
    const { container } = render(<LiveTheater liveScan={{ ...base, status: "idle" }} />);
    expect(container.firstChild).toBeNull();
  });
});
```

- [ ] **Step 2: Correr el test y verlo fallar**

Run: `npm test -- src/components/LiveTheater.test.jsx`
Expected: FAIL — módulo no existe.

- [ ] **Step 3: Implementar `LiveTheater.jsx`**

Crear `src/components/LiveTheater.jsx`:

```jsx
// src/components/LiveTheater.jsx
// Panel-teatro en vivo (consola dividida DedSec): mientras corre un escaneo,
// muestra el razonamiento en streaming (izq), las caras + contadores (der) y
// los providers activos (abajo). Puramente presentacional sobre `liveScan`.
import GodEye from "./GodEye";

export default function LiveTheater({ liveScan, statusText }) {
  if (!liveScan || liveScan.status !== "running") return null;
  const { reasoning = [], findings = 0, providers = [], media = [] } = liveScan;
  const lastReasoning = reasoning.slice(-5);
  const lastMedia = media.slice(-4);

  return (
    <div className="ds-grunge ds-scanlines datamosh-in my-2 rounded-md border border-[#c8ff2f]/25 bg-[#0b0b0d]/80 p-3">
      <div className="mb-2 flex items-center gap-2 text-[0.7rem] uppercase tracking-widest text-[#c8ff2f]">
        <span className="h-4 w-4 shrink-0"><GodEye state="scanning" /></span>
        <span className="ds-glitch font-bold">RINNEGAN</span>
        <span className="text-white/40">// {liveScan.kind}</span>
        <span className="ml-auto text-[#ff004d] animate-pulse">■ EN VIVO</span>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1.1fr_1fr]">
        {/* Razonamiento (izq) */}
        <div className="min-w-0 text-[0.7rem] leading-relaxed">
          <div className="text-white/40 uppercase tracking-widest text-[0.55rem] mb-1">Razonamiento</div>
          {lastReasoning.length ? (
            lastReasoning.map((r, i) => (
              <div key={i} className="datamosh-in truncate">
                <span className="text-[#ff2bd6]">◇ {r.step}</span>{" "}
                <span className="text-white/80">{r.thought}</span>
                {r.action ? <span className="text-[#00e5ff]"> → {r.action}</span> : null}
              </div>
            ))
          ) : (
            <div className="text-white/40 animate-pulse">{statusText || "procesando…"}</div>
          )}
        </div>

        {/* Caras + contadores (der) */}
        <div className="min-w-0">
          {lastMedia.length ? (
            <div className="flex flex-wrap gap-2">
              {lastMedia.map((m, i) => (
                <div key={i} className="ds-sweep h-12 w-12 overflow-hidden rounded border border-[#c8ff2f]/40">
                  <img src={m.image_url} alt={m.source || "cara"} loading="lazy" className="h-full w-full object-cover opacity-80" />
                </div>
              ))}
            </div>
          ) : null}
          <div className="mt-2 flex gap-3 text-[0.6rem]">
            <span><span className="text-[#c8ff2f] text-sm font-bold">{findings}</span> hallazgos</span>
            <span><span className="text-[#00e5ff] text-sm font-bold">{providers.length}</span> providers</span>
          </div>
        </div>
      </div>

      {/* Providers activos (abajo) */}
      {providers.length ? (
        <div className="mt-2 flex flex-wrap gap-1.5 border-t border-white/10 pt-2">
          {providers.map((p) => (
            <span key={p} className="ds-neon text-[0.55rem] uppercase tracking-wide border border-[#c8ff2f]/40 rounded px-1 text-[#c8ff2f]">
              {p}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-2 text-[0.55rem] text-white/30">ctrl+c para abortar</div>
    </div>
  );
}
```

- [ ] **Step 4: Correr el test y verlo pasar**

Run: `npm test -- src/components/LiveTheater.test.jsx`
Expected: PASS.

- [ ] **Step 5: Montar en `Terminal.jsx`**

(a) Import (junto a `GodEye`/`OutputLine`):

```js
import LiveTheater from "./LiveTheater";
```

(b) En el destructuring de `useTerminal()` (Terminal.jsx ~84-92): añadir `liveScan` (tras `pickCandidate`) y **quitar `scanProgress`** (ya no se usa tras reemplazar el bloque, evita `no-unused-vars`). Debe quedar sin `scanProgress` y con:

```js
    pickCandidate,
    liveScan,
```

(c) Reemplazar el bloque `{isProcessing && ( … )}` (Terminal.jsx ~380-408, el mini progress actual, que usaba `scanProgress`) por el panel-teatro:

```jsx
          {isProcessing && (
            <LiveTheater liveScan={liveScan} statusText={statusText} />
          )}
```

(Nota: `LiveTheater` incluye el ojo, el estado y "ctrl+c". Si `liveScan.status` no es `running` todavía, devuelve null; como `beginScan` pone `running` de inmediato, el panel aparece al arrancar. El `scanProgress` numérico se omite — los contadores lo reemplazan; por eso se quita del destructuring. `statusText` sí se sigue usando como fallback.)

- [ ] **Step 6: Suite completa + lint**

Run: `npm test && npm run lint`
Expected: verdes, 0 errores.

- [ ] **Step 7: Commit**

```bash
git add src/components/LiveTheater.jsx src/components/LiveTheater.test.jsx src/components/Terminal.jsx
git commit -m "feat(theater): LiveTheater split-console panel + Terminal mount"
```

---

### Task 5: Verificación de la fase

- [ ] **Step 1: Lint + suite + build**

Run: `npm run lint && npm test && npm run build`
Expected: lint 0, todos los tests verdes, build OK.

- [ ] **Step 2: Verificación en navegador (dev)**

`npm run dev`, con sesión iniciada:
1. Confirmar el look DedSec (verde+magenta grunge, glitch en el ojo/RINNEGAN, scanlines) en boot/login/header/terminal.
2. Correr un escaneo (`osint torvalds` o `investigar …`) → confirmar el **panel-teatro** (consola dividida) con razonamiento/contadores/providers/caras en vivo, y que colapsa al terminar dejando los resultados.
3. Confirmar sonidos DedSec.
4. (Accesibilidad) Con "reducir movimiento" del SO activo, confirmar que no hay glitch/parpadeo pero sí colores.

- [ ] **Step 3: (No commitear `docs/` en la rama.)**

---

## Notas de handoff

- Sub-proyecto 2 de v4 (spec `v4b`). Todo frontend + sonidos; sin backend.
- 2A (tokens+reskin, Tasks 1-2) es visual → verificado por lint/build/suite-verde + navegador, no TDD (no hay lógica que testear en CSS). 2B (Tasks 3-4) es TDD.
- El contador de presupuesto en vivo queda fuera (necesitaría evento de backend) — el teatro muestra lo derivable en cliente.
- El % facial detallado sigue en la galería del stream; el teatro muestra "comparando en progreso".
```
