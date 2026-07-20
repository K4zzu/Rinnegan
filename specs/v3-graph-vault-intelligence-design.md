# v3 — Grafo, bóveda, pivoting y búsqueda enriquecida (diseño)

> Fecha: 2026-07-20 · Estado: aprobado (brainstorming) · Sigue a v2 (router NL + probabilidad facial).

## 1. Propósito

Elevar Rinnegan de "buscador de una pasada" a una **máquina de inteligencia**: cada búsqueda encadena objetivos (pivoting), enriquece con búsqueda social real y reverse-image, correlaciona caras contra un historial, y puede archivarse en una **bóveda** (grafo persistente). El norte sigue siendo el "ojo que todo lo ve", de un solo usuario.

### Regla rectora (decisión del usuario)

- **La inteligencia siempre corre**, sin preguntar: IA "¿quién es?", búsqueda social, reverse-image, auto-pivot y correlación facial cross-scan.
- **Persistir se pregunta**: al terminar, `¿archivar en la bóveda? [s/n]`. Si se descarta, la búsqueda fue efímera (solo esa sesión).

## 2. Decisiones tomadas

| Tema | Decisión |
|---|---|
| Almacenamiento | Backend **SQLite** (tablas nuevas junto a `users`), cross-device y consultable. |
| Reverse-image | **SerpApi** tier gratis (100/mes, sin tarjeta). Se dispara en la mejor foto de **cada nodo**. |
| Búsqueda social | Provider `social` con **dorks** (`site:instagram.com` …). Fuente: **scraper gratis DDG+Bing** (ilimitado) **+ SerpApi de refuerzo** cuando quede cuota. |
| Expansión del grafo | **Auto-pivot siempre** (guardes o no), **best-first** con presupuesto `max_nodes` (default 10), no por profundidad fija. |
| Orquestación | **Backend** orquesta el fan-out y emite estructura de grafo en el stream. |
| Cuota/costo | No se limita la inteligencia por cuota. Contadores **informativos** + **costo USD por consulta** y agregado. |

## 3. Arquitectura

```
Búsqueda NL ──► escaneo raíz (providers actuales + provider `social`)
                     │
        ┌────────────┼─────────────┬──────────────────┐
        ▼            ▼             ▼                  ▼
   IA "¿quién es?"  reverse img   auto-pivot        clustering facial
   (existe)         (SerpApi)     (backend,         (navegador, existe)
                        │          best-first)          │
                        └──── grafo en memoria ◄────────┘
                                     │
                          cada cara ─► POST /faces/match  (¿ya en bóveda? %)
                                     │
                              [ done + cost ] ──► ¿archivar? ──► SQLite
```

Todo corre siempre. Lo único tras la pregunta es persistir.

**Estado efímero vs. persistido.** El grafo se arma en memoria/sesión durante el escaneo para poder mostrarlo aunque no se guarde. El backend **no guarda estado de sesión**: al decir "sí", el frontend envía el payload acumulado (nodos + enlaces + descriptores + costo) a `POST /vault/save`. La correlación cross-scan sí consulta en vivo lo ya guardado.

## 4. Modelo de datos (SQLite, todas con `user_id`)

| Tabla | Campos clave | Notas |
|---|---|---|
| `nodes` | `kind, value, label, created_at` · único `(user_id, kind, value)` | un objetivo investigado; re-investigar reusa el nodo (upsert). `kind`: name/username/email/phone/domain/ip/image. |
| `edges` | `src_node_id, dst_node_id, relation, confidence, created_at` | `relation`: `pivot` / `reverse_image` / `same_face` / `manual`. |
| `scans` | `node_id, query, findings_json, ai_report, media_json, elapsed_ms, cost_usd, cost_breakdown_json, created_at` | snapshot de una búsqueda guardada. |
| `faces` | `node_id, scan_id, source, image_url, page_url, descriptor (BLOB 128×float32 = 512 B), created_at` | huellas para correlación cross-scan. |
| `usage` | `provider, endpoint, scan_id, units, tokens_in, tokens_out, cost_usd, created_at` | una fila por llamada medida (SerpApi/OpenAI/TomTom). |

El descriptor lo calcula el navegador (face-api.js, ya existe) y se envía solo al archivar.

