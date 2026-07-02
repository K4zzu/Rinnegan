# Prompt para el agente de backend — Hito 6: Image

> Continúa en el MISMO repo `rinnegan-api`. Copia el bloque y pásaselo al agente.

> **Actualización (2026-06-20):** el provider `reverse_image` (Google Vision) fue **descartado** por decisión del usuario. La categoría `image` en v1 = **EXIF + face** únicamente. Ignora las secciones de `reverse_image`/`GOOGLE_VISION_API_KEY` de este prompt. Reverse image pasa al roadmap v2 (opción de pago).

---

Continúas `rinnegan-api`. Hitos 1–5 hechos (domain/ip, username, email, phone, name). Patrón probado: providers aislados, orquestador multiplexa SSE, `registry.py`, rutas genéricas, auto-desactivación por credencial faltante. **Este es el Hito 6: categoría `image`.** Es el primero cuya entrada es un **archivo** (no un query param): usa **POST multipart** y streaming SSE sobre la respuesta. Mantén el protocolo de eventos y el envelope idénticos; adapta solo el tipo de entrada de los providers de imagen (reciben bytes en vez de string).

## Objetivo

`POST /osint/image/stream` (multipart, campo `file`) que analiza una imagen y reporta en vivo: metadata EXIF (incl. GPS), dónde aparece la imagen en la web, y rostros detectados. EXIF y rostros son **locales/gratis**; reverse image usa **Google Vision** (key, auto-desactivable).

## Endpoint y entrada

- `POST /osint/image/stream`, `multipart/form-data`, campo **`file`** (FastAPI `UploadFile`).
- Lee los bytes una sola vez y compártelos entre providers.
- **Límite de tamaño:** rechaza > 15 MB con HTTP 413 (el frontend ya valida, pero guárdate también).
- Respuesta: `StreamingResponse` con `media_type="text/event-stream"` y el MISMO protocolo de eventos (`meta`, `progress`, `finding`, `source_error`, `ai_report` [reservado], `done`).
- `type` = `"image"`. En `meta`, `query` = nombre del archivo (o `"image"`), `providers` = los realmente activos (exif siempre; reverse_image solo si hay key; face solo si está habilitado y el modelo carga).

## Providers a implementar

**`exif` — `app/providers/image/exif_provider.py`** (Pillow / `exifread`, local, sin key):
- Extrae EXIF. Findings:
  - `gps` — si hay coordenadas: convierte a lat/lon decimales. `title` = `"lat, lon"`, `data.url` = `https://www.google.com/maps?q=<lat>,<lon>`, `data.lat/lon`. `confidence:"high"` (dato duro, oro para OSINT).
  - `datetime` — `DateTimeOriginal`. `high`.
  - `camera` — `Make` + `Model`. `high`.
  - `software` — si está. `medium`.
- Si la imagen **no tiene EXIF** (muy común, las redes lo eliminan) → un `finding` `"sin metadata EXIF"` `confidence:"low"` (no un error).

**`reverse_image` — `app/providers/image/reverse_image_provider.py`** (Google Vision Web Detection, requiere key):
- Key: `GOOGLE_VISION_API_KEY`. Si falta → `source_error` ("reverse_image: sin credencial GOOGLE_VISION_API_KEY") + seguir. `requires_key = True`.
- Llama `POST https://vision.googleapis.com/v1/images:annotate?key=<KEY>` con la imagen en base64 y `features:[{type:"WEB_DETECTION"}]`. **1 sola llamada** por escaneo.
- Findings desde `webDetection`:
  - `pagesWithMatchingImages` → `title` = pageTitle, `data.url` = url. `confidence:"high"`.
  - `fullMatchingImages` / `partialMatchingImages` → `data.url` = url imagen. `medium`.
  - `webEntities` (top ~5 con score) → `title` = description. `medium` (etiquetas/entidades).
  - `bestGuessLabels` → `title`. `medium`.
- 429/quota o error HTTP → `source_error` aislado, sin reintentos.

**`face` — `app/providers/image/face_provider.py`** (InsightFace, local, sin key, dependencia pesada):
- Usa InsightFace (`FaceAnalysis`, modelo `buffalo_l`). Detecta rostros. Findings:
  - `faces` — `title` = `"N rostro(s) detectado(s)"`, `data.count`. `medium`.
  - por rostro: `data` con `age` estimado, `gender`, y `bbox`; incluye el `embedding` en `data` (para correlación futura). `title` = `"rostro #k · ~edad · género"`. `medium`.
- **Pesado/honesto:** onnxruntime + descarga de modelos (~300 MB) en el primer uso. Si el modelo no carga o la dep no está → `source_error` ("face: modelo no disponible"), sin tumbar el escaneo. Configurable con `FACE_ENABLED` (default `true`).
- Aclara en el README: esto es detección/atributos + embedding de la imagen subida; **NO** busca el rostro en la web (inviable/ilegal, fuera de alcance).

## Registro / ruta / orquestador

- Registra `exif`, `reverse_image`, `face` bajo `image` en `registry.py` (lazy imports; `reverse_image.requires_key=True`).
- Añade la ruta POST. Reusa el orquestador y el emit de eventos; pásales los bytes de la imagen como entrada de los providers de esta categoría (adaptación mínima; NO cambies el formato de eventos ni el envelope).

## Precisión / honestidad

- EXIF GPS es dato duro → `high`. reverse_image encuentra la imagen o similares/entidades, no "esta persona". face es detección/atributos best-effort → `medium`.
- Sin búsqueda facial de la web (descartado en el spec). Dilo en el README.

## Tests (pytest + respx / mock)

- `exif`: una imagen generada con EXIF+GPS (usa `piexif` para construirla en el test) → findings gps/datetime/camera; una imagen sin EXIF → finding "sin metadata" (sin crash).
- `reverse_image`: respx mockea la respuesta de Vision con `webDetection` → findings esperados; falta de key → `source_error` sin llamar; 429 → `source_error`.
- `face`: **mockea/monkeypatchea el modelo** (no descargues 300 MB en tests) — simula 0, 1 y 2 rostros; modelo no disponible → `source_error`.
- Ruta: POST multipart con una imagen pequeña → `meta` (providers activos) → findings → `done`; archivo > 15 MB → 413.
- `ruff` limpio.

## Criterios de aceptación

1. `POST /osint/image/stream` (multipart `file`) devuelve SSE con `meta` → findings → `done`.
2. Imagen con GPS → finding `gps` con enlace a maps; imagen sin EXIF → finding "sin metadata", sin crash.
3. `reverse_image` sin `GOOGLE_VISION_API_KEY` → `source_error` claro; con key (mock) → findings de web detection.
4. `face` detecta rostros (o `source_error` si el modelo no carga), aislado.
5. Límite de 15 MB (413). Tests verdes + `ruff` + README (cómo sacar `GOOGLE_VISION_API_KEY`, nota de descarga de modelos de face, y que NO hay búsqueda facial web).

## NO hagas en este hito

- Nada de IA (Hito 7). No búsqueda facial en la web. No cambies el protocolo de eventos ni el envelope (solo adaptas la entrada a bytes).

Cuando termines: salida real de `curl -N -F file=@foto.jpg` (o el `source_error` de Vision si aún no hay key), conteo de findings por provider, y resultados de `pytest`/`ruff`.
