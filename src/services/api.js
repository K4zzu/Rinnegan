// src/services/api.js

const BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

// Tiempo máximo de espera por petición no-streaming (ms) antes de abortar.
const REQUEST_TIMEOUT_MS = 10_000;

async function request(path, params = {}) {
  const url = new URL(path, BASE_URL);

  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, value);
  });

  // Aborta la petición si el backend no responde a tiempo.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res;
  try {
    res = await fetch(url.toString(), { signal: controller.signal });
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error(
        `Tiempo de espera agotado (${REQUEST_TIMEOUT_MS / 1000}s). ` +
          "¿Está el backend en línea?"
      );
    }
    throw new Error(`Error de red: ${err.message || err.toString()}`);
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }

  return res.json();
}

// Identidad real del cliente (IP pública, geo) desde el backend.
export function whoami() {
  return request("/whoami");
}

// Eventos del protocolo SSE (ver spec: sección "SSE Event Protocol").
const SSE_EVENTS = [
  "meta",
  "progress",
  "finding",
  "source_error",
  "ai_report",
  "done",
];

/**
 * Abre un stream SSE contra GET /osint/<category>/stream?value=...
 * y despacha cada evento a su handler.
 *
 * handlers: { meta, progress, finding, source_error, ai_report, done, error }
 * Devuelve { close } para cancelar el escaneo en curso.
 */
export function streamOsint(category, value, handlers = {}) {
  const url = new URL(`/osint/${category}/stream`, BASE_URL);
  url.searchParams.set("value", value);

  const source = new EventSource(url.toString());
  // Cuando llega `done`, el server cierra la conexión; marcamos `finished`
  // para no confundir ese cierre con un error de conexión.
  let finished = false;

  const parse = (raw) => {
    try {
      return raw ? JSON.parse(raw) : null;
    } catch {
      return raw;
    }
  };

  for (const name of SSE_EVENTS) {
    source.addEventListener(name, (e) => {
      if (name === "done") finished = true;
      handlers[name]?.(parse(e.data));
      if (name === "done") source.close();
    });
  }

  source.onerror = () => {
    if (finished) return;
    handlers.error?.(
      new Error("No se pudo conectar con el backend o se perdió la conexión.")
    );
    source.close();
  };

  return {
    close: () => {
      finished = true;
      source.close();
    },
  };
}
