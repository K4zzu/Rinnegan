# Prompt backend — v3 Fase 1: bóveda (persistencia de investigaciones)

> Continúa en el MISMO repo `rinnegan-api`. Copia el bloque y pásaselo al agente.

---

Añade persistencia para investigaciones guardadas (la "bóveda") sobre el SQLite/SQLAlchemy que ya existe (el mismo `DB_PATH` de la auth). Tablas nuevas + endpoints, todos protegidos con la auth existente (token por header `Authorization` o `?token=`). NO toques la lógica OSINT ni el protocolo de streaming.

## Tablas (todas con `user_id`, creadas al arrancar)

- `nodes`: `id` (pk), `user_id` (fk users), `kind`, `value`, `label`, `created_at`. **Único `(user_id, kind, value)`**.
- `edges`: `id` (pk), `user_id`, `src_node_id` (fk nodes), `dst_node_id` (fk nodes), `relation`, `confidence` (float, nullable), `created_at`.
- `scans`: `id` (pk), `user_id`, `node_id` (fk nodes), `query`, `findings_json`, `media_json`, `ai_report` (text, null), `elapsed_ms` (int, null), `cost_usd` (float, default 0), `cost_breakdown_json` (null), `created_at`.
- `faces`: `id` (pk), `user_id`, `node_id` (fk nodes), `scan_id` (fk scans, null), `source`, `image_url`, `page_url` (null), `descriptor` (BLOB, null), `created_at`.

## Endpoints (todos bajo el usuario actual; 401 sin token)

- `POST /vault/save` — body:
  ```json
  {
    "root": "n0",
    "nodes": [{ "id": "n0", "kind": "name", "value": "Carlos Sánchez", "label": "Carlos Sánchez" }],
    "edges": [{ "src": "n0", "dst": "n1", "relation": "pivot", "confidence": 0.8 }],
    "scans": [{ "node": "n0", "query": "Carlos Sánchez", "findings": [], "media": [], "ai_report": "…", "elapsed_ms": 7800 }],
    "faces": [{ "node": "n0", "source": "github", "image_url": "…", "page_url": "…", "descriptor": [/*128 floats*/] }]
  }
  ```
  Los `id` de nodo y los refs `src/dst/node` son **ids temporales de cliente** (strings). Haz **upsert de cada nodo por `(user_id, kind, value)`**, construye un mapa `temp_id → id_real`, remapea `edges`/`scans`/`faces` y guarda. `findings`/`media` se guardan como JSON. `descriptor` (si viene) es lista de 128 floats → guárdalo como bytes (`struct.pack`). Devuelve `{ "graph_id": <id real del nodo root> }`. `cost_usd` queda en 0 en esta fase (el costo llega en una fase posterior).

- `GET /vault/graph` → `{ "nodes": [{ id, kind, value, label, created_at, scan_count }], "edges": [{ src, dst, relation, confidence }] }` del usuario.

- `GET /vault/node/{id}` → `{ "node": {…}, "scans": [{ id, query, findings, media, ai_report, elapsed_ms, cost_usd, created_at }], "faces": [{ id, source, image_url, page_url }] }`. 404 si el nodo no es del usuario.

- `DELETE /vault/node/{id}` → borra el nodo y sus `edges`/`scans`/`faces`. 204. 404 si no es del usuario.

## Tests (pytest)

- `/vault/save` roundtrip: guardar y leer; **upsert dedupe** (guardar dos veces el mismo `(kind,value)` reusa el nodo, no duplica).
- `/vault/graph` lista nodos+edges con `scan_count`.
- `/vault/node/{id}` devuelve scans+faces; **aislamiento por usuario** (user A no ve/borra nodos de user B → 404).
- `DELETE` borra en cascada.
- Auth: 401 sin token en los cuatro endpoints.
- `ruff` limpio. README actualizado.

## Criterios de aceptación

1. `POST /vault/save` persiste y **deduplica** nodos por `(kind,value)`; remapea refs temporales.
2. `GET /vault/graph`, `GET /vault/node/{id}`, `DELETE /vault/node/{id}` funcionan y respetan pertenencia.
3. Todo protegido (401 sin token). Tests verdes + `ruff` + README.

## NO hagas

- No rompas OSINT/streaming. No expongas datos de otros usuarios. `descriptor` nullable (la correlación facial llega en una fase posterior). No añadas todavía `/faces/match`, `/usage`, ni el grafo con pivot.