## 5. Contrato del backend

Todos protegidos con la auth actual (token por header `Authorization` o `?token=`). Ningún endpoint tumba el escaneo: todo degrada con nota.

### 5.1 `GET /osint/graph/stream?value=…&kind=…` — escaneo con grafo

**Endpoint nuevo** al que el frontend migra el flujo NL (el `/osint/auto/stream` actual puede quedar por compatibilidad, sin pivot). El backend:
1. Corre el escaneo raíz (providers actuales + `social`).
2. Sobre la mejor foto de cada nodo corre `reverse-image` (SerpApi).
3. Expande **best-first**: mantiene una cola de entidades candidatas (usuarios, emails, handles y perfiles hallados por dorks/reverse-image), priorizadas por confianza, y las convierte en nodos hasta agotar `max_nodes` (default 10, env `PIVOT_MAX_NODES`). No hay límite de profundidad; el único tope es el total de nodos.

Emite los eventos actuales (`meta`/`progress`/`finding`/`source_error`/`media`/`ai_report`/`done`) **más**:
- `node` → `{ id, kind, value, label, parent_id }`
- `edge` → `{ src, dst, relation, confidence }`
- El `done` incluye `cost: { usd, breakdown:[{provider, units, tokens, usd}] }`.

### 5.2 `POST /osint/reverse-image` — SerpApi

Body `{ image_url }` (o upload). Llama SerpApi (Google/Yandex reverse). Devuelve `{ matches:[{ url, title, thumbnail, page_url, source }] }`. Agotado/caído → `{ matches:[], note }`. Registra `usage`.

### 5.3 Provider `social` (interno, dorks)

Corre dorks por plataforma (`site:instagram.com`, `site:facebook.com`, `site:linkedin.com/in`, `site:tiktok.com`, `site:x.com OR site:twitter.com`, y consulta plana). Fuente:
- **Base:** HTML de **DuckDuckGo + Bing** (sin key, ilimitado), fusionando y deduplicando.
- **Refuerzo:** si queda cuota SerpApi, algunos dorks también por Google y se fusionan.

Extrae `{ profile_url, handle, platform, title, snippet, image_url? }` por resultado → hallazgos + entidades candidatas para pivot + fotos de perfil al análisis facial.

### 5.4 `POST /faces/match` — correlación cross-scan (siempre)

Body `{ descriptor:[128] }`. Vecino-más-cercano sobre `faces` del usuario (euclidiana < 0.55). Devuelve `{ matches:[{ node_id, kind, value, label, image_url, distance, probability }] }`.

### 5.5 `POST /vault/save` — archivar

Body `{ root, nodes[], edges[], scans:[{…, scan_id}], faces:[{…, descriptor}] }`. Upsert de nodos por `(kind,value)`; inserta edges/scans/faces. El **costo NO lo envía el cliente**: el backend lo deriva sumando las filas de `usage` con ese `scan_id` (ya registradas durante el escaneo, pues la inteligencia siempre corre) y lo guarda en `scans.cost_usd`/`cost_breakdown_json`. Devuelve `{ graph_id }`. Falla → 4xx/5xx controlado (el front reintenta).

### 5.6 Bóveda

- `GET /vault/graph` → `{ nodes[], edges[] }` del usuario.
- `GET /vault/node/{id}` → nodo + sus `scans` y `faces`.
- `DELETE /vault/node/{id}` → borra nodo y sus dependencias.

### 5.7 `GET /usage?period=month|day`

`{ providers:[{ name, used, limit, unit, resets_at, cost_usd }], total_cost_usd, period }`. Precios por env: `OPENAI_PRICE_IN`/`OPENAI_PRICE_OUT` (por 1M tokens), `SERPAPI_PRICE`, `SERPAPI_MONTHLY_LIMIT` (default 100), `TOMTOM_DAILY_LIMIT`.

## 6. Frontend

