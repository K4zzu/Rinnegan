# Rinnegan — OSINT Aggregation Platform (v1) — Design / Shared Contract

**Date:** 2026-06-20
**Status:** Approved design. Source of truth for both tracks (see Working Model).
**Scope:** v1 — núcleo de plataforma + 4 categorías (username, email, domain/IP, phone) + capa de IA. Sin imagen. Sin auth (local).

---

## 1. Purpose

Rinnegan es una **terminal OSINT real** estilo osint.rocks: dado un username, email, dominio/IP o teléfono, agrega múltiples fuentes y devuelve resultados en vivo, cerrando con un análisis de IA. El frontend es la SPA existente (React + Vite, este repo). El backend es un proyecto FastAPI **separado** (repo `rinnegan-api`).

Resultados son **best-effort y sin verificar** — se comunica explícitamente al usuario (disclaimer). No es un agregador público de alto volumen.

## 2. Working Model (cómo construimos)

Dos tracks en paralelo, sincronizados por este contrato:

- **Backend** (repo separado, agente dedicado): Claude de este repo genera **prompts autocontenidos hito por hito**. Cada prompt incluye su parte del contrato + herramientas + criterios de aceptación + tests.
- **Frontend** (este repo, Claude): implementa el consumo del contrato (SSE, comandos, render del reporte IA, whoami).
- **Este documento es la fuente de verdad.** Ningún lado se desvía del contrato sin actualizarlo aquí primero.

Orden de hitos: `núcleo → domain/IP → username → email → phone → IA`.

## 3. Architecture (backend)

Enfoque modular: cada **fuente** es un provider aislado con interfaz común; cada **categoría** orquesta sus providers en paralelo (async) y emite eventos por streaming.

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
│   │   └── phone/     (libphonenumber)
│   ├── ai/analyst.py           # OpenAI: correlación + resumen + reporte
│   └── routes/osint.py         # endpoints SSE por categoría
├── tests/                      # pytest + respx
├── Dockerfile
└── pyproject.toml              # uv, ruff, python 3.12
```

**Flujo de una consulta:** EventSource → orquestador lanza providers en paralelo → cada `finding` se streamea en vivo → al terminar, el envelope agregado va a `ai/analyst.py` → reporte IA streameado → evento `done`.

## 4. API Surface

| Endpoint | Método | Comando terminal | Respuesta |
|---|---|---|---|
| `/whoami` | GET | header / `osint self` | JSON simple |
| `/osint/ip/stream?value=` | GET (SSE) | `osint ip <ip>` | stream |
| `/osint/domain/stream?value=` | GET (SSE) | `osint domain <dom>` | stream |
| `/osint/email/stream?value=` | GET (SSE) | `osint email <email>` | stream |
| `/osint/username/stream?value=` | GET (SSE) | `osint user <user>` | stream |
| `/osint/phone/stream?value=` | GET (SSE) | `osint phone <tel>` | stream |

`/whoami` → `{ "ip": "<public ip>", "user_agent": "...", "geo": {country, city, ...} | null }`.

SSE se sirve como `text/event-stream`. GET con query param para que `EventSource` (que solo hace GET) funcione directo.

## 5. SSE Event Protocol (contrato exacto)

Cada mensaje SSE tiene un `event:` y un `data:` con JSON. Tipos:

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

`status` en `progress`: `"running" | "done" | "error"`.
`confidence` en `finding`: `"high" | "medium" | "low"`.

## 6. Normalized Envelope (resultado agregado)

El estado final también se representa como envelope (lo que recibe la IA y lo que consumiría un cliente no-streaming):

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

## 7. Providers (v1) — todos sin API key salvo nota

**Interfaz:**
```python
class Provider:
    name: str
    category: str          # "username"|"email"|"domain"|"ip"|"phone"
    requires_key: bool = False
    async def stream(self, value: str) -> AsyncIterator[Event]: ...
