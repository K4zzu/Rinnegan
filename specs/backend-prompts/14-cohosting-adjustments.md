# Prompt para el agente de backend — v2-A: ajustes para co-hosting detrás de un proxy externo

> Continúa en el MISMO repo `rinnegan-api`. Copia el bloque y pásaselo al agente.

---

El backend se desplegará **co-hospedado con n8n** en una instancia Lightsail, detrás de **un único reverse proxy Caddy externo** (definido fuera de este repo). El backend correrá como el servicio `backend`, **sin publicar puertos al host**, y Caddy le hará `reverse_proxy backend:8000`. Ajusta el repo para que funcione limpio en ese escenario. No cambies la lógica OSINT/auth.

## Contexto (no lo implementes aquí, solo tenlo en cuenta)

- Un compose externo hace `build: ./rinnegan-api` (usa **este** Dockerfile), monta un volumen en `/app/data`, y expone el backend solo por la red interna. Caddy termina el HTTPS y enruta `godeye.whatbrainy.com → backend:8000`.
- Por eso el backend recibe las peticiones **detrás de un proxy** (headers `X-Forwarded-For` / `X-Forwarded-Proto`).

## Cambios a realizar

### 1. Dockerfile — correr detrás de proxy

Asegúrate de que el `CMD`/arranque de uvicorn:
- escuche en `0.0.0.0:8000`,
- confíe en los headers del proxy: **`--proxy-headers --forwarded-allow-ips="*"`**.

Ej.: `uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips="*"`.

Motivo: sin esto, `/whoami` y el logging ven la IP de Caddy en vez del cliente real, y el esquema se detecta mal.

### 2. IP real del cliente en `/whoami`

Confirma que `/whoami` toma la IP del cliente respetando **`X-Forwarded-For`** (primer valor de la cadena) cuando viene por proxy, con fallback a la IP directa. (Ya lo hacía; verifica que sigue bien tras habilitar `--proxy-headers`.)

### 3. CORS

- Lee `CORS_ORIGINS` (lista separada por comas). Debe incluir por defecto `https://k4zzu.github.io` (el frontend en GitHub Pages) y `http://localhost:5173` (dev).
- Permite el header `Authorization`. Sin cookies/credentials (el token va por header o `?token=`).

### 4. Endpoint de salud público

Añade `GET /health` → `200 {"status":"ok"}`, **sin auth**. Sirve para verificar que el backend vive detrás de Caddy sin necesitar token (como `/whoami` ahora da 401). Útil para healthchecks y para depurar el deploy.

### 5. Carpeta de datos / SQLite

- El backend usa `DB_PATH` (env; en prod `= /app/data/rinnegan.db`). Asegúrate de que **crea el directorio si no existe** y de que la BD vive ahí (el volumen externo monta `/app/data`).
- El `Dockerfile` puede crear `/app/data` (o el código lo crea al abrir la BD). Que un contenedor recién construido sin volumen previo no falle por carpeta inexistente.

### 6. Documentar el compose standalone del repo

- El repo ya trae un `docker-compose.yml` + `Caddyfile` **standalone** (Rinnegan solo). Déjalos, pero añade en el README una nota clara: *"Estos son para deploy standalone de solo-Rinnegan. En un servidor con varios apps (co-hosting), NO se usan — un proxy externo enruta y solo se reutiliza este Dockerfile. Correr ambos compose provocaría dos Caddy en conflicto por 80/443."*

## Tests / verificación

- `GET /health` → 200 sin token.
- Con `--proxy-headers`, una petición con `X-Forwarded-For: 8.8.8.8` a `/whoami` (con token) reporta `8.8.8.8`.
- CORS incluye el origen de Pages.
- `ruff` limpio; tests existentes siguen verdes.

## Criterios de aceptación

1. `docker build` produce una imagen que arranca uvicorn con `--proxy-headers --forwarded-allow-ips="*"` en `0.0.0.0:8000`.
2. `GET /health` responde 200 público; el resto de `/osint/*` y `/whoami` siguen exigiendo token.
3. `/whoami` detrás de proxy devuelve la IP real vía `X-Forwarded-For`.
4. CORS configurable e incluye `https://k4zzu.github.io`.
5. La BD SQLite se crea en `DB_PATH` sin fallar si la carpeta no existía. README con la nota de co-hosting.

## NO hagas

- No publiques el puerto 8000 al host en el Dockerfile (solo `EXPOSE 8000` está bien; el mapeo lo decide el compose externo). No metas un Caddy dentro de este servicio. No cambies la lógica OSINT/auth ni el protocolo de eventos.

Cuando termines: confirma el `CMD` final del Dockerfile, la respuesta de `/health`, y `pytest`/`ruff`.
