# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Rinnegan is a React + Vite + Tailwind SPA that simulates an OSINT terminal UI. It calls a separate FastAPI backend for reconnaissance queries (IP/domain/email/user lookups).

- React 19 with JSX (no TypeScript, despite `@types/*` being installed)
- Tailwind CSS 4 via `@tailwindcss/vite` (no `tailwind.config.js` — configured in CSS)
- Package manager: npm

## Commands

- `npm run dev` — start the Vite dev server
- `npm run build` — production build, **outputs to `docs/`** (not `dist/`)
- `npm run lint` — ESLint (the only linter; no Prettier/formatter is configured)
- `npm run preview` — preview the production build

## Backend dependency

OSINT features require the separate FastAPI backend running at `http://localhost:8000`. The frontend reads the base URL from `VITE_API_BASE_URL` (defaults to `http://localhost:8000`). Without the backend, lookup commands will fail.

## Deployment (GitHub Pages)

There is no CI workflow. Deploy is manual:

1. `npm run build` (writes into `docs/`)
2. Commit the updated `docs/` folder and push to `main`
3. GitHub Pages serves directly from `docs/` on `main`

Because of this, `vite.config.js` sets `base: '/Rinnegan/'` — keep this in sync with the repo name or asset paths break on the deployed site.

## Code style

- ESLint flat config (`eslint.config.js`); `no-unused-vars` ignores names matching `^[A-Z_]` (uppercase/constant-style).
