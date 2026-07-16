# Guía de despliegue — n8n + Rinnegan en Lightsail (IP 3.234.15.90)

Un solo stack Docker: **Caddy** (HTTPS auto) enruta `n8n.TUDOMINIO.com` y `api.TUDOMINIO.com`.
Sustituye **TUDOMINIO.com** por tu dominio real en `Caddyfile` y `docker-compose.yml`.

---

## 0. DNS (en tu proveedor de dominio)

Crea dos registros **A** apuntando a la IP de la instancia:

| Tipo | Nombre | Valor |
|---|---|---|
| A | `n8n` | `3.234.15.90` |
| A | `api` | `3.234.15.90` |

(Espera unos minutos a que propague. Verifica: `nslookup api.TUDOMINIO.com`.)

## 1. Firewall de Lightsail

En la consola de Lightsail → tu instancia → **Networking** → añade reglas:
- **HTTP** TCP **80**
- **HTTPS** TCP **443**
- (SSH 22 ya viene abierto)

## 2. Conéctate por SSH

Desde tu PC (usa tu llave de Lightsail):
```bash
ssh -i /ruta/LightsailDefaultKey.pem ubuntu@3.234.15.90
```

## 3. Instala Docker + Compose

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker      # o cierra y reabre la sesión SSH
docker --version && docker compose version
```

## 4. Prepara el directorio de deploy

```bash
mkdir -p ~/deploy && cd ~/deploy
# Clona el repo del backend AQUÍ (el compose hace build de ./rinnegan-api):
git clone <URL_DEL_REPO_rinnegan-api> rinnegan-api
```
Copia a `~/deploy/` los tres archivos de `specs/deploy/`: `docker-compose.yml`, `Caddyfile`, y `.env.example` → renómbralo a `.env`.

(Puedes pegarlos con `nano docker-compose.yml`, etc.)

## 5. Configura

- **`Caddyfile`**: reemplaza `TUDOMINIO.com` (dos veces) y `tu-email@ejemplo.com`.
- **`docker-compose.yml`**: reemplaza `n8n.TUDOMINIO.com` (host y webhook de n8n).
- **`.env`**: pon tu `OPENAI_API_KEY`, genera `JWT_SECRET` con `openssl rand -hex 32`, define `INVITE_CODES`, y ajusta `CORS_ORIGINS` (deja tu Pages `https://k4zzu.github.io`).

## 6. Levanta el stack

```bash
cd ~/deploy
docker compose up -d --build
docker compose ps
docker compose logs -f            # Ctrl+C para salir
```
Caddy tardará ~1 min en sacar los certificados la primera vez.

## 7. Verifica

```bash
curl -I https://api.TUDOMINIO.com/whoami     # 401 (protegido) = auth OK
curl -I https://n8n.TUDOMINIO.com            # 200/302 = n8n OK
```
Abre en el navegador:
- `https://n8n.TUDOMINIO.com` → asistente de n8n.
- `https://api.TUDOMINIO.com/docs` → Swagger del backend (si está activo).

## 8. Conecta el frontend (GitHub Pages)

En el repo del **frontend** (este), compila apuntando al backend y publica:
```bash
# .env del frontend (o variable al compilar):
VITE_API_BASE_URL=https://api.TUDOMINIO.com npm run build
# commit de docs/ y push a main → Pages sirve la versión conectada.
```

## 9. Actualizaciones futuras

```bash
cd ~/deploy/rinnegan-api && git pull
cd ~/deploy && docker compose up -d --build
```

---

## Notas

- **Puertos**: solo Caddy publica 80/443. n8n (5678) y backend (8000) quedan internos → sin choques.
- **Persistencia**: n8n en volumen `n8n_data`, SQLite de Rinnegan en `rinnegan_data`. Sobreviven reinicios.
- **RAM**: n8n + Maigret conviven bien en ~2 GB. **InsightFace/rostros** (sub-proyecto D) pide más (~1 GB extra + modelos); por eso `FACE_ENABLED=false` por ahora.
- **Seguridad**: `.env` nunca va a git. `JWT_SECRET` fuerte. El registro exige `INVITE_CODES`.
