# v4 — Agente de investigación autónomo (diseño)

> Fecha: 2026-09-08 · Estado: aprobado (brainstorming) · Sub-proyecto 1 de 2.

## 1. Propósito

Que Rinnegan **descubra quién es una persona a partir de poca info + una pista en lenguaje natural**, de forma autónoma, y entregue un **dossier** (identidad, ocupación, info personal, cuentas, fotos, familia). Solo pide intervención humana cuando hay candidatos genuinamente ambiguos.

Caso guía: `seed="Thiago Andrés Navarro"`, `hint="hijo de la rectora de una universidad"` → el agente razona al revés (universidades → rectoras → su hijo Thiago → verificar → familia) y arma el dossier.

**Por qué es nuevo:** el auto-pivot de v3 es **mecánico** (extrae handles → los escanea). Esto requiere que la **IA dirija la investigación** (hipotetiza, decide la siguiente búsqueda, verifica la pista, pivota a relaciones). La línea base actual con "Thiago Andrés Navarro" devuelve **0** (persona de bajo perfil, no encontrable con búsqueda de nombre plana).

## 2. Decisiones tomadas (brainstorming)

| Tema | Decisión |
|---|---|
| Profundidad | **Bucle acotado con presupuesto** (medio): 2-3 saltos, tope de búsquedas por investigación. |
| Modelo del agente | **`gpt-4.1-mini`** como conductor (mejor que 4o-mini en tool-use/planeación), configurable por env `INVESTIGATE_MODEL`; escalar a `gpt-4.1`/`o4-mini` si se traba. El `gpt-4o-mini` del reporte simple de escaneos NO se toca. |
| Orquestación | **Backend** (IA al volante con function-calling); el frontend solo renderiza. |
| Ambigüedad | Sin estado en el server: emite `candidate` y termina; el frontend **re-lanza** una investigación sembrada con la identidad elegida. |
| Familia | Nodos + aristas del grafo existente con `relation:"family:madre"` etc. (reusa bóveda de v3 Fase 1). |
| Búsqueda | SerpApi es el único buscador vivo (DDG bloqueado en prod). Presupuesto duro protege la cuota (100/mes). |

## 3. Arquitectura

```
Frase NL ──► /interpret ──► action:"investigate" {seed, hint}
                                     │
                          GET /investigate/stream?seed=&hint=
                                     │
          ┌──────────── BUCLE AGÉNTICO (backend, gpt-4.1-mini) ───────────┐
          │  system prompt: misión + pista + anti-alucinación             │
          │  loop (hasta dossier | presupuesto | ambigüedad):             │
          │    IA planea → llama herramienta → lee resultado → decide     │
          │    herramientas: web_search · scan_username · reverse_image   │
          │    presupuesto: MAX_SEARCHES (~20), MAX_HOPS (~3)             │
          └──────────────────────────────────────────────────────────────┘
                                     │  emite por SSE:
     finding · media · node · edge (existentes)  +  reasoning · candidate · dossier (nuevos)
                                     │
   Frontend: log de razonamiento en vivo · CandidatePicker · DossierView · guardar en bóveda
```

## 4. Contrato del backend

### `GET /investigate/stream?seed=<s>&hint=<h>` (protegido; token por `?token=`)

Bucle agéntico con **OpenAI function-calling**. Reusa `OPENAI_API_KEY`. Modelo por env `INVESTIGATE_MODEL` (default `gpt-4.1-mini`).

**Herramientas expuestas a la IA** (cada llamada cuenta contra el presupuesto):
- `web_search(query)` → dorks vía SerpApi (Google). Devuelve `[{title, url, snippet}]`.
- `scan_username(handle)` → escaneo Maigret existente → perfiles del handle.
- `reverse_image(image_url)` → SerpApi reverse → dónde aparece la foto.

**System prompt (reglas):** misión = encontrar a la persona que encaja con `seed`+`hint`, **verificar la pista contra una fuente**, y luego pivotar a **familia cercana**. Riguroso: **nunca inventar**; cada afirmación del dossier **cita su fuente (URL)**; afirmar identidad **solo con señal fuerte**; si hay ≥2 personas plausibles indistinguibles, desambiguar con el usuario.

**Presupuesto (env):** `INVESTIGATE_MAX_SEARCHES` (default 20), `INVESTIGATE_MAX_HOPS` (default 3). El backend cuenta las tool-calls; cerca del tope inyecta "cierra ya"; corte duro en el límite.

