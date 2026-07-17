// src/hooks/useVoice.js
// Reconocimiento de voz del navegador (Web Speech API). Sin backend ni key.
// Soportado en Chrome/Edge/Chrome-Android; en el resto `supported` es false.
import { useRef, useState } from "react";

export function useVoice({ onResult, lang = "es-CO" } = {}) {
  const SR =
    typeof window !== "undefined" &&
    (window.SpeechRecognition || window.webkitSpeechRecognition);
  const supported = !!SR;

  const [listening, setListening] = useState(false);
  const recRef = useRef(null);

  const start = () => {
    if (!supported || listening) return;
    const rec = new SR();
    rec.lang = lang;
    rec.interimResults = true;
    rec.continuous = false;

    rec.onresult = (e) => {
      let txt = "";
      for (let i = 0; i < e.results.length; i++) {
        txt += e.results[i][0].transcript;
      }
      onResult?.(txt);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);

    recRef.current = rec;
    setListening(true);
    try {
      rec.start();
    } catch {
      setListening(false);
    }
  };

  const stop = () => {
    try {
      recRef.current?.stop();
    } catch {
      // ignore
    }
  };

  const toggle = () => (listening ? stop() : start());

  return { supported, listening, toggle };
}
