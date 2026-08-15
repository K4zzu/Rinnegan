# Cuotas + costo USD (Fase 5) — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ver el consumo de cuotas (SerpApi/OpenAI/TomTom) y el costo en USD: una línea de costo al final de cada escaneo, un panel `cuotas` a demanda, y un indicador siempre visible en el header con lo más escaso (SerpApi) + total del mes.

**Architecture:** El backend (repo aparte) registra cada llamada medida en una tabla `usage`, expone `GET /usage`, y añade `cost` al evento `done` (prompt 22). El frontend: `getUsage` en `api.js`; la línea de costo en el `done` de `ScanEntry`; `UsagePanel` (comando `cuotas`); `UsageIndicator` (header, fetch de `/usage`).

**Tech Stack:** Frontend React 19 + Vite + Vitest. Backend FastAPI (entregado como prompt).

**Spec:** `specs/v3-graph-vault-intelligence-design.md` (§5.7, §6.7)

## Global Constraints

- JSX sin TypeScript; ESLint flat config; `no-unused-vars` ignora `^[A-Z_]`. `npm run lint` 0 errores.
- Build sale a `docs/`; nunca escribir specs/planes bajo `docs/`; no commitear `docs/` en la rama.
- Backend = repo separado; se entrega como `specs/backend-prompts/22-usage-cost.md`.
- Vitest (jsdom). Tests verifican comportamiento real; mockear red con promesas.
- **Rulings de Fase 5:**
  - El costo por escaneo llega en el evento `done` como `cost: { usd, breakdown:[{provider, units, tokens, usd}] }` (derivado backend de las filas `usage` con ese `scan_id`). Si no viene, no se muestra línea de costo (degradación).
  - `GET /usage?period=month|day` → `{ providers:[{name, used, limit, unit, resets_at, cost_usd}], total_cost_usd, period }`.
  - El indicador HUD muestra la cuota escasa (SerpApi) + total USD; si `/usage` falla, no renderiza nada.

---

### Task 1: Prompt de backend (usage + /usage + cost en done)

**Files:**
- Create: `specs/backend-prompts/22-usage-cost.md`

- [ ] **Step 1: Escribir el prompt**

Crear `specs/backend-prompts/22-usage-cost.md` con este contenido exacto:

