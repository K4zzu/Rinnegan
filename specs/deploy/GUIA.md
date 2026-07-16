# Guía de despliegue — n8n + Rinnegan en Lightsail

- **IP:** `3.234.15.90`
- **n8n:** `https://n8n.whatbrainy.com`
- **Rinnegan (backend / godeye):** `https://godeye.whatbrainy.com`

Un solo stack Docker: **Caddy** (HTTPS auto) enruta ambos subdominios. Sin conflictos de puertos.

---

## 0. DNS (en tu proveedor de whatbrainy.com)

Crea dos registros **A** apuntando a la IP:

| Tipo | Nombre | Valor |
|---|---|---|
| A | `n8n` | `3.234.15.90` |
| A | `godeye` | `3.234.15.90` |

Verifica que propagó: `nslookup godeye.whatbrainy.com` debe devolver `3.234.15.90`.

## 1. Firewall de Lightsail

Consola Lightsail → tu instancia → **Networking** → añade reglas:
- **HTTP** TCP **80**
- **HTTPS** TCP **443**
- (SSH 22 ya viene abierto)

## 2. Conéctate por SSH

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
git clone <URL_DEL_REPO_rinnegan-api> rinnegan-api
```
Copia a `~/deploy/` los archivos `docker-compose.yml`, `Caddyfile` y `.env.example` (renómbralo a `.env`) de `specs/deploy/`. Ya vienen con `whatbrainy.com` puesto.

> ⚠️ **Importante:** el repo `rinnegan-api` trae su PROPIO `docker-compose.yml` y `Caddyfile` (deploy standalone). En esta instancia **NO los uses** — usamos los de `specs/deploy/` (co-hospedan n8n + Rinnegan bajo un solo Caddy). De `rinnegan-api` solo se usa su **Dockerfile** (lo construye `build: ./rinnegan-api`). Si corrieras los dos compose, tendrías dos Caddy peleando por 80/443.

## 5. Configura el `.env`

Edita `~/deploy/.env`:
- `OPENAI_API_KEY=` tu key de OpenAI.
- `JWT_SECRET=` genéralo: `openssl rand -hex 32`.
- `INVITE_CODES=` tus códigos de invitación (los que repartas para registro).
- `CORS_ORIGINS=https://k4zzu.github.io,http://localhost:5173` (ya viene así; añade otro origen si lo necesitas).

(El `Caddyfile` y el `docker-compose.yml` ya tienen tus subdominios; solo revisa el email en el `Caddyfile` si quieres cambiarlo.)

## 6. Levanta el stack

```bash
cd ~/deploy
docker compose up -d --build
docker compose ps
docker compose logs -f            # Ctrl+C para salir
```
Caddy tardará ~1 min en emitir los certificados la primera vez (necesita el DNS ya propagado y los puertos 80/443 abiertos).

## 7. Verifica

```bash
curl -I https://godeye.whatbrainy.com/whoami   # 401 (protegido) = auth OK
curl -I https://n8n.whatbrainy.com             # 200/302 = n8n OK
```
En el navegador:
- `https://n8n.whatbrainy.com` → asistente de n8n.
- `https://godeye.whatbrainy.com/docs` → Swagger del backend.

## 8. Conecta el frontend (GitHub Pages)

En el repo del **frontend** (este), compila apuntando al backend y publica:
```bash
VITE_API_BASE_URL=https://godeye.whatbrainy.com npm run build
```
Luego commit de `docs/` y push a `main` → Pages sirve la versión conectada al backend real.

## 9. Actualizaciones futuras

```bash
cd ~/deploy/rinnegan-api && git pull
cd ~/deploy && docker compose up -d --build
```

---

## Notas

- **Puertos**: solo Caddy publica 80/443. n8n (5678) y backend (8000) quedan internos → sin choques.
- **Persistencia**: n8n en volumen `n8n_data`, SQLite de Rinnegan en `rinnegan_data`. Sobreviven reinicios.
- **RAM**: n8n + Maigret conviven bien en ~2 GB. **InsightFace/rostros** (sub-proyecto D) pide más; por eso `FACE_ENABLED=false` por ahora.
- **Seguridad**: `.env` nunca a git. `JWT_SECRET` fuerte. El registro exige `INVITE_CODES`.
- **Registro del primer usuario**: entra a la versión de Pages (o local) apuntando a `godeye.whatbrainy.com`, ve a "Regístrate con un código", usa uno de tus `INVITE_CODES`.
