// src/services/api.js

const BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

// Tiempo máximo de espera por petición no-streaming (ms) antes de abortar.
const REQUEST_TIMEOUT_MS = 10_000;

// ── Sesión / token ───────────────────────────────────────────────────────
const TOKEN_KEY = "rinnegan:token";

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // localStorage no disponible — se ignora.
  }
}

// Handler que la app registra para reaccionar a un 401 (sesión caída).
let onUnauthorized = null;
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}
function handle401() {
  setToken(null);
  onUnauthorized?.();
}

async function request(path, { params = {}, method = "GET", json = null } = {}) {
  const url = new URL(path, BASE_URL);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, value);
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const opts = { method, headers, signal: controller.signal };
  if (json != null) {
    headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(json);
  }

  let res;
  try {
    res = await fetch(url.toString(), opts);
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

  if (res.status === 401) {
    handle401();
    const err = new Error("Sesión expirada o no autorizado.");
    err.status = 401;
    throw err;
  }

  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail = body?.detail || "";
    } catch {
      // cuerpo no-JSON
    }
    const err = new Error(detail || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }

  return res.status === 204 ? null : res.json();
}

// ── Auth ─────────────────────────────────────────────────────────────────
export async function login(username, password) {
  const data = await request("/auth/login", {
    method: "POST",
    json: { username, password },
  });
  setToken(data.access_token);
  return data;
}

export async function register(username, password, invite_code) {
  const data = await request("/auth/register", {
    method: "POST",
    json: { username, password, invite_code },
  });
  setToken(data.access_token);
  return data;
}

export function me() {
  return request("/auth/me");
}

export function logout() {
  setToken(null);
}

// Identidad real del cliente (IP pública, geo) desde el backend.
export function whoami() {
  return request("/whoami");
}

// Calcula una ruta con ETA + tráfico. `text` es lenguaje natural o coords.
export function planRoute(text) {
  return request("/route", { method: "POST", json: { text } });
}

// Interpreta lenguaje natural → { action, ... } (osint | route | command | unknown).
export function interpret(text) {
  return request("/interpret", { method: "POST", json: { text } });
}

// ── Bóveda (investigaciones persistidas) ───────────────────────────────────
export function saveVault(payload) {
  return request("/vault/save", { method: "POST", json: payload });
}

export function getVaultGraph() {
  return request("/vault/graph");
}

export function getVaultNode(id) {
  return request(`/vault/node/${id}`);
}

export function deleteVaultNode(id) {
  return request(`/vault/node/${id}`, { method: "DELETE" });
}

// Compara un descriptor facial contra las caras guardadas del usuario.
export function facesMatch(descriptor) {
  return request("/faces/match", { method: "POST", json: { descriptor } });
}

// Consumo de cuotas + costo USD acumulado (period: "month" | "day").
export function getUsage(period = "month") {
  return request("/usage", { params: { period } });
}

// URL del proxy de imágenes (con token) para analizar fotos de otros dominios.
export function imgProxyUrl(url) {
  const u = new URL("/img", BASE_URL);
  u.searchParams.set("url", url);
  const token = getToken();
  if (token) u.searchParams.set("token", token);
  return u.toString();
}

// Eventos del protocolo SSE (ver spec: sección "SSE Event Protocol").
const SSE_EVENTS = [
  "meta",
  "progress",
  "finding",
  "source_error",
  "media",
  "ai_report",
  "node",
  "edge",
  "done",
];

// Abre un EventSource contra `url` (con ?token=) y despacha SSE_EVENTS a handlers.
function openEventStream(url, handlers) {
  const token = getToken();
  if (token) url.searchParams.set("token", token);

  const source = new EventSource(url.toString());
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

/**
 * Abre un stream SSE contra GET /osint/<category>/stream?value=...
 * El token va como ?token= porque EventSource no admite cabeceras.
 */
export function streamOsint(category, value, handlers = {}) {
  const url = new URL(`/osint/${category}/stream`, BASE_URL);
  url.searchParams.set("value", value);
  return openEventStream(url, handlers);
}

/**
 * Igual que streamOsint pero contra /osint/graph/stream (auto-pivot + grafo):
 * además de los eventos normales, emite `node` y `edge`.
 */
export function streamOsintGraph(value, kind, handlers = {}) {
  const url = new URL("/osint/graph/stream", BASE_URL);
  url.searchParams.set("value", value);
  if (kind) url.searchParams.set("kind", kind);
  return openEventStream(url, handlers);
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
    const token = getToken();
    let res;
    try {
      res = await fetch(url.toString(), {
        method: "POST",
        body: form,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        signal: controller.signal,
      });
    } catch (err) {
      if (!finished && err.name !== "AbortError") {
        handlers.error?.(new Error("No se pudo conectar con el backend."));
      }
      return;
    }

    if (res.status === 401) {
      handle401();
      handlers.error?.(new Error("Sesión expirada o no autorizado."));
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
