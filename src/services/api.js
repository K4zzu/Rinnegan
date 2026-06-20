// src/services/api.js

const BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

// Tiempo máximo de espera por petición (ms) antes de abortar.
const REQUEST_TIMEOUT_MS = 10_000;

async function request(path, params = {}) {
  const url = new URL(path, BASE_URL);

  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, value);
  });

  // Aborta la petición si el backend no responde a tiempo, así la
  // terminal no se queda colgada en "Procesando..." indefinidamente.
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

  // Aquí ya solo nos importa el JSON
  const data = await res.json();
  return data;
}

export function osintLookupIp(value) {
  return request("/osint/ip", { value });
}

export function osintLookupDomain(value) {
  return request("/osint/domain", { value });
}

export function osintLookupEmail(value) {
  return request("/osint/email", { value });
}

export function osintLookupUser(value) {
  return request("/osint/user", { value });
}