1. **Reducer de grafo** — consume `node`/`edge` junto a los eventos actuales; arma `{ nodes, edges }` en la entrada de terminal. No rompe el render existente.
2. **`GraphView.jsx` (lazy, chunk aparte como `RouteMap`)** — SVG a mano, paleta violeta Rinnegan; nodos por tipo, enlaces etiquetados por relación, layout radial desde la raíz, nodo clicable para enfocar/expandir; se dibuja en vivo durante el pivoting.
3. **Prompt de guardado (estilo terminal, no modal)** — al `done`: `◈ ¿archivar en la bóveda? [s/n]`. `s` → junta payload + descriptores → `POST /vault/save` → `✓ archivado`. `n` → `— descartado (sesión efímera)`.
4. **Alertas faciales cross-scan (en `MediaGallery`)** — además del % intra-escaneo, `POST /faces/match` por cara; si hay match: badge `⚠ visto antes · <objetivo> · NN%` enlazando al nodo.
5. **Reverse-image en la galería** — fila "aparece también en…" con thumbnail + enlace a la página fuente; sus caras entran al análisis facial.
6. **Bóveda (`boveda`)** — `GET /vault/graph` → dibuja el grafo guardado (reusa `GraphView`) + lista; abrir nodo → `GET /vault/node/{id}`; borrar con confirmación.
7. **Cuotas y costo** — (a) indicador siempre visible en el HUD del header con lo escaso (`serp 63◱ · $0.42`); (b) comando `cuotas`/`uso` → panel con barras por proveedor (usado/límite + renovación) + costo USD del mes; (c) línea de costo en el `done` de cada escaneo, p. ej. `✓ 9 hallazgos · 7.8s · costo $0.014 (openai 3.1k tok $0.004 · serp ×5 $0.010)`.

El router NL (v2) enruta las frases nuevas: `boveda`/`cuotas` como comandos explícitos; el resto sigue cayendo en el escaneo con grafo.

## 7. Manejo de errores (todo degrada, nunca tumba el escaneo)

- SerpApi caído/agotado → `matches:[]` + nota; el grafo sigue con providers gratis.
- Scraper DDG/Bing bloqueado → salta esa plataforma, registra `source_error`, continúa.
- `/faces/match` falla → la galería muestra el % intra-escaneo, sin alerta cross-scan.
- `/vault/save` falla → `⚠ no se pudo archivar`; la sesión sigue en memoria para reintentar.
- Auto-pivot: si un pivot revienta, el nodo se marca en rojo y el resto continúa.

## 8. Testing

**Backend (pytest + respx, todo mockeado):** orquestación best-first con tope `max_nodes`; provider `social` (parseo HTML DDG/Bing + fusión SerpApi + dedupe); reverse-image (SerpApi mock); `/faces/match` (euclidiana + umbral); `/vault/save`+`/vault/graph` roundtrip y upsert por `(kind,value)`; `/usage` y cálculo de costo USD (tokens×precio); degradación de cada fallo; auth (401 sin token). `ruff` limpio.

**Frontend (vitest):** reducer de grafo (eventos node/edge, dedupe); render de alertas cross-scan; flujo del prompt de guardado (s/n → save/discard); panel `cuotas`; línea de costo en `done`. Lazy-split de `GraphView`. Lint/test/build verdes.

## 9. Despliegue por fases

Cada fase = commit(s) de frontend + un prompt de backend que el usuario pasa al agente de backend. Se despliega y verifica antes de la siguiente.

1. **Bóveda + persistencia** — tablas `nodes/edges/scans/faces`, `/vault/*`, prompt de guardado `[s/n]` (sobre el escaneo actual, sin pivot todavía).
2. **Provider social + reverse-image** — dorks DDG/Bing + SerpApi de refuerzo, `/osint/reverse-image`, render en galería.
3. **Grafo + auto-pivot best-first** — `/osint/graph/stream` con eventos `node`/`edge`, `GraphView`, presupuesto `max_nodes`.
4. **Correlación facial cross-scan** — `/faces/match` + alertas en `MediaGallery`.
5. **Cuotas y costo** — tabla `usage`, `/usage`, indicador HUD + panel `cuotas` + costo por escaneo.

Total estimado: ~4-5 prompts de backend.

## 10. Fuera de alcance (v3)

- Sincronización multi-usuario / compartir bóvedas (sigue siendo single-user).
- Enriquecimiento con keys de pago adicionales (HIBP, Censys, AbuseIPDB).
- Layout de grafo avanzado (física/force completa); v3 usa layout radial simple.
- Exportar la bóveda (JSON/CSV) — candidato a v4.
