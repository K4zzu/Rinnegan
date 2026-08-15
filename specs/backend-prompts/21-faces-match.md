# Prompt backend — v3 Fase 4: POST /faces/match (correlación facial cross-scan)

> Continúa en el MISMO repo `rinnegan-api`. Copia el bloque y pásaselo al agente.

---

Añade `POST /faces/match` (protegido con la auth existente; token por header o `?token=`). Compara un descriptor facial contra las caras guardadas del usuario (tabla `faces`, ya creada en la Fase 1) y devuelve las coincidencias. La tabla `faces` ya guarda `descriptor` (BLOB de 128 floats vía `struct.pack`) cuando el frontend lo manda en `/vault/save`; aquí solo se consulta.

## Endpoint

`POST /faces/match`, body `{ "descriptor": [/* 128 floats */] }`.

- Recorre las `faces` del usuario actual con `descriptor` no nulo; desempaqueta cada BLOB a 128 floats.
- Calcula la **distancia euclidiana** entre el descriptor de entrada y cada cara guardada.
- Considera coincidencia si `distancia < 0.55` (env opcional `FACE_MATCH_THRESHOLD`, default 0.55).
- Ordena por distancia ascendente. Devuelve, uniendo con `nodes`/`scans` para el contexto:

```json
{ "matches": [
  { "node_id": 12, "kind": "name", "value": "Carlos Sánchez", "label": "Carlos Sánchez",
    "image_url": "…", "distance": 0.41, "probability": 84 }
] }
```

- `probability` = entero 0–100 derivado de la distancia (p. ej. `round((1 - distancia/0.55) * 100)` acotado a [0,100]).
- Sin coincidencias → `{ "matches": [] }`. Sin token → 401. Nunca 500 por datos vacíos.
- Ligero en RAM: es solo aritmética de vectores en Python (numpy si ya está, o loop). No cargues ML.

## Tests (pytest)

- Con caras guardadas mockeadas (dos personas distintas), un descriptor cercano a una devuelve esa como match con `distance < 0.55` y `probability` alto; un descriptor lejano → `matches: []`.
- Solo compara contra caras del usuario actual (aislamiento por `user_id`).
- Sin token → 401. `ruff` limpio. README.

## Criterios de aceptación

1. `POST /faces/match {descriptor}` devuelve las caras guardadas del usuario dentro del umbral, con `node_id`/`value`/`label`/`image_url`/`distance`/`probability`, ordenadas por distancia.
2. Aislamiento por usuario; 401 sin token; nunca 500 por vacío. Tests + `ruff` + README.

## NO hagas

- No recalcules descriptores en el server (llegan del navegador). No compares contra caras de otros usuarios. No añadas todavía `/usage`.
