# Prompt para el agente de backend — Fix: filtrar anuncios de DuckDuckGo

> Continúa en el MISMO repo `rinnegan-api`. Copia el bloque y pásaselo al agente. Es un fix pequeño.

---

En el provider `duckduckgo` de la categoría `name` (`app/providers/name/duckduckgo_provider.py`), se están colando **anuncios/sponsored** de DuckDuckGo como si fueran hallazgos reales. Ejemplo real que apareció al buscar "Linus Torvalds":

```
source: "duckduckgo.com"
url: "https://duckduckgo.com/y.js?ad_domain=aliexpress.com&ad_provider=bingv7aa&ad_type=txad&...&u3=https%3A%2F%2Fwww.bing.com%2Faclick..."
snippet: "Smarter online shopping from today! AliExpress the biggest online marketplace."
```

## Objetivo

Descartar los resultados de anuncios; solo emitir `finding` para resultados orgánicos.

## Qué filtrar (descarta el resultado si CUALQUIERA aplica)

1. **Contenedor de anuncio en el HTML:** el resultado está dentro de un bloque marcado como ad — el `<a>` o su ancestro tiene clases tipo `result--ad`, `result--ad--small`, o hay un `.badge--ad` cerca. Si usas el selector `.result` para iterar, **excluye** los que también tengan la clase de ad. (Preferible: filtra por estructura del DOM.)
2. **URL de redirección de anuncio de DDG:** tras resolver el href (incluida la decodificación de `uddg`), descarta si la URL final:
   - tiene host `duckduckgo.com` **y** path que empieza por `/y.js`, o
   - contiene los parámetros `ad_provider`, `ad_domain` o `ad_type`, o
   - su host es `duckduckgo.com` (los resultados orgánicos nunca apuntan a duckduckgo.com — su `source` no debe ser el propio buscador).

Aplica ambos filtros (defensa en capas): si el HTML de DDG cambia, al menos el filtro por URL/params sigue atrapando los ads.

## Reglas

- El filtrado ocurre **antes** de emitir el `finding` (no lo emitas y no lo cuentes).
- No cambies el resto del comportamiento (query con comillas para nombre+apellido, boost social, decodificación `uddg`, aislamiento, etc.).

## Tests (pytest + respx)

- Añade al HTML de ejemplo (o crea uno) **un resultado de anuncio** (href tipo `//duckduckgo.com/y.js?ad_provider=...&uddg=...` y/o dentro de un contenedor `result--ad`) junto con resultados orgánicos → verifica que el finding del anuncio **NO** se emite y los orgánicos **sí**.
- Verifica que ningún finding resultante tenga `source == "duckduckgo.com"` ni una URL con `/y.js` o `ad_provider`.
- `ruff` limpio.

## Criterio de aceptación

`GET /osint/name/stream?value=Linus%20Torvalds` (y por ende `osint auto`) ya **no** incluye resultados de anuncios (nada de `y.js`/AliExpress/`ad_provider`); solo perfiles/páginas orgánicas. Tests verdes + `ruff`.

Cuando termines: salida real de `curl -N` de `name` para un término que antes traía ads, mostrando que ya no aparecen, y `pytest`/`ruff`.
