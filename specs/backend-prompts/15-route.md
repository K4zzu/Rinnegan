# Prompt para el agente de backend — v2: endpoint /route (ruta + ETA con tráfico)

> Continúa en el MISMO repo `rinnegan-api`. Copia el bloque y pásaselo al agente.

---

Añade un endpoint `POST /route` que, dado un texto libre (o coordenadas), calcula una ruta con **ETA y tráfico actual** vía **Mapbox Directions**, extrayendo los parámetros del texto con **OpenAI**. No cambies la lógica OSINT ni el protocolo de eventos; es un endpoint nuevo, protegido con la auth existente.

## Config

- `MAPBOX_TOKEN` (env, obligatorio para este endpoint). Sin él → responde error claro (503 `{"detail":"route: falta MAPBOX_TOKEN"}`).
- Reusa `OPENAI_API_KEY` / `OPENAI_MODEL` ya existentes.

## Endpoint

`POST /route` — **protegido** (misma dependencia de auth; 401 sin token). Body, uno de:
- `{ "text": "<frase libre>" }` — ej: "mi amigo sale en 4 min desde 4.651,-74.056, nos vemos en 4.667,-74.062, va en moto".
- `{ "origin": {"lat":..,"lng":..}, "dest": {"lat":..,"lng":..}, "mode": "car|moto|bike|walk", "depart_in_min": 4 }` — ya estructurado (salta OpenAI).

### Flujo

1. Si viene `text`: **OpenAI** extrae `{ origin{lat,lng}, dest{lat,lng}, mode, depart_in_min }`. Instruye al modelo: devolver JSON estricto; aceptar coords "lat,lng", links de Google Maps (extraer coords), y frases en español; `mode` por defecto `"car"`, `depart_in_min` por defecto `0`. Si no logra coords válidas → 422 `{"detail":"no pude entender las coordenadas de origen/destino"}`.
2. Valida coords (lat ∈ [-90,90], lng ∈ [-180,180]).
3. Mapea modo → perfil Mapbox: `car`/`moto` → `driving-traffic`; `bike` → `cycling`; `walk` → `walking`.
4. Llama **Mapbox Directions**:
   `GET https://api.mapbox.com/directions/v5/mapbox/{profile}/{oLng},{oLat};{dLng},{dLat}?access_token={MAPBOX_TOKEN}&geometries=geojson&overview=full&steps=true&annotations=congestion,duration,distance`
   (driving-traffic ya usa el tráfico actual). Sin ruta → 404; error HTTP de Mapbox → 502, con detalle.
5. Deriva `traffic_level` de la relación `duration_traffic` vs `duration_typical` (o de `congestion`): `low` (<1.15x), `moderate` (1.15–1.4x), `heavy` (>1.4x). Si el perfil no da "typical" (no-driving), usa `low`.

### Respuesta (contrato exacto que consume el frontend)

```json
{
  "origin": { "lat": 4.651, "lng": -74.056 },
  "dest":   { "lat": 4.667, "lng": -74.062 },
  "mode": "driving-traffic",
  "mode_label": "moto",
  "depart_in_min": 4,
  "requested_at": "ISO8601",
  "distance_m": 5230,
  "duration_traffic_s": 980,
  "duration_typical_s": 820,
  "eta_iso": "ISO8601",
  "traffic_level": "moderate",
  "geometry": { "type": "LineString", "coordinates": [[lng,lat], ...] },
  "steps": [ { "instruction": "Gira a la derecha…", "distance_m": 120, "duration_s": 30 } ]
}
```

- `mode_label`: el modo que pidió el usuario en palabras (car/moto/bike/walk), para el HUD.
- `eta_iso` = `requested_at + depart_in_min*60 + duration_traffic_s`.
- `duration_typical_s`: la duración sin tráfico si Mapbox la da (`duration` base); si no, igual a la de tráfico.
- `geometry`: la LineString completa (`overview=full`).

## Tests (pytest)

- OpenAI **mockeado**: una frase de ejemplo → params esperados; frase sin coords → 422.
- Mapbox **mockeado** (respx) con una respuesta de ejemplo (geometry + durations + congestion) → contrato correcto (distance/duration/eta/traffic_level/geometry).
- Body estructurado (sin `text`) → no llama a OpenAI, sí a Mapbox.
- Coords fuera de rango → 422. Sin `MAPBOX_TOKEN` → 503. Sin token de auth → 401.
- `ruff` limpio.

## Criterios de aceptación

1. `POST /route {text}` con auth → contrato completo con geometry, ETA y traffic_level.
2. `POST /route {origin,dest,mode,depart_in_min}` funciona sin OpenAI.
3. Errores claros: 422 (coords), 404 (sin ruta), 502 (Mapbox), 503 (sin token), 401 (sin auth).
4. Tests verdes (OpenAI+Mapbox mockeados) + `ruff` + README (endpoint, `MAPBOX_TOKEN`, cómo obtenerlo gratis).

## NO hagas

- No expongas `MAPBOX_TOKEN` en respuestas. No cambies el protocolo SSE/envelope de OSINT. No hagas streaming aquí (respuesta JSON única). No añadas rastreo real de personas (el tracker vive en el frontend como estimación).

Cuando termines: `curl` de `POST /route` con una frase y con body estructurado, y `pytest`/`ruff`.
