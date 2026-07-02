# Prompt para el agente de backend — Hito 3: Email

> Continúa en el MISMO repo `rinnegan-api`. Copia el bloque y pásaselo al agente.

---

Continúas `rinnegan-api`. Hitos 1 y 2 hechos (núcleo + domain/ip + username). El patrón está probado: providers aislados, orquestador multiplexa SSE, `registry.py` mapea `category → [providers]`, rutas genéricas. **Este es el Hito 3: categoría `email`.** No toques el core (orchestrator/envelope/events/base) — solo añade providers y registra la categoría, como en el Hito 2.

## Objetivo

`GET /osint/email/stream?value=<email>` que reporta en vivo: si el email es válido/entregable, su reputación/exposición, y en qué sitios está registrado. Todo **sin API key**.

## Contrato (idéntico — respétalo)

Mismos eventos SSE (`meta`, `progress`, `finding`, `source_error`, `done`; sin `ai_report`). `type` = `"email"`. Un `finding` por señal encontrada. `data.url` cuando aplique. `confidence` high/medium/low.

## Providers a implementar (todos SIN key)

**`validator` — `app/providers/email/validator_provider.py`**
- Usa `email-validator` con verificación de entregabilidad (chequeo de MX).
- Findings: validez sintáctica, dominio normalizado, si el dominio tiene MX (y cuáles). `confidence:"high"`.
- Si es inválido, emite un `finding` diciéndolo (no un error) y el resto de providers puede igual intentar.
- Es rápido y local (salvo la consulta MX). Buen "primer finding" inmediato.

**`emailrep` — `app/providers/email/emailrep_provider.py`**
- Consulta `https://emailrep.io/{email}` (GET, sin key a bajo rate). **Envía un User-Agent descriptivo** (emailrep lo pide).
- Findings a partir de la respuesta: reputación (`reputation`), si fue visto en brechas/pastes (`details.credentials_leaked`, `data_breach`), perfiles/redes detectados (`details.profiles`), señales de malicioso/spam.
- **Rate limit:** si responde 429, emite `source_error` ("emailrep rate limited") y sigue — NO reintentes en bucle.
- `confidence`: `high` para señales duras (breach conocido), `medium` para reputación/perfiles.

**`holehe` — `app/providers/email/holehe_provider.py`**
- Comprueba en ~120 sitios si el email está **registrado** (vía endpoints de recuperación de contraseña, sin alertar al objetivo). Úsalo como **librería async importable** por módulo.
- Un `finding` por sitio donde el email existe (`data.site`, `data.url` si el módulo lo da). Emite `progress` (checked/total) conforme avanza.
- ⚠️ **Holehe está semi-abandonado**: muchos módulos se rompen. **Envuelve cada módulo/site en su propio try/except**; un módulo que revienta se ignora (cuenta en checked, no tumba nada). Si Holehe entero falla al importar/correr → `source_error` y seguir.
- `confidence:"medium"` (fuente poco fiable por el abandono).
- Aislado y con timeout propio (`HOLEHE_TIMEOUT`, default ~40s).

## Registro / ruta

- Registra `validator`, `emailrep`, `holehe` bajo `email` en `registry.py`.
- Añade el binding de ruta `email` siguiendo el patrón de `username`. Sin `extra` especiales en este hito (los tres corren por defecto).

## Precisión / honestidad

- `validator` es fiable; `emailrep` es señal razonable; `holehe` es best-effort y ruidoso por su abandono → por eso `medium` y aislamiento por módulo.
- No hay fuente gratis real de "email → brechas" completa; `emailrep` es lo mejor sin key. No prometas exhaustividad.

## Tests (pytest + respx / mock)

- `validator`: email válido con MX (mock del resolver) → finding válido; inválido → finding "inválido", sin excepción.
- `emailrep`: respx mockea 200 con payload de ejemplo → findings esperados; mockea 429 → `source_error`, sin romper.
- `holehe`: mockea el runner con algunos sites "registrado" y otros no, y un módulo que lanza excepción → solo los positivos son findings, el que revienta se ignora, se emite `progress`, y el `done` sale bien.
- `ruff` limpio.

## Criterios de aceptación

1. `GET /osint/email/stream?value=<email_real>` emite `meta` (providers: validator, emailrep, holehe) → findings en vivo → `done`.
2. Email inválido → finding "inválido" (no crash), y el escaneo completa.
3. `emailrep` con 429 → `source_error` aislado; el resto sigue.
4. Un módulo de holehe que falla no tumba el escaneo.
5. Tests verdes (sin red real) + `ruff` limpio + README actualizado (incl. nota de que holehe es best-effort).

## NO hagas en este hito

- Nada de phone/name/image/IA. No cambies el protocolo SSE ni el envelope. No reintentos agresivos contra emailrep.

Cuando termines: salida real de `curl -N` de un email, conteo de findings por provider, y resultados de `pytest`/`ruff`.
