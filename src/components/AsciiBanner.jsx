// src/components/AsciiBanner.jsx
import { useEffect, useState } from "react";

const DEFAULT_BANNER = String.raw`

                                                           @@@@@@@@@@@@@@@@@@@@@@@@@@
                                                  @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
                                            @@@@@@@@@@@@@@@@@@@@@@@@%%%###@###%@@@@@
                                       @@@@@@@@@@@@@@@@@@%@@#######%@#####@####@@@@
                                  @@@@@@@@@@@@@@@%@%*######%%*#####*@%#####%##%@@@@
                              @@@@@@@@@@@@@%#######%@#######@#######%@**##*@##@@@@
                           @@@@@@@@@@@%####*#########%##**+++@=======@+=*##%#@@@@
                         @@@@@@@@%@%############**+++#*======%+======%*=###%@@@@@
                      @@@@@@@@%###@*######@@@@#++++++*%======*#======##=*#*@@@@@
                    @@@@@@@@######@###*++#@@@@@++++++*@======*#======#*+##@@@@@
                 @@@@@@@%##@######@+++++++#@@%*++++++##======#+======#+*#%@@@@
                @@@@@@#*###@###+==+%+++++++++++++++++@=======@=======%+#%@@@@
              @@@@@%@######@+======*#+++++++++++++++#*======+#======+##%@@@@
            @@@@@@##@####+=+%=======+%++++++++++++*@+=======%=======%#@@@@@
           @@@@@####%@#+====*%========*@#++++++*%%+========%=======#@@@@@@
         @@@@@%######@+======+%===========================@=======*@@@@@
        @@@@@#%####+==@========%*=======================#*======+@@@@@@
       @@@@###%##+=====%*========%#===================##======*@@@@@@
      @@@@#####%========+%=========*%%*============*%+====+#@@@@@@@
     @@@@##*#+==#=========+%===========+*#%%%%%%*+====+%@@@@@@@@
    @@@%@##*=====*+=========+@*================+*%@@@@@@@@@@
   @@@%##%========+%===========*@#++##%%@@@@@@@@@@@@@@@
  @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
  @@@@@@@@@@

        Rinnegan OSINT Terminal Tool
`;

const GLYPHS = "@#%=+*/\\|<>x░▒▓·".split("");
const rndGlyph = () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
const isFixed = (c) => c === " " || c === "\n" || c === "\r";

export default function AsciiBanner({ className = "", banner, animate = true }) {
  const text = banner || DEFAULT_BANNER;
  const [display, setDisplay] = useState(text);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!animate || reduce) {
      setDisplay(text);
      return;
    }

    const chars = Array.from(text);
    const idxs = [];
    for (let i = 0; i < chars.length; i++) if (!isFixed(chars[i])) idxs.push(i);

    // Orden de revelado aleatorio (desencriptado no lineal).
    const order = [...idxs];
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }

    const locked = new Set();
    let revealed = 0;
    const perFrame = Math.max(1, Math.ceil(order.length / 34)); // ~1s
    let tick = 0;

    const id = setInterval(() => {
      tick++;
      const out = chars.slice();

      if (revealed < order.length) {
        // Fase desencriptado: fija un lote, el resto sigue "reescribiéndose".
        for (let k = 0; k < perFrame && revealed < order.length; k++) {
          locked.add(order[revealed++]);
        }
        for (const i of idxs) if (!locked.has(i)) out[i] = rndGlyph();
      } else {
        // Fase ambiental: pocos caracteres glitchean y vuelven (cada 3 frames).
        if (tick % 3 === 0) {
          const n = Math.max(1, Math.ceil(idxs.length * 0.01));
          for (let k = 0; k < n; k++) {
            out[idxs[Math.floor(Math.random() * idxs.length)]] = rndGlyph();
          }
        } else {
          setDisplay(text);
          return;
        }
      }
      setDisplay(out.join(""));
    }, 34);

    return () => clearInterval(id);
  }, [text, animate]);

  return (
    <pre
      aria-hidden="true"
      className={
        "text-[9px] leading-[10px] md:text-xs md:leading-4 mb-3 select-none " +
        "max-w-full overflow-x-auto " +
        className
      }
    >
      {display}
    </pre>
  );
}
