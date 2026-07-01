// src/hooks/useClientInfo.js
import { useEffect, useState, useRef } from "react";
import { whoami } from "../services/api";

export function useClientInfo() {
  const [now, setNow] = useState(new Date());
  const [locationStatus, setLocationStatus] = useState("idle");
  const [location, setLocation] = useState(null);
  // IP pública real, servida por el backend (/whoami). Null si el backend
  // no está disponible → el header muestra "pendiente backend".
  const [ip, setIp] = useState(null);

  // Hora en vivo
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Identidad del cliente desde el backend (best-effort).
  useEffect(() => {
    let cancelled = false;
    whoami()
      .then((data) => {
        if (!cancelled) setIp(data?.ip || null);
      })
      .catch(() => {
        // Backend no disponible: se queda en null, sin ruido.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Geolocalización
  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setLocationStatus("unsupported");
      return;
    }

    setLocationStatus("requesting");

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
        setLocationStatus("granted");
      },
      (err) => {
        console.error("Geolocation error:", err);
        setLocationStatus("denied");
      },
      {
        enableHighAccuracy: false,
        timeout: 5000,
      }
    );
  }, []);

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const timeString = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  let locationLabel = "Ubicación desactivada";
  if (locationStatus === "unsupported") {
    locationLabel = "Ubicación no soportada";
  } else if (locationStatus === "requesting") {
    locationLabel = "Solicitando ubicación...";
  } else if (locationStatus === "denied") {
    locationLabel = "Permiso de ubicación denegado";
  } else if (locationStatus === "granted" && location) {
    locationLabel = `Lat ${location.lat.toFixed(3)}, Lng ${location.lng.toFixed(
      3
    )}`;
  }

  return {
    username: "guest",
    ip, // desde /whoami; null si el backend no responde
    timeString,
    timeZone,
    locationLabel,
  };
}

// 🔹 Monitor de recursos + sparkline "real + hype visual"
export function useSystemStats() {
  const [stats, setStats] = useState({
    deviceType: "unknown",
    online: typeof navigator !== "undefined" ? navigator.onLine : true,
    networkType: "desconocido",
    downlinkMbps: null,
    rttMs: null,
    memoryUsedMb: null,
    memoryLimitMb: null,
    batterySupported: false,
    batteryLevel: null,
    batteryCharging: null,
    netHistory: Array(24).fill(0), // 24 puntos para el sparkline
  });

  const batteryRef = useRef(null);

  // Battery API
  useEffect(() => {
    let cancelled = false;

    async function setupBattery() {
      try {
        if (!("getBattery" in navigator)) return;
        const batt = await navigator.getBattery();
        if (cancelled) return;

        batteryRef.current = batt;
        setStats((prev) => ({
          ...prev,
          batterySupported: true,
          batteryLevel: batt.level,
          batteryCharging: batt.charging,
        }));
      } catch (e) {
        console.warn("Battery API no disponible o falló:", e);
      }
    }

    setupBattery();

    return () => {
      cancelled = true;
    };
  }, []);

  // Eventos online/offline
  useEffect(() => {
    const handleOnline = () =>
      setStats((prev) => ({
        ...prev,
        online: true,
      }));
    const handleOffline = () =>
      setStats((prev) => ({
        ...prev,
        online: false,
      }));

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Actualización periódica de stats + sparkline
  useEffect(() => {
    const update = () => {
      setStats((prev) => {
        // Tipo de dispositivo
        let deviceType = "desktop";
        if (typeof navigator !== "undefined") {
          const ua = navigator.userAgent || navigator.vendor || "";
          if (/Mobi|Android|iPhone|iPad|iPod/i.test(ua)) {
            deviceType = "mobile";
          }
        } else if (typeof window !== "undefined") {
          if (window.innerWidth < 768) deviceType = "mobile";
        }

        // NetworkInformation API
        let networkType = "desconocido";
        let downlinkMbps = null;
        let rttMs = null;

        const connection =
          navigator.connection ||
          navigator.mozConnection ||
          navigator.webkitConnection;

        if (connection) {
          networkType = connection.effectiveType || networkType;
          if (typeof connection.downlink === "number") {
            downlinkMbps = connection.downlink; // Mbps
          }
          if (typeof connection.rtt === "number") {
            rttMs = connection.rtt;
          }
        }

        // Memoria
        let memoryUsedMb = null;
        let memoryLimitMb = null;
        if (performance && performance.memory) {
          memoryUsedMb = performance.memory.usedJSHeapSize / (1024 * 1024);
          memoryLimitMb = performance.memory.jsHeapSizeLimit / (1024 * 1024);
        }

        // Batería
        let batteryLevel = prev.batteryLevel;
        let batteryCharging = prev.batteryCharging;
        if (batteryRef.current) {
          batteryLevel = batteryRef.current.level;
          batteryCharging = batteryRef.current.charging;
        }

        // 📈 Sparkline: base real + jitter visual
        const mbps = typeof downlinkMbps === "number" ? downlinkMbps : 0;

        // Rango útil real: 0–20 Mb/s (más sensible)
        const maxRef = 20;
        const baseNorm = mbps > 0 ? Math.max(0, Math.min(1, mbps / maxRef)) : 0;

        // Jitter visual ±15% alrededor del valor base (sin tocar el número real)
        let norm = baseNorm;
        if (mbps > 0) {
          const jitterRange = 0.15; // 15%
          const jitter = (Math.random() * 2 - 1) * jitterRange;
          norm = Math.max(0, Math.min(1, baseNorm + jitter));
        } else {
          // Sin info de downlink: si está online, un poquitico de vida; si offline, cero
          if (prev.online) {
            const jitterBase = 0.1;
            const jitter = (Math.random() * 2 - 1) * 0.05; // ±5%
            norm = Math.max(0, Math.min(1, jitterBase + jitter));
          } else {
            norm = 0;
          }
        }

        const prevHistory = prev.netHistory || [];
        const newHistory = [...prevHistory.slice(1), norm];

        return {
          ...prev,
          deviceType,
          networkType,
          downlinkMbps,
          rttMs,
          memoryUsedMb,
          memoryLimitMb,
          batterySupported: prev.batterySupported || !!batteryRef.current,
          batteryLevel,
          batteryCharging,
          netHistory: newHistory,
        };
      });
    };

    update();
    const id = setInterval(update, 1000); // 1 segundo
    return () => clearInterval(id);
  }, []);

  return stats;
}
