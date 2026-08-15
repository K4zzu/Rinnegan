# Prompt backend — v3 Fase 5: cuotas + costo USD (tabla usage, /usage, cost en done)

> Continúa en el MISMO repo `rinnegan-api`. Copia el bloque y pásaselo al agente.

---

Añade seguimiento de consumo y costo. NO cambies la lógica OSINT; solo instrumenta las llamadas externas medidas y añade un endpoint + un campo `cost` al evento `done`. Protegido con la auth existente.

## Tabla `usage` (con `user_id`, creada al arrancar)

`id` (pk), `user_id`, `provider` (`serpapi`|`openai`|`tomtom`), `endpoint` (str), `scan_id` (str, nullable), `units` (int, default 1), `tokens_in` (int, null), `tokens_out` (int, null), `cost_usd` (float, default 0), `created_at`.

## Instrumentación

Envuelve las llamadas externas medidas para insertar una fila `usage` por llamada, calculando `cost_usd` con precios de env:
- `OPENAI_PRICE_IN`, `OPENAI_PRICE_OUT` (USD por 1M tokens; usa los tokens reales de la respuesta). `provider="openai"`.
- `SERPAPI_PRICE` (USD por búsqueda; 0 en tier gratis). `provider="serpapi"`, `units=1` por búsqueda.
- `tomtom` (0 dentro del tier). `provider="tomtom"`, `units=1` por request.
- `SERPAPI_MONTHLY_LIMIT` (default 100), `TOMTOM_DAILY_LIMIT` (default 2500) — solo para mostrar el límite.

Cada escaneo (los streams `/osint/*/stream` y `/osint/graph/stream`) genera un `scan_id` (string) al empezar; propágalo a las llamadas medidas de ese escaneo para etiquetar sus filas `usage`. `/interpret`, `/route`, `/img` etc. usan `scan_id=null`.

## `cost` en el evento `done`

Al emitir `done` de un escaneo, incluye:
```json
{ "summary": { "findings": 9, "errors": 1, "elapsed_ms": 7800 },
  "cost": { "usd": 0.014, "breakdown": [
    { "provider": "openai", "units": 1, "tokens": 3100, "usd": 0.004 },
    { "provider": "serpapi", "units": 5, "tokens": null, "usd": 0.010 } ] } }
```
`cost` = suma de las filas `usage` con ese `scan_id`. Si no hubo costo, `cost: { "usd": 0, "breakdown": [] }`.

## `GET /usage?period=month|day`

Devuelve:
```json
{ "period": "month",
  "providers": [
    { "name": "serpapi", "used": 37, "limit": 100, "unit": "búsquedas", "resets_at": "2026-09-01", "cost_usd": 0 },
    { "name": "openai", "used": 128000, "limit": null, "unit": "tokens", "resets_at": null, "cost_usd": 0.42 },
    { "name": "tomtom", "used": 14, "limit": 2500, "unit": "requests", "resets_at": "medianoche", "cost_usd": 0 } ],
  "total_cost_usd": 0.42 }
```
`used`/`cost_usd` agregados por proveedor en el periodo (SerpApi: mes; TomTom: día). `resets_at` legible.

## Tests (pytest)

- Insertar filas `usage` mockeadas → `GET /usage` agrega correctamente por proveedor y periodo; `total_cost_usd` suma.
- Aislamiento por usuario. Sin token → 401.
- Un escaneo con filas `usage` mockeadas para su `scan_id` → el `done` incluye `cost.usd` = suma y `breakdown` por proveedor.
- `ruff` limpio. README.

## Criterios de aceptación

1. Tabla `usage` + instrumentación de SerpApi/OpenAI/TomTom con `cost_usd` por precios de env.
2. `GET /usage` agrega por proveedor/periodo con límites y `total_cost_usd`.
3. El `done` de los escaneos incluye `cost` (suma por `scan_id`).
4. Aislamiento por usuario; 401 sin token. Tests + `ruff` + README.

## NO hagas

- No rompas los eventos existentes (solo AÑADES `cost` al `done`). No expongas precios como secretos (son env). No bloquees escaneos por cuota (solo informas).
