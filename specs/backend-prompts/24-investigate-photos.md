# Prompt backend — v4.1: fotos en el agente de investigación

> Continúa en el MISMO repo `rinnegan-api`. Extiende el agente `/investigate/stream` del prompt 23. NO cambies otros endpoints. Copia el bloque y pásaselo al agente de backend.

---

**Problema:** hoy `/investigate/stream` nunca produce fotos. Las herramientas del agente (`web_search`, `scan_username`, `reverse_image`) no devuelven imágenes: `web_search` solo da texto y `reverse_image` necesita recibir un `image_url` que el agente no tiene de dónde sacar. Por eso `dossier.photos` sale vacío y no se emiten eventos `media`. El frontend YA renderiza fotos (dossier + teatro); solo falta que el backend las provea.

**Objetivo:** dar al agente una fuente de imágenes y hacer que traiga fotos de la persona confirmada (y de cada candidato en la ruta de desambiguación), emitiendo `media` y llenando `photos[]`.

## 1. Nueva herramienta: `image_search(query)`
- Implementa `image_search(query)` vía **SerpApi Google Images** (`engine=google_images`). Devuelve a la IA una lista compacta: `[{ image_url, thumbnail, source, title }]` (usa `original` como `image_url`, `link`/`source` como `source`, `title` como `title`).
- **Limita a los primeros 6 resultados** por llamada (evita ruido y payloads grandes).
- **Cada llamada cuenta contra `INVESTIGATE_MAX_SEARCHES`** igual que `web_search` (es una búsqueda SerpApi). Respeta el tope duro; si ya no queda presupuesto, no la ejecutes y sigue al dossier.
- Reusa el cliente SerpApi y el tracking de `usage` existentes (para que el `cost` del `done` incluya estas búsquedas). Nunca 500: si SerpApi falla, devuelve lista vacía y continúa.

## 2. System prompt — instrucción de fotos
Añade a las reglas del agente:
- **Cuando confirmes la identidad de la persona** (señal fuerte), haz **una** `image_search` con una consulta específica y desambiguadora (nombre + contexto que la distinga, p. ej. `"Sandra Navarro Parra rectora Uninavarra"`, no solo el nombre). Usa esas imágenes como las fotos de la persona.
- **En la ruta de desambiguación**, antes de emitir `candidate`, haz una `image_search` por cada candidato plausible (máx. los 2-3 que vas a ofrecer) y pon la mejor imagen en `candidate.image_url`, para que el usuario pueda reconocerlo visualmente.
- Sé consciente del presupuesto: prioriza la persona confirmada. Solo busca fotos de un familiar si sobra presupuesto claramente. **Nunca inventes URLs de imágenes**; si `image_search` no devuelve nada, deja `photos` vacío y anótalo.

## 3. Emisión de eventos (usa los existentes, no inventes formato)
- Por cada foto relevante que obtengas de la persona confirmada, emite un evento **`media`** con la MISMA forma que el resto de streams:
  ```json
  { "items": [ { "image_url":"…", "page_url":"…", "title":"…", "source":"instagram.com", "confidence":"medium", "origin":"photo" } ] }
  ```
  - `origin` debe ser **`"photo"`** (o cualquier valor que NO sea `"reverse"`), porque el frontend trata las de `origin:"reverse"` como caras de terceros y las excluye del análisis facial de la persona. Estas SÍ son de la persona.
  - `page_url` = la página fuente (perfil/nota); si no la tienes, omítela (el front cae a `image_url`).
  - `confidence`: `high` si la foto viene de una fuente que ya ligaste a la persona (su perfil verificado), `medium` en otro caso.
- En el `dossier`, llena `photos` con las mismas imágenes de la persona confirmada:
  ```json
  "photos": [ { "image_url":"…", "source":"…" }, … ]
  ```
  (2-6 fotos; las mejores/más probables de ser la persona).

## 4. Tests (pytest, IA + SerpApi mockeados)
- `image_search` respeta `MAX_SEARCHES` (cuenta como búsqueda) y limita a 6 resultados.
- Ruta confirmada: tras confirmar identidad, el agente llama `image_search`, emite ≥1 evento `media` con `origin != "reverse"`, y el `dossier.photos` no está vacío.
- Ruta de desambiguación: cada `candidate` emitido lleva `image_url` cuando `image_search` devolvió algo.
- SerpApi de imágenes falla → sin 500, `photos` vacío, el stream termina con `dossier`+`done` normal.
- `ruff` limpio. Actualiza el README de `/investigate/stream` para mencionar `image_search` y el presupuesto.

## 5. Criterios de aceptación
1. Una investigación de una persona pública real trae fotos: ≥1 evento `media` (`origin:"photo"`) y `dossier.photos` no vacío.
2. Los candidatos (cuando hay ambigüedad) traen `image_url`.
3. Las búsquedas de imágenes cuentan en `cost`/`usage` y respetan `MAX_SEARCHES`. Nunca 500. Tests + `ruff` + README.

## NO hagas
- No cambies el contrato de los eventos `media`/`dossier` (solo los llenas). No cambies otros endpoints. No inventes URLs de imágenes. No dispares una `image_search` por cada resultado de texto (solo para la persona confirmada y los candidatos). No expongas keys.
