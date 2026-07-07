# Rinnegan v2-A — Deploy (Lightsail + HTTPS) + Auth — Design / Contract

**Status:** Approved design. Contract for backend (`rinnegan-api`) + frontend (this repo).
**Scope:** v2 sub-project A+B — desplegar el backend en AWS Lightsail con HTTPS, y añadir autenticación multiusuario con código de invitación. NO incluye pivoting/persistencia de OSINT ni rostros (sub-proyectos posteriores), aunque introduce la BD SQLite que esos reusarán.

---

## 1. Purpose

Hoy el backend corre solo en local (`localhost:8000`) sin auth. Este sub-proyecto lo lleva a producción en **Lightsail con HTTPS** y añade **login/registro** para que solo usuarios autorizados (con código de invitación) lo usen — protegiendo la infra y el gasto de OpenAI. Habilita usar el frontend de GitHub Pages contra el backend real desde cualquier lado.

## 2. Auth (backend)

- **Modelo:** multiusuario. Registro requiere **código de invitación**.
- **Stack:** FastAPI + **JWT** (token de sesión, exp ~7 días) + hash de contraseña **bcrypt** vía `passlib`. **SQLite** vía SQLAlchemy/SQLModel (archivo en volumen).
- **Tabla `users`:** `id`, `username` (único), `password_hash`, `created_at`.
- **Endpoints:**
  - `POST /auth/register` — body `{username, password, invite_code}`. Valida `invite_code` contra `INVITE_CODES` (env, lista separada por comas). Código inválido → `403`. Usuario existente → `409`. Éxito → crea usuario, devuelve JWT.
  - `POST /auth/login` — body `{username, password}` → `{access_token, token_type:"bearer"}` o `401`.
  - `GET /auth/me` — con token → `{id, username}`.
- **Protección:** middleware/dependencia que exige JWT válido en **todos** los `/osint/*` y `/whoami`. Sin token / inválido / vencido → `401`.
- **Guarda de costo:** límite por usuario configurable (`SCANS_PER_DAY`, default ej. 50). Superado → `429`. Contador simple (tabla o memoria con reset diario).

## 3. Token en el streaming (contrato clave)

`EventSource` no puede enviar cabeceras. Por eso el backend acepta el JWT por **dos vías**:
- **Streams SSE (GET)** — `?token=<jwt>` en la query. Ej: `GET /osint/auto/stream?value=x&token=<jwt>`.
- **No-streaming (POST/GET simples: login, whoami, image)** — cabecera `Authorization: Bearer <jwt>`.

La dependencia de auth del backend revisa **primero** la cabecera, y si no está, el query param `token`. Ambas rutas validan el mismo JWT.

## 4. Frontend (este repo)

- **Panel de login HUD** (overlay sobre la terminal, no dentro de ella — mejor para campos de contraseña):
  - **Login:** usuario + contraseña.
  - **Registro** (toggle): usuario + contraseña + **código de invitación**.
  - Errores claros (código inválido, usuario existente, credenciales incorrectas).
- **Arranque:** si no hay token válido en `localStorage` → muestra el panel; si hay → va directo a la terminal.
- **Almacenamiento:** JWT en `localStorage` (`rinnegan:token`).
- **Envío del token:** `?token=` en `streamOsint`/`streamOsintImage` (los que usan EventSource/fetch de stream) y `Authorization: Bearer` en `whoami` y el resto. (Nota: la subida de imagen es POST → puede usar cabecera.)
- **Sesión:** respuesta `401` de cualquier llamada → limpia el token y muestra el login. Comando **`logout`** para cerrar sesión. El header muestra el `username` real.
- **Config:** el frontend de Pages se compila con `VITE_API_BASE_URL=https://api.<dominio>`; en dev sigue `localhost:8000`.

## 5. Deploy (Lightsail + HTTPS)

- **Instancia:** Ubuntu en Lightsail con **IP estática**. RAM ≥ 2 GB (holgura para Maigret ahora y InsightFace después).
- **Docker + docker-compose**, dos servicios:
  - `backend` — la FastAPI (Dockerfile existente).
  - `caddy` — reverse proxy con **HTTPS automático** (Let's Encrypt).
- **Caddyfile:** `api.<dominio>` → `reverse_proxy backend:8000`. Renovación de cert automática.
- **DNS:** registro **A** `api.<dominio>` → IP estática de Lightsail.
- **Firewall Lightsail:** abrir **80, 443** (y 22 SSH).
- **CORS:** `https://k4zzu.github.io` (Pages) + `http://localhost:5173` (dev), vía `CORS_ORIGINS`. Con `Authorization` permitido en headers.
- **Persistencia:** SQLite en **volumen Docker** (sobrevive reinicios). Mismo store que usará el pivoting.
- **Env del servidor:** `OPENAI_API_KEY`, `JWT_SECRET` (secreto largo aleatorio), `INVITE_CODES`, `CORS_ORIGINS`, `DB_PATH`, `SCANS_PER_DAY`, y demás keys existentes.
- **Entregables:** `Dockerfile` (ya), `docker-compose.yml`, `Caddyfile`, `.env.example`, y una **guía de deploy** paso a paso (crear instancia, IP estática, DNS, firewall, `docker compose up -d`).

## 6. Testing

- **Backend (pytest):** registro con código válido/ inválido/ ausente; usuario duplicado; login ok/ credenciales malas; JWT válido/ vencido/ manipulado; `/osint/*` y `/whoami` → `401` sin token; aceptación por **cabecera** y por **`?token=`**; límite `SCANS_PER_DAY` → `429`. Contraseñas hasheadas (nunca en claro).
- **Frontend (vitest):** que las llamadas adjunten el token (header y `?token=`); que un `401` limpie sesión y muestre login; parser de `logout`.
- **Manual post-deploy:** DNS resuelve, HTTPS válido, registro con código desde el Pages, login, y un escaneo real por HTTPS.

## 7. Seguridad / notas honestas

- `JWT_SECRET` fuerte y fuera del repo (env del servidor). Contraseñas con bcrypt, nunca en claro ni en logs.
- Token por `?token=` va cifrado sobre HTTPS; evita cookies cross-origin. Aceptable para uso personal; los tokens expiran.
- El código de invitación controla el alta pero no es rotación de secretos — si se filtra, se cambia `INVITE_CODES` y listo.
- Rate-limit por usuario protege el gasto de OpenAI; ajústalo a tu presupuesto.
- Exponer OSINT públicamente implica responsabilidad de uso; el disclaimer del reporte se mantiene.

## 8. Orden de implementación

1. **Backend auth** (users, JWT, invite, protección, rate-limit, tests) — sin tocar la lógica OSINT, solo envolver las rutas.
2. **Frontend login** (panel HUD, token en llamadas, 401→login, logout).
3. **Deploy** (compose + Caddy + guía) — se prueba de punta a punta al final.
