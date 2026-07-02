# Prompt para el agente de backend — Hito 5: Name (Google CSE)

> Continúa en el MISMO repo `rinnegan-api`. Copia el bloque y pásaselo al agente.

---

Continúas `rinnegan-api`. Hitos 1–4 hechos (núcleo + domain/ip + username + email + phone). Patrón probado: providers aislados, orquestador multiplexa SSE, `registry.py` mapea `category → [providers]`, rutas genéricas, y los providers que requieren credencial se **auto-desactivan** con `source_error` si falta la key (no rompen el escaneo). **Este es el Hito 5: categoría `name`** (búsqueda por nombre y apellido). No toques el core — solo añade el provider y registra la categoría.

## Objetivo

`GET /osint/name/stream?value=<nombre apellido>` que, dado un nombre (o nombre + apellido), devuelve posibles coincidencias en la web usando **Google Custom Search JSON API** (gratis, 100 búsquedas/día). Con solo el nombre → resultados amplios; con apellido → búsqueda más filtrada (frase exacta).

## Credenciales (requeridas, se auto-desactiva si faltan)

- `GOOGLE_CSE_KEY` — API key de Google Custom Search.
- `GOOGLE_CSE_ID` — ID del motor de búsqueda programable (configurado para "buscar en toda la web").
- Ambas en `.env` / `config.py`. Si **cualquiera falta**, el provider emite `source_error` (`"name: sin credencial GOOGLE_CSE_KEY/ID"`) y el escaneo termina limpio con `done` (mismo patrón de auto-desactivación del spec). NO crashees.

## Contrato (idéntico — respétalo)

Mismos eventos SSE (`meta`, `finding`, `source_error`, `done`; `progress` opcional). `type` = `"name"`. `confidence` high/medium/low.

```
event: meta
data: {"query":"John Doe","type":"name","providers":["google_cse"],"started_at":"<ISO8601>"}

event: finding
data: {"provider":"google_cse","source":"linkedin.com","title":"John Doe - Software Engineer | LinkedIn",
       "data":{"url":"https://linkedin.com/in/johndoe","snippet":"...","display_url":"linkedin.com/in/johndoe"},
       "confidence":"medium"}

event: done
data: {"summary":{"findings":9,"errors":0,"elapsed_ms":900}}
```

## Provider a implementar

**`google_cse` — `app/providers/name/google_cse_provider.py`** (httpx async):

- **Endpoint:** `GET https://www.googleapis.com/customsearch/v1` con `key`, `cx` (=`GOOGLE_CSE_ID`), `q`, `num` (ej. 10).
- **Construcción del query (importante):**
  - Si el `value` tiene **una sola palabra** (solo nombre) → query amplio: `value` tal cual. `confidence:"low"` (muy ruidoso).
  - Si tiene **dos o más palabras** (nombre + apellido) → query como **frase exacta entre comillas**: `"John Doe"`. `confidence:"medium"`.
- **Findings:** un `finding` por resultado de búsqueda. `source` = dominio del resultado (extrae el host de `link`). `title` = `title` del resultado. `data.url` = `link`. `data.snippet` = `snippet`. `data.display_url` = `displayLink`.
- **Boost de confianza:** si el dominio del resultado es una red social/perfil conocida (linkedin.com, twitter.com/x.com, instagram.com, facebook.com, github.com, etc.), sube ese finding un nivel (low→medium, medium→high) — son coincidencias más significativas para identificar a la persona.
- **Quota/errores:** si la API responde 429 o error de quota → `source_error` ("google_cse quota exceeded"), sin reintentos. Otros errores HTTP → `source_error` aislado.
- **Presupuesto de llamadas:** máximo **1 llamada** a la API por escaneo (respeta la cuota de 100/día). No hagas múltiples queries.

## Registro / ruta

- Registra `google_cse` bajo `name` en `registry.py` (lazy import), `requires_key = True`.
- Añade el binding de ruta `name` siguiendo el patrón previo. El `value` puede traer espacios (nombre + apellido) — recíbelo del query param `value` tal cual.

## Precisión / honestidad

- La búsqueda por nombre es intrínsecamente débil (homónimos, ruido). Por eso: solo-nombre → `low`, con apellido → `medium`, y `high` solo cuando el resultado es un perfil social claro.
- No afirmes identidad: son "posibles coincidencias", no confirmaciones. El nombre del provider y los títulos deben dejarlo claro.

## Tests (pytest + respx)

- respx mockea la respuesta de Custom Search con varios `items` → verifica el mapeo a findings (source=dominio, url, snippet).
- Value de una palabra → query sin comillas y `confidence:"low"`; value de dos palabras → query con comillas y `confidence:"medium"`; resultado en linkedin.com → `high`.
- Falta de `GOOGLE_CSE_KEY`/`ID` → `source_error` de credencial + `done`, sin llamar a la API.
- 429 → `source_error` de quota, sin reintentos.
- `ruff` limpio.

## Criterios de aceptación

1. Con credenciales válidas, `GET /osint/name/stream?value=<nombre apellido>` emite `meta` (provider google_cse) → findings → `done`.
2. Sin credenciales → `source_error` claro + `done`, sin crash y sin llamar a la API.
3. Query con comillas para nombre+apellido; sin comillas para nombre solo; boost de confianza en dominios sociales.
4. Máximo 1 llamada a la API por escaneo. 429 → `source_error`.
5. Tests verdes + `ruff` limpio + README actualizado (cómo obtener `GOOGLE_CSE_KEY`/`GOOGLE_CSE_ID` y la nota de cuota 100/día + naturaleza best-effort del name search).

## NO hagas en este hito

- Nada de image/IA. No múltiples queries ni scraping fuera de la CSE API. No cambies el protocolo SSE ni el envelope.

Cuando termines: salida real de `curl -N` de un nombre (o el `source_error` de credencial si aún no hay keys), conteo de findings, y resultados de `pytest`/`ruff`.
