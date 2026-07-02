# Rinnegan — OSINT Aggregation Platform (v1) — Design / Shared Contract

**Date:** 2026-06-20
**Status:** Approved design. Source of truth for both tracks (see Working Model).
**Scope:** v1 — plataforma + 6 categorías de entrada (username, email, phone, domain/IP, name, image) + capa de IA. Herramienta **personal, single-user, backend local**. Sin auth.

---

## 1. Purpose

Rinnegan es una **terminal OSINT personal** — "el ojo que todo lo ve". Dado un username, email, teléfono, dominio/IP, nombre+apellido o una foto, agrega múltiples fuentes y devuelve resultados en vivo, cerrando con un análisis de IA que correlaciona la identidad.

- **Uso:** personal, una sola persona. Backend **local** (`localhost:8000`). Frontend = la SPA de este repo.
- **Estética objetivo:** HUD militar / terminal / Jarvis (track de frontend, ver §9).
- Resultados **best-effort y sin verificar** — disclaimer explícito. Uso responsable/legal.

## 2. Working Model (cómo construimos)

Dos tracks en paralelo, sincronizados por este contrato:

- **Backend** (repo separado `rinnegan-api`, agente dedicado): Claude de este repo genera **prompts autocontenidos hito por hito** (contrato + herramientas + criterios de aceptación + tests).
- **Frontend** (este repo, Claude): implementa el consumo del contrato (SSE / streaming, comandos, subida de imagen, render del reporte IA, whoami) y el rediseño HUD.
- **Este documento es la fuente de verdad.** Nadie se desvía del contrato sin actualizarlo aquí primero.

Orden de hitos: `núcleo → domain/IP → username → email → phone → name → image → IA`.

## 3. Architecture (backend)

Modular: cada **fuente** es un provider aislado con interfaz común; cada **categoría** orquesta sus providers en paralelo (async) y emite eventos por streaming.

```
backend/  (repo: rinnegan-api)
├── app/
│   ├── main.py                 # FastAPI, CORS, routers
│   ├── core/
│   │   ├── envelope.py         # esquema pydantic del resultado normalizado
│   │   ├── events.py           # tipos de evento SSE
│   │   └── orchestrator.py     # corre providers en paralelo, emite eventos
│   ├── providers/
│   │   ├── base.py             # Provider (interfaz)
│   │   ├── username/  (maigret, sherlock)
│   │   ├── email/     (validator, emailrep, holehe)
│   │   ├── domain/    (rdap, dns, whois, crtsh)
│   │   ├── ip/        (ipapi, reverse_dns)
│   │   ├── phone/     (libphonenumber)
│   │   ├── name/      (duckduckgo)
│   │   └── image/     (exif, face)
│   ├── ai/analyst.py           # OpenAI: correlación + resumen + reporte
│   └── routes/osint.py         # endpoints por categoría
├── tests/                      # pytest + respx
├── Dockerfile
├── .env.example                # claves (ver §11)
└── pyproject.toml              # uv, ruff, python 3.12
```

**Flujo:** cliente abre stream → orquestador lanza providers en paralelo → cada `finding` se streamea en vivo → al terminar, el envelope agregado va a `ai/analyst.py` → reporte IA streameado → evento `done`.

## 4. API Surface

**Categorías de texto** (entrada por query param, streaming SSE vía `EventSource`, GET):

| Endpoint | Comando terminal |
|---|---|
| `GET /whoami` | header / `osint self` |
| `GET /osint/ip/stream?value=` | `osint ip <ip>` |
| `GET /osint/domain/stream?value=` | `osint domain <dom>` |
| `GET /osint/email/stream?value=` | `osint email <email>` |
| `GET /osint/username/stream?value=` | `osint user <user>` |
| `GET /osint/phone/stream?value=` | `osint phone <tel>` |
| `GET /osint/name/stream?value=` | `osint name "<nombre apellido>"` |

**Categoría imagen** (necesita subir archivo → POST multipart; streaming vía `fetch` + ReadableStream, NO EventSource):

| Endpoint | Comando terminal |
|---|---|
| `POST /osint/image/stream` (multipart: `file`) | `osint image` (abre selector de archivo) |

`/whoami` → `{ "ip": "<public ip>", "user_agent": "...", "geo": {country, city, ...} | null }`.

Ambos tipos de stream emiten `text/event-stream` con el **mismo protocolo de eventos** (§5). La única diferencia es el transporte (GET+EventSource vs POST+fetch-reader).

## 5. SSE Event Protocol (contrato exacto)

