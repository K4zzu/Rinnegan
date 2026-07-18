# Prompt para el agente de backend — Migrar /route de Mapbox a TomTom

> Continúa en el MISMO repo `rinnegan-api`. Copia el bloque y pásaselo al agente.

---

Ya implementaste el endpoint `POST /route` usando **Mapbox Directions**. **Migra el proveedor a TomTom** (Mapbox exige tarjeta de crédito; TomTom da tráfico en free tier sin tarjeta y con modo moto nativo). **NO cambies el contrato de respuesta ni el resto del flujo** (OpenAI para extraer params, auth, validación de coords, manejo de errores): el frontend consume el mismo JSON. Solo cambia la parte del proveedor.

## Cambios puntuales

### 1. Config

- Elimina `MAPBOX_TOKEN`. Añade **`TOMTOM_API_KEY`** (env, en `config.py` y `.env.example`).
- Sin `TOMTOM_API_KEY` → 503 `{"detail":"route: falta TOMTOM_API_KEY"}`.

### 2. Mapeo de modo → `travelMode` de TomTom

`car`→`car`, `moto`→`motorcycle`, `bike`→`bicycle`, `walk`→`pedestrian`.

### 3. Llamada a TomTom (reemplaza la de Mapbox)

`GET https://api.tomtom.com/routing/1/calculateRoute/{oLat},{oLng}:{dLat},{dLng}/json`
con query: `key={TOMTOM_API_KEY}`, `travelMode={travelMode}`, `traffic=true`, `routeType=fastest`, `computeTravelTimeFor=all`.
- Sin ruta → 404; error HTTP de TomTom → 502 (con detalle).

### 4. Mapeo de la respuesta de TomTom → el MISMO contrato

De `routes[0]`:
- `summary.lengthInMeters` → `distance_m`
- `summary.travelTimeInSeconds` → `duration_traffic_s`
- `summary.noTrafficTravelTimeInSeconds` → `duration_typical_s` (si falta, = tráfico)
- `summary.trafficDelayInSeconds` → para `traffic_level`
- **geometry**: concatena `legs[].points` (cada uno `{latitude, longitude}`) → GeoJSON `LineString` con coords **`[lng, lat]`** (ese orden).
- `mode` = el `travelMode` de TomTom; `mode_label` = la palabra que pidió el usuario (car/moto/bike/walk).
- `traffic_level`: `low` (<1.15x típico o delay pequeño), `moderate` (1.15–1.4x), `heavy` (>1.4x).
- `eta_iso`, `distance_m`, `duration_*`, `origin`, `dest`, `depart_in_min`, `steps` (puede quedar `[]`): igual que antes.

**El contrato de respuesta NO cambia** (mismos campos que ya devolvías con Mapbox).

### 5. Tests

- Reemplaza el mock de Mapbox por un mock de **TomTom** (respx) con una respuesta de ejemplo (`summary` + `legs[].points`). Verifica: `distance_m`, `duration_traffic_s`, `geometry` en `[lng,lat]`, `traffic_level`, `mode=motorcycle` cuando el input es "moto".
- Actualiza los casos de error: sin `TOMTOM_API_KEY` → 503; TomTom sin ruta → 404; error TomTom → 502. (OpenAI/coords/auth iguales.)

### 6. README

Reemplaza las menciones de Mapbox/`MAPBOX_TOKEN` por TomTom/`TOMTOM_API_KEY` y cómo obtener la key gratis en developer.tomtom.com.

## Criterio de aceptación

`POST /route {text}` (con `TOMTOM_API_KEY` en env) devuelve el mismo contrato de siempre pero con datos de TomTom (geometry GeoJSON `[lng,lat]`, tráfico real). `moto` → `travelMode=motorcycle`. Tests verdes (TomTom mockeado) + `ruff`. Sin restos de Mapbox en el código ni en la config.

Cuando termines: `curl` de `POST /route` con una frase, confirmando `geometry`, `traffic_level` y `mode`, y `pytest`/`ruff`.