**Eventos SSE** — los existentes (`meta`/`progress`/`finding`/`source_error`/`media`/`node`/`edge`/`done`) MÁS:
- `reasoning` → `{ "step": 1, "thought": "…", "action": "web_search: rectora universidad Navarro" }` — un evento por paso del agente (para el log en vivo).
- `candidate` → `{ "candidates": [ { "id": "c1", "name": "…", "why": "encaja con la pista porque…", "confidence": 0.6, "image_url": "…", "profiles": ["…"] } ] }` — cuando hay ambigüedad. El stream termina tras esto (estado "necesita elección").
- `dossier` → el reporte final estructurado:
  ```json
  { "identity": { "name": "…", "confidence": 0.82, "verified_by": "url" },
    "occupation": "…", "personal_info": ["…"],
    "accounts": [{ "platform": "instagram", "url": "…", "handle": "…" }],
    "photos": [{ "image_url": "…", "source": "…" }],
    "family": [{ "name": "…", "relation": "madre", "note": "rectora de …", "url": "…" }],
    "sources": ["…"], "note": "parcial|completo|no determinable" }
  ```

**Familia también como grafo:** por cada familiar, emite `node` (kind `name`/`username`) + `edge` con `relation:"family:<parentesco>"` (`madre`/`padre`/`hermano`/…). Así se ve en `GraphView` y se guarda en la bóveda.

**Nunca 500.** Fallo de IA/proveedor → `dossier` con `note:"no concluyente"` + hallazgos parciales.

## 5. Frontend

1. **Entrada:** `/interpret` gana la acción `investigate` con `{seed, hint}` (frase con persona + pista / "averigua quién es"). Comando explícito: `investigar <seed> · <pista>`. Identificador simple sin intención de investigar → sigue cayendo en `osint` (escaneo normal).
2. **`api.js`:** `streamInvestigate(seed, hint, handlers)` (SSE); añade `reasoning`/`candidate`/`dossier` a `SSE_EVENTS`.
3. **`useTerminal`:** `handleInvestigate(seed, hint)` (usa `beginScan`); el dispatch NL enruta `investigate`. Acumula los eventos; al `candidate` empuja `{type:"candidates", …}`; al `dossier` empuja `{type:"dossier", …}`. Prompt de guardado (Fase 1) archiva dossier + grafo de familia.
4. **Componentes:**
   - `ReasoningLog.jsx` — pasos `{step, thought, action}` en lista (simple; la animación DedSec es el sub-proyecto 2).
   - `CandidatePicker.jsx` — tarjetas (foto, nombre, "por qué encaja", confianza). Clic → `handleInvestigate` sembrado con esa identidad confirmada.
   - `DossierView.jsx` — dossier estructurado; **familia** como mini-árbol (reusa `GraphView`) + lista, con enlaces a fuentes.
   - Wiring en `OutputLine` para `candidates`/`dossier`.
5. Reusa: SSE, `beginScan`, galería facial (v3 Fase 2/4), bóveda (v3 Fase 1), grafo (v3 Fase 3), costo en `done` (v3 Fase 5).

## 6. Errores + anti-alucinación

- IA/proveedor falla → `dossier` "no concluyente" + parciales; nunca 500.
- Presupuesto agotado → dossier parcial + nota.
- Persona no encontrada → dossier "no determinable" + sugerencia de más pistas.
- SerpApi agotado / DDG muerto → degrada a lo disponible + nota.
- **Anti-alucinación (duro):** identidad solo con fuente que confirme la pista; todo lo demás "sin verificar"; nunca inventar cuentas/fotos/familia; cada afirmación cita URL.

## 7. Fases (cada una = prompt de backend + chunk de frontend)

1. **Agente backend** (`specs/backend-prompts/23-investigate-agent.md`): `/investigate/stream` con tool-use, presupuesto, eventos `reasoning`/`candidate`/`dossier`, familia como node/edge.
2. **Flujo frontend**: `streamInvestigate` + acción NL `investigate` + `handleInvestigate` + `ReasoningLog` + `DossierView` + guardado.
3. **Selector de candidatos**: `CandidatePicker` + re-run enfocado.

## 8. Testing

- **Backend** (pytest, IA+providers mockeados): el bucle llama herramientas y **respeta el tope de presupuesto**; emite `reasoning`/`candidate`/`dossier`; familia como node/edge; ruta de ambigüedad (emite `candidate` y termina); afirmaciones citan fuente; nunca 500; sin token → 401. `ruff`.
- **Frontend** (vitest): dispatch SSE de `streamInvestigate` (incl. reasoning/candidate/dossier); routing NL `investigate`; acumulación en el registro; click en `CandidatePicker` → re-lanza `handleInvestigate` con la identidad; render de `DossierView` y `ReasoningLog`; payload de guardado incluye familia (nodes/edges `family:*`).

## 9. Fuera de alcance (este sub-proyecto)

- **Sub-proyecto 2: visualización DedSec** (razonamiento animado, comparación de caras en vivo, efectos, sonidos) — spec aparte, se monta sobre los eventos `reasoning` que este sub-proyecto ya emite.
- **Agente completo/profundo** (familia extendida, saltos ilimitados) — descartado por costo/cuota; el bucle es acotado.
- Cambiar el modelo del reporte simple de escaneos normales (sigue en `gpt-4o-mini`).
- Fuentes de búsqueda adicionales (Bing propio, etc.) — si la cuota SerpApi topa, es un tema aparte.
