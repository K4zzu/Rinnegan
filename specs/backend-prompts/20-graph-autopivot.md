# Prompt backend — v3 Fase 3: /osint/graph/stream (auto-pivot best-first + grafo)

> Continúa en el MISMO repo `rinnegan-api`. Copia el bloque y pásaselo al agente.

---

Añade `GET /osint/graph/stream?value=<v>&kind=<k>` (protegido con la auth existente; token por header o `?token=`). Es un escaneo AUTO que además **auto-pivota** y emite la estructura del grafo. NO rompas los endpoints/streams existentes (`/osint/auto/stream` sigue tal cual).

## Comportamiento

1. Corre el escaneo raíz sobre `value` (los providers que apliquen, incluido el `social` de la Fase 2 y el reverse-image sobre la mejor foto).
2. **Auto-pivot best-first:** mantén una cola de entidades candidatas descubiertas (usuarios/handles, emails, dominios, y perfiles hallados por dorks/reverse-image), priorizadas por confianza. Convierte las de mayor confianza en nodos nuevos y escanéalas (providers gratis; reverse-image en la mejor foto de cada nodo, como en Fase 2). Repite hasta agotar el presupuesto **`PIVOT_MAX_NODES`** (env, default 10). No hay límite de profundidad; el único tope es el total de nodos.

## Eventos (protocolo SSE existente + 2 nuevos)

Emite los eventos actuales (`meta`, `progress`, `finding`, `source_error`, `media`, `ai_report`, `done`) igual que `/osint/auto/stream`, MÁS:

- `node` → `{ "id": "n0", "kind": "name", "value": "Carlos Sánchez", "label": "Carlos Sánchez", "parent_id": null }`
  - El nodo raíz lleva `parent_id: null`. Cada pivote lleva el `id` del nodo del que nació. Los `id` son strings temporales estables durante el stream (ej. `n0`, `n1`, …), los mismos que luego el frontend manda a `/vault/save`.
- `edge` → `{ "src": "n0", "dst": "n1", "relation": "pivot", "confidence": 0.8 }`
  - `relation`: `pivot` (derivado del auto-pivot) | `reverse_image` (perfil hallado por reverse-image) | `same_face` (reservado).

Emite el `node` raíz al empezar y cada `node`/`edge` de pivote conforme los descubres (antes o junto a sus findings). El `ai_report` y el `done` se emiten una vez al final (síntesis global). El costo por escaneo llega en una fase posterior.

## Tests (pytest + respx, todo mockeado)

- El stream emite el `node` raíz (`parent_id: null`) y, con entidades pivotables mockeadas, nodos/edges adicionales hasta `PIVOT_MAX_NODES` (verifica el tope).
- Best-first: con confianzas distintas, los nodos de mayor confianza se expanden primero.
- Los eventos existentes (`finding`/`media`/`ai_report`/`done`) siguen emitiéndose.
- Sin token → 401. `ruff` limpio. README.

## Criterios de aceptación

1. `GET /osint/graph/stream` corre auto-pivot best-first con tope `PIVOT_MAX_NODES` (default 10) y emite `node`/`edge` además de los eventos actuales.
2. No rompe `/osint/auto/stream` ni los demás endpoints.
3. Protegido (401 sin token). Tests verdes + `ruff` + README.

## NO hagas

- No elimines `/osint/auto/stream`. No hagas fan-out sin tope (respeta `PIVOT_MAX_NODES`). No añadas todavía `/faces/match` ni `/usage`.
