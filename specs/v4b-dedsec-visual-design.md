# v4b — Rebrand DedSec + panel-teatro en vivo (diseño)

> Fecha: 2026-09-08 · Estado: aprobado (brainstorming) · Sub-proyecto 2 de v4.

## 1. Propósito

Dar a Rinnegan la estética **hacker/DedSec** que el usuario pidió, y hacer **visibles las operaciones** que hace el sistema mientras trabaja (no solo esperar el resultado): un panel-teatro en vivo que muestra el razonamiento, la comparación de caras y los contadores en tiempo real. Se monta sobre los eventos que v3/v4 ya emiten (`reasoning`, `finding`, `media`, etc.).

## 2. Decisiones tomadas (brainstorming, con companion visual)

| Tema | Decisión |
|---|---|
| Estética | **Rebrand DedSec completo**, paleta **C**: verde ácido `#c8ff2f` + magenta/rojo `#ff004d` + cian `#00e5ff` sobre base grunge oscura `#0b0b0d`; glitch agresivo, scanlines, textura spray, detalles sticker. |
| Identidad | **Se conserva "Rinnegan" + el ojo/GodEye**, re-skineados en clave grunge/glitch. No se cambia el concepto. |
| Estructura | **Panel-teatro dedicado en vivo** (aparece durante el escaneo, colapsa al terminar). |
| Layout del panel | **B · Consola dividida**: razonamiento (izq), caras + contadores (der), providers activos (abajo). |
| Inspiración | DedSec como *inspiración* (glitch/graffiti/neón); **motivo original**, NO el logo/assets de Ubisoft. |

## 3. Arquitectura

Todo frontend + sonidos. Dos capas:
- **2A · Lenguaje visual DedSec** — tokens de paleta C + utilidades/keyframes de movimiento (glitch/datamosh/scanline/grunge) en `index.css`; re-skin dirigido de los componentes de identidad; sonidos DedSec.
- **2B · `LiveTheater`** — la consola dividida que consume el **estado en vivo** del escaneo, expuesto por `useTerminal` como `liveScan`.

```
beginScan(handlers) ── actualiza ──► liveScan {status, reasoning, findings, providers, media, startedAt}
        │ (isProcessing = true)                 │
        ▼                                        ▼
   stream SSE (eventos existentes)      <LiveTheater liveScan={…} />  (consola dividida DedSec)
        │ done                                   │ done → colapsa
        ▼                                        ▼
   history (ScanEntry/DossierView/…, re-skineados)   resultados quedan en el stream
```

## 4. Sub-proyecto 2A — Lenguaje visual DedSec

- **Tokens (`src/index.css`):** reemplazar la paleta violeta actual por la paleta C (fondo grunge, verde/magenta/cian). Definir variables CSS (`--ds-bg`, `--ds-neon`, `--ds-magenta`, `--ds-cyan`, `--ds-dim`). El tema por defecto de la app pasa a "dedsec" (actualizar `theme.colors.*` — `bannerText`, `headerText`, `outputText`, `errorText`, etc. — que los componentes ya consumen).
- **Utilidades/keyframes:** clases reutilizables `.glitch` (text-shadow doble neón + jitter opcional), `.scanlines` (overlay repeating-gradient), `.grunge` (textura spray via gradientes), `.datamosh` (transición de aparición glitch). Todas **gated por `prefers-reduced-motion`** (como ya hace el CSS actual): con movimiento reducido, se ven los colores/estáticos pero sin jitter/parpadeo.
- **Re-skin dirigido:** `GodEye.jsx` (ojo con glitch/neón), boot loader + `AsciiBanner`, `LoginPanel`, header de `Terminal`, `ScanEntry` (líneas de hallazgo con acento glitch). El resto (MediaGallery, DossierView, GraphView, VaultList, UsagePanel, RouteMap HUD) hereda los tokens automáticamente; ajustes puntuales solo si algo queda ilegible.
- **Sonidos (`src/utils/sound.js`):** paleta de audio DedSec (glitch/data-burst/beep más agresivos) para boot/scanStart/finding/error/lock/done; respeta el toggle de sonido existente.
- **Accesibilidad:** contraste suficiente del neón sobre grunge; todo el movimiento respeta `prefers-reduced-motion`.

