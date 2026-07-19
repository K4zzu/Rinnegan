// src/components/PromptLine.jsx
import { useState } from "react";
import Cursor from "./Cursor";
import { useVoice } from "../hooks/useVoice";
import { sound } from "../utils/sound";

export default function PromptLine({ value, onChange, onKeyDown, inputRef, theme }) {
  const colors = theme?.colors || {};

  // color del prefijo: qminds@osint:~$
  const prefixClass = colors.promptUser || "text-green-300";

  // color del texto mientras escribes (antes de Enter)
  const typingClass =
    colors.commandInput || colors.commandHistory || "text-green-400";

  // Posición del caret (para dibujar el bloque donde está el cursor real).
  const [caret, setCaret] = useState(0);
  const syncCaret = (e) => setCaret(e.target.selectionStart ?? value.length);

  // Voz → escribe la transcripción en el input (revisar y dar Enter).
  const { supported, listening, toggle } = useVoice({ onResult: onChange });

  const onMicClick = (e) => {
    e.stopPropagation();
    sound.unlock();
    if (!listening) sound.scanStart();
    toggle();
    inputRef?.current?.focus();
  };

  const pos = Math.min(caret, value.length);
  const before = value.slice(0, pos);
  const after = value.slice(pos);

  return (
    <div className="flex items-center text-xs md:text-sm">
      <span className={`${prefixClass} mr-2 select-none`}>
        {theme?.id || "qminds"}@osint:~$
      </span>

      <div className="flex-1 relative whitespace-pre-wrap break-words">
        {/* Texto visible con el bloque de cursor EN la posición del caret */}
        <span className={typingClass}>{before}</span>
        <Cursor />
        <span className={typingClass}>{after}</span>

        {/* Input invisible que captura el teclado */}
        <input
          ref={inputRef}
          autoFocus
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setCaret(e.target.selectionStart ?? e.target.value.length);
          }}
          onKeyDown={onKeyDown}
          onKeyUp={syncCaret}
          onClick={syncCaret}
          onSelect={syncCaret}
          className="absolute inset-0 w-full h-full bg-transparent text-transparent caret-transparent outline-none border-none"
          autoComplete="off"
          autoCorrect="off"
          spellCheck="false"
          aria-label="Entrada de comandos de la terminal"
        />
      </div>

      {/* Botón de voz (solo si el navegador lo soporta) */}
      {supported && (
        <button
          type="button"
          onClick={onMicClick}
          aria-label={listening ? "Detener dictado" : "Dictar por voz"}
          title={listening ? "Escuchando… clic para detener" : "Dictar por voz"}
          className={`ml-2 shrink-0 rounded-full border p-1.5 transition ${
            listening
              ? "border-fuchsia-400/70 text-fuchsia-300 bg-fuchsia-500/10 animate-pulse shadow-[0_0_10px_rgba(232,121,249,0.5)]"
              : "border-white/15 text-violet-300/70 hover:text-violet-200 hover:border-violet-400/50"
          }`}
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="3" width="6" height="11" rx="3" />
            <path d="M5 11a7 7 0 0 0 14 0" />
            <line x1="12" y1="18" x2="12" y2="21" />
          </svg>
        </button>
      )}
    </div>
  );
}
