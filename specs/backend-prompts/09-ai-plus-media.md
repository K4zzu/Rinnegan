# Prompt para el agente de backend — Hito 7b: IA más inteligente + extracción de medios

> Continúa en el MISMO repo `rinnegan-api`. Copia el bloque y pásaselo al agente.

---

Continúas `rinnegan-api`. La v1 está completa (domain/ip, username, email, phone, name, image, IA). Ahora dos mejoras: **(A)** hacer el análisis de IA más inteligente (inferir la identidad real), y **(B)** extraer imágenes/avatares de los perfiles encontrados y emitirlos como un nuevo evento `media`. No cambies el core más allá de: añadir un paso de enriquecimiento de medios en el orquestador (después de los providers, antes de la IA) y añadir el tipo de evento `media` a `events.py`.

---

## Eje A — Analista de IA más inteligente (`app/ai/analyst.py`)

Mejora el prompt del analista (no cambies el flujo: sigue emitiéndose un solo `ai_report` al final). Añade:

1. **Inferencia de identidad.** A partir del handle/nombre consultado + los hallazgos, infiere la **entidad real más probable** usando el conocimiento del modelo (ej. `torvalds` → probablemente Linus Torvalds, creador de Linux/Git). Añade una sección **`## ¿Quién es?`** con una bio corta (quién es, a qué se dedica) y un **nivel de confianza** de la inferencia.
2. **Guardas anti-alucinación (CRÍTICO).** En el system prompt, instruye explícitamente:
   - Inferir identidad **solo con señal fuerte** (handle consistente en varias plataformas grandes, nombre distintivo, coincidencias claras). Si no hay certeza, escribir **"identidad no determinable con seguridad"** y NO adivinar.
   - Marcar toda inferencia como **"inferencia basada en conocimiento público, sin verificar"**.
   - **Nunca fabricar** datos concretos que no estén en los hallazgos (emails, teléfonos, direcciones, fechas). Distinguir entre "lo que dicen los hallazgos" y "lo que el modelo cree por conocimiento general".
   - Responder en español, conciso.
3. Mantén las secciones existentes (Resumen, Correlación de identidad, Señales/riesgo, Pivots sugeridos) y el disclaimer final.
4. (Opcional) Incluye en el contexto del analista la lista de medios extraídos (Eje B) para que pueda mencionarlos.

## Eje B — Extracción de medios (nuevo)

Nuevo paso `app/media/enrich.py` (o similar), invocado por el orquestador **después de que terminan los providers y antes de la IA**. Reúne imágenes/avatares de los perfiles encontrados y emite **un solo evento `media`** con un array.

### Nuevo evento SSE `media` (añádelo a `events.py`)

```
event: media
data: {"items":[
  {"source":"github","image_url":"https://github.com/torvalds.png","page_url":"https://github.com/torvalds","title":"GitHub","confidence":"high"},
  {"source":"gravatar","image_url":"https://www.gravatar.com/avatar/<md5>?s=128","page_url":"...","title":"Gravatar","confidence":"medium"}
]}
```

- Campos por item: `source` (plataforma/dominio), `image_url` (imagen a mostrar), `page_url` (link al abrir), `title` (etiqueta), `confidence` (high/medium/low).
- Emite el evento **una sola vez** (batch), después de `progress`/`finding`/`source_error` y antes de `ai_report`. Si no hay imágenes, **no emitas** el evento (o emítelo con `items: []` — el frontend lo ignora).

### Fuentes de imagen (sin auth)

1. **GitHub (fácil, fiable):** si entre los hallazgos hay un perfil de `github.com/<user>` (o la consulta es un username), avatar = `https://github.com/<user>.png` (o vía `https://api.github.com/users/<user>` → `avatar_url`). `confidence:"high"`.
2. **Gravatar (para email):** en la categoría `email` (o emails hallados), `https://www.gravatar.com/avatar/<md5(email.strip().lower())>?d=404&s=128`. Usa `d=404` para que devuelva 404 si no existe → **descártalo** si 404. `confidence:"medium"`.
3. **og:image (best-effort):** para los **top-N** (ej. 5) hallazgos de perfil con confianza high/medium, haz `GET` de la página (httpx, **User-Agent de navegador**, timeout ~8s, sigue redirects) y parsea `<meta property="og:image">` (o `twitter:image`). Extrae esa URL. `confidence` = la del hallazgo.

### Reglas de robustez / honestidad

- **Aislamiento:** cada fuente/URL en su try/except; una que falle se ignora, no rompe nada. Todo el paso envuelto para que un fallo global no impida el `ai_report`/`done`.
- **Límites:** máx ~5 fetches de og:image por escaneo (latencia/rate-limit). Dedup por `image_url`.
- **Honestidad:** X/Twitter, LinkedIn e Instagram suelen **bloquear** el fetch de og:image → muchos no darán imagen. Es esperado; simplemente se omiten.
- Config: `MEDIA_ENABLED` (default `true`), `MEDIA_MAX_OGIMAGE` (default `5`).

## Orden en el orquestador

`providers (findings/progress/source_error en vivo)` → **`media` (batch)** → `ai_report` → `done`.

## Tests (pytest + respx / mock)

- **Eje A:** mockea el cliente OpenAI; verifica que el prompt enviado incluye las instrucciones de inferencia + guardas (puedes verificar que el system prompt contiene las frases clave). El flujo sigue emitiendo un solo `ai_report`.
- **Eje B:**
  - GitHub: username `torvalds` → item con `image_url` `github.com/torvalds.png`.
  - Gravatar: respx mockea 200 para un email con gravatar y 404 para otro → solo el de 200 se incluye.
  - og:image: respx devuelve HTML con `<meta property="og:image">` → item con esa URL; HTML sin og:image o status 403 → se omite, sin crash.
  - El evento `media` se emite una vez con los items dedupeados; 0 imágenes → no se emite (o `items: []`).
  - Un fallo de una fuente no impide `ai_report`/`done`.
- `ruff` limpio.

## Criterios de aceptación

1. Cualquier escaneo con perfiles (ej. `osint user torvalds`) emite un evento `media` con avatares (al menos el de GitHub) antes del `ai_report`.
2. El `ai_report` incluye la sección **¿Quién es?** con inferencia de identidad + confianza cuando hay señal fuerte; y dice "no determinable" cuando no la hay (verifícalo con un handle genérico).
3. Ninguna fuente de medios que falle rompe el escaneo. og:image de sitios que bloquean se omite silenciosamente.
4. `MEDIA_ENABLED=false` desactiva el paso limpiamente.
5. Tests verdes (OpenAI + HTTP mockeados) + `ruff` + README actualizado (nuevo evento `media`, fuentes de imagen, límites y nota de que muchas redes bloquean).

## NO hagas

- No emitas múltiples `ai_report`. No hagas búsqueda facial ni indexes rostros. No uses credenciales nuevas (todo esto es sin key). No cambies el formato de los eventos existentes ni del envelope.

Cuando termines: salida real de `curl -N` de `osint user torvalds` mostrando el evento `media` y el `ai_report` con la sección ¿Quién es?, y resultados de `pytest`/`ruff`.
