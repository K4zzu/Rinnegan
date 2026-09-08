# Agente de investigación (sub-proyecto 1) — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que una frase con poca info + una pista ("investiga a Thiago Andrés Navarro, hijo de la rectora de una universidad") dispare un agente backend que razona, busca, verifica y arma un **dossier** (identidad, ocupación, cuentas, fotos, familia), mostrando su razonamiento en vivo y pidiendo elegir solo si hay candidatos ambiguos.

**Architecture:** El backend (repo aparte) expone `GET /investigate/stream` con un bucle agéntico (OpenAI function-calling, `gpt-4.1-mini`) sobre las herramientas OSINT existentes, con presupuesto de búsquedas; emite los eventos SSE actuales más `reasoning`/`candidate`/`dossier`. El frontend enruta la acción NL `investigate`, corre el stream con `beginScan`, renderiza el razonamiento en vivo (líneas), el `DossierView` y el `CandidatePicker` (que re-lanza la investigación enfocada).

**Tech Stack:** Frontend React 19 + Vite + Vitest. Backend FastAPI + OpenAI function-calling (entregado como prompt, no implementado aquí).

**Spec:** `specs/v4-investigation-agent-design.md`

## Global Constraints

- JSX sin TypeScript; ESLint flat config; `no-unused-vars` ignora `^[A-Z_]`. `npm run lint` 0 errores.
- Build sale a `docs/`; nunca escribir specs/planes bajo `docs/`; no commitear `docs/` en la rama.
- Backend = repo separado; se entrega como `specs/backend-prompts/23-investigate-agent.md`.
- Vitest (jsdom). Tests verifican comportamiento real; SSE con la `FakeEventSource` de módulo en `api.test.js`.
- **Contrato SSE:** eventos existentes (`meta/progress/finding/source_error/media/node/edge/done`) + `reasoning` `{step, thought, action}`, `candidate` `{candidates:[{id,name,why,confidence,image_url,profiles}]}`, `dossier` `{identity,occupation,personal_info,accounts,photos,family,sources,note}`. Tras `candidate` el backend emite `done` (nota "necesita elección") para cerrar el stream limpio. Familia también como `node`+`edge` con `relation:"family:<parentesco>"`.
- Modelo del agente por env `INVESTIGATE_MODEL` (default `gpt-4.1-mini`); presupuesto `INVESTIGATE_MAX_SEARCHES` (20), `INVESTIGATE_MAX_HOPS` (3).

---

### Task 1: Prompt de backend (agente `/investigate/stream`)

**Files:**
- Create: `specs/backend-prompts/23-investigate-agent.md`

- [ ] **Step 1: Escribir el prompt**

Crear `specs/backend-prompts/23-investigate-agent.md` con este contenido exacto:

