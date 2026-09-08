// src/utils/sound.js
// Paleta de sonido tipo consola/sónar, sintetizada con Web Audio (sin
// archivos). Envolventes suaves + capas ligeras para que suene menos a "beep"
// y más a instrumento de vigilancia. Muteable y persistido. El AudioContext
// se desbloquea tras un gesto del usuario (sound.unlock()).

const KEY = "rinnegan:sound";

let ctx = null;
let master = null;
let enabled = true;

try {
  const saved = localStorage.getItem(KEY);
  if (saved !== null) enabled = saved === "1";
} catch {
  // localStorage no disponible — default.
}

function audioCtx() {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!ctx) {
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

// Una voz: oscilador con envolvente A/D y filtro opcional.
function voice({
  freq = 660,
  type = "sine",
  t0 = 0,
  dur = 0.12,
  gain = 0.05,
  attack = 0.005,
  slideTo = null,
  detune = 0,
  filter = null,
}) {
  const c = audioCtx();
  if (!c) return;
  const start = c.currentTime + t0;

  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.detune.value = detune;
  osc.frequency.setValueAtTime(freq, start);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, start + dur);

  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(gain, start + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);

  let node = osc;
  if (filter) {
    const f = c.createBiquadFilter();
    f.type = filter.type || "lowpass";
    f.frequency.value = filter.freq || 1200;
    osc.connect(f);
    node = f;
  }
  node.connect(g);
  g.connect(master);
  osc.start(start);
  osc.stop(start + dur + 0.02);
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

  unlock() {
    audioCtx();
  },

  // Encendido: barrido corto grave→agudo tipo glitch burst (power-up áspero).
  boot() {
    if (!enabled) return;
    voice({ freq: 90, slideTo: 640, type: "sawtooth", dur: 0.28, gain: 0.05, filter: { freq: 900 } });
    voice({ freq: 180, slideTo: 1200, type: "square", dur: 0.22, gain: 0.025, t0: 0.02 });
  },

  // Inicio de escaneo: barrido de frecuencia corto (glitch burst) en vez de ping de sónar.
  scanStart() {
    if (!enabled) return;
    voice({ freq: 220, slideTo: 1760, type: "sawtooth", dur: 0.09, gain: 0.045, filter: { freq: 2600 } });
    voice({ freq: 440, slideTo: 1320, type: "square", dur: 0.07, gain: 0.02, t0: 0.05 });
  },

  // Hallazgo: blip corto y áspero, tono según confianza + armónico sutil.
  finding(confidence) {
    if (!enabled) return;
    const base =
      confidence === "high" ? 940 : confidence === "medium" ? 680 : 500;
    voice({ freq: base, type: "square", dur: 0.06, gain: 0.03 });
    voice({ freq: base * 2, type: "sawtooth", dur: 0.045, gain: 0.008, detune: 4 });
  },

  // Error: golpe grave, seco y distorsionado.
  error() {
    if (!enabled) return;
    voice({ freq: 150, slideTo: 90, type: "sawtooth", dur: 0.16, gain: 0.045, filter: { freq: 500 } });
  },

  // Objetivo fijado (identidad resuelta): dos tonos ascendentes + núcleo, más ásperos.
  lock() {
    if (!enabled) return;
    voice({ freq: 523, type: "square", dur: 0.12, gain: 0.035 });
    voice({ freq: 784, type: "square", dur: 0.16, gain: 0.04, t0: 0.1 });
    voice({ freq: 1568, type: "sawtooth", dur: 0.22, gain: 0.018, t0: 0.12 });
  },

  // Fin de escaneo: acorde resuelto (quinta).
  done() {
    if (!enabled) return;
    voice({ freq: 660, type: "sine", dur: 0.14, gain: 0.04 });
    voice({ freq: 990, type: "sine", dur: 0.24, gain: 0.035, t0: 0.09 });
  },
};
