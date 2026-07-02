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
  "media",
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

// Parsea un frame SSE ("event: x\ndata: {...}") en { event, data }.
function parseSseFrame(frame) {
  let event = null;
  const dataLines = [];
  for (const line of frame.split("\n")) {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).replace(/^ /, ""));
    }
  }
  return { event, data: dataLines.length ? dataLines.join("\n") : null };
}

function safeParse(raw) {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return raw;
  }
}

/**
 * Igual que streamOsint pero para imágenes: sube el archivo por POST multipart
 * y lee la respuesta SSE con fetch + ReadableStream (EventSource no hace POST).
 * Devuelve { close } para cancelar.
 */
export function streamOsintImage(file, handlers = {}) {
  const url = new URL("/osint/image/stream", BASE_URL);
  const form = new FormData();
  form.append("file", file);

  const controller = new AbortController();
  let finished = false;

  (async () => {
    let res;
    try {
      res = await fetch(url.toString(), {
        method: "POST",
        body: form,
        signal: controller.signal,
      });
    } catch (err) {
      if (!finished && err.name !== "AbortError") {
        handlers.error?.(new Error("No se pudo conectar con el backend."));
      }
      return;
    }

    if (!res.ok || !res.body) {
      handlers.error?.(new Error(`HTTP ${res.status}`));
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let sep;
        // Los frames SSE se separan por línea en blanco.
        while ((sep = buffer.indexOf("\n\n")) !== -1) {
          const frame = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          const { event, data } = parseSseFrame(frame);
          if (!event) continue;
          if (event === "done") finished = true;
          handlers[event]?.(safeParse(data));
        }
      }
    } catch (err) {
      if (!finished && err.name !== "AbortError") {
        handlers.error?.(new Error("Se perdió la conexión durante la subida."));
      }
    }
  })();

  return {
    close: () => {
      finished = true;
      controller.abort();
    },
  };
}
