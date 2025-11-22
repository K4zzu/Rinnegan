// src/components/PromptLine.jsx
import Cursor from "./Cursor";

export default function PromptLine({ value, onChange, inputRef, theme }) {
  const colors = theme?.colors || {};

  // color del prefijo: qminds@osint:~$
  const prefixClass = colors.promptUser || "text-green-300";

  // color del texto mientras escribes (antes de Enter)
  const typingClass =
    colors.commandInput || colors.commandHistory || "text-green-400";

  return (
    <div className="flex text-xs md:text-sm">
      <span className={`${prefixClass} mr-2 select-none`}>
        {theme?.id || "qminds"}@osint:~$
      </span>

      <div className="flex-1 relative">
        {/* Texto visible + cursor */}
        <span className={typingClass}>{value}</span>
        <Cursor />

        {/* Input invisible que captura el teclado */}
        <input
          ref={inputRef}
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 w-full h-full bg-transparent text-transparent caret-transparent outline-none border-none"
          autoComplete="off"
          autoCorrect="off"
          spellCheck="false"
        />
      </div>
    </div>
  );
}