```markdown
# Prompt backend — v4: agente de investigación `/investigate/stream`

> Continúa en el MISMO repo `rinnegan-api`. Copia el bloque y pásaselo al agente.

---

Añade `GET /investigate/stream?seed=<s>&hint=<h>` (protegido; token por header o `?token=`). Es un **bucle agéntico**: la IA (OpenAI function-calling) dirige una investigación OSINT usando la pista para encontrar y verificar a una persona, luego su familia cercana, y emite un dossier. Reusa `OPENAI_API_KEY`, los providers OSINT existentes y el tracking de `usage` (para que el `done` lleve `cost`). NO cambies los otros endpoints.

## Modelo y presupuesto (env)
- `INVESTIGATE_MODEL` (default `gpt-4.1-mini`).
- `INVESTIGATE_MAX_SEARCHES` (default 20) — tope duro de tool-calls que consumen búsquedas.
- `INVESTIGATE_MAX_HOPS` (default 3).

## Herramientas (function-calling)
Expón a la IA estas funciones; cada llamada que busque cuenta contra `MAX_SEARCHES`:
- `web_search(query)` → dorks vía SerpApi (Google). Devuelve `[{title,url,snippet}]`.
- `scan_username(handle)` → el escaneo Maigret existente → perfiles.
- `reverse_image(image_url)` → SerpApi reverse.

## System prompt (reglas)
Misión: encontrar a la persona que encaja con `seed`+`hint`, **verificar la pista contra una fuente concreta** (ej. una página/nota que ligue a la persona con lo que dice la pista), y luego pivotar a **familia cercana**. Reglas duras: **nunca inventes**; cada afirmación del dossier **cita su fuente (URL)**; afirma identidad **solo con señal fuerte**; si hay ≥2 personas plausibles que no puedes distinguir, **desambigua con el usuario** (herramienta/salida `candidate`). Sé conciso en el razonamiento.

## Comportamiento del bucle
1. La IA planea y llama herramientas; el backend ejecuta y le devuelve los resultados.
2. Por cada paso, emite un evento SSE `reasoning`. Por cada hallazgo/foto/perfil, emite los eventos existentes (`finding`/`media`).
3. Cuando descubre a la persona o a un familiar, emite `node` (kind name/username) + `edge` (`relation:"pivot"` o `relation:"family:<parentesco>"`).
4. Para al llegar al dossier, agotar el presupuesto, o necesitar desambiguar.

## Eventos SSE (existentes + 3 nuevos)
- `reasoning` → `{ "step": 1, "thought": "…", "action": "web_search: rectora universidad Navarro" }`
- `candidate` → `{ "candidates": [ { "id":"c1","name":"…","why":"…","confidence":0.6,"image_url":"…","profiles":["…"] } ] }`. **Tras emitir `candidate`, emite `done`** (con `summary` + `cost`, nota "necesita elección") para cerrar el stream.
- `dossier` → `{ "identity":{"name":"…","confidence":0.82,"verified_by":"url"}, "occupation":"…", "personal_info":["…"], "accounts":[{"platform":"instagram","url":"…","handle":"…"}], "photos":[{"image_url":"…","source":"…"}], "family":[{"name":"…","relation":"madre","note":"rectora de …","url":"…"}], "sources":["…"], "note":"completo|parcial|no determinable" }`
- `done` → como los otros streams: `{ "summary":{...}, "cost":{...} }`.

## Errores
Nunca 500. Fallo de IA/proveedor → emite `dossier` con `note:"no concluyente"` + lo que se haya hallado, luego `done`. Presupuesto agotado → dossier parcial + nota. Persona no encontrada → dossier `note:"no determinable"`.

## Tests (pytest, IA+providers mockeados)
- El bucle llama herramientas y **respeta `MAX_SEARCHES`** (no excede el tope).
- Emite `reasoning`, y al final `dossier`+`done`.
- Ruta de ambigüedad: la IA pide desambiguar → emite `candidate` seguido de `done`.
- Familia sale como `node`+`edge` con `relation` `family:*`.
- El dossier cita fuentes (URLs) en `sources`/`verified_by`.
- Sin token → 401. Nunca 500. `ruff` limpio. README.

## Criterios de aceptación
1. `GET /investigate/stream` corre el agente con presupuesto y emite `reasoning`/`candidate`/`dossier` además de los eventos actuales; familia como node/edge.
2. El `done` incluye `cost` (usa el tracking de usage). Tras `candidate` viene `done`.
3. Protegido (401 sin token); nunca 500. Tests + `ruff` + README.

## NO hagas
- No cambies el modelo del reporte simple de escaneos (sigue `gpt-4o-mini`). No hagas saltos ilimitados (respeta el presupuesto). No inventes datos. No expongas keys.
```

- [ ] **Step 2: Commit**

```bash
git add specs/backend-prompts/23-investigate-agent.md
git commit -m "docs: backend prompt 23 (investigation agent)"
```

---

### Task 2: `api.js` — `streamInvestigate` + eventos reasoning/candidate/dossier

**Files:**
- Modify: `src/services/api.js`
- Test: `src/services/api.test.js`

**Interfaces:**
- Consumes: `openEventStream(url, handlers)` existente.
- Produces: `streamInvestigate(seed, hint, handlers) → {close}`; `SSE_EVENTS` incluye `"reasoning"`, `"candidate"`, `"dossier"`.

