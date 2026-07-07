// src/components/LoginPanel.jsx
import { useState } from "react";
import { login, register, me } from "../services/api";

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
      onAuthed(user);
    } catch (err) {
      setError(err?.message || "No se pudo autenticar.");
      setLoading(false);
    }
  };

  return (
    <div className="h-full w-full flex items-center justify-center p-4 font-mono text-green-300">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-md border border-green-500/40 bg-black/30 p-5 shadow-lg"
      >
        <div className="mb-4 flex items-center gap-2 text-sm tracking-widest text-green-400">
          <span>◉</span>
          <span>RINNEGAN // ACCESO</span>
          <span className="flex-1 h-px bg-green-500/20" />
        </div>

        <label className="mb-3 block text-xs">
          <span className="mb-1 block text-green-400/70 uppercase tracking-wider">
            usuario
          </span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoFocus
            className="w-full rounded-sm border border-green-500/30 bg-black/40 px-2 py-1.5 text-green-200 outline-none focus:border-green-400/60"
          />
        </label>

        <label className="mb-3 block text-xs">
          <span className="mb-1 block text-green-400/70 uppercase tracking-wider">
            contraseña
          </span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={isRegister ? "new-password" : "current-password"}
            className="w-full rounded-sm border border-green-500/30 bg-black/40 px-2 py-1.5 text-green-200 outline-none focus:border-green-400/60"
          />
        </label>

        {isRegister && (
          <label className="mb-3 block text-xs">
            <span className="mb-1 block text-green-400/70 uppercase tracking-wider">
              código de invitación
            </span>
            <input
              value={invite}
              onChange={(e) => setInvite(e.target.value)}
              className="w-full rounded-sm border border-green-500/30 bg-black/40 px-2 py-1.5 text-green-200 outline-none focus:border-green-400/60"
            />
          </label>
        )}

        {error && (
          <p className="mb-3 text-xs text-red-400 break-words">[!] {error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-sm border border-green-500/50 bg-green-500/10 py-2 text-sm uppercase tracking-widest text-green-300 hover:bg-green-500/20 disabled:opacity-50"
        >
          {loading
            ? "…"
            : isRegister
            ? "Registrarse"
            : "Iniciar sesión"}
        </button>

        <button
          type="button"
          onClick={() => {
            setMode(isRegister ? "login" : "register");
            setError("");
          }}
          className="mt-3 w-full text-center text-[0.7rem] text-green-400/60 hover:text-green-300"
        >
          {isRegister
            ? "¿Ya tienes cuenta? Inicia sesión"
            : "¿Sin cuenta? Regístrate con un código"}
        </button>
      </form>
    </div>
  );
}
