// src/utils/sound.js
// Sonidos sintetizados con Web Audio (sin archivos). Beeps de telemetría
// tipo HUD. Muteable y persistido en localStorage. El AudioContext debe
// "desbloquearse" tras un gesto del usuario (llamar a sound.unlock()).

const KEY = "rinnegan:sound";

let ctx = null;
let enabled = true;

try {
  const saved = localStorage.getItem(KEY);
  if (saved !== null) enabled = saved === "1";
} catch {
  // localStorage no disponible — se queda en el default.
}

function audioCtx() {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

function tone({ freq = 660, dur = 0.06, type = "sine", gain = 0.04, slideTo = null }) {
  if (!enabled) return;
  const c = audioCtx();
  if (!c) return;

  const osc = c.createOscillator();
  const g = c.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, c.currentTime);
  if (slideTo) {
    osc.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + dur);
  }

  g.gain.setValueAtTime(gain, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);

  osc.connect(g);
  g.connect(c.destination);
  osc.start();
  osc.stop(c.currentTime + dur);
}

export const sound = {
  isEnabled: () => enabled,

  setEnabled(value) {
    enabled = !!value;
    try {
      localStorage.setItem(KEY, enabled ? "1" : "0");
    } catch {
      // ignore
    }
  },

  toggle() {
    this.setEnabled(!enabled);
    return enabled;
  },

  // Llamar tras un gesto del usuario para habilitar el audio del navegador.
  unlock() {
    audioCtx();
  },

  scanStart() {
    tone({ freq: 280, slideTo: 720, dur: 0.2, type: "sawtooth", gain: 0.025 });
  },

  finding(confidence) {
    const freq =
      confidence === "high" ? 920 : confidence === "medium" ? 660 : 480;
    tone({ freq, dur: 0.05, type: "sine", gain: 0.03 });
  },

  error() {
    tone({ freq: 150, dur: 0.15, type: "square", gain: 0.025 });
  },

  done() {
    tone({ freq: 660, dur: 0.08, type: "sine", gain: 0.035 });
    setTimeout(() => tone({ freq: 990, dur: 0.13, type: "sine", gain: 0.035 }), 90);
  },
};