- [ ] **Step 1: Escribir el test que falla**

Añadir a `src/services/api.test.js` (reusa la `FakeEventSource` de módulo; añade su propio `beforeEach` que estubbea `EventSource`):

```js
import { streamInvestigate } from "./api";

describe("streamInvestigate", () => {
  beforeEach(() => vi.stubGlobal("EventSource", FakeEventSource));

  it("abre /investigate/stream con seed y hint, y despacha los eventos nuevos", () => {
    const reasoning = vi.fn();
    const candidate = vi.fn();
    const dossier = vi.fn();
    streamInvestigate("Thiago Navarro", "hijo de rectora", { reasoning, candidate, dossier });
    expect(FakeEventSource.last.url).toContain("/investigate/stream");
    expect(FakeEventSource.last.url).toContain("seed=Thiago+Navarro");
    expect(FakeEventSource.last.url).toContain("hint=hijo+de+rectora");

    FakeEventSource.last.emit("reasoning", JSON.stringify({ step: 1, thought: "t", action: "a" }));
    FakeEventSource.last.emit("candidate", JSON.stringify({ candidates: [{ id: "c1", name: "X" }] }));
    FakeEventSource.last.emit("dossier", JSON.stringify({ identity: { name: "X" } }));
    expect(reasoning).toHaveBeenCalledWith({ step: 1, thought: "t", action: "a" });
    expect(candidate).toHaveBeenCalledWith({ candidates: [{ id: "c1", name: "X" }] });
    expect(dossier).toHaveBeenCalledWith({ identity: { name: "X" } });
  });
});
```

- [ ] **Step 2: Correr el test y verlo fallar**

Run: `npm test -- src/services/api.test.js`
Expected: FAIL — `streamInvestigate is not a function`.

- [ ] **Step 3: Implementar**

En `src/services/api.js`:

(a) Añadir `"reasoning"`, `"candidate"`, `"dossier"` a `SSE_EVENTS` (antes de `"done"`):

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
  "reasoning",
  "candidate",
  "dossier",
  "done",
];
```

(b) Añadir `streamInvestigate` (junto a `streamOsintGraph`):

```js
/**
 * Agente de investigación: bucle agéntico backend. Además de los eventos
 * normales emite `reasoning`, `candidate` y `dossier`.
 */
export function streamInvestigate(seed, hint, handlers = {}) {
  const url = new URL("/investigate/stream", BASE_URL);
  url.searchParams.set("seed", seed);
  if (hint) url.searchParams.set("hint", hint);
  return openEventStream(url, handlers);
}
```

- [ ] **Step 4: Correr el test y verlo pasar**

Run: `npm test -- src/services/api.test.js`
Expected: PASS (incluidos los tests existentes de streamOsint/streamOsintGraph).

- [ ] **Step 5: Commit**

```bash
git add src/services/api.js src/services/api.test.js
git commit -m "feat(api): streamInvestigate + reasoning/candidate/dossier SSE events"
```

---

### Task 3: `useTerminal` — acción `investigate`, comando `investigar`, handlers, re-run

**Files:**
- Modify: `src/hooks/useTerminal.js`
- Modify: `src/utils/commandParser.js`
- Test: `src/hooks/useTerminal.investigate.test.js`

**Interfaces:**
- Consumes: `streamInvestigate` (Task 2); `beginScan` existente.
- Produces: `handleInvestigate(seed, hint)`; `pickCandidate(candidate)`; el hook retorna `pickCandidate` para el wiring; el dispatch NL enruta `investigate`; comando `investigar <seed> · <hint>`; `parseCommand("investigar …")` → `{command:"investigar", args:[…]}`.

- [ ] **Step 1: Escribir el test que falla**

Crear `src/hooks/useTerminal.investigate.test.js`:

```js
import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useTerminal } from "./useTerminal";
import * as api from "../services/api";

afterEach(() => vi.restoreAllMocks());

