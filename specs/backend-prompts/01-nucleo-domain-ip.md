# Prompt para el agente de backend — Hito 1: Núcleo + Domain/IP

> Copia todo lo que sigue (dentro del bloque) y pásaselo al agente que construirá el repo `rinnegan-api`.

---

Estás construyendo desde cero un backend **FastAPI** llamado `rinnegan-api`: el motor OSINT de una terminal personal ("Rinnegan"). Este es el **Hito 1**: montar el núcleo de la plataforma y la primera categoría end-to-end (dominio/IP). Otras categorías (username, email, phone, name, image, IA) llegarán en hitos siguientes — **diseña el núcleo para que enchufen sin refactor**, pero NO las implementes ahora.

## Contexto y principios

- Herramienta **personal, single-user, local** (`localhost:8000`). Sin auth.
- Un **frontend** SPA (React) consume este backend por **streaming SSE**. El contrato de abajo es sagrado: nombres de eventos, campos y forma del envelope deben coincidir exactamente.
- Cada **fuente externa** es un "provider" aislado: un fallo de una fuente nunca tumba el escaneo; su error se reporta y el resto continúa.
- Resultados **best-effort, sin verificar**.

## Stack obligatorio

- Python **3.12**, gestor **uv**, linter **ruff**.
- **FastAPI** + **httpx** (async) + **pydantic v2**.
- Tests: **pytest** + **respx** (mock de httpx). Cobertura real de cada provider y del orquestador.
- `Dockerfile` funcional (para deploy futuro; no se despliega ahora).
- Estructura de proyecto:

```
rinnegan-api/
├── app/
│   ├── main.py                 # FastAPI, CORS, routers
│   ├── core/
│   │   ├── envelope.py         # modelos pydantic (envelope + finding)
│   │   ├── events.py           # tipos de evento SSE + serialización a text/event-stream
│   │   └── orchestrator.py     # corre N providers en paralelo (asyncio), emite eventos
│   ├── providers/
│   │   ├── base.py             # clase/protocolo Provider
│   │   ├── domain/  (rdap.py, dns.py, whois.py, crtsh.py)
│   │   └── ip/      (ipapi.py, reverse_dns.py)
│   ├── routes/osint.py         # endpoints /osint/{domain,ip}/stream y /whoami
│   └── config.py               # settings (pydantic-settings), CORS origins, .env
├── tests/
├── .env.example
├── Dockerfile
├── pyproject.toml
└── README.md
```

## Interfaz Provider (base.py)

```python
class Provider:
    name: str                 # ej. "rdap"
    category: str             # "domain" | "ip"
    requires_key: bool = False
    async def stream(self, value: str) -> AsyncIterator[Event]: ...
```

Cada provider hace `yield` de eventos (`progress`, `finding`, `source_error`) a medida que trabaja. El orquestador ejecuta todos los providers de una categoría **en paralelo** (`asyncio.gather` / task group) y multiplexa sus eventos hacia el cliente conforme llegan (usa una `asyncio.Queue`).

## Contrato SSE (EXACTO)

Endpoints de esta entrega:

- `GET /whoami` → JSON simple (no streaming): `{ "ip": "<ip pública del request>", "user_agent": "...", "geo": {country, city, ...} | null }`. Para `geo`, resuelve la IP del cliente con ip-api (mismo provider `ipapi`). Detrás de proxy, respeta `X-Forwarded-For`.
- `GET /osint/domain/stream?value=<dominio>` → `text/event-stream`
- `GET /osint/ip/stream?value=<ip>` → `text/event-stream`

Formato de cada mensaje SSE (`event:` + `data:` con JSON en una línea):

```
event: meta
data: {"query":"example.com","type":"domain","providers":["rdap","dns","whois","crtsh"],"started_at":"<ISO8601>"}

event: progress
data: {"provider":"crtsh","status":"running","checked":0,"total":0}

event: finding
data: {"provider":"dns","source":"A","title":"93.184.216.34","data":{"record":"A","value":"93.184.216.34"},"confidence":"high"}

event: source_error
data: {"provider":"whois","error":"timeout"}

event: ai_report
data: {"format":"markdown","text":"..."}     # (aún NO en este hito; reservado)

event: done
data: {"summary":{"findings":12,"errors":1,"elapsed_ms":3400}}
```

