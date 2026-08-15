// src/components/UsageIndicator.jsx
// Indicador compacto de cuotas en el header: muestra lo más escaso (SerpApi) y
// el costo total del mes. Si /usage falla, no renderiza nada. Escribe `cuotas`
// para el panel completo.
import { useEffect, useState } from "react";
import { getUsage } from "../services/api";

export default function UsageIndicator({ className = "" }) {
  const [usage, setUsage] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getUsage("month")
      .then((d) => !cancelled && setUsage(d))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!usage) return null;

  const serp = (usage.providers || []).find((p) =>
    (p.name || "").toLowerCase().includes("serp")
  );
  const total =
    typeof usage.total_cost_usd === "number" ? usage.total_cost_usd : 0;

  return (
    <span
      className={`text-[0.6rem] tracking-wide opacity-70 ${className}`}
      title="cuotas y costo — escribe 'cuotas' para el panel"
    >
      {serp ? `serp ${serp.used}/${serp.limit ?? "∞"} · ` : ""}${total.toFixed(2)}
    </span>
  );
}
