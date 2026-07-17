// src/components/GodEye.jsx
// La firma de godeye: un ojo/sensor Rinnegan vivo. Anillos concéntricos que
// giran, tomoe orbitando, una pupila que enfoca al escanear y un "lock" de
// objetivo cuando la identidad se resuelve. Hereda el acento con currentColor.
//
// state: "idle" | "scanning" | "locked"

const TOMOE = [0, 120, 240]; // tres tomoe (Rinnegan)

export default function GodEye({ state = "idle", className = "", style }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={`godeye ${className}`}
      data-state={state}
      style={style}
      aria-hidden="true"
      fill="none"
    >
      {/* Halo de fósforo */}
      <circle className="ge-halo" cx="50" cy="50" r="46" />

      {/* Anillos concéntricos (ondas), giran en sentidos opuestos */}
      <circle
        className="ge-ring ge-ring-1"
        cx="50"
        cy="50"
        r="44"
        strokeDasharray="3 7"
      />
      <circle
        className="ge-ring ge-ring-2"
        cx="50"
        cy="50"
        r="35"
        strokeDasharray="10 6"
      />
      <circle className="ge-ring ge-ring-3" cx="50" cy="50" r="26" />

      {/* Tomoe orbitando el iris */}
      <g className="ge-tomoe">
        {TOMOE.map((deg) => (
          <circle
            key={deg}
            cx="50"
            cy="24"
            r="2.6"
            transform={`rotate(${deg} 50 50)`}
          />
        ))}
      </g>

      {/* Barrido de radar (solo al escanear) */}
      <g className="ge-sweep">
        <line x1="50" y1="50" x2="50" y2="8" />
      </g>

      {/* Iris + pupila (enfoca/dilata) */}
      <circle className="ge-iris" cx="50" cy="50" r="15" />
      <circle className="ge-pupil" cx="50" cy="50" r="7" />
      <circle className="ge-core" cx="50" cy="50" r="2.4" />

      {/* Reticón de objetivo — aparece en "locked" */}
      <g className="ge-reticle">
        <path d="M14 22 V14 H22" />
        <path d="M86 22 V14 H78" />
        <path d="M14 78 V86 H22" />
        <path d="M86 78 V86 H78" />
      </g>
    </svg>
  );
}
