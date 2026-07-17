// src/components/LoginPanel.jsx
import { useState } from "react";
import { login, register, me } from "../services/api";
import GodEye from "./GodEye";
import { sound } from "../utils/sound";

export default function LoginPanel({ onAuthed }) {
  const [mode, setMode] = useState("login"); // "login" | "register"
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [invite, setInvite] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isRegister = mode === "register";

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    sound.unlock();
    if (!username.trim() || !password) {
      setError("Usuario y contraseña son obligatorios.");
      return;
    }
    if (isRegister && !invite.trim()) {
      setError("El código de invitación es obligatorio.");
      return;
    }
    setLoading(true);
    try {
      if (isRegister) {
        await register(username.trim(), password, invite.trim());
      } else {
        await login(username.trim(), password);
      }
      const user = await me();
      sound.lock();
      onAuthed(user);
    } catch (err) {
      sound.error();
      setError(err?.message || "No se pudo autenticar.");
      setLoading(false);
    }
  };

  const field =
    "w-full rounded-sm border border-violet-500/30 bg-black/40 px-2 py-1.5 text-violet-100 outline-none focus:border-fuchsia-400/70 focus:shadow-[0_0_8px_rgba(232,121,249,0.25)] transition";
  const labelCls =
    "mb-1 block text-[0.65rem] text-violet-300/60 uppercase tracking-[0.2em]";

  return (
    <div className="h-full w-full flex flex-col items-center justify-center p-4 font-mono text-violet-200">
      {/* El ojo */}
      <div className="ge-boot h-20 w-20 mb-3 text-violet-400">
        <GodEye state="scanning" />
      </div>
      <div className="phosphor text-violet-300 tracking-[0.5em] text-xl mb-1">
        GODEYE
      </div>
      <p className="text-[0.65rem] text-violet-300/40 tracking-widest uppercase mb-5">
        all-source intelligence
      </p>

      <form
        onSubmit={onSubmit}
        className="w-full max-w-xs rounded-md border border-violet-500/30 bg-violet-500/[0.03] p-5 shadow-[0_0_40px_rgba(139,92,246,0.08)]"
      >
        <label className="mb-3 block">
          <span className={labelCls}>usuario</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoFocus
            className={field}
          />
        </label>

        <label className="mb-3 block">
          <span className={labelCls}>contraseña</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={isRegister ? "new-password" : "current-password"}
            className={field}
          />
        </label>

        {isRegister && (
          <label className="mb-3 block">
            <span className={labelCls}>código de invitación</span>
            <input
              value={invite}
              onChange={(e) => setInvite(e.target.value)}
              className={field}
            />
          </label>
        )}

        {error && (
          <p className="mb-3 text-xs text-red-400 break-words">[!] {error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-sm border border-violet-400/50 bg-violet-500/10 py-2 text-sm uppercase tracking-[0.25em] text-violet-200 hover:bg-violet-500/20 hover:shadow-[0_0_14px_rgba(139,92,246,0.35)] transition disabled:opacity-50"
        >
          {loading ? "abriendo el ojo…" : isRegister ? "registrarse" : "entrar"}
        </button>

        <button
          type="button"
          onClick={() => {
            setMode(isRegister ? "login" : "register");
            setError("");
          }}
          className="mt-3 w-full text-center text-[0.7rem] text-violet-300/50 hover:text-violet-200"
        >
          {isRegister
            ? "¿ya tienes cuenta? inicia sesión"
            : "¿sin cuenta? regístrate con un código"}
        </button>
      </form>
    </div>
  );
}
