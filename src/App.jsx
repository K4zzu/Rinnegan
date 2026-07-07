// src/App.jsx
import { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Terminal from "./components/Terminal";
import LoginPanel from "./components/LoginPanel";
import { getToken, me, logout, setUnauthorizedHandler } from "./services/api";

function Layout({ children }) {
  return (
    <div className="min-h-dvh bg-slate-950 text-green-400 flex items-center justify-center px-2 py-3 sm:px-4 sm:py-4 md:px-6">
      <div
        className="
          w-full
          max-w-4xl
          h-[88dvh]
          md:h-[90dvh]
          rounded-xl
          border border-green-500/40
          shadow-lg
          overflow-hidden
          relative
        "
      >
        {/* Efecto scanlines */}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0)_50%,rgba(0,0,0,0.35)_50%)] bg-[length:100%_4px] opacity-40 mix-blend-soft-light" />
        {/* Glow verde suave */}
        <div className="pointer-events-none absolute inset-0 bg-green-500/10 blur-3xl" />

        {/* Contenido real */}
        <div className="relative z-10 h-full">
          {children}
        </div>
      </div>
    </div>
  );
}

function NotFoundPage() {
  return (
    <div className="p-4 font-mono text-sm text-red-400">
      404 – Ruta no encontrada.
    </div>
  );
}

export default function App() {
  // undefined = cargando (validando token), null = sin sesión, {} = autenticado.
  // Sin token, el estado inicial ya es null (evita setState síncrono en el effect).
  const [user, setUser] = useState(() => (getToken() ? undefined : null));

  useEffect(() => {
    // Un 401 en cualquier llamada cierra la sesión.
    setUnauthorizedHandler(() => setUser(null));

    if (getToken()) {
      me()
        .then((u) => setUser(u))
        .catch(() => setUser(null));
    }
  }, []);

  const handleLogout = () => {
    logout();
    setUser(null);
  };

  if (user === undefined) return null; // breve carga inicial

  if (!user) {
    return (
      <Layout>
        <LoginPanel onAuthed={setUser} />
      </Layout>
    );
  }

  return (
    <Router basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route
          path="/"
          element={
            <Layout>
              <Terminal user={user} onLogout={handleLogout} />
            </Layout>
          }
        />
        <Route
          path="*"
          element={
            <Layout>
              <NotFoundPage />
            </Layout>
          }
        />
      </Routes>
    </Router>
  );
}