describe("useTerminal · investigate", () => {
  it("el comando 'investigar' abre streamInvestigate y renderiza reasoning + dossier", async () => {
    vi.spyOn(api, "streamInvestigate").mockImplementation((seed, hint, h) => {
      h.meta?.({});
      h.reasoning?.({ step: 1, thought: "busco la rectora", action: "web_search" });
      h.dossier?.({ identity: { name: "Thiago Navarro", confidence: 0.8 }, family: [], accounts: [], photos: [] });
      h.done?.({ summary: { findings: 3, errors: 0, elapsed_ms: 5000 }, cost: { usd: 0.02, breakdown: [] } });
      return { close: () => {} };
    });
    const { result } = renderHook(() => useTerminal());
    await act(async () => {
      await result.current.handleCommand("investigar Thiago Navarro · hijo de rectora");
    });
    await waitFor(() => {
      const reasoning = result.current.history.find((e) => e.scan === "reasoning");
      const dossier = result.current.history.find((e) => e.type === "dossier");
      expect(reasoning).toBeTruthy();
      expect(dossier.data.identity.name).toBe("Thiago Navarro");
    });
    const [seed, hint] = api.streamInvestigate.mock.calls[0];
    expect(seed).toBe("Thiago Navarro");
    expect(hint).toBe("hijo de rectora");
  });

  it("un evento candidate empuja una entrada 'candidates' y NO pide guardar", async () => {
    vi.spyOn(api, "streamInvestigate").mockImplementation((seed, hint, h) => {
      h.candidate?.({ candidates: [{ id: "c1", name: "A" }, { id: "c2", name: "B" }] });
      h.done?.({ summary: {}, cost: null });
      return { close: () => {} };
    });
    const { result } = renderHook(() => useTerminal());
    await act(async () => {
      await result.current.handleCommand("investigar Ana");
    });
    await waitFor(() => {
      expect(result.current.history.find((e) => e.type === "candidates")).toBeTruthy();
    });
    // sin prompt de guardado tras candidate
    expect(result.current.history.find((e) => e.text === "◈ ¿archivar en la bóveda? [s/n]")).toBeFalsy();
  });
});
```

- [ ] **Step 2: Correr el test y verlo fallar**

Run: `npm test -- src/hooks/useTerminal.investigate.test.js`
Expected: FAIL — `investigar` no reconocido; no hay reasoning/dossier/candidates.

- [ ] **Step 3: Implementar**

En `src/hooks/useTerminal.js`:

(a) Import: añadir `streamInvestigate` al import de `../services/api`.

(b) Añadir `"investigar"` a `EXPLICIT_PREFIX` (la lista junto a `EXPLICIT_SINGLE`):

```js
const EXPLICIT_PREFIX = ["osint", "ruta", "route", "theme", "sound", "investigar"];
```

(b2) En `src/utils/commandParser.js`, hacer que `investigar` se parsee como comando de prefijo (si no, cae en el fallback `unknown` con `command` = toda la cadena). Añadir, junto al bloque `if (first === "ruta" || first === "route")`:

```js
  // --- Comando investigar (texto libre: persona · pista) ---
  if (first === "investigar") {
    return {
      command: "investigar",
      args: parts.slice(1),
      category: "core",
    };
  }
```

(c) Junto a los otros refs (donde están `currentScanRef`/`pendingSaveRef`), añadir:

```js
  const candidatePausedRef = useRef(false);
```

(d) En `handleNaturalLanguage`, añadir el caso al `switch`:

```js
      case "investigate":
        if (action.seed) handleInvestigate(action.seed, action.hint || "");
        else
          pushToHistory({
            type: "error",
            text: "Entendí que quieres investigar, pero no una persona clara.",
          });
        break;
```

(e) En `handleCommand`, añadir el caso del comando explícito (junto a los otros, p. ej. tras `ruta`):

```js
    if (command === "investigar") {
      const raw = args.join(" ");
      const [seed, hint] = raw.split("·").map((s) => s.trim());
      if (!seed) {
        pushToHistory({ type: "error", text: "Uso: investigar <persona> · <pista opcional>" });
      } else {
        handleInvestigate(seed, hint || "");
      }
      return;
    }
