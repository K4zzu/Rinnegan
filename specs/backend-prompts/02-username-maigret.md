# Prompt para el agente de backend — Hito 2: Username (Maigret)

> Continúa en el MISMO repo `rinnegan-api` del Hito 1. Copia el bloque y pásaselo al agente.

---

Continúas el backend `rinnegan-api`. El Hito 1 (núcleo + domain/IP) ya está hecho: existe la interfaz `Provider`, el orquestador async que multiplexa providers y emite SSE, el envelope normalizado, y `app/providers/registry.py` (mapea `category → [providers]`). **Este es el Hito 2: agregar la categoría `username`.** El core, el orquestador y las rutas genéricas NO deben cambiar — solo registras providers nuevos y añades (si hace falta) el binding de ruta para `username`, siguiendo el patrón ya establecido para `domain`/`ip`.

## Objetivo

Endpoint `GET /osint/username/stream?value=<usuario>` que, dado un username, reporta en vivo (SSE) en qué sitios existe ese usuario, usando **Maigret** como fuente primaria y **Sherlock** como secundaria opcional.

## Contrato (idéntico al Hito 1 — respétalo exacto)

Mismos eventos SSE: `meta`, `progress`, `finding`, `source_error`, `done` (no `ai_report` todavía). Formato:

```
event: meta
data: {"query":"kazzu","type":"username","providers":["maigret"],"started_at":"<ISO8601>"}

event: progress
data: {"provider":"maigret","status":"running","checked":312,"total":500}

event: finding
data: {"provider":"maigret","source":"github","title":"github.com/kazzu",
       "data":{"url":"https://github.com/kazzu","site":"GitHub"},"confidence":"high"}

event: done
data: {"summary":{"findings":14,"errors":0,"elapsed_ms":38210}}
```

- `type` = `"username"`.
- Un `finding` por **sitio donde el usuario existe** (no reportar los negativos como findings).
- `source` = identificador corto del sitio (ej. `github`); `title` legible; `data.url` = URL del perfil; incluye `data.site` con el nombre del sitio.
- `confidence`: `high` si el match es fuerte/estático; `medium` si es dudoso (posible falso positivo por challenge/redirect). Ver nota de precisión.
- El envelope normalizado se acumula igual que en el Hito 1 (findings/sources/errors).

## Providers a implementar

**`maigret` (primario, requerido) — `app/providers/username/maigret_provider.py`**
- Usa Maigret como **librería async importable** (NO subprocess). Corre su búsqueda y traduce cada sitio con match a un `finding`.
- Emite `progress` con `checked/total` a medida que avanza (Maigret expone el progreso por sitio; si no es trivial, emite progress periódico con el conteo acumulado). Esto alimenta la barra en vivo del frontend.
- Limita concurrencia interna a un valor razonable (ej. 30–50) para reducir falsos positivos por rate-limit. Timeout global del provider configurable (`MAIGRET_TIMEOUT`, default ~60s).
- Sin API key. FlareSolverr (para Cloudflare) queda **desactivado por defecto**; deja un hook/env opcional pero no lo exijas.
- No hace falta escanear los 3000+ sitios: usa el set por defecto de Maigret (top ~500). Configurable por env si quieres (`MAIGRET_TOP_SITES`).

**`sherlock` (secundario, OPCIONAL, off por defecto) — `app/providers/username/sherlock_provider.py`**
- Solo se activa si la request lo pide: `GET /osint/username/stream?value=x&extra=sherlock`. Por defecto NO corre (mantiene el escaneo rápido).
- Vía subprocess (Sherlock no expone API de librería estable): ejecútalo, parsea su salida, emite un `finding` por sitio encontrado con `provider:"sherlock"`.
- Aislado: si el binario no está o falla, `source_error` y seguir.

## Registro (el único punto de cambio del "core")

- Registra `maigret` (y `sherlock` condicional) bajo la categoría `username` en `registry.py`, siguiendo el patrón de `domain`/`ip`.
- Añade el binding de ruta `username` si tu diseño del Hito 1 no lo hace ya de forma genérica.
- El flag `extra=sherlock` se resuelve al construir la lista de providers para esa request.

## Precisión / honestidad (importante)

- Correr enumeración de usuarios genera **falsos positivos** cuando los sitios responden con páginas de challenge/redirect. Marca esos como `confidence:"medium"` y los sólidos como `"high"`.
- No subas la concurrencia para "ir más rápido": eso empeora la precisión. Prioriza correctitud.
- La lista de sitios de Maigret se degrada con el tiempo; no es tu problema arreglarla, pero no asumas 100% de cobertura.

## Tests (pytest + respx / mock)

- Mockea Maigret (no hagas red real en tests): inyecta un resultado simulado con algunos sitios `found` y otros `not found`, y verifica que:
  - solo los `found` se convierten en `finding`,
  - se emiten eventos `progress`,
  - el envelope final tiene el conteo correcto de findings.
- Un fallo del provider (excepción simulada) → `source_error` y el `done` igual se emite.
- `sherlock` off por defecto (sin `extra=sherlock` no aparece en `meta.providers`); on cuando se pide.
- `ruff check` limpio.

## Criterios de aceptación

1. `GET /osint/username/stream?value=<algún_usuario_real>` emite `meta` (providers incluye `maigret`) → `progress` en vivo → `finding` por sitio → `done`.
2. `&extra=sherlock` añade `sherlock` a `meta.providers` y sus findings; sin el flag, no corre.
3. Un provider que falla no tumba el escaneo (`source_error` + `done`).
4. Tests pytest verdes (Maigret mockeado, sin red real). `ruff` limpio.
5. README actualizado: cómo instalar Maigret/Sherlock y correr la categoría username; nota de que Sherlock es opcional y requiere el binario.

## NO hagas en este hito

- Nada de email/phone/name/image/IA.
- No cambies el protocolo SSE ni el envelope.
- No subas la concurrencia buscando velocidad a costa de precisión.

Cuando termines: reporta salida real de `curl -N` de un username, conteo de findings, y resultados de `pytest`/`ruff`.
