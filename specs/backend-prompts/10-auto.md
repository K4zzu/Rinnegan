# Prompt para el agente de backend — Hito 8: Modo AUTO (`/osint/auto`)

> Continúa en el MISMO repo `rinnegan-api`. Copia el bloque y pásaselo al agente.

---

Continúas `rinnegan-api`. Todas las categorías existen (domain/ip, username, email, phone, name, image) + medios + IA. **Este hito añade un endpoint "auto"**: el usuario pasa un dato sin decir el tipo, el backend **detecta el tipo** y corre **todas las categorías que apliquen**, junta todo en un envelope, extrae medios de todo y emite **un solo `ai_report` correlacionado**. No cambies el core, el protocolo de eventos ni el envelope; reutiliza el orquestador con un conjunto de providers que abarca varias categorías.

## Objetivo

`GET /osint/auto/stream?value=<dato>` (SSE, mismo protocolo). Detecta el tipo del `value` y ejecuta las categorías aplicables como **una sola corrida** (providers en paralelo, findings/progress/source_error/media/ai_report/done igual que siempre). `type` en `meta` = `"auto"`.

## Detección de tipo (por la forma del dato, en este orden)

1. **email** — contiene `@` y pinta de correo (`\S+@\S+\.\S+`) → categoría `email`.
2. **ip** — IPv4 (`^\d{1,3}(\.\d{1,3}){3}$`) o IPv6 → `ip`.
3. **phone** — empieza con `+` o es casi todo dígitos (permite espacios/`-`/`()`), largo ≥ 7 → `phone`.
4. **domain** — sin `@`, sin espacios, con al menos un punto y TLD alfabético (`^[a-z0-9.-]+\.[a-z]{2,}$`) → `domain`.
5. **si tiene espacios** (varias palabras) y no cayó en lo anterior → nombre de persona → `name`.
6. **una sola palabra** (handle), resto de casos → **`username` + `name`** (corre ambas: es un handle que podría ser también un nombre/alias).

Deja la lógica de detección en un módulo testeable (ej. `app/core/detect.py` → `detect_categories(value) -> list[str]`). Devuelve la lista de categorías a correr.

## Ejecución

- Construye el conjunto de providers = **unión** de los providers de las categorías detectadas (usa el `registry`; añade un helper si hace falta, ej. `providers_for_categories([...])`).
- Córrelos con el **mismo orquestador** (en paralelo, streaming en vivo). Cada `finding` ya trae su `provider`/`source`, así que el usuario ve de dónde viene cada cosa.
- Luego el **paso de medios** (igual que hoy) sobre TODOS los findings → evento `media`.
- Luego **una sola IA** sobre el envelope combinado → `ai_report` que **correlaciona entre categorías** (ej. "el username X y el nombre Y probablemente son la misma persona: Linus Torvalds"). Pásale también los medios como contexto (ya lo soporta `analyze(envelope, media=...)`).
- `done` como siempre.

## Contrato (sin cambios de formato)

- `meta`: `{"query": "<value>", "type": "auto", "providers": [<union de providers>], "started_at": "..."}`.
- El resto de eventos idénticos. El envelope acumulado usa `type: "auto"`.
- Los endpoints por categoría existentes **siguen igual** (no los toques). `auto` es adicional.

## Precisión / honestidad

- La detección es heurística; ante duda con un handle de una palabra, corre `username` + `name` (más cobertura). Documenta la tabla de detección en el README.
- No corras categorías que no aplican (no tiene sentido `email` sobre "torvalds"). Solo las detectadas.
- Un handle que es puro número podría confundirse con teléfono; prioriza `phone` solo si parece teléfono real (largo/prefijo), sino trátalo como handle.

## Tests (pytest)

- **detección** (`detect_categories`): email→[email]; `8.8.8.8`→[ip]; `+573001234567`→[phone]; `example.com`→[domain]; `John Doe`→[name]; `torvalds`→[username, name]. Casos borde (número corto, dominio sin TLD, etc.).
- **endpoint auto**: `value=torvalds` → `meta.type=="auto"`, providers incluye los de username y name, emite findings de ambas, un `media`, un solo `ai_report`, `done`. (Providers externos mockeados.)
- Aislamiento: si una categoría falla, las demás siguen; un solo `ai_report`.
- `ruff` limpio.

## Criterios de aceptación

1. `GET /osint/auto/stream?value=torvalds` corre `username`+`name`, emite findings de ambas en vivo, `media`, **un** `ai_report` correlacionado, `done`. `meta.type=="auto"`.
2. `value=algo@mail.com` → solo `email`; `value=8.8.8.8` → solo `ip`; `value=example.com` → solo `domain`; `value=+57300...` → solo `phone`; `value=John Doe` → solo `name`.
3. Endpoints por categoría existentes intactos.
4. Tests verdes (externos mockeados) + `ruff` + README (tabla de detección + endpoint auto).

## NO hagas

- No cambies el formato de eventos ni el envelope. No dupliques el `ai_report` (uno solo, combinado). No metas la categoría `image` en auto (la imagen se sube aparte por POST). No uses API keys nuevas.

Cuando termines: salida real de `curl -N "http://localhost:8000/osint/auto/stream?value=torvalds"` mostrando providers de varias categorías + un solo `ai_report`, y `pytest`/`ruff`.