Reglas:
- `status` ∈ `"running" | "done" | "error"`. `confidence` ∈ `"high" | "medium" | "low"`.
- Emite `meta` primero, luego eventos de providers en vivo, y `done` al final con el resumen.
- **NO** emitas `ai_report` en este hito (la IA es un hito posterior); deja el tipo de evento definido en `events.py` pero sin usar.
- Serializa `data:` como JSON compacto en una sola línea. Termina cada evento con doble `\n`.

## Envelope normalizado (envelope.py)

El orquestador, además de emitir eventos, acumula el estado final en este modelo (se usará para alimentar la IA en hitos futuros y para tests):

```json
{
  "query": "example.com",
  "type": "domain",
  "timestamp": "<ISO8601>",
  "data": {},
  "findings": [ {"provider":"dns","source":"A","title":"...","data":{},"confidence":"high"} ],
  "sources": [ {"provider":"dns","status":"done","count":4} ],
  "errors":  [ {"provider":"whois","error":"timeout"} ]
}
```

## Providers a implementar en este hito (todos SIN API key)

**Categoría `domain`** (input: un dominio):
- `rdap` — consulta RDAP (JSON estructurado; ej. `https://rdap.org/domain/<dominio>`). Emite findings: registrar, fechas de creación/expiración, nameservers, estados.
- `whois` — **fallback** de RDAP usando `python-whois`. Si RDAP ya dio datos, whois complementa; corre igual pero marca confidence `medium`.
- `dns` — con `dnspython` (async o en threadpool): registros A, AAAA, MX, TXT, NS. Un `finding` por registro.
- `crtsh` — subdominios vía Certificate Transparency: `https://crt.sh/?q=%25.<dominio>&output=json`. Deduplica nombres; un `finding` por subdominio único. Sé cortés (timeout, límite razonable).

**Categoría `ip`** (input: una IP):
- `ipapi` — `http://ip-api.com/json/<ip>` (sin key, 45 req/min). Findings: país, ciudad, lat/lon, ISP, org, ASN. Reutilizable por `/whoami`.
- `reverse_dns` — PTR / reverse DNS de la IP (stdlib `socket` en threadpool). Finding: hostname(s).

## Configuración / operación

- **CORS**: permite `http://localhost:5173` (dev del frontend). Configurable vía env `CORS_ORIGINS`.
- **Timeouts**: cada provider con timeout propio (ej. 10s) para no colgar el stream.
- **Concurrencia**: providers de una categoría en paralelo; dentro de un provider que hace muchas requests, limita concurrencia.
- `.env.example` con `CORS_ORIGINS=http://localhost:5173` (aún sin keys en este hito).
- `config.py` con pydantic-settings.

## Criterios de aceptación (deben cumplirse)

1. `uv run uvicorn app.main:app --reload` levanta en `:8000`.
2. `GET /whoami` devuelve la IP pública y geo.
3. `curl -N http://localhost:8000/osint/domain/stream?value=example.com` emite `meta` → varios `finding` en vivo → `done`, en formato SSE válido.
4. `curl -N http://localhost:8000/osint/ip/stream?value=8.8.8.8` idem.
5. Si una fuente falla (simula timeout), aparece `source_error` y el escaneo **continúa** y cierra con `done`.
6. **Tests pytest verdes**, con respx mockeando RDAP/crt.sh/ip-api: cubre cada provider (éxito + fallo aislado) y el orquestador (multiplexado + envelope final correcto).
7. `ruff check` limpio.
8. `README.md` con cómo instalar (uv), correr y testear.

## NO hagas en este hito

- Nada de username/email/phone/name/image.
- Nada de IA / OpenAI (deja `ai_report` definido pero sin emitir).
- Nada de auth, persistencia ni deploy.

Cuando termines, reporta: endpoints funcionando, salida de ejemplo de un `curl -N`, y el resultado de `pytest` y `ruff`.
