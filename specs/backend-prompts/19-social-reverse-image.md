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
