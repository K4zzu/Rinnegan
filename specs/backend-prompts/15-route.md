# Prompt para el agente de backend — v2: endpoint /route (ruta + ETA con tráfico, TomTom)

> Continúa en el MISMO repo `rinnegan-api`. Copia el bloque y pásaselo al agente.

---

Añade un endpoint `POST /route` que, dado un texto libre (o coordenadas), calcula una ruta con **ETA y tráfico actual** vía **TomTom Routing API**, extrayendo los parámetros del texto con **OpenAI**. No cambies la lógica OSINT ni el protocolo de eventos; es un endpoint nuevo, protegido con la auth existente.

## Config

- `TOMTOM_API_KEY` (env, obligatorio para este endpoint). Sin él → 503 `{"detail":"route: falta TOMTOM_API_KEY"}`.
- Reusa `OPENAI_API_KEY` / `OPENAI_MODEL`.

## Endpoint

`POST /route` — **protegido** (misma dependencia de auth; 401 sin token). Body, uno de:
- `{ "text": "<frase libre>" }` — ej: "mi amigo sale en 4 min desde 4.651,-74.056, nos vemos en 4.667,-74.062, va en moto".
- `{ "origin": {"lat":..,"lng":..}, "dest": {"lat":..,"lng":..}, "mode": "car|moto|bike|walk", "depart_in_min": 4 }`.

### Flujo

1. Si viene `text`: **OpenAI** extrae `{ origin{lat,lng}, dest{lat,lng}, mode, depart_in_min }`. Instrucciones: JSON estricto; aceptar "lat,lng", links de Google Maps (extraer coords), frases en español; `mode` default `"car"`, `depart_in_min` default `0`. Sin coords válidas → 422 `{"detail":"no pude entender las coordenadas de origen/destino"}`.
2. Valida coords (lat ∈ [-90,90], lng ∈ [-180,180]).
3. Mapea modo → `travelMode` de TomTom: `car`→`car`, `moto`→`motorcycle`, `bike`→`bicycle`, `walk`→`pedestrian`.
4. Llama **TomTom Calculate Route** (tráfico en vivo):
   `GET https://api.tomtom.com/routing/1/calculateRoute/{oLat},{oLng}:{dLat},{dLng}/json?key={TOMTOM_API_KEY}&travelMode={travelMode}&traffic=true&routeType=fastest&computeTravelTimeFor=all`
   - Sin ruta → 404; error HTTP de TomTom → 502, con detalle.
5. De la respuesta (`routes[0]`):
   - `summary.lengthInMeters` → `distance_m`.
   - `summary.travelTimeInSeconds` (con tráfico) → `duration_traffic_s`.
   - `summary.noTrafficTravelTimeInSeconds` → `duration_typical_s` (si falta, usa el de tráfico).
   - `summary.trafficDelayInSeconds` → para `traffic_level`.
   - **Geometría:** concatena `legs[].points` (cada punto `{latitude, longitude}`) → GeoJSON `LineString` con coords `[lng, lat]`.
6. `traffic_level` desde el ratio tráfico/normal (o el delay): `low` (<1.15x o delay pequeño), `moderate` (1.15–1.4x), `heavy` (>1.4x).

### Respuesta (contrato exacto — NO cambia respecto al diseño; solo cambió el proveedor)

```json
{
  "origin": { "lat": 4.651, "lng": -74.056 },
  "dest":   { "lat": 4.667, "lng": -74.062 },
  "mode": "motorcycle",
  "mode_label": "moto",
  "depart_in_min": 4,
  "requested_at": "ISO8601",
  "distance_m": 5230,
  "duration_traffic_s": 980,
  "duration_typical_s": 820,
  "eta_iso": "ISO8601",
  "traffic_level": "moderate",
  "geometry": { "type": "LineString", "coordinates": [[lng,lat], ...] },
  "steps": []
}
```

- `mode` = el `travelMode` de TomTom; `mode_label` = el que pidió el usuario (car/moto/bike/walk).
- `eta_iso` = `requested_at + depart_in_min*60 + duration_traffic_s`.
- `geometry` en formato **GeoJSON LineString** `[lng,lat]` (el frontend lo dibuja directo con MapLibre).
- `steps`: opcional (TomTom puede dar guidance con `instructionsType=text`); puede ir `[]`.

## Tests (pytest)

- OpenAI **mockeado**: frase → params; frase sin coords → 422.
- TomTom **mockeado** (respx) con una respuesta de ejemplo (summary + legs.points) → contrato correcto (distance/duration/geometry en [lng,lat]/traffic_level/eta).
- Body estructurado (sin `text`) → no llama a OpenAI, sí a TomTom.
- Coords fuera de rango → 422. Sin `TOMTOM_API_KEY` → 503. Sin auth → 401.
- `ruff` limpio.

## Criterios de aceptación

1. `POST /route {text}` con auth → contrato completo con geometry (GeoJSON [lng,lat]), ETA y traffic_level.
2. `POST /route {origin,dest,mode,depart_in_min}` funciona sin OpenAI. `moto` → `travelMode=motorcycle`.
3. Errores claros: 422 (coords), 404 (sin ruta), 502 (TomTom), 503 (sin key), 401 (sin auth).
4. Tests verdes (OpenAI+TomTom mockeados) + `ruff` + README (endpoint, `TOMTOM_API_KEY`, cómo obtenerlo gratis en developer.tomtom.com).

## NO hagas

- No expongas `TOMTOM_API_KEY` en respuestas. No cambies el protocolo SSE/envelope de OSINT. No streaming aquí (JSON único). El "tracking" real vive en el frontend como estimación.

Cuando termines: `curl` de `POST /route` con una frase y con body estructurado, y `pytest`/`ruff`.
