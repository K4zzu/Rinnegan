# Prompt para el agente de backend — Hito 4: Phone

> Continúa en el MISMO repo `rinnegan-api`. Copia el bloque y pásaselo al agente.

---

Continúas `rinnegan-api`. Hitos 1–3 hechos (núcleo + domain/ip + username + email). Patrón probado: providers aislados, orquestador multiplexa SSE, `registry.py` mapea `category → [providers]`, rutas genéricas. **Este es el Hito 4: categoría `phone`.** No toques el core — solo añade el provider y registra la categoría, como en los hitos previos.

## Objetivo

`GET /osint/phone/stream?value=<numero>` que, dado un número de teléfono, reporta validez, país/región, operador, tipo de línea, zonas horarias y formatos. **Todo local, sin red y sin API key** (usa `phonenumbers`, el port de libphonenumber).

## Contrato (idéntico — respétalo)

Mismos eventos SSE (`meta`, `finding`, `source_error`, `done`; `progress` opcional — este scan es instantáneo, puede no necesitarlo). `type` = `"phone"`. `confidence` high/medium.

```
event: meta
data: {"query":"+573001234567","type":"phone","providers":["libphonenumber"],"started_at":"<ISO8601>"}

event: finding
data: {"provider":"libphonenumber","source":"validity","title":"número válido",
       "data":{"valid":true,"possible":true},"confidence":"high"}

event: done
data: {"summary":{"findings":6,"errors":0,"elapsed_ms":40}}
```

## Provider a implementar (SIN key, sin red)

**`libphonenumber` — `app/providers/phone/libphonenumber_provider.py`** usando el paquete `phonenumbers`:

- **Parseo:** intenta `phonenumbers.parse(value, None)`. Si el número no trae prefijo internacional (`+`) y no se puede parsear sin región, emite un `finding` "formato ambiguo / falta código de país" (no un crash) y termina limpio. Considera aceptar una región por defecto configurable (`PHONE_DEFAULT_REGION`, default `None`).
- Emite estos findings (uno por atributo):
  - `validity` — `is_valid_number` / `is_possible_number`. `confidence:"high"`.
  - `line_type` — `number_type` mapeado a texto (MOBILE, FIXED_LINE, VOIP, etc.). `high`.
  - `location` — `geocoder.description_for_number(num, "es")` (país/región). `confidence:"medium"` (aproximado).
  - `carrier` — `carrier.name_for_number(num, "es")` si hay. `medium` (aproximado, puede venir vacío por portabilidad).
  - `timezones` — `timezone.time_zones_for_number(num)`. `high`.
  - `formats` — un finding con `data` que incluya E164, internacional y nacional (`format_number`). `high`.
- Si un sub-dato no está disponible (carrier vacío, etc.), simplemente no emitas ese finding (no es error).
- Errores inesperados del provider → `source_error` (aislado), y el `done` igual se emite.

## Registro / ruta

- Registra `libphonenumber` bajo `phone` en `registry.py` (lazy import).
- Añade el binding de ruta `phone` siguiendo el patrón de los hitos previos.

## Precisión / honestidad

- `phonenumbers` es determinista para validez/tipo/formatos (→ high). Geocoder y carrier son **aproximados** (bases estáticas; la portabilidad numérica los hace poco fiables) → `medium`.
- No inventes datos: si el número es inválido, dilo claramente en un finding y no fuerces location/carrier.

## Tests (pytest)

- Número válido con prefijo internacional (ej. un `+1...` o `+57...`) → findings de validity(valid), line_type, formats; sin red (phonenumbers es offline).
- Número inválido/ambiguo → finding de "inválido"/"ambiguo", sin excepción, con `done`.
- Provider lanza excepción simulada → `source_error` + `done`.
- `ruff` limpio.

## Criterios de aceptación

1. `GET /osint/phone/stream?value=<numero_válido_con_+>` emite `meta` (provider libphonenumber) → findings → `done`.
2. Número inválido/ambiguo → finding claro, sin crash, escaneo completa.
3. Tests verdes + `ruff` limpio + README actualizado (nota: location/carrier aproximados).

## NO hagas en este hito

- Nada de name/image/IA. No footprint externo (PhoneInfoga/OSINT de redes) — eso es v2. No cambies el protocolo SSE ni el envelope.

Cuando termines: salida real de `curl -N` de un número, conteo de findings, y resultados de `pytest`/`ruff`.
