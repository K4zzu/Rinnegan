// src/utils/faceCache.js
// Caché en memoria de descriptores faciales (128-d) por URL de imagen.
// La llena faceCluster durante el análisis; la leen MediaGallery (para la
// correlación cross-scan) y useTerminal (para guardar las caras en la bóveda).
// Es solo una caché de cómputo por sesión; la fuente de verdad del match es la
// bóveda en el backend.
const cache = new Map();

export function setDescriptor(url, descriptor) {
  if (url && descriptor) cache.set(url, descriptor);
}

export function getDescriptor(url) {
  return cache.get(url) || null;
}

export function clearDescriptors() {
  cache.clear();
}
