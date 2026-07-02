// src/components/OutputLine.jsx
import ScanEntry from "./ScanEntry";

export default function OutputLine({ entry, theme }) {
  const colors = theme?.colors || {};

  // Los eventos de un escaneo OSINT se renderizan con estética HUD.
  if (entry.type === "scan") {
    return <ScanEntry entry={entry} theme={theme} />;
  }

  const baseClass = "whitespace-pre-wrap leading-snug text-xs md:text-sm";

  const prefixClass = colors.promptUser || "text-green-300";
  const inputTextClass =
    colors.commandHistory || "text-green-100"; // color después de Enter
  const outputTextClass = colors.outputText || "text-green-200";
  const errorTextClass = colors.errorText || "text-red-400";

  if (entry.type === "input") {
    return (
      <div className={baseClass}>
        <span className={`${prefixClass} mr-2 select-none`}>
          {theme?.id || "qminds"}@osint:~$
        </span>
        <span className={inputTextClass}>{entry.text}</span>
      </div>
    );
  }

  if (entry.type === "error") {
    return (
      <div className={`${baseClass} ${errorTextClass}`}>
        {entry.text}
      </div>
    );
  }

  // output normal
  return (
    <div className={`${baseClass} ${outputTextClass}`}>
      {entry.text}
    </div>
  );
}
