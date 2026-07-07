# Prompt para el agente de backend — v2-A: Autenticación (JWT + invite)

> Continúa en el MISMO repo `rinnegan-api`. Copia el bloque y pásaselo al agente. (El deploy va en un prompt aparte.)

---

Añade **autenticación multiusuario** a `rinnegan-api`. No cambies la lógica OSINT ni el protocolo de eventos; solo introduces la capa de auth (BD de usuarios, JWT, registro con invitación) y **proteges** las rutas existentes. Todo lo demás sigue igual.

## Stack

- **SQLite** vía SQLAlchemy (o SQLModel). Archivo en `DB_PATH` (env, ej. `./data/rinnegan.db`). Crea el engine/sesión y las tablas al arrancar.
- **JWT** con `python-jose` (o PyJWT). **bcrypt** vía `passlib[bcrypt]` para hashear contraseñas.
- Nuevos módulos: `app/auth/models.py` (tabla users), `app/auth/security.py` (hash + JWT), `app/auth/routes.py` (endpoints), `app/auth/deps.py` (dependencia de usuario actual). Mantén el core OSINT intacto.

## Tabla `users`

`id` (pk), `username` (único, no vacío), `password_hash`, `created_at`. (Deja espacio para más campos futuros; el pivoting añadirá tablas propias.)

## Config (env / `config.py` / `.env.example`)

- `JWT_SECRET` (obligatorio, secreto largo aleatorio; NO hardcodear).
- `JWT_EXPIRE_DAYS` (default 7).
- `INVITE_CODES` (lista separada por comas; ej. `alpha123,beta456`).
- `DB_PATH` (default `./data/rinnegan.db`).
- `SCANS_PER_DAY` (default 50).

## Endpoints (`/auth`)

- `POST /auth/register` — body `{username, password, invite_code}`.
  - `invite_code` no está en `INVITE_CODES` → **403** (`{"detail":"código de invitación inválido"}`).
  - `username` ya existe → **409**.
  - password vacía o muy corta (< 8) → **422**.
  - Éxito → crea usuario (password **hasheada**), devuelve `{access_token, token_type:"bearer"}`.
- `POST /auth/login` — body `{username, password}` → `{access_token, token_type:"bearer"}` o **401** (credenciales inválidas). Mismo mensaje genérico para usuario inexistente y password mala (no filtrar cuál falló).
- `GET /auth/me` — requiere token → `{id, username}`.

## Dependencia de auth (contrato de token — IMPORTANTE)

`EventSource` no manda cabeceras, así que la dependencia `get_current_user(request)` debe aceptar el JWT por **dos vías**, en este orden:
1. Cabecera `Authorization: Bearer <jwt>`.
2. Si no hay cabecera, query param `?token=<jwt>`.

Valida el JWT (firma + expiración). Inválido/ausente/vencido → **401**.

**Protege con esta dependencia TODAS** las rutas `/osint/*` (incluidas las SSE y la de imagen POST) y `/whoami`. Los endpoints `/auth/*` quedan públicos (login/register) salvo `/auth/me`.

## Rate-limit por usuario (guarda de costo)

- Cada inicio de un escaneo OSINT (`/osint/*`) cuenta 1 para el usuario en el día actual (UTC).
- Si el usuario supera `SCANS_PER_DAY` → **429** (`{"detail":"límite diario de escaneos alcanzado"}`), sin correr el escaneo.
- Implementación simple: contador por `(user_id, fecha)` en una tabla (o en memoria con reset diario; tabla es más robusto tras reinicios).

## CORS

- Permite orígenes de `CORS_ORIGINS` (ya existe). Asegúrate de permitir el header `Authorization` y los métodos usados. No hacen falta cookies/credentials (el token va en header o query).

## Tests (pytest)

- Registro: código válido → 200 + token; código inválido → 403; ausente → 422/403; usuario duplicado → 409; password corta → 422. Verifica que la password se guarda **hasheada** (no en claro).
- Login: correcto → token; usuario inexistente o password mala → 401 (mismo mensaje).
- JWT: token válido pasa; vencido/manipulado/ausente → 401.
- Protección: `GET /whoami` y un `/osint/.../stream` sin token → 401; con token por **cabecera** → 200; con token por **`?token=`** → 200.
- Rate-limit: pasado `SCANS_PER_DAY` → 429.
- `ruff` limpio.

## Criterios de aceptación

1. Registro con código válido crea usuario y devuelve JWT; login funciona; `/auth/me` devuelve el usuario.
2. Todos los `/osint/*` y `/whoami` exigen token (401 sin él), y aceptan token por cabecera **y** por `?token=`.
3. Registro sin código válido → 403. Rate-limit → 429.
4. Contraseñas hasheadas (bcrypt). `JWT_SECRET` desde env.
5. Tests verdes + `ruff` + README (endpoints de auth, envs nuevas, cómo obtener token y usarlo con `?token=` en los streams).

## NO hagas

- No cambies la lógica OSINT, ni el protocolo de eventos, ni el envelope. No metas OAuth/terceros (auth propia con JWT). No guardes contraseñas ni tokens en logs. Nada de pivoting/rostros (van en otros hitos).

Cuando termines: `curl` de register → login → uso de `/whoami` con `Authorization` y de un stream con `?token=`, más un 401 sin token; y `pytest`/`ruff`.
