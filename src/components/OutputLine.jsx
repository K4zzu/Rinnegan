// src/components/OutputLine.jsx
import { lazy, Suspense } from "react";
import ScanEntry from "./ScanEntry";
import VaultList from "./VaultList";
import UsagePanel from "./UsagePanel";
import DossierView from "./DossierView";
import CandidatePicker from "./CandidatePicker";

// MapLibre es pesado: se carga bajo demanda solo al mostrar una ruta.
const RouteMap = lazy(() => import("./RouteMap"));
const GraphView = lazy(() => import("./GraphView"));

export default function OutputLine({ entry, theme, onPickCandidate }) {
  const colors = theme?.colors || {};

  // Los eventos de un escaneo OSINT se renderizan con estética HUD.
  if (entry.type === "scan") {
    return <ScanEntry entry={entry} theme={theme} />;
  }

  if (entry.type === "vault") {
    return <VaultList data={entry.data} />;
  }

  if (entry.type === "dossier") {
    return <DossierView data={entry.data} />;
  }

  if (entry.type === "candidates") {
    return <CandidatePicker items={entry.items} onPick={onPickCandidate} />;
  }

  if (entry.type === "usage") {
    return <UsagePanel data={entry.data} />;
  }

  if (entry.type === "graph") {
    return (
      <Suspense
        fallback={
          <div className="my-2 text-xs text-violet-300/60">[grafo] dibujando…</div>
        }
      >
        <GraphView data={entry.data} />
      </Suspense>
    );
  }

  // Mapa de ruta con ETA + tracker (chunk aparte).
  if (entry.type === "route") {
    return (
      <Suspense
        fallback={
          <div className="my-2 text-xs text-violet-300/60">
            [ruta] cargando mapa…
          </div>
        }
      >
        <RouteMap data={entry.data} />
      </Suspense>
    );
  }

  const baseClass =
    "whitespace-pre-wrap break-words leading-snug text-xs md:text-sm";

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