Cada mensaje: `event:` + `data:` JSON.

```
event: meta
data: { "query": "kazzu", "type": "username", "providers": ["maigret","sherlock"], "started_at": "ISO8601" }

event: progress
data: { "provider": "maigret", "status": "running", "checked": 312, "total": 500 }

event: finding
data: { "provider": "maigret", "source": "github", "title": "github.com/kazzu",
        "data": { "url": "https://github.com/kazzu", "...": "..." }, "confidence": "high|medium|low" }

event: source_error
data: { "provider": "holehe", "error": "module timeout" }

event: ai_report
data: { "format": "markdown", "text": "## Resumen\n..." }

event: done
data: { "summary": { "findings": 18, "errors": 2, "elapsed_ms": 41200 } }
```

`status`: `"running" | "done" | "error"`. `confidence`: `"high" | "medium" | "low"`.

## 6. Normalized Envelope (resultado agregado)

Lo que recibe la IA y lo que consumiría un cliente no-streaming:

```json
{
  "query": "kazzu",
  "type": "username",
  "timestamp": "ISO8601",
  "data": {},
  "findings": [
    { "provider": "maigret", "source": "github", "title": "...", "data": {}, "confidence": "high" }
  ],
  "sources": [ { "provider": "maigret", "status": "done", "count": 14 } ],
  "errors": [ { "provider": "holehe", "error": "module timeout" } ]
}
```

## 7. Providers (v1)

**Interfaz:**
```python
class Provider:
    name: str
    category: str          # "username"|"email"|"domain"|"ip"|"phone"|"name"|"image"
    requires_key: bool = False
    async def stream(self, value) -> AsyncIterator[Event]: ...
```

| Categoría | Provider | Emite | Cuenta/Key | Notas |
|---|---|---|---|---|
| username | `maigret` | sitios donde existe el usuario | no | async nativo, ~500 sitios. **Primario.** |
| | `sherlock` | segunda opinión | no | subprocess. Secundario, opt-in. |
| email | `validator` | sintaxis + MX | no | `email-validator` |
| | `emailrep` | reputación/exposición | no | emailrep.io sin key a bajo rate |
| | `holehe` | sitios donde el email está registrado | no | ⚠️ semi-abandonado, aislado para parchear |
| domain | `rdap`+`whois` | registrar, fechas, NS | no | RDAP preferido, WHOIS fallback |
| | `dns` | A/AAAA/MX/TXT/NS | no | `dnspython` |
| | `crtsh` | subdominios (CT) | no | crt.sh, con rate/cortesía |
| ip | `ipapi` | geo, ISP, ASN | no | ip-api.com (45 req/min) |
| | `reverse_dns` | hostname(s) | no | stdlib |
| phone | `libphonenumber` | país, operador, tipo, validez | no | `phonenumbers`, local sin red |
| **name** | `duckduckgo` | posibles matches (perfiles, páginas) | no | DDG HTML scraping. Con apellido → frase exacta. (Google CSE descartado 2026-06-20) |
| **image** | `exif` | GPS, fecha, dispositivo | no | `Pillow`/`exifread`, local. Alto valor |
| | `face` | detección + encoding facial; correlación 1:1 | no | InsightFace, local, dep pesada |

> Nota (2026-06-20): `reverse_image` (Google Vision Web Detection) fue **descartado** por decisión del usuario. Reverse image queda solo en el roadmap v2 (opción de pago). La categoría `image` en v1 = EXIF + face.

**Reglas:** cada provider falla aislado (→ `source_error`), nunca tumba el escaneo. Testeable solo (pytest + respx). Concurrencia limitada por provider (evita falsos positivos por rate-limit).

**Nota sobre `face`:** en v1 detecta/encodea rostros de la imagen subida y expone comparación 1:1. La correlación automática "misma cara en varios perfiles encontrados" (bajar las fotos de perfil de un escaneo de username y compararlas) es un objetivo alcanzable que puede vivir en el orquestador/IA; se marca como enhancement de v1 si el tiempo lo permite, sin bloquear el resto.

## 8. AI Layer (`ai/analyst.py`)

- **Trigger:** automático al cerrar cada escaneo.
- **Entrada:** el envelope normalizado completo (incluye señales de imagen: EXIF, matches faciales si los hay).
- **Proceso** (un prompt estructurado): correlación de identidad · resumen ejecutivo · señales/risk notes · pivots sugeridos.
- **Salida:** markdown, streameado como `ai_report`.
- **Proveedor:** OpenAI (`OPENAI_API_KEY`). Slot intercambiable.
- **Guardas:** `OPENAI_MODEL` (default `gpt-4o-mini`), truncado de findings si exceden tokens, disclaimer fijo.

