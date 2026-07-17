# Rinnegan v2 — Ruta + ETA con tráfico + tracker estimado + voz — Design / Contract

**Status:** Approved design. Contract for backend (`rinnegan-api`) + frontend (this repo).
**Scope:** un comando `ruta` que, dado un texto libre (o coordenadas), calcula ruta y ETA **con tráfico** (Mapbox), muestra un **mapa estética terminal** (MapLibre) con la trayectoria y un **marcador de posición estimada** que avanza en tiempo real; más un **botón de voz** para dictar comandos.

---

## 1. Purpose

Poder decir/escribir "mi amigo sale en 4 min desde \<coords\>, nos vemos en \<coords\>, va en moto" y ver: la ruta en un mapa con estilo terminal, el ETA con tráfico actual, la hora de llegada, y un marcador que **estima dónde iría el vehículo ahora** (avanzando por la ruta según el tiempo transcurrido). El botón de voz evita escribir la frase larga.

**Honestidad:** el tracker es una **posición estimada** sobre la ruta (dead-reckoning con el ETA), NO el GPS real de la persona.

## 2. Entrada + parseo de lenguaje natural

- **Comando `ruta <texto>`** (alias `route`). Acepta:
  - Texto libre en español (el ejemplo de arriba).
  - Directo: `ruta 4.651,-74.056 -> 4.667,-74.062 moto`.
  - Links de Google Maps pegados (se extraen las coordenadas).
- El **backend usa OpenAI** para extraer del texto: `{ origin{lat,lng}, dest{lat,lng}, mode, depart_in_min }`.
  - `mode` por defecto **"car"**. Mapeo a perfiles Mapbox: `car`/`moto` → `driving-traffic`; `bike` → `cycling`; `walk` → `walking`. (Moto ≈ auto en Mapbox; se aclara en el HUD.)
  - `depart_in_min` por defecto 0.
  - Si OpenAI no logra extraer coords válidas → error claro ("no pude entender las coordenadas de origen/destino").

## 3. Servicio de ruta (backend)

`POST /route` (protegido con auth, como el resto). Body: `{ "text": "<frase>" }` **o** `{ origin, dest, mode, depart_in_min }` ya estructurado (salta OpenAI).

Flujo: (1) si viene `text`, OpenAI extrae params; (2) valida coords; (3) llama **Mapbox Directions** perfil según modo, con `geometries=geojson`, `overview=full`, `annotations=congestion,duration,distance`, tráfico en vivo (driving-traffic); (4) responde el contrato:

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
  "eta_iso": "ISO8601",            // requested_at + depart_in_min + duration_traffic
  "traffic_level": "low|moderate|heavy",
  "geometry": { "type": "LineString", "coordinates": [[lng,lat], ...] },
  "steps": [ { "instruction": "...", "distance_m": 120, "duration_s": 30 } ]
}
```

- `traffic_level`: derivado de `duration_traffic` vs `duration_typical` (o de las anotaciones `congestion`).
- Errores: coords inválidas → 422 con detalle; Mapbox falla/sin ruta → 502/404 con detalle; sin `MAPBOX_TOKEN` → error de credencial claro.
- Config: `MAPBOX_TOKEN` (env). Reusa `OPENAI_API_KEY`.

## 4. Frontend — mapa estética terminal + tracker

- **Dependencia:** `maplibre-gl`. Tiles **gratis sin key** (OpenFreeMap), estilo **oscuro** tintado a terminal (líneas mínimas, etiquetas discretas, acento violeta).
- **Comando `ruta`** → `POST /route` (no-streaming) → empuja una entrada de historial tipo `route` con el payload. Estado "calculando ruta…" mientras responde.
- **Componente `RouteMap`** (bloque HUD ~360px en el flujo de la terminal):
  - Marcadores de **origen** y **destino**; ruta como **línea con glow**; marcador de **posición estimada**.
  - **HUD overlay**: distancia · ETA con tráfico · hora de llegada · `traffic_level` · `mode_label` · cuenta regresiva "llega en ~X min" · "posición estimada: N% de la ruta".
  - **Tracker**: al montar, *fly-through* que dibuja la ruta y encuadra; luego el marcador refleja la **posición estimada en tiempo real**:
    - `departure = requested_at + depart_in_min`.
    - `elapsed = now - departure`. Si `elapsed < 0` → marcador en el origen, "sale en X min".
    - `frac = clamp(elapsed / duration_traffic_s, 0, 1)`; posición = punto sobre la geometría a `frac` de la longitud total (interpolación por distancia). Actualiza cada 1s.
    - Al llegar a 1.0 → "llegada estimada alcanzada".
  - `prefers-reduced-motion`: sin fly-through (encuadre directo).

## 5. Voz (frontend)

- **Botón de micrófono** en la línea del prompt. **Web Speech API** (`SpeechRecognition` / `webkitSpeechRecognition`), idioma `es-CO` (fallback `es-ES`).
- Clic → escuchando (pulso + sonido); resultados **interinos** se muestran en vivo en el input; el resultado final queda en el input para **revisar y dar Enter** (no auto-envía).
- Sirve para **cualquier comando**. Sin backend, sin key.
- **Sin soporte** (Firefox, etc.) → el botón se **oculta**. Nota de privacidad: en Chrome el audio se procesa en el servicio de voz del navegador (Google).

## 6. Cuentas / claves

| Servicio | Dónde | Cuenta |
|---|---|---|
| **Mapbox Directions** (routing+tráfico) | backend `.env` `MAPBOX_TOKEN` | **Sí, gratis** (100k/mes) |
| OpenAI (extracción NL) | backend (ya está) | ya la tiene |
| Tiles del mapa (OpenFreeMap) | frontend | no |
| Voz (Web Speech API) | frontend | no |

## 7. Testing

- **Backend:** parseo NL con OpenAI **mockeado** (frase → params); Mapbox **mockeado** (respx) → contrato correcto (distance/duration/geometry/traffic_level); coords inválidas → 422; sin `MAPBOX_TOKEN` → error claro; auth exigido (401 sin token).
- **Frontend:** el comando `ruta` llama a `planRoute` y empuja la entrada `route`; cálculo de la posición estimada (`frac` por tiempo) con tiempos simulados; botón de voz con `SpeechRecognition` **mockeado** (transcript → input); navegador sin soporte → botón ausente.

## 8. Limitaciones honestas

- **Tracker = estimación**, no GPS real de la persona.
- Tráfico y ETA son de Mapbox (buenos, no perfectos). "Moto" se rutea como auto.
- Web Speech API: solo Chrome/Edge/Chrome-Android; el audio pasa por el servicio del navegador.
- El mapa depende de tiles de OpenFreeMap (servicio externo gratuito).

## 9. Orden de implementación

1. **Backend `/route`** (OpenAI extract + Mapbox + contrato + tests). Prompt para el agente.
2. **Frontend**: `planRoute` + comando `ruta` + `RouteMap` (MapLibre) + tracker.
3. **Frontend**: botón de voz (Web Speech API).
