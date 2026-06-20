# Rinnegan

SPA en React + Vite + Tailwind que simula una **terminal OSINT**. Ofrece una interfaz tipo terminal (boot animado, comandos, temas) que consulta un backend FastAPI separado para reconocimiento de IP, dominio, email y usuario.

## Stack

- **React 19** con JSX (sin TypeScript)
- **Vite 7** como bundler
- **Tailwind CSS 4** vía `@tailwindcss/vite` (configurado en CSS, sin `tailwind.config.js`)
- **react-router-dom 7**

## Requisitos

- Node.js + npm
- (Opcional) El backend FastAPI corriendo en `http://localhost:8000` para los comandos OSINT.

## Desarrollo

```bash
npm install
npm run dev      # servidor de desarrollo
npm run lint     # ESLint
npm run build    # build de producción → carpeta docs/
npm run preview  # previsualiza el build
```

## Variables de entorno

| Variable             | Default                 | Descripción                          |
| -------------------- | ----------------------- | ------------------------------------ |
| `VITE_API_BASE_URL`  | `http://localhost:8000` | URL base del backend FastAPI (OSINT) |

Copia `.env.example` a `.env` y ajusta el valor si tu backend está en otra dirección.

## Comandos de la terminal

Escribe `help` dentro de la app para ver la lista. Resumen:

- `help`, `clear`, `banner`
- `theme list` / `theme <id>` — cambia entre temas (`qminds`, `darknet`, `cloud`)
- `netstat`, `sysinfo`, `osint self` — info del cliente (red, sistema, fingerprint)
- `osint ip|domain|email|user <valor>` — lookups contra el backend

## Despliegue (GitHub Pages)

No hay CI. El deploy es manual:

1. `npm run build` (escribe en `docs/`)
2. Commit de `docs/` y push a `main`
3. GitHub Pages sirve directamente desde `docs/`

Por eso `vite.config.js` define `base: '/Rinnegan/'` — mantenlo igual al nombre del repo o los assets se rompen en producción.
