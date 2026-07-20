# Rinnegan v2 — Router de intención (NL, voz-primero) + probabilidad facial — Design / Contract

**Status:** Approved design. Contract for backend (`rinnegan-api`) + frontend (this repo).
**Scope:** (A) interpretar lenguaje natural (voz o texto) y correr el OSINT/ruta que aplique sin comandos específicos; (B) con las fotos halladas, agrupar caras en el navegador y dar una **probabilidad** de que sean la misma persona.

---

## 1. Purpose

Que el usuario **describa** en lenguaje natural (hablando o escribiendo) — "acabo de conocer a Carlos Sánchez" — y el sistema infiera la intención, corra la inteligencia sola, y con las fotos encontradas indique **con qué probabilidad cada una es esa persona**. Sin memorizar comandos.

**Honestidad:** nombres comunes → resultados *posibles*, no certeza. La "probabilidad facial" mide consistencia de una cara recurrente entre perfiles, **no** identidad verificada.

## 2. Router de intención (backend + frontend)

### Backend — `POST /interpret` (protegido)

Body `{ "text": "<lo que dijo/escribió el usuario>" }`. **OpenAI** clasifica y devuelve **una** acción:

```json
// inteligencia sobre alguien/algo
{ "action": "osint", "value": "Carlos Sánchez", "kind": "name" }   // kind: auto|name|username|email|phone|domain|ip
// ruta / ETA
{ "action": "route", "text": "sale en 4 min desde ... a ... en moto" }
// comando meta dicho en NL
{ "action": "command", "command": "clear" }                        // p.ej. "clear","help","theme cloud","sound off","logout"
// no se entendió
{ "action": "unknown", "message": "no entendí; ¿puedes reformular?" }
```

Prompt del modelo: si el usuario quiere info de una persona/usuario/email/tel/dominio/IP → `osint` con el objetivo extraído y `kind`; si quiere una ruta/ETA → `route` (pasa el texto tal cual); si es una acción de la terminal (limpiar, ayuda, cambiar tema, silenciar, salir) → `command` con el string del comando; si no → `unknown`. JSON estricto.

### Frontend — despacho

Al enviar (voz o texto):
- Si el input **empieza con un comando explícito conocido** (`help`,`clear`,`banner`,`netstat`,`sysinfo`,`about`,`demo`,`sound`,`logout`,`theme`,`ruta`/`route`,`osint …`) → se maneja como hoy (atajo rápido, sin `/interpret`).
- Si no → llama `POST /interpret` (muestra "interpretando…") y despacha la acción:
  - `osint` → corre el **auto scan** con `value` (`streamOsint("auto", value)`), que ya hace name/username/email/… + `media` (fotos) + IA.
  - `route` → `planRoute(text)` (endpoint existente).
  - `command` → re-despacha ese string por `handleCommand` (reusa los handlers locales).
  - `unknown` → muestra el `message`.

### Voz
Dictas → la transcripción queda en el input → **revisas → Enter** → pasa por el router. (Web Speech API, como ya está.)

## 3. Probabilidad facial (navegador + proxy)

### Backend — `GET /img?url=<encoded>` (protegido)

Proxy de imágenes para que el navegador pueda leer los píxeles de fotos de otros dominios (CORS). Reglas:
- Solo `http(s)`. **Bloquea SSRF**: rechaza hosts/IPs privadas (localhost, 127.0.0.0/8, 10/8, 172.16/12, 192.168/16, 169.254/16, `::1`, etc.).
- Solo content-type de imagen; tope de tamaño (~8MB) y timeout (~8s).
- Reexpone la imagen con `Access-Control-Allow-Origin` (los orígenes de `CORS_ORIGINS`) para que el `<canvas>` no quede "tainted".

### Frontend — análisis facial (con `face-api.js`, lazy)

Tras un escaneo cuyo `media` trae **≥2 fotos**:
1. Carga `face-api.js` (modelos **empaquetados** en `public/models/`, ~6MB, una vez) — lazy (chunk aparte).
2. Por cada foto (cargada vía `/img?url=…&token=…`): detecta la cara principal + descriptor 128-d. Fotos sin cara detectable → se omiten.
3. **Agrupa** los descriptores por distancia euclidiana (umbral ~0.55). El **grupo más grande** = la cara que más se repite entre perfiles.
4. **Probabilidad**: en función del tamaño del grupo dominante vs total y de la compacidad (distancia media). Ej.: "3 de 4 fotos muestran la misma cara → 87%".
5. **UI**: en la galería, badge por foto ("misma persona · 87%" en el grupo dominante; "otra cara" / "sin rostro" en las demás) + una línea resumen. La IA puede mencionar la conclusión.

Todo en el dispositivo del usuario (cero RAM de ML en el servidor de 2GB). Respeta `prefers-reduced-motion` en las animaciones.

## 4. Flujo completo

`hablar/escribir NL → /interpret → (osint auto | route | command | unknown) → escaneo en vivo → media (fotos) → face-api agrupa → % en la galería + IA`.

Los comandos explícitos siguen disponibles como atajos.

## 5. Límites honestos (en la UI)

- Nombre común → muchos candidatos; resultados posibles, no certeza. Más señal (ciudad, empresa, @handle) mejora mucho.
- Probabilidad facial = consistencia de la cara recurrente, no identidad verificada.
- Depende de fotos accesibles y con cara detectable; muchas redes bloquean sus imágenes.
- Voz: solo Chrome/Edge/Chrome-Android.
- El proxy `/img` procesa imágenes públicas; se usa solo para poder analizarlas en el navegador.

## 6. Cuentas / claves

**Ninguna nueva.** OpenAI ya está; modelos de face-api **empaquetados** (sin CDN/cuenta); `/interpret` y `/img` sin key. Ligeros en RAM (no hay ML en el servidor).

## 7. Testing

- **Backend (pytest):** `/interpret` con OpenAI **mockeado** → cada tipo de acción (osint/route/command/unknown); `/img` → valida http(s), header CORS, tope de tamaño/timeout, **rechaza IP privada/SSRF**, rechaza no-imagen; ambos exigen auth (401 sin token).
- **Frontend (vitest):** el router despacha la acción correcta (mock de `/interpret` → llama al flujo correcto); el **agrupamiento facial** con descriptores simulados (agrupa + calcula %); voz con `SpeechRecognition` mockeado.

## 8. Orden de implementación

1. **Backend**: `/interpret` (OpenAI) + `/img` (proxy con anti-SSRF) + tests. Prompt para el agente.
2. **Frontend**: despacho NL (interpret → flujo), estado "interpretando…".
3. **Frontend**: análisis facial (`face-api.js` lazy + modelos en `public/models/` + agrupamiento + badges en la galería).
