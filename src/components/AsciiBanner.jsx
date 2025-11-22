// src/components/AsciiBanner.jsx

const DEFAULT_BANNER = String.raw`
   ____       _                       _       
  / __ \ ___ (_)____ _   ____  ____  (_)___ _
 / / / // _ \/ // __ \ / __ \/ __ \/ // _ \/
/ /_/ //  __/ // / / // /_/ / / / / //  __/
/_____/ \___/_//_/ /_(_)____/_/ /_/_/ \___/ 

        OSINT Terminal
`;

export default function AsciiBanner({ className = "", banner }) {
  const text = banner || DEFAULT_BANNER;

  return (
    <pre
      className={
        "text-[9px] leading-[10px] md:text-xs md:leading-4 mb-3 select-none " +
        className
      }
    >
      {text}
    </pre>
  );
}
