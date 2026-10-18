import { Wordmark } from "@/components/tg/logo";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { SIM_USER, getSimUser, signInSimulated } from "@/lib/tokengate/sim-auth";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Iniciar sesión — blinka" },
      { name: "description", content: "Accede al agente pagador de blinka." },
      { property: "og:title", content: "Iniciar sesión — blinka" },
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
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"
      />
    </svg>
  );
}

function Login() {
  const [step, setStep] = useState<"idle" | "connecting" | "account">("idle");
  const navigate = useNavigate();

  // Si ya hay sesión simulada, ir directo al panel.
  useEffect(() => {
    if (getSimUser()) navigate({ to: "/app", replace: true });
  }, [navigate]);

  const startGoogleFlow = () => {
    setStep("connecting");
    // Flujo simulado: no hay autenticación real, solo se queman los datos.
    window.setTimeout(() => setStep("account"), 900);
  };

  const confirmAccount = () => {
    signInSimulated();
    navigate({ to: "/app" });
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border/70 bg-card p-8 shadow-soft">
        <div className="mb-8">
          <Wordmark />
        </div>
        <h1 className="display text-3xl text-foreground">Tu agente paga solo lo que debe.</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Entra para revisar decisiones, reglas y aprobaciones.
        </p>

        {step === "account" ? (
          <div className="mt-8" role="dialog" aria-label="Elegir cuenta de Google">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Elegir cuenta · simulado
            </p>
            <button
              type="button"
              onClick={confirmAccount}
              className="mt-3 flex w-full items-center gap-3 rounded-xl border border-input bg-background p-3 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-foreground text-sm font-semibold text-background">
                {SIM_USER.initials}
              </span>
              <span className="flex min-w-0 flex-col leading-tight">
                <span className="truncate text-sm font-medium text-foreground">
                  {SIM_USER.name}
                </span>
                <span className="truncate text-xs text-muted-foreground">{SIM_USER.email}</span>
              </span>
            </button>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Demostración: no se valida ninguna cuenta real.
            </p>
          </div>
        ) : (
          <button
            type="button"
            onClick={startGoogleFlow}
            disabled={step === "connecting"}
            className="mt-8 flex h-11 w-full items-center justify-center gap-3 rounded-full border border-input bg-background text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
          >
            <GoogleIcon />
            {step === "connecting" ? "Conectando con Google…" : "Continuar con Google"}
          </button>
        )}

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Cada decisión tiene reglas, límites y una razón detrás.
        </p>
      </div>
    </main>
  );
}
