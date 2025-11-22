// src/App.jsx
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Terminal from "./components/Terminal";

function Layout({ children }) {
  return (
    <div className="min-h-screen bg-slate-950 text-green-400 flex items-center justify-center px-2 py-4 sm:px-4 md:px-6">
      <div
        className="
          w-full 
          max-w-4xl 
          h-[80vh] 
          sm:h-[85vh] 
          md:h-[90vh] 
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


function TerminalPage() {
  return <Terminal />;
}

function AboutPage() {
  return (
    <div className="p-4 font-mono text-sm">
      <h1 className="text-lg font-bold mb-2 text-green-300">
        OSINT Terminal – Frontend
      </h1>
      <p className="text-green-100/80">
        Esta es una vista de ejemplo para futuras secciones (docs, settings, etc.).
      </p>
      <p className="mt-2 text-xs text-green-300/70">
        Ruta actual: <code>/about</code>
      </p>
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
  return (
    <Router basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route
          path="/"
          element={
            <Layout>
              <TerminalPage />
            </Layout>
          }
        />
        <Route
          path="/about"
          element={
            <Layout>
              <AboutPage />
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
