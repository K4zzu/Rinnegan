// src/components/ErrorBoundary.jsx
import { Component } from "react";

// Los error boundaries en React siguen requiriendo un componente de clase
// (no hay equivalente con hooks para componentDidCatch todavía).
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("ErrorBoundary capturó un error:", error, info);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-red-400 font-mono text-sm flex items-center justify-center p-6">
          <div className="max-w-lg">
            <p className="mb-2">[FATAL] La terminal encontró un error inesperado.</p>
            <pre className="text-xs text-red-300/80 whitespace-pre-wrap mb-4">
              {this.state.error?.message || "Error desconocido"}
            </pre>
            <button
              type="button"
              onClick={this.handleReload}
              className="border border-red-500/50 px-3 py-1 text-red-300 hover:bg-red-500/10"
            >
              Reiniciar terminal
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