```markdown
# Prompt backend — v3 Fase 5: cuotas + costo USD (tabla usage, /usage, cost en done)

> Continúa en el MISMO repo `rinnegan-api`. Copia el bloque y pásaselo al agente.

---

Añade seguimiento de consumo y costo. NO cambies la lógica OSINT; solo instrumenta las llamadas externas medidas y añade un endpoint + un campo `cost` al evento `done`. Protegido con la auth existente.

## Tabla `usage` (con `user_id`, creada al arrancar)

`id` (pk), `user_id`, `provider` (`serpapi`|`openai`|`tomtom`), `endpoint` (str), `scan_id` (str, nullable), `units` (int, default 1), `tokens_in` (int, null), `tokens_out` (int, null), `cost_usd` (float, default 0), `created_at`.

## Instrumentación

Envuelve las llamadas externas medidas para insertar una fila `usage` por llamada, calculando `cost_usd` con precios de env:
- `OPENAI_PRICE_IN`, `OPENAI_PRICE_OUT` (USD por 1M tokens; usa los tokens reales de la respuesta). `provider="openai"`.
- `SERPAPI_PRICE` (USD por búsqueda; 0 en tier gratis). `provider="serpapi"`, `units=1` por búsqueda.
- `tomtom` (0 dentro del tier). `provider="tomtom"`, `units=1` por request.
- `SERPAPI_MONTHLY_LIMIT` (default 100), `TOMTOM_DAILY_LIMIT` (default 2500) — solo para mostrar el límite.

Cada escaneo (los streams `/osint/*/stream` y `/osint/graph/stream`) genera un `scan_id` (string) al empezar; propágalo a las llamadas medidas de ese escaneo para etiquetar sus filas `usage`. `/interpret`, `/route`, `/img` etc. usan `scan_id=null`.

## `cost` en el evento `done`

Al emitir `done` de un escaneo, incluye:
```json
{ "summary": { "findings": 9, "errors": 1, "elapsed_ms": 7800 },
  "cost": { "usd": 0.014, "breakdown": [
    { "provider": "openai", "units": 1, "tokens": 3100, "usd": 0.004 },
    { "provider": "serpapi", "units": 5, "tokens": null, "usd": 0.010 } ] } }
```
`cost` = suma de las filas `usage` con ese `scan_id`. Si no hubo costo, `cost: { "usd": 0, "breakdown": [] }`.

## `GET /usage?period=month|day`

Devuelve:
```json
{ "period": "month",
  "providers": [
    { "name": "serpapi", "used": 37, "limit": 100, "unit": "búsquedas", "resets_at": "2026-09-01", "cost_usd": 0 },
    { "name": "openai", "used": 128000, "limit": null, "unit": "tokens", "resets_at": null, "cost_usd": 0.42 },
    { "name": "tomtom", "used": 14, "limit": 2500, "unit": "requests", "resets_at": "medianoche", "cost_usd": 0 } ],
  "total_cost_usd": 0.42 }
```
`used`/`cost_usd` agregados por proveedor en el periodo (SerpApi: mes; TomTom: día). `resets_at` legible.

## Tests (pytest)

- Insertar filas `usage` mockeadas → `GET /usage` agrega correctamente por proveedor y periodo; `total_cost_usd` suma.
- Aislamiento por usuario. Sin token → 401.
- Un escaneo con filas `usage` mockeadas para su `scan_id` → el `done` incluye `cost.usd` = suma y `breakdown` por proveedor.
- `ruff` limpio. README.

## Criterios de aceptación

1. Tabla `usage` + instrumentación de SerpApi/OpenAI/TomTom con `cost_usd` por precios de env.
2. `GET /usage` agrega por proveedor/periodo con límites y `total_cost_usd`.
3. El `done` de los escaneos incluye `cost` (suma por `scan_id`).
4. Aislamiento por usuario; 401 sin token. Tests + `ruff` + README.

## NO hagas

- No rompas los eventos existentes (solo AÑADES `cost` al `done`). No expongas precios como secretos (son env). No bloquees escaneos por cuota (solo informas).
```

- [ ] **Step 2: Commit**

```bash
git add specs/backend-prompts/22-usage-cost.md
git commit -m "docs: backend prompt 22 (usage tracking + cost)"
```

---

### Task 2: `api.js` — `getUsage`

**Files:**
- Modify: `src/services/api.js`
- Test: `src/services/api.test.js`

**Interfaces:**
- Produces: `getUsage(period="month") → Promise<{providers, total_cost_usd, period}>`.

- [ ] **Step 1: Escribir el test que falla**

Añadir a `src/services/api.test.js`:

```js
import { getUsage } from "./api";

describe("getUsage", () => {
  it("hace GET a /usage con el periodo", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ providers: [], total_cost_usd: 0, period: "month" }),
      })
    );
    const res = await getUsage("month");
    expect(res).toEqual({ providers: [], total_cost_usd: 0, period: "month" });
    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(url).toContain("/usage");
    expect(url).toContain("period=month");
  });
});
```

- [ ] **Step 2: Correr el test y verlo fallar**

Run: `npm test -- src/services/api.test.js`
Expected: FAIL — `getUsage is not a function`.

- [ ] **Step 3: Implementar**

En `src/services/api.js`, junto a las funciones de bóveda:

```js
// Consumo de cuotas + costo USD acumulado (period: "month" | "day").
export function getUsage(period = "month") {
  return request("/usage", { params: { period } });
}
```

- [ ] **Step 4: Correr el test y verlo pasar**

Run: `npm test -- src/services/api.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/api.js src/services/api.test.js
git commit -m "feat(api): getUsage (quotas + cost)"
```

---

### Task 3: `ScanEntry` — línea de costo en el `done`

**Files:**
- Modify: `src/components/ScanEntry.jsx`
- Test: `src/components/ScanEntry.cost.test.jsx` (nuevo)

**Interfaces:**
- Consumes: entrada `{ scan: "done", findings, errors, elapsed, cost? }` donde `cost = { usd, breakdown:[{provider, units, tokens, usd}] }`.

- [ ] **Step 1: Escribir el test que falla**

Crear `src/components/ScanEntry.cost.test.jsx`:

```jsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ScanEntry from "./ScanEntry";

describe("ScanEntry · costo", () => {
  it("muestra la línea de costo en el done cuando viene cost", () => {
    const entry = {
      type: "scan",
      scan: "done",
      findings: 9,
      errors: 1,
      elapsed: 7800,
      cost: {
        usd: 0.014,
        breakdown: [
          { provider: "openai", units: 1, tokens: 3100, usd: 0.004 },
          { provider: "serpapi", units: 5, tokens: null, usd: 0.01 },
        ],
      },
    };
    render(<ScanEntry entry={entry} theme={{}} />);
    expect(screen.getByText(/costo/i)).toBeTruthy();
    expect(screen.getByText(/openai/)).toBeTruthy();
    expect(screen.getByText(/serpapi/)).toBeTruthy();
  });

  it("no muestra costo cuando no viene", () => {
    const entry = { type: "scan", scan: "done", findings: 1, errors: 0, elapsed: 100 };
    render(<ScanEntry entry={entry} theme={{}} />);
    expect(screen.queryByText(/costo/i)).toBeNull();
  });
});
```

- [ ] **Step 2: Correr el test y verlo fallar**

Run: `npm test -- src/components/ScanEntry.cost.test.jsx`
Expected: FAIL — no existe la línea de costo.

- [ ] **Step 3: Implementar**

En `src/components/ScanEntry.jsx`:

(a) Añadir dos helpers a nivel de módulo (tras el `const ERROR_COLOR = …`, cerca del inicio):

```js
const fmtUsd = (n) =>
  typeof n === "number" ? `$${n.toFixed(n < 0.01 ? 4 : 2)}` : "$0";

function fmtBreakdown(b) {
  const amount =
    typeof b.tokens === "number"
      ? `${Math.round(b.tokens / 100) / 10}k tok`
      : `×${b.units ?? 1}`;
  return `${b.provider} ${amount} ${fmtUsd(b.usd)}`;
}
```

(b) En el `case "done":`, añadir la línea de costo tras el `<span>{entry.elapsed}ms</span>`. El bloque `done` debe quedar así:

```jsx
    case "done":
      return (
        <div className="scan-done mt-1 mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-white/10 pt-1 text-[0.65rem] uppercase tracking-wider">
          <span style={{ color: CONFIDENCE.high.color }}>
            ✓ {entry.findings} {entry.findings === 1 ? "hallazgo" : "hallazgos"}
          </span>
          {entry.errors ? (
            <span style={{ color: CONFIDENCE.medium.color }}>
              {entry.errors} {entry.errors === 1 ? "error" : "errores"}
            </span>
          ) : null}
          <span className="text-white/40">{entry.elapsed}ms</span>
          {entry.cost && (entry.cost.usd || entry.cost.breakdown?.length) ? (
            <span className="normal-case text-white/50">
              costo {fmtUsd(entry.cost.usd)}
              {entry.cost.breakdown?.length ? (
                <span className="text-white/35">
                  {" "}
                  ({entry.cost.breakdown.map((b) => fmtBreakdown(b)).join(" · ")})
                </span>
              ) : null}
            </span>
          ) : null}
        </div>
      );
```

- [ ] **Step 4: Correr el test y verlo pasar**

Run: `npm test -- src/components/ScanEntry.cost.test.jsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ScanEntry.jsx src/components/ScanEntry.cost.test.jsx
git commit -m "feat(cost): per-scan cost line in the done summary"
```

---

### Task 4: `UsagePanel` + wiring en `OutputLine`

**Files:**
- Create: `src/components/UsagePanel.jsx`
- Test: `src/components/UsagePanel.test.jsx`
- Modify: `src/components/OutputLine.jsx`

**Interfaces:**
- Consumes: entrada `{ type: "usage", data: {providers, total_cost_usd, period} }`.
- Produces: `<UsagePanel data={…} />` (default export).

- [ ] **Step 1: Escribir el test que falla**

Crear `src/components/UsagePanel.test.jsx`:

```jsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import UsagePanel from "./UsagePanel";

describe("UsagePanel", () => {
  it("lista proveedores con uso/límite y el total", () => {
    const data = {
      period: "month",
      providers: [
        { name: "serpapi", used: 37, limit: 100, unit: "búsquedas", resets_at: "2026-09-01", cost_usd: 0 },
        { name: "openai", used: 128000, limit: null, unit: "tokens", resets_at: null, cost_usd: 0.42 },
      ],
      total_cost_usd: 0.42,
    };
    render(<UsagePanel data={data} />);
    expect(screen.getByText("serpapi")).toBeTruthy();
    expect(screen.getByText("openai")).toBeTruthy();
    expect(screen.getByText(/37\/100/)).toBeTruthy();
    expect(screen.getByText(/total/i)).toBeTruthy();
  });

  it("estado vacío sin proveedores", () => {
    render(<UsagePanel data={{ providers: [], total_cost_usd: 0 }} />);
    expect(screen.getByText(/sin datos de uso/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Correr el test y verlo fallar**

Run: `npm test -- src/components/UsagePanel.test.jsx`
Expected: FAIL — módulo no existe.

- [ ] **Step 3: Implementar `UsagePanel.jsx`**

Crear `src/components/UsagePanel.jsx`:

```jsx
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
      <div className="mb-2 flex items-center gap-2 text-[0.7rem] uppercase tracking-widest text-fuchsia-300/80">
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
                    className="h-full rounded bg-fuchsia-400/70"
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
```

- [ ] **Step 4: Correr el test y verlo pasar**

Run: `npm test -- src/components/UsagePanel.test.jsx`
Expected: PASS.

- [ ] **Step 5: Cablear en `OutputLine`**

En `src/components/OutputLine.jsx`:

(a) Añadir el import (tras los otros imports estáticos, junto a `VaultList`):

```js
import UsagePanel from "./UsagePanel";
```

(b) Añadir el caso, junto a los otros `if (entry.type === …)` (p. ej. tras el caso `vault`):

```js
  if (entry.type === "usage") {
    return <UsagePanel data={entry.data} />;
  }
```

- [ ] **Step 6: Correr la suite + lint**

Run: `npm test && npm run lint`
Expected: verdes, 0 errores.

- [ ] **Step 7: Commit**

```bash
git add src/components/UsagePanel.jsx src/components/UsagePanel.test.jsx src/components/OutputLine.jsx
git commit -m "feat(cost): UsagePanel + OutputLine wiring"
```

---

### Task 5: `useTerminal` — costo en el `done` + comando `cuotas`

**Files:**
- Modify: `src/hooks/useTerminal.js`
- Test: `src/hooks/useTerminal.usage.test.js`

**Interfaces:**
- Consumes: `getUsage` (Task 2).
- Produces: el `done` del escaneo lleva `cost`; comando `cuotas`/`uso` empuja `{type:"usage", data}`.

- [ ] **Step 1: Escribir el test que falla**

Crear `src/hooks/useTerminal.usage.test.js`:

```js
import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useTerminal } from "./useTerminal";
import * as api from "../services/api";

afterEach(() => vi.restoreAllMocks());

describe("useTerminal · cuotas y costo", () => {
  it("el comando 'cuotas' consulta /usage y empuja una entrada 'usage'", async () => {
    vi.spyOn(api, "getUsage").mockResolvedValue({
      period: "month",
      providers: [{ name: "serpapi", used: 3, limit: 100, unit: "búsquedas" }],
      total_cost_usd: 0.1,
    });
    const { result } = renderHook(() => useTerminal());
    await act(async () => {
      await result.current.handleCommand("cuotas");
    });
    await waitFor(() => {
      const usage = result.current.history.find((e) => e.type === "usage");
      expect(usage).toBeTruthy();
      expect(usage.data.providers[0].name).toBe("serpapi");
    });
    expect(api.getUsage).toHaveBeenCalled();
  });

  it("el done del escaneo propaga cost al historial", async () => {
    vi.spyOn(api, "streamOsint").mockImplementation((cat, val, h) => {
      h.meta?.({});
      h.done?.({
        summary: { findings: 0, errors: 0, elapsed_ms: 1000 },
        cost: { usd: 0.01, breakdown: [{ provider: "serpapi", units: 5, usd: 0.01 }] },
      });
      return { close: () => {} };
    });
    const { result } = renderHook(() => useTerminal());
    await act(async () => {
      await result.current.handleCommand("osint user carlos");
    });
    await waitFor(() => {
      const done = result.current.history.find((e) => e.type === "scan" && e.scan === "done");
      expect(done).toBeTruthy();
      expect(done.cost.usd).toBe(0.01);
    });
  });
});
```

- [ ] **Step 2: Correr el test y verlo fallar**

Run: `npm test -- src/hooks/useTerminal.usage.test.js`
Expected: FAIL — `cuotas` no reconocido; el done no lleva `cost`.

- [ ] **Step 3: Implementar**

En `src/hooks/useTerminal.js`:

(a) Añadir `getUsage` al import de `../services/api`.

(b) Añadir `"cuotas"` y `"uso"` a `EXPLICIT_SINGLE`.

(c) En `handleCommand`, junto a los otros comandos (p. ej. tras el caso `boveda`):

```js
    if (command === "cuotas" || command === "uso") {
      await handleUsage();
      return;
    }
```

(d) Añadir el handler `handleUsage` (junto a `handleVault`):

```js
  const handleUsage = async () => {
    pushToHistory({ type: "output", text: "[cuotas] consultando…" });
    try {
      const data = await getUsage("month");
      pushToHistory({ type: "usage", data });
    } catch (err) {
      pushToHistory({
        type: "error",
        text: "No se pudo cargar el uso: " + (err?.message || "error"),
      });
    }
  };
```

(e) En el handler `done` de `beginScan`, añadir `cost: d?.cost ?? null` a la entrada del escaneo. La llamada `pushScan({ type: "scan", scan: "done", … })` debe incluir el campo `cost`:

```js
        pushScan({
          type: "scan",
          scan: "done",
          findings: s.findings ?? 0,
          errors: s.errors ?? 0,
          elapsed: s.elapsed_ms ?? "?",
          cost: d?.cost ?? null,
        });
```

(Deja el resto del handler `done` igual: el push del grafo si hay nodos, `pendingSaveRef`, el prompt `◈ ¿archivar…`, y `finish()`.)

- [ ] **Step 4: Correr el test y verlo pasar**

Run: `npm test -- src/hooks/useTerminal.usage.test.js`
Expected: PASS.

- [ ] **Step 5: Suite completa + lint**

Run: `npm test && npm run lint`
Expected: verdes (incl. los tests de fases previas de `useTerminal`), 0 errores.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useTerminal.js src/hooks/useTerminal.usage.test.js
git commit -m "feat(cost): cost in scan done + 'cuotas' command"
```

---

### Task 6: `UsageIndicator` (HUD) + header de `Terminal`

**Files:**
- Create: `src/components/UsageIndicator.jsx`
- Test: `src/components/UsageIndicator.test.jsx`
- Modify: `src/components/Terminal.jsx`

**Interfaces:**
- Consumes: `getUsage` (Task 2).
- Produces: `<UsageIndicator />` — compacto, se dibuja en el header.

- [ ] **Step 1: Escribir el test que falla**

Crear `src/components/UsageIndicator.test.jsx`:

```jsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("../services/api", () => ({
  getUsage: vi.fn(() =>
    Promise.resolve({
      providers: [{ name: "serpapi", used: 63, limit: 100 }],
      total_cost_usd: 0.42,
    })
  ),
}));

import UsageIndicator from "./UsageIndicator";
import { getUsage } from "../services/api";

afterEach(() => vi.clearAllMocks());

describe("UsageIndicator", () => {
  it("muestra la cuota escasa (serp) y el costo total tras cargar", async () => {
    render(<UsageIndicator />);
    await waitFor(() => {
      expect(getUsage).toHaveBeenCalled();
      expect(screen.getByText(/serp 63\/100/i)).toBeTruthy();
      expect(screen.getByText(/\$0\.42/)).toBeTruthy();
    });
  });
});
```

- [ ] **Step 2: Correr el test y verlo fallar**

Run: `npm test -- src/components/UsageIndicator.test.jsx`
Expected: FAIL — módulo no existe.

- [ ] **Step 3: Implementar `UsageIndicator.jsx`**

Crear `src/components/UsageIndicator.jsx`:

```jsx
// src/components/UsageIndicator.jsx
// Indicador compacto de cuotas en el header: muestra lo más escaso (SerpApi) y
// el costo total del mes. Si /usage falla, no renderiza nada. Escribe `cuotas`
// para el panel completo.
import { useEffect, useState } from "react";
import { getUsage } from "../services/api";

export default function UsageIndicator({ className = "" }) {
  const [usage, setUsage] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getUsage("month")
      .then((d) => !cancelled && setUsage(d))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!usage) return null;

  const serp = (usage.providers || []).find((p) =>
    (p.name || "").toLowerCase().includes("serp")
  );
  const total =
    typeof usage.total_cost_usd === "number" ? usage.total_cost_usd : 0;

  return (
    <span
      className={`text-[0.6rem] tracking-wide opacity-70 ${className}`}
      title="cuotas y costo — escribe 'cuotas' para el panel"
    >
      {serp ? `serp ${serp.used}/${serp.limit ?? "∞"} · ` : ""}${total.toFixed(2)}
    </span>
  );
}
```

- [ ] **Step 4: Correr el test y verlo pasar**

Run: `npm test -- src/components/UsageIndicator.test.jsx`
Expected: PASS.

- [ ] **Step 5: Cablear en el header de `Terminal.jsx`**

En `src/components/Terminal.jsx`:

(a) Añadir el import (junto al de `GodEye`):

```js
import UsageIndicator from "./UsageIndicator";
```

(b) En la barra de ventana del header (el `<div className="flex items-center gap-2">` que contiene `GodEye` + `RINNEGAN` + `· {theme.label}`), añadir el indicador al final, empujado a la derecha. Tras la línea `<span className="ml-1 truncate opacity-50">· {theme.label}</span>`:

```jsx
          <UsageIndicator className="ml-auto shrink-0" />
```

- [ ] **Step 6: Correr la suite + lint**

Run: `npm test && npm run lint`
Expected: verdes, 0 errores.

- [ ] **Step 7: Commit**

```bash
git add src/components/UsageIndicator.jsx src/components/UsageIndicator.test.jsx src/components/Terminal.jsx
git commit -m "feat(cost): HUD usage indicator in the header"
```

---

### Task 7: Verificación de la fase

- [ ] **Step 1: Lint + suite + build**

Run: `npm run lint && npm test && npm run build`
Expected: lint 0, todos los tests verdes, build OK.

- [ ] **Step 2: Verificación en navegador (con el backend del prompt 22 desplegado)**

Con sesión y prompt 22 desplegado:
1. Correr un escaneo → confirmar la línea de costo en el cierre (`costo $… (…)`).
2. Escribir `cuotas` → confirmar el panel con barras por proveedor + total.
3. Confirmar el indicador en el header (`serp N/100 · $X.XX`).

- [ ] **Step 3: (No commitear `docs/` en la rama.)**

---

## Notas de handoff

- Fase 5 del spec v3 (§9), la última. Backend: prompt 22. El resto es frontend.
- Con esta fase, el diseño v3 completo queda implementado en el frontend (faltan por desplegar los prompts 18-22).
- Rulings: costo en el evento `done`; indicador HUD = SerpApi + total; panel a demanda con `cuotas`/`uso`.
```