```

(Nota: `parseCommand` devuelve `command:"investigar"` y `args` con el resto; verifica que `investigar` caiga en el bloque `category === "core"`/fallback y llegue aquí. Como está en `EXPLICIT_PREFIX`, `isExplicitCommand` lo trata como explícito; el `command` será `"investigar"` por el fallback de `parseCommand`.)

(f) Añadir `handleInvestigate` y `pickCandidate` (junto a `runAutoScan`):

```js
  const handleInvestigate = (seed, hint) => {
    beginScan((handlers) => streamInvestigate(seed, hint, handlers), {
      kind: "investigate",
      queryFallback: seed,
    });
  };

  // Al elegir un candidato, re-lanza la investigación sembrada con esa identidad.
  const pickCandidate = (candidate) => {
    if (!candidate?.name) return;
    pushToHistory({ type: "input", text: `investigar ${candidate.name} (confirmado)` });
    handleInvestigate(candidate.name, `identidad confirmada por el usuario: ${candidate.why || candidate.name}`);
  };
```

(g) Al inicio de `beginScan` (donde se resetea `currentScanRef`), resetear el flag:

```js
    candidatePausedRef.current = false;
```

(h) En el objeto de handlers de `beginScan`, añadir `reasoning`/`candidate`/`dossier` (p. ej. tras `ai_report`):

```js
      reasoning: (d) => {
        if (!d) return;
        pushToHistory({
          type: "scan",
          scan: "reasoning",
          step: d.step,
          thought: d.thought,
          action: d.action,
        });
      },
      candidate: (d) => {
        if (!d?.candidates?.length) return;
        candidatePausedRef.current = true;
        pushToHistory({ type: "candidates", items: d.candidates });
      },
      dossier: (d) => {
        if (!d) return;
        sound.lock();
        pushToHistory({ type: "dossier", data: d });
      },
```

(i) En el handler `done`, envolver el prompt de guardado para saltarlo si hubo candidato. Reemplazar las dos líneas del `pendingSaveRef`/prompt por:

```js
        if (!candidatePausedRef.current) {
          pendingSaveRef.current = currentScanRef.current;
          pushToHistory({ type: "output", text: "◈ ¿archivar en la bóveda? [s/n]" });
        }
```

(j) Exponer `pickCandidate` en el `return` del hook (junto a `handleCommand`, `runImageScan`, etc.):

```js
    pickCandidate,
```

- [ ] **Step 4: Correr el test y verlo pasar**

Run: `npm test -- src/hooks/useTerminal.investigate.test.js`
Expected: PASS.

- [ ] **Step 5: Suite completa + lint**

Run: `npm test && npm run lint`
Expected: verdes (incl. los tests previos de useTerminal), 0 errores.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useTerminal.js src/utils/commandParser.js src/hooks/useTerminal.investigate.test.js
git commit -m "feat(investigate): NL action + investigar command + reasoning/candidate/dossier handlers"
```

---

### Task 4: `ScanEntry` — línea de razonamiento

**Files:**
- Modify: `src/components/ScanEntry.jsx`
- Test: `src/components/ScanEntry.reasoning.test.jsx`

**Interfaces:**
- Consumes: entrada `{ scan: "reasoning", step, thought, action }`.

- [ ] **Step 1: Escribir el test que falla**

Crear `src/components/ScanEntry.reasoning.test.jsx`:

```jsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ScanEntry from "./ScanEntry";

describe("ScanEntry · reasoning", () => {
  it("renderiza el paso de razonamiento con thought y action", () => {
    const entry = { type: "scan", scan: "reasoning", step: 2, thought: "busco la rectora", action: "web_search: rectora Navarro" };
    render(<ScanEntry entry={entry} theme={{}} />);
    expect(screen.getByText(/busco la rectora/)).toBeTruthy();
    expect(screen.getByText(/web_search/)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Correr el test y verlo fallar**

Run: `npm test -- src/components/ScanEntry.reasoning.test.jsx`
Expected: FAIL — el caso `reasoning` no existe (renderiza null).

- [ ] **Step 3: Implementar**

En `src/components/ScanEntry.jsx`, añadir el caso `reasoning` al `switch` (antes de `default`):

```jsx
    case "reasoning":
      return (
        <div className="finding-in flex items-start gap-2 py-[2px] pl-2 border-l-2 text-[0.7rem] md:text-xs" style={{ borderColor: "#a78bfa" }}>
          <span className="select-none text-fuchsia-300/80">◇</span>
          <span className="text-white/40 shrink-0">paso {entry.step}</span>
          <span className="min-w-0 flex-1">
            <span className="text-white/80">{entry.thought}</span>
            {entry.action ? (
              <span className="text-fuchsia-300/70"> → {entry.action}</span>
            ) : null}
          </span>
        </div>
      );
```

- [ ] **Step 4: Correr el test y verlo pasar**

Run: `npm test -- src/components/ScanEntry.reasoning.test.jsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ScanEntry.jsx src/components/ScanEntry.reasoning.test.jsx
git commit -m "feat(investigate): reasoning step line in ScanEntry"
```

---

### Task 5: `DossierView` + wiring en `OutputLine`

**Files:**
- Create: `src/components/DossierView.jsx`
- Test: `src/components/DossierView.test.jsx`
- Modify: `src/components/OutputLine.jsx`

**Interfaces:**
- Consumes: entrada `{ type: "dossier", data }` con la forma del dossier.
- Produces: `<DossierView data={…} />` (default export).

- [ ] **Step 1: Escribir el test que falla**

Crear `src/components/DossierView.test.jsx`:

```jsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import DossierView from "./DossierView";

