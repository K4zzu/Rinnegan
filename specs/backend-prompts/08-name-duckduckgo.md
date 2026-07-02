# Prompt para el agente de backend — Hito 5b: reemplazar `name` (Google CSE → DuckDuckGo)

> Continúa en el MISMO repo `rinnegan-api`. Copia el bloque y pásaselo al agente.

---

Continúas `rinnegan-api`. La categoría `name` ya existe pero usa Google Custom Search (`google_cse_provider.py`), que requiere API key + configuración de proyecto Google que dio problemas. **Reemplaza el provider de `name` por uno basado en DuckDuckGo (HTML scraping), SIN API key ni cuenta.** No cambies el core, el protocolo de eventos ni el envelope; solo sustituye el provider dentro de la categoría `name`.

## Objetivo

`GET /osint/name/stream?value=<nombre apellido>` que devuelve posibles coincidencias en la web usando DuckDuckGo, **sin credenciales**. Misma semántica que antes: nombre solo → amplio; nombre + apellido → frase exacta (mejor filtro); boost de confianza en dominios sociales.

## Cambios concretos

1. **Nuevo provider** `app/providers/name/duckduckgo_provider.py` (`name = "duckduckgo"`, `category = "name"`, `requires_key = False`).
2. **Elimina** `google_cse_provider.py` y su registro; en `registry.py` la categoría `name` ahora usa `duckduckgo`.
3. **Quita** de `config.py` y `.env.example` las settings `GOOGLE_CSE_KEY` / `GOOGLE_CSE_ID` (ya no se usan).
4. Actualiza los tests: elimina/renombra `test_google_cse.py` → `test_duckduckgo.py`; ajusta `test_name_routes.py` para el nuevo provider.
5. README: actualiza la sección `name` (ahora sin cuenta; nota de que DDG es scraping best-effort).

## Implementación del provider (httpx async, sin key)

- **Endpoint:** `GET https://html.duckduckgo.com/html/?q=<query>` (versión HTML, sin JS).
  - Envía un **User-Agent de navegador** (ej. un UA de Chrome/Firefox realista) — sin él, DDG puede bloquear o devolver vacío.
  - Timeout propio (~10s).
- **Construcción del query** (igual que antes):
  - `value` de **una sola palabra** → query = `value` tal cual. `confidence:"low"` (muy ruidoso).
  - `value` de **dos o más palabras** → query = frase exacta entre comillas: `"John Doe"`. `confidence:"medium"`.
- **Parseo del HTML** (usa `beautifulsoup4` + `lxml`, o `selectolax`):
  - Cada resultado está en `a.result__a` (título + href) y el snippet en `.result__snippet`.
  - **Los href de DDG son de redirección**: `//duckduckgo.com/l/?uddg=<URL_real_encodeada>&...`. **Decodifica el parámetro `uddg`** (URL-decode) para obtener la URL real. Si el href ya es absoluto, úsalo tal cual.
  - Emite un `finding` por resultado (máx ~10): `source` = dominio del resultado (host de la URL real), `title` = título del resultado, `data.url` = URL real, `data.snippet` = snippet.
- **Boost de confianza:** si el dominio es una red social/perfil conocida (linkedin.com, twitter.com/x.com, instagram.com, facebook.com, github.com, youtube.com, etc.) sube un nivel (low→medium, medium→high).
- **Robustez / honestidad:**
  - Si DDG devuelve una página de captcha/anomalía, o 0 resultados parseables, o un status != 200 → `source_error` (`"duckduckgo: sin resultados o bloqueado"`), aislado, y el `done` igual se emite.
  - **1 sola petición** por escaneo (no pagines). DDG HTML puede rate-limitear si se abusa.

## Precisión / honestidad

- Búsqueda por nombre sigue siendo débil (homónimos, ruido) → por eso `low` para nombre solo y `medium`/`high` con apellido y dominios sociales.
- DDG HTML es scraping: su estructura puede cambiar con el tiempo (mantenimiento ocasional). No prometas exhaustividad; son "posibles coincidencias".

## Tests (pytest + respx)

- respx mockea `https://html.duckduckgo.com/html/` devolviendo un HTML de ejemplo con varios resultados (incluye un href con `uddg=` para verificar la decodificación) → comprueba: findings con `source`=dominio real, `data.url` decodificada, snippet.
- Value de una palabra → query sin comillas y `confidence:"low"`; dos palabras → query con comillas y `confidence:"medium"`; un resultado en linkedin.com → `high`.
- Respuesta con captcha / vacía / status 202/403 → `source_error`, sin crash, con `done`.
- `ruff` limpio.

## Criterios de aceptación

1. `GET /osint/name/stream?value=<nombre apellido>` emite `meta` (provider `duckduckgo`) → findings (con URLs reales decodificadas) → `done`. **Sin ninguna API key.**
2. Query con comillas para nombre+apellido; sin comillas para nombre solo; boost social.
3. DDG bloqueado/captcha → `source_error` aislado + `done`.
4. Se eliminaron las settings/uso de Google CSE. Tests verdes + `ruff` + README actualizado (name ahora sin cuenta, best-effort).

## NO hagas

- No reintroduzcas API keys para `name`. No pagines DDG. No cambies el protocolo de eventos ni el envelope. No toques otras categorías.

Cuando termines: salida real de `curl -N "http://localhost:8000/osint/name/stream?value=Linus%20Torvalds"` con findings reales, y resultados de `pytest`/`ruff`.
