// src/utils/netMonitor.js

// Guardamos muestras simples de tráfico: { ts, bytes }
// Solo de esta app (las peticiones que hagamos con fetch instrumentado).
let samples = [];

// Registrar bytes transferidos en un momento dado
export function recordNetwork(bytes) {
  const now = Date.now();
  samples.push({ ts: now, bytes });

  // Limpiamos muestras de más de 60s para no crecer infinito
  const cutoff = now - 60_000;
  samples = samples.filter((s) => s.ts >= cutoff);
}

// Obtener throughput (bytes/seg) en una ventana (por defecto 1 segundo)
export function getRecentThroughput(windowMs = 1000) {
  const now = Date.now();
  const windowStart = now - windowMs;
  let totalBytes = 0;

  for (const s of samples) {
    if (s.ts >= windowStart) {
      totalBytes += s.bytes;
    }
  }

  // bytes por segundo
  return totalBytes / (windowMs / 1000);
}