## 9. Frontend Integration (este repo)

- `services/api.js`:
  - `streamOsint(category, value, handlers)` con `EventSource` para categorías de texto.
  - `streamOsintImage(file, handlers)` con `fetch` + ReadableStream (POST multipart) para imagen.
  - `whoami()` con `fetch`.
- `hooks/useTerminal.js`: los comandos abren el stream, imprimen `finding` en vivo, muestran `progress`, renderizan `ai_report` como bloque `[ANÁLISIS IA]`, cierran en `done`.
- **Cancelación:** Ctrl+C / comando cierra el stream en curso (resuelve el timeout de raíz).
- `whoami` al boot llena `ip`/`username` reales (elimina `ip:null` / `"guest"`).
- **Comandos nuevos:** `osint phone <tel>`, `osint name "<nombre apellido>"`, `osint image` (dispara selector de archivo / drop zone). Actualizar parser y `help`.
- **Estética HUD / Jarvis (track propio):** rediseño visual con el skill frontend-design una vez fluyan datos. Paneles tipo HUD, escaneo en vivo, tipografía militar. No bloquea el backend.

## 10. Operation & Errors

- **CORS:** permite `http://localhost:5173` (dev). (Frontend de Pages queda como vitrina; ver nota de mixed-content abajo.)
- **Errores:** aislados por fuente; resultado siempre parcial-útil.
- **Rate-limit/bloqueo:** concurrencia limitada por provider; `confidence` por finding.
- **Disclaimer:** en el reporte IA y en `about`.
- **Auth:** ninguna — herramienta personal, backend local, single-user.
- **Mixed-content (importante):** el frontend desplegado en Pages (HTTPS) llamando a `http://localhost:8000` puede ser bloqueado por el navegador. **Mientras el backend sea local, usar la herramienta con el frontend en local (`npm run dev`) apuntando a localhost.** La versión de Pages queda como demo visual. Se resuelve cuando el backend tenga HTTPS (v2).

## 11. Accounts & Keys (backend `.env`, nunca en frontend)

| Variable | Servicio | ¿Crear cuenta? | Tier |
|---|---|---|---|
| `OPENAI_API_KEY` | OpenAI (IA) | Ya la tiene | de pago (suyo) |
| `OPENAI_MODEL` | (opcional) | — | default `gpt-4o-mini` |

> `name` ya NO requiere credenciales: usa DuckDuckGo (scraping). La única cuenta obligatoria de la v1 es **OpenAI** (IA).

Providers cuyo key falta → se auto-desactivan y reportan `source_error` "sin credencial", sin romper el escaneo.

## 12. Stack & Quality (backend)

FastAPI · httpx · pydantic v2 · `dnspython`, `python-whois`, `email-validator`, `maigret`, `phonenumbers`, `Pillow`/`exifread`, `insightface` · pytest + respx · ruff · uv · Python 3.12 · Dockerfile listo para deploy futuro.

## 13. Roadmap (fuera de v1)

- **v2:** reverse image premium (TinEye/SerpApi, mayor cobertura) · enriquecimiento con keys opcionales (Censys, AbuseIPDB, HIBP) · persistencia + **pivoting** real · correlación facial automática cross-perfil completa · deploy del backend con HTTPS (habilita usar el frontend de Pages contra el backend real) · auth si deja de ser single-user.
- **Descartado a propósito:** búsqueda facial de la web abierta (subir rostro → encontrarlo en todos lados) — no existe API gratis/legal (GDPR Art. 9, BIPA, precedente Clearview) e infra-inviable.

## 14. Constraints / Honest Limitations (de la investigación)

- Sherlock/Holehe desde IP de datacenter: 20–60% de éxito en sitios protegidos; falsos positivos al rate-limitear. → concurrencia limitada + `confidence` + disclaimer. (Local mitiga esto: tu IP residencial.)
- Listas de sitios (Maigret/Sherlock) se degradan; mantenimiento periódico.
- No hay API gratis real de email→brechas (HIBP de pago).
- Holehe semi-abandonado: aislado para parchearlo.
- Búsqueda por nombre es la más débil (people-search); DuckDuckGo (scraping HTML, sin key) da resultados razonables pero no exhaustivos, y su HTML puede cambiar (mantenimiento ocasional).
- `image` en v1 es EXIF (dato duro) + detección facial local. Reverse image (dónde aparece la foto) quedó descartado en v1 — solo v2 como opción de pago.
