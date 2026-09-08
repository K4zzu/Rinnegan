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
