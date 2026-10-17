import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Iniciar sesión — TokenGate" },
      { name: "description", content: "Accede a TokenGate: el agente que paga y compra por ti." },
      { property: "og:title", content: "Iniciar sesión — TokenGate" },
      { property: "og:description", content: "El agente que paga y compra por ti." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Login,
});

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

function Login() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <span className="text-lg font-semibold tracking-tight text-foreground">TokenGate</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          El agente que paga y compra por ti.
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Entra o regístrate para gestionar tus agentes, límites y aprobaciones.
        </p>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            setTimeout(() => navigate({ to: "/app" }), 700);
          }}
          disabled={loading}
          className="mt-8 flex h-11 w-full items-center justify-center gap-3 rounded-md border border-input bg-background text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
        >
          <GoogleIcon />
          {loading ? "Conectando…" : "Continuar con Google"}
        </button>
        <p className="mt-3 text-center text-xs text-muted-foreground">Demo: entrarás al entorno de demostración de Acme Studio.</p>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Cada decisión tiene reglas, límites y una razón detrás.
        </p>
      </div>
    </main>
  );
}
