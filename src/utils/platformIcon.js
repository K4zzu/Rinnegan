// src/utils/platformIcon.js
// Icono para una plataforma/red social a partir del `source` de un hallazgo
// (ej. "github", "linkedin.com"). Devuelve un emoji o null si no se reconoce.

const ICONS = {
  github: "🐙",
  gitlab: "🦊",
  telegram: "✈️",
  instagram: "📷",
  twitter: "🐦",
  x: "🐦",
  reddit: "👽",
  facebook: "📘",
  linkedin: "💼",
  youtube: "▶️",
  tiktok: "🎵",
  spotify: "🎧",
  twitch: "🎮",
  discord: "💬",
  medium: "✍️",
  pinterest: "📌",
  snapchat: "👻",
  flickr: "📸",
  steam: "🕹️",
  soundcloud: "🔊",
  wordpress: "📝",
  bluesky: "🦋",
  substack: "📰",
  wikipedia: "📚",
  stackoverflow: "💬",
  gravatar: "👤",
};

export function platformIcon(source) {
  if (!source) return null;
  const key = String(source)
    .toLowerCase()
    .replace(/^www\./, "")
    .split(".")[0];
  return ICONS[key] || null;
}