```

| Categoría | Provider | Emite | Notas |
|---|---|---|---|
| username | `maigret` | sitios donde existe el usuario | async nativo, ~500 sitios default. **Primario.** |
| | `sherlock` | segunda opinión | subprocess. Secundario, opt-in por flag. |
| email | `validator` | sintaxis + MX | `email-validator`, instantáneo |
| | `emailrep` | reputación / exposición | emailrep.io sin key a bajo rate; degrada elegante |
| | `holehe` | sitios donde el email está registrado | ⚠️ semi-abandonado; aislado para parchear sin romper el resto |
| domain | `rdap` + `whois` | registrar, fechas, NS | RDAP (JSON) preferido, WHOIS fallback |
| | `dns` | A/AAAA/MX/TXT/NS | `dnspython` |
| | `crtsh` | subdominios (Certificate Transparency) | crt.sh, con rate/cortesía |
| ip | `ipapi` | geo, ISP, ASN | ip-api.com (45 req/min) |
| | `reverse_dns` | hostname(s) | stdlib |
| phone | `libphonenumber` | país, operador, tipo, validez | `phonenumbers`, parsing local sin red |

**Reglas:** cada provider falla aislado (→ `source_error`), nunca tumba el escaneo. Cada provider testeable solo (pytest + respx). Concurrencia limitada por provider (evita falsos positivos por rate-limit).

## 8. AI Layer (`ai/analyst.py`)

- **Trigger:** automático al cerrar cada escaneo.
- **Entrada:** el envelope normalizado completo.
- **Proceso** (un prompt estructurado): correlación de identidad · resumen ejecutivo · señales/risk notes · pivots sugeridos.
- **Salida:** markdown, streameado como `ai_report`.
- **Proveedor:** OpenAI (key del usuario, `OPENAI_API_KEY`). Slot intercambiable.
- **Guardas:** `OPENAI_MODEL` (default `gpt-4o-mini`), truncado de findings si exceden el límite de tokens, disclaimer fijo de "datos sin verificar".

## 9. Frontend Integration (este repo)

- `services/api.js`: nueva `streamOsint(category, value, handlers)` con `EventSource`; `whoami` con `fetch`. Reemplaza las `osintLookup*` actuales.
- `hooks/useTerminal.js`: `handleOsintCommand` abre el stream e imprime `finding` en vivo, muestra `progress`, renderiza `ai_report` como bloque `[ANÁLISIS IA]`, cierra en `done`.
- **Cancelación:** Ctrl+C / comando cierra el `EventSource` en curso (resuelve el problema del timeout de raíz).
- `whoami` al boot llena `ip`/`username` reales en el header (elimina `ip:null` y `"guest"` hardcodeados).
- Comando nuevo `osint phone <tel>` + actualizar parser y `help`.

## 10. Operation & Errors

- **CORS:** v1 permite `http://localhost:5173` (dev); origen de Pages configurable para después.
- **Errores:** aislados por fuente; resultado siempre parcial-útil.
- **Rate-limit/bloqueo:** concurrencia limitada por provider; `confidence` por finding.
- **Disclaimer:** en el reporte IA y en `about` — best-effort, sin verificar, uso responsable/legal.
- **Auth:** ninguna en v1 (local). Auth + rate-limit por usuario + logging = **transversal obligatorio antes de cualquier deploy público** (mínimo legal/anti-abuso).

## 11. Stack & Quality (backend)

FastAPI · httpx · pydantic v2 · `dnspython`, `python-whois`, `email-validator`, `maigret`, `phonenumbers` · pytest + respx · ruff · uv · Python 3.12 · Dockerfile listo para deploy futuro.

## 12. Roadmap (fuera de v1)

- **v2:** `osint phone` con footprint extendido · reverse image search **de pago** (TinEye/SerpApi) · enriquecimiento con keys opcionales (Censys, AbuseIPDB, HIBP) · persistencia + **pivoting** real · auth + rate-limit + deploy HTTPS.
- **Descartado a propósito:** búsqueda facial de la web abierta — inviable legal (GDPR Art. 9, BIPA, precedente Clearview) e infraestructuralmente.

## 13. Constraints / Honest Limitations (de la investigación)

- Correr Sherlock/Holehe a escala desde IP de datacenter: 20–60% de éxito en sitios protegidos; falsos positivos al rate-limitear. Por eso concurrencia limitada + `confidence` + disclaimer.
- Listas de sitios (Maigret/Sherlock/WhatsMyName) se degradan; requiere mantenimiento periódico.
- No hay API gratis real de email→brechas. HIBP de pago; Pwned Passwords (gratis) es solo passwords.
- Holehe está semi-abandonado: se aísla para poder parchearlo.