## 5. Sub-proyecto 2B — `LiveTheater` (consola dividida)

- **`useTerminal` expone `liveScan`** (estado nuevo), actualizado dentro de `beginScan`:
  - `status` (`running`|`idle`), `kind`, `query`, `startedAt`.
  - `reasoning`: últimos pasos `{step, thought, action}` (para el log izquierdo).
  - `findings`: contador (incrementa en cada evento `finding`).
  - `providers`: conjunto de providers vistos (de `meta`/`finding`).
  - `media`: últimas imágenes recibidas (para la sección de caras).
  - Se **resetea** al inicio de `beginScan` y se marca `idle` en `finish()`/`done`.
- **`src/components/LiveTheater.jsx`** (layout B), renderizado por `Terminal` cuando `isProcessing`:
  - **Izquierda:** log de razonamiento en streaming (pasos con glitch al entrar).
  - **Derecha:** las últimas caras/medios con animación de scan-line ("comparando"), y los contadores (hallazgos, tiempo). El **% de coincidencia facial** detallado sigue en la galería del stream (la del sub-proyecto v3/v4); el teatro muestra el "en progreso".
  - **Abajo:** chips de providers activos.
  - Encabezado con el ojo glitch + "■ EN VIVO".
- **Colapso:** al `done`, el panel se oculta (o muestra un cierre breve) y los resultados quedan en el stream (dossier/grafo/hallazgos).
- **Caveat de presupuesto:** el contador exacto SerpApi (ej. 11/20) NO se emite hoy en vivo. El teatro muestra los contadores **derivables en cliente** (hallazgos, providers, tiempo). El de presupuesto queda **fuera de este sub-proyecto**; si más adelante el backend emite un evento de progreso con el presupuesto, se añade. No se inventan números.

## 6. Errores / degradación / accesibilidad

- Sin datos en vivo (escaneo sin `reasoning`, ej. un `osint` simple) → el teatro muestra igual los contadores/providers/medios que sí lleguen; si no hay nada, un estado mínimo "procesando…".
- `prefers-reduced-motion`: sin glitch/jitter/parpadeo; colores y layout estáticos.
- El teatro nunca bloquea ni rompe el stream: es puramente presentacional sobre `liveScan`.

## 7. Fases

1. **2A-1 · Tokens + utilidades DedSec** (`index.css`, tema por defecto) — la base de color/movimiento.
2. **2A-2 · Re-skin de identidad** (GodEye, boot/AsciiBanner, LoginPanel, header, ScanEntry) + sonidos DedSec.
3. **2B-1 · `liveScan` en `useTerminal`** (estado + actualización en beginScan) + tests.
4. **2B-2 · `LiveTheater.jsx`** + wiring en `Terminal` (mostrar mientras `isProcessing`) + tests.

## 8. Testing

- **Frontend (vitest):**
  - `liveScan`: al correr un escaneo (streamOsint mockeado), `liveScan` acumula reasoning/findings/providers/media y vuelve a `idle` en `done`.
  - `LiveTheater`: render con un `liveScan` de muestra → muestra pasos de razonamiento, contadores, chips de providers, sección de caras; con `status:"idle"` no se muestra (o el `Terminal` no lo monta).
  - Los tests existentes (81) siguen verdes tras el reskin (el cambio de tokens no rompe lógica; los tests no dependen de colores exactos).
- **Visual:** verificación en navegador (dev) del look DedSec + el panel en un escaneo real.

## 9. Fuera de alcance

- Contador de presupuesto en vivo (requiere evento de backend) — nota, no incluido.
- Cambiar el concepto/identidad (el ojo se conserva).
- Assets/logo reales de Ubisoft (se usa motivo original).
- Animación facial descriptor-por-descriptor detallada dentro del teatro (el % vive en la galería del stream).
