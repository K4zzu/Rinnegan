// src/services/api.js

const BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

async function request(path, params = {}) {
  const url = new URL(path, BASE_URL);

  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, value);
  });

  let res;
  try {
    res = await fetch(url.toString());
  } catch (err) {
    throw new Error(`Error de red: ${err.message || err.toString()}`);
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
