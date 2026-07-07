# Prompt para el agente de backend — v2-A: Deploy en Lightsail (HTTPS)

> Continúa en el MISMO repo `rinnegan-api`. Copia el bloque y pásaselo al agente. Requiere el hito de auth (12) ya aplicado.

---

Prepara el despliegue de `rinnegan-api` en **AWS Lightsail** con **HTTPS automático** vía Caddy, usando Docker Compose. Genera los archivos de infra y una guía de deploy. No cambies la lógica de la app; esto es empaquetado + reverse proxy + docs.

## Archivos a crear

### 1. `docker-compose.yml` (dos servicios)

- **`backend`**: construye desde el `Dockerfile` existente. Expone el puerto interno (ej. 8000). Lee variables desde `.env`. Monta un **volumen** para la BD SQLite (ej. `./data:/app/data`) para que **persista** entre reinicios. `restart: unless-stopped`. NO publiques su puerto al host (solo lo habla Caddy por la red interna).
- **`caddy`**: imagen oficial `caddy:2`. Publica `80:80` y `443:443`. Monta el `Caddyfile` y volúmenes para datos/certs de Caddy (`caddy_data`, `caddy_config`) para no re-emitir certificados en cada reinicio. `restart: unless-stopped`. `depends_on: backend`.

### 2. `Caddyfile`

```
api.TU_DOMINIO.com {
    reverse_proxy backend:8000
}
```
(Caddy saca y renueva el certificado Let's Encrypt automáticamente. El dominio real se parametriza — documenta que se edita aquí o se pasa por variable.)

### 3. `.env.example` (completo para prod)

Incluye TODAS las variables: `OPENAI_API_KEY`, `OPENAI_MODEL`, `JWT_SECRET`, `JWT_EXPIRE_DAYS`, `INVITE_CODES`, `DB_PATH=/app/data/rinnegan.db`, `SCANS_PER_DAY`, `CORS_ORIGINS=https://k4zzu.github.io,http://localhost:5173`, `PHONE_DEFAULT_REGION`, `MEDIA_ENABLED`, `MEDIA_MAX_OGIMAGE`, `FACE_ENABLED`. Con comentarios y cómo generar `JWT_SECRET` (ej. `openssl rand -hex 32`).

### 4. Verifica el `Dockerfile`

Que instale las deps (incluye las de auth: passlib[bcrypt], python-jose/PyJWT, SQLAlchemy), cree `/app/data`, y arranque con uvicorn (ej. `uvicorn app.main:app --host 0.0.0.0 --port 8000`). Multi-stage si ayuda al tamaño.

### 5. `DEPLOY.md` (guía paso a paso)

1. **Crear instancia** Lightsail (Ubuntu 22.04, plan con **≥ 2 GB RAM**).
2. **IP estática**: crear y adjuntar a la instancia.
3. **DNS**: registro **A** `api.TU_DOMINIO.com` → IP estática. (Esperar propagación.)
4. **Firewall Lightsail (Networking)**: abrir **80 (HTTP)**, **443 (HTTPS)**, **22 (SSH)**.
5. **En la instancia**: instalar Docker + Docker Compose plugin. `git clone` del repo. Copiar `.env.example` → `.env` y rellenar (OpenAI key, `JWT_SECRET` con `openssl rand -hex 32`, `INVITE_CODES`, dominio en el `Caddyfile`).
6. `docker compose up -d --build`. Verificar `docker compose logs -f`.
7. **Probar**: `https://api.TU_DOMINIO.com/whoami` debe dar 401 (protegido) y `https://api.TU_DOMINIO.com/auth/register` debe existir; el cert HTTPS válido.
8. **Frontend**: en el repo del frontend, compilar con `VITE_API_BASE_URL=https://api.TU_DOMINIO.com` y publicar `docs/` en GitHub Pages. (Nota para el usuario.)
9. **Actualizaciones**: `git pull && docker compose up -d --build`.

## CORS

Confirma que el backend lee `CORS_ORIGINS` e incluye `https://k4zzu.github.io` y `http://localhost:5173`, permitiendo el header `Authorization`.

## Criterios de aceptación

1. `docker compose up -d --build` levanta backend + caddy localmente (con un dominio de prueba o localhost) sin errores.
2. La BD SQLite persiste en el volumen tras `docker compose down && up`.
3. `Caddyfile`, `docker-compose.yml`, `.env.example` y `DEPLOY.md` presentes y coherentes.
4. `DEPLOY.md` cubre instancia → IP estática → DNS → firewall → env → up → prueba HTTPS → build del frontend.
5. `ruff` limpio (si tocas código Python).

## NO hagas

- No publiques secretos reales en el repo (`.env` va en `.gitignore`; solo `.env.example`). No expongas el puerto del backend directo al host. No cambies la lógica OSINT/auth.

Cuando termines: el árbol de archivos nuevos, el contenido del `docker-compose.yml` y `Caddyfile`, y confirmación de que `docker compose up` levanta ambos servicios.
