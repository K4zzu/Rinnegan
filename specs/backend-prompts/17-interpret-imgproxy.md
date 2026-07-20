# Prompt para el agente de backend — v2: /interpret (router NL) + /img (proxy anti-SSRF)

> Continúa en el MISMO repo `rinnegan-api`. Copia el bloque y pásaselo al agente.

---

Añade dos endpoints, ambos **protegidos con la auth existente** (aceptan token por cabecera `Authorization` **o** por `?token=`, como los streams): `POST /interpret` (clasifica lenguaje natural con OpenAI) y `GET /img` (proxy de imágenes con protección anti-SSRF, para análisis facial en el navegador). No cambies la lógica OSINT ni el protocolo de eventos. Reusa `OPENAI_API_KEY`. Ambos deben ser livianos en RAM (no hay ML aquí).

## 1. `POST /interpret`

Body `{ "text": "<lo que dijo/escribió el usuario>" }`. Usa **OpenAI** para clasificar la intención y devolver **una** acción en JSON estricto:

```json
{ "action": "osint",   "value": "Carlos Sánchez", "kind": "name" }   // kind: auto|name|username|email|phone|domain|ip
{ "action": "route",   "text": "sale en 4 min desde ... a ... en moto" }
{ "action": "command", "command": "clear" }
{ "action": "unknown", "message": "no entendí; ¿puedes reformular?" }
```

Reglas del prompt del modelo (system):
- Si el usuario quiere **información sobre una persona/usuario/email/teléfono/dominio/IP** → `osint`, con `value` = el objetivo extraído (ej. el nombre) y `kind` el tipo detectado (`name` para nombre+apellido; `username`, `email`, `phone`, `domain`, `ip`; `auto` si dudas).
- Si pide una **ruta/ETA/cuánto tarda en llegar** → `route`, con `text` = la frase relevante (tal cual, para pasarla a `/route`).
- Si es una **acción de la terminal** (limpiar pantalla, ayuda, cambiar tema, silenciar/activar sonido, cerrar sesión) → `command` con el string exacto del comando: `clear` | `help` | `theme <id>` | `sound on|off` | `logout` | `about` | `banner` | `netstat` | `sysinfo`.
- Si no se entiende → `unknown` con un `message` corto en español.
- Devuelve SOLO el JSON. Si el modelo falla el JSON, responde `{"action":"unknown","message":"…"}` (no 500).

`POST /interpret` protegido (401 sin token). Errores de OpenAI → `{"action":"unknown","message":"no pude interpretar (IA no disponible)"}` (no tumbar).

## 2. `GET /img?url=<encoded>` — proxy de imágenes con anti-SSRF

Sirve para que el navegador pueda leer los píxeles de fotos de otros dominios (análisis facial). **Protegido** (token por `?token=` porque lo carga un `<img>`/canvas).

Reglas (SEGURIDAD — imprescindible):
- Solo esquemas `http`/`https`. Otro esquema → 400.
- **Anti-SSRF:** resuelve el host y **rechaza IPs privadas/loopback/link-local/multicast**: `127.0.0.0/8`, `10/8`, `172.16/12`, `192.168/16`, `169.254/16`, `100.64/10`, `::1`, `fc00::/7`, `fe80::/10`, `0.0.0.0`, y hostnames `localhost`. → 400/403.
- Sigue redirects PERO **revalida el host en cada salto** (un redirect no puede llevar a una IP privada). Máx ~3 redirects.
- Timeout ~8s. Descarga con **tope de tamaño ~8MB** (aborta si excede).
- Acepta solo `Content-Type` de imagen (`image/*`); si no, 415.
- Responde los bytes con el `Content-Type` original y **`Access-Control-Allow-Origin`** = los orígenes de `CORS_ORIGINS` (para que el canvas no quede "tainted"). `Cache-Control` corto opcional.

## Tests (pytest + respx)

- **/interpret:** OpenAI **mockeado** devolviendo cada tipo → el endpoint retorna la acción tal cual; JSON inválido del modelo → `unknown` (no 500); error de OpenAI → `unknown`; sin token → 401.
- **/img:** URL http válida (respx mock imagen) → 200 con `Access-Control-Allow-Origin` y `Content-Type` imagen; **URL a IP privada/localhost → rechazada** (400/403); esquema no-http → 400; content-type no-imagen → 415; excede tamaño/timeout → error controlado; sin token → 401.
- `ruff` limpio.

## Criterios de aceptación

1. `POST /interpret {text}` (con auth) devuelve una de las 4 acciones; nunca 500 por JSON del modelo.
2. `GET /img?url=…&token=…` proxya imágenes públicas con CORS y **bloquea SSRF** (IPs privadas/localhost, redirects a privadas, no-imagen, tamaño).
3. Ambos protegidos (401 sin token). Tests verdes (OpenAI+HTTP mockeados) + `ruff` + README.

## NO hagas

- No expongas keys. No hagas de `/img` un proxy abierto sin las validaciones anti-SSRF. No cambies OSINT/eventos. Nada de ML/rostros en el servidor (eso corre en el navegador).

Cuando termines: `curl` de `/interpret` con 2-3 frases (persona, ruta, "limpia la pantalla") y de `/img` con una URL de imagen pública y con una URL a `127.0.0.1` (debe rechazar); `pytest`/`ruff`.