describe("DossierView", () => {
  it("muestra identidad, ocupación, cuentas y familia", () => {
    const data = {
      identity: { name: "Thiago Navarro", confidence: 0.82, verified_by: "http://u/x" },
      occupation: "Estudiante",
      personal_info: ["Vive en Bogotá"],
      accounts: [{ platform: "instagram", url: "http://ig/t", handle: "thiago" }],
      photos: [{ image_url: "http://x/a.jpg", source: "instagram" }],
      family: [{ name: "María Navarro", relation: "madre", note: "rectora de X", url: "http://u/m" }],
      sources: ["http://u/x"],
      note: "completo",
    };
    render(<DossierView data={data} />);
    expect(screen.getByText("Thiago Navarro")).toBeTruthy();
    expect(screen.getByText(/Estudiante/)).toBeTruthy();
    expect(screen.getByText(/instagram/)).toBeTruthy();
    expect(screen.getByText(/María Navarro/)).toBeTruthy();
    expect(screen.getByText(/madre/)).toBeTruthy();
  });

  it("maneja un dossier no concluyente sin romper", () => {
    render(<DossierView data={{ note: "no determinable", identity: null }} />);
    expect(screen.getByText(/no determinable/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Correr el test y verlo fallar**

Run: `npm test -- src/components/DossierView.test.jsx`
Expected: FAIL — módulo no existe.

- [ ] **Step 3: Implementar `DossierView.jsx`**

Crear `src/components/DossierView.jsx`:

```jsx
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
    <div className="ai-reveal my-2 rounded-md border border-fuchsia-400/20 bg-white/[0.02] p-3">
      <div className="mb-1 flex items-center gap-2 text-[0.7rem] uppercase tracking-widest text-fuchsia-300/90">
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
            <a href={id.verified_by} target="_blank" rel="noreferrer" className="ml-2 text-[0.6rem] text-fuchsia-300/70 underline decoration-dotted">fuente</a>
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
                <span className="text-fuchsia-300/80">{f.relation}</span>: <span className="text-white/90">{f.name}</span>
                {f.note ? <span className="text-white/50"> — {f.note}</span> : null}
                {f.url ? <a href={f.url} target="_blank" rel="noreferrer" className="ml-1 text-[0.6rem] text-fuchsia-300/70 underline decoration-dotted">fuente</a> : null}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <div className="mt-2 text-[0.6rem] text-white/30">— datos OSINT sin verificación legal; validar antes de actuar.</div>
    </div>
  );
}
```

- [ ] **Step 4: Correr el test y verlo pasar**

Run: `npm test -- src/components/DossierView.test.jsx`
Expected: PASS.

- [ ] **Step 5: Cablear en `OutputLine`**

En `src/components/OutputLine.jsx`: añadir el import (junto a los otros estáticos) y el caso.

```js
import DossierView from "./DossierView";
```

Tras el caso `if (entry.type === "vault")` (o junto a los otros `if (entry.type === …)`):

```js
  if (entry.type === "dossier") {
    return <DossierView data={entry.data} />;
  }
```

- [ ] **Step 6: Correr la suite + lint**

Run: `npm test && npm run lint`
Expected: verdes, 0 errores.

- [ ] **Step 7: Commit**

```bash
git add src/components/DossierView.jsx src/components/DossierView.test.jsx src/components/OutputLine.jsx
git commit -m "feat(investigate): DossierView + OutputLine wiring"
```

---

### Task 6: `CandidatePicker` + wiring (con callback `onPick`)

**Files:**
- Create: `src/components/CandidatePicker.jsx`
- Test: `src/components/CandidatePicker.test.jsx`
- Modify: `src/components/OutputLine.jsx`, `src/components/Terminal.jsx`

**Interfaces:**
- Consumes: entrada `{ type: "candidates", items }`; `pickCandidate` (Task 3) via prop `onPick`.
- Produces: `<CandidatePicker items={…} onPick={fn} />`.

- [ ] **Step 1: Escribir el test que falla**

Crear `src/components/CandidatePicker.test.jsx`:

```jsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import CandidatePicker from "./CandidatePicker";

describe("CandidatePicker", () => {
  it("lista candidatos y llama onPick al elegir uno", () => {
    const items = [
      { id: "c1", name: "Thiago A", why: "hijo de rectora X", confidence: 0.7, image_url: "http://x/a.jpg" },
      { id: "c2", name: "Thiago B", why: "otro", confidence: 0.4 },
    ];
    const onPick = vi.fn();
    render(<CandidatePicker items={items} onPick={onPick} />);
    expect(screen.getByText("Thiago A")).toBeTruthy();
    expect(screen.getByText(/hijo de rectora X/)).toBeTruthy();
    fireEvent.click(screen.getByText("Thiago A"));
    expect(onPick).toHaveBeenCalledWith(items[0]);
  });
});
```

- [ ] **Step 2: Correr el test y verlo fallar**

Run: `npm test -- src/components/CandidatePicker.test.jsx`
Expected: FAIL — módulo no existe.

- [ ] **Step 3: Implementar `CandidatePicker.jsx`**

Crear `src/components/CandidatePicker.jsx`:

```jsx
// src/components/CandidatePicker.jsx
// Cuando la investigación encuentra varios candidatos ambiguos, muestra tarjetas
// clicables. Al elegir uno, onPick(candidate) re-lanza la investigación enfocada.
export default function CandidatePicker({ items, onPick }) {
  const candidates = items || [];
  if (!candidates.length) return null;

  return (
    <div className="ai-reveal my-2 rounded-md border border-amber-400/30 bg-white/[0.02] p-3">
      <div className="mb-2 flex items-center gap-2 text-[0.7rem] uppercase tracking-widest text-amber-300/90">
        <span>⚠</span>
        <span>Varios candidatos · elige a quien reconozcas</span>
        <span className="h-px flex-1 bg-current/20" />
      </div>
      <div className="flex flex-wrap gap-2">
        {candidates.map((c) => {
          const pct = typeof c.confidence === "number" ? Math.round(c.confidence * 100) : null;
          return (
            <button
              key={c.id || c.name}
              type="button"
              onClick={() => onPick?.(c)}
              className="flex w-40 flex-col gap-1 rounded border border-white/10 bg-white/[0.03] p-2 text-left hover:border-amber-300/60"
            >
              <div className="flex items-center gap-2">
                {c.image_url ? (
                  <img src={c.image_url} alt={c.name} loading="lazy" className="h-8 w-8 rounded object-cover" />
                ) : (
                  <span className="flex h-8 w-8 items-center justify-center rounded bg-white/5 text-white/40">?</span>
                )}
                <span className="min-w-0 flex-1 truncate text-xs font-semibold text-white/90">{c.name}</span>
              </div>
              {c.why ? <span className="text-[0.6rem] leading-tight text-white/50">{c.why}</span> : null}
              {pct != null ? <span className="text-[0.55rem] text-emerald-300/80">{pct}%</span> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Correr el test y verlo pasar**

Run: `npm test -- src/components/CandidatePicker.test.jsx`
Expected: PASS.

- [ ] **Step 5: Cablear `onPick` a través de `OutputLine` y `Terminal`**

(a) En `src/components/OutputLine.jsx`: añadir el import y el caso, y aceptar la prop `onPickCandidate`. Cambiar la firma del componente a `export default function OutputLine({ entry, theme, onPickCandidate })` y añadir:

```js
import CandidatePicker from "./CandidatePicker";
```

```js
  if (entry.type === "candidates") {
    return <CandidatePicker items={entry.items} onPick={onPickCandidate} />;
  }
```

(b) En `src/components/Terminal.jsx`, dos ediciones:

1. En el destructuring de `useTerminal()` (líneas ~84-92), añadir `pickCandidate` tras `runImageScan`:

```js
  const {
    history,
    isProcessing,
    statusText,
    scanProgress,
    handleCommand,
    cancelActiveStream,
    runImageScan,
    pickCandidate,
  } = useTerminal();
```

2. En el render de `OutputLine` (línea ~376), pasar la prop:

```jsx
            <OutputLine key={index} entry={entry} theme={theme} onPickCandidate={pickCandidate} />
```

- [ ] **Step 6: Correr la suite + lint**

Run: `npm test && npm run lint`
Expected: verdes, 0 errores.

- [ ] **Step 7: Commit**

```bash
git add src/components/CandidatePicker.jsx src/components/CandidatePicker.test.jsx src/components/OutputLine.jsx src/components/Terminal.jsx
git commit -m "feat(investigate): CandidatePicker + onPick re-run wiring"
```

---

### Task 7: Verificación de la fase

- [ ] **Step 1: Lint + suite + build**

Run: `npm run lint && npm test && npm run build`
Expected: lint 0, todos los tests verdes, build OK.

- [ ] **Step 2: Verificación en navegador (con el backend del prompt 23 desplegado)**

Con sesión y prompt 23 desplegado:
1. Escribir `investigar Thiago Andrés Navarro · hijo de la rectora de una universidad` (o la frase NL).
2. Confirmar que aparecen líneas de **razonamiento en vivo** (◇ paso N · …).
3. Confirmar el **dossier** al final (identidad, cuentas, fotos, familia) o el **selector de candidatos** si hay ambigüedad → clic → re-lanza enfocado.
4. Confirmar la línea de costo en el `done` y el prompt de guardado (si hubo dossier).

- [ ] **Step 3: (No commitear `docs/` en la rama.)**

---

## Notas de handoff

- Sub-proyecto 1 de la spec v4. El grueso es backend (prompt 23, agente con function-calling). El frontend acumula/renderiza.
- El `reasoning` se muestra como líneas simples (append-only) en `ScanEntry`; la visualización animada DedSec es el **sub-proyecto 2** (spec aparte), montada sobre estos mismos eventos.
- Contrato clave: tras `candidate` el backend emite `done` (para cerrar el stream sin error espurio); el frontend salta el prompt de guardado si hubo `candidate`.
- Cuota: cada investigación gasta hasta `INVESTIGATE_MAX_SEARCHES` (~20) de SerpApi → ~5 investigaciones/mes en el tier gratis.
```
