// src/components/RouteMap.jsx
// Mapa estética terminal (MapLibre, tiles oscuros sin key) con la ruta y un
// marcador de POSICIÓN ESTIMADA que avanza en tiempo real según el ETA con
// tráfico y el retraso de salida. La estimación NO es GPS real de la persona.
import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

// Estilo raster oscuro y minimal (CARTO dark_nolabels), sin API key.
const DARK_STYLE = {
  version: 8,
  sources: {
    base: {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png",
        "https://b.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png",
        "https://c.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      attribution: "© OpenStreetMap © CARTO",
    },
  },
  layers: [{ id: "base", type: "raster", source: "base" }],
};

// Distancia haversine (m) entre [lng,lat].
function haversine(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Punto sobre la polilínea a una fracción [0..1] de su longitud total.
function pointAtFraction(coords, frac) {
  if (coords.length < 2) return coords[0];
  const segs = [];
  let total = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const d = haversine(coords[i], coords[i + 1]);
    segs.push(d);
    total += d;
  }
  const target = Math.max(0, Math.min(1, frac)) * total;
  let acc = 0;
  for (let i = 0; i < segs.length; i++) {
    if (acc + segs[i] >= target) {
      const t = segs[i] === 0 ? 0 : (target - acc) / segs[i];
      const a = coords[i];
      const b = coords[i + 1];
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    }
    acc += segs[i];
  }
  return coords[coords.length - 1];
}

function markerEl(kind) {
  const el = document.createElement("div");
  el.className = `route-marker route-marker--${kind}`;
  return el;
}

const TRAFFIC_LABEL = { low: "fluido", moderate: "moderado", heavy: "cargado" };
const TRAFFIC_COLOR = { low: "#34d399", moderate: "#fbbf24", heavy: "#f87171" };

export default function RouteMap({ data }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const estMarkerRef = useRef(null);
  const [status, setStatus] = useState({ pct: 0, label: "" });

  const coords = data?.geometry?.coordinates || [];

  useEffect(() => {
    if (!containerRef.current || coords.length < 2) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: DARK_STYLE,
      center: coords[0],
      zoom: 12,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    map.on("load", () => {
      map.addSource("route", {
        type: "geojson",
        data: { type: "Feature", geometry: data.geometry },
      });
      // Glow + línea principal (verde).
      map.addLayer({
        id: "route-glow",
        type: "line",
        source: "route",
        paint: { "line-color": "#c8ff2f", "line-width": 9, "line-blur": 8, "line-opacity": 0.5 },
        layout: { "line-cap": "round", "line-join": "round" },
      });
      map.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        paint: { "line-color": "#c8ff2f", "line-width": 2.5 },
        layout: { "line-cap": "round", "line-join": "round" },
      });

      new maplibregl.Marker({ element: markerEl("origin") }).setLngLat(coords[0]).addTo(map);
      new maplibregl.Marker({ element: markerEl("dest") })
        .setLngLat(coords[coords.length - 1])
        .addTo(map);
      estMarkerRef.current = new maplibregl.Marker({ element: markerEl("est") })
        .setLngLat(coords[0])
        .addTo(map);

      // Encuadre a la ruta.
      const bounds = coords.reduce(
        (b, c) => b.extend(c),
        new maplibregl.LngLatBounds(coords[0], coords[0])
      );
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      map.fitBounds(bounds, { padding: 48, duration: reduce ? 0 : 1200 });
    });

    return () => map.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tracker: posición estimada en tiempo real.
  useEffect(() => {
    if (coords.length < 2) return;
    const departure =
      new Date(data.requested_at).getTime() + (data.depart_in_min || 0) * 60000;
    const durMs = (data.duration_traffic_s || 1) * 1000;

    const tick = () => {
      const elapsed = Date.now() - departure;
      let pct, label;
      if (elapsed < 0) {
        pct = 0;
        label = `sale en ${Math.ceil(-elapsed / 60000)} min`;
      } else {
        const frac = Math.max(0, Math.min(1, elapsed / durMs));
        pct = Math.round(frac * 100);
        const remain = Math.max(0, Math.ceil((durMs - elapsed) / 60000));
        label = frac >= 1 ? "llegada estimada alcanzada" : `llega en ~${remain} min`;
        estMarkerRef.current?.setLngLat(pointAtFraction(coords, frac));
      }
      setStatus({ pct, label });
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (coords.length < 2) {
    return (
      <div className="my-2 text-xs text-red-400">
        [ruta] no se pudo trazar la geometría de la ruta.
      </div>
    );
  }

  const km = (data.distance_m / 1000).toFixed(1);
  const etaMin = Math.round(data.duration_traffic_s / 60);
  const etaHora = new Date(data.eta_iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const traffic = TRAFFIC_LABEL[data.traffic_level] || data.traffic_level;

  return (
    <div className="ai-reveal my-2 overflow-hidden rounded-md border border-white/10 bg-white/[0.02]">
      {/* Encabezado HUD */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 text-[0.7rem] uppercase tracking-widest text-[#c8ff2f]">
        <span>◎ ruta</span>
        <span className="text-white/80">{data.mode_label}</span>
        <span className="opacity-60">{km} km</span>
        <span className="opacity-60">eta ~{etaMin} min</span>
        <span className="opacity-60">llegada {etaHora}</span>
        <span style={{ color: TRAFFIC_COLOR[data.traffic_level] }}>
          tráfico {traffic}
        </span>
      </div>

      {/* Mapa */}
      <div className="relative">
        <div ref={containerRef} className="h-[320px] w-full" />
        {/* Chip de tracking sobre el mapa */}
        <div className="pointer-events-none absolute left-2 bottom-2 rounded bg-black/70 px-2 py-1 text-[0.65rem] text-[#c8ff2f] backdrop-blur">
          <span className="text-[#ff004d]">◉</span> posición estimada ·{" "}
          {status.pct}% · {status.label}
        </div>
      </div>

      <div className="px-3 py-1.5 text-[0.6rem] text-white/35">
        — posición estimada sobre la ruta (no es GPS real de la persona).
      </div>
    </div>
  );
}
