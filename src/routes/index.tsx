import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ShieldCheck,
  Workflow,
  SlidersHorizontal,
  FileSearch,
  ArrowRight,
  CheckCircle2,
  Clock,
  UserCheck,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TokenGate — El agente que paga y compra por ti" },
      {
        name: "description",
        content:
          "Delega compras y pagos de facturas a agentes de IA con límites, reglas y control humano.",
      },
      { property: "og:title", content: "TokenGate — El agente que paga y compra por ti" },
      {
        property: "og:description",
        content: "Reduce fricciones y automatiza tus pagos con decisiones explicables.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const benefits = [
  {
    icon: Workflow,
    title: "Automatización",
    text: "Menos revisión manual de facturas y aprobaciones repetitivas.",
  },
  {
    icon: SlidersHorizontal,
    title: "Control",
    text: "Presupuestos, límites de gasto, proveedores autorizados y umbrales de aprobación humana.",
  },
  {
    icon: FileSearch,
    title: "Trazabilidad",
    text: "Cada decisión explicada y registrada en un historial auditable.",
  },
];

const decisions = [
  { supplier: "Papelería Andina S.A.S.", amount: "$ 1.240.000", status: "Aprobada", icon: CheckCircle2, tone: "text-chart-4" },
  { supplier: "Cloud Servicios Ltda.", amount: "$ 8.900.000", status: "Requiere revisión", icon: UserCheck, tone: "text-secondary" },
  { supplier: "Transportes del Norte", amount: "$ 640.500", status: "En cola", icon: Clock, tone: "text-muted-foreground" },
];

function GoogleCta({ label }: { label: string }) {
  return (
    <Link
      to="/login"
      className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
    >
      {label}
      <ArrowRight className="h-4 w-4" />
    </Link>
  );
}

function Landing() {
  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <span className="font-semibold tracking-tight">TokenGate</span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/login"
            className="hidden h-11 items-center px-3 text-sm font-medium text-muted-foreground hover:text-foreground sm:inline-flex"
          >
            Iniciar sesión
          </Link>
          <Link
            to="/login"
            className="inline-flex h-11 items-center rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-muted"
          >
            Registrarse
          </Link>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl gap-12 px-4 pb-20 pt-12 sm:px-6 md:pt-20 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="mb-4 font-mono text-xs uppercase tracking-widest text-secondary">
              Pagos y compras con agentes
            </p>
            <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              El agente que paga y compra por ti.
            </h1>
            <p className="mt-4 text-xl font-medium text-primary">
              Reduce fricciones y automatiza tus pagos.
            </p>
            <p className="mt-4 max-w-lg text-muted-foreground">
              TokenGate permite que tus agentes gestionen facturas y compras dentro de límites
              definidos, con decisiones explicables y control humano cuando importa.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <GoogleCta label="Empezar con Google" />
              <Link
                to="/login"
                className="inline-flex h-11 items-center justify-center rounded-md border border-input px-5 text-sm font-medium hover:bg-muted"
              >
                Ya tengo cuenta
              </Link>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <span className="text-sm font-medium">Decisiones del agente</span>
              <span className="font-mono text-xs text-muted-foreground">Hoy · simulación</span>
            </div>
            <ul className="divide-y divide-border">
              {decisions.map((d) => (
                <li key={d.supplier} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{d.supplier}</p>
                    <p className="font-mono text-xs text-muted-foreground">{d.amount} COP</p>
                  </div>
                  <span className={`flex shrink-0 items-center gap-1.5 text-xs font-medium ${d.tone}`}>
                    <d.icon className="h-4 w-4" />
                    {d.status}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-3 rounded-md bg-muted p-3 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Razón: </span>
              Cloud Servicios supera el umbral de $ 5.000.000 definido para aprobación humana.
            </div>
          </div>
        </section>

        <section className="border-y border-border bg-card/50">
          <div className="mx-auto grid max-w-6xl gap-px px-4 py-16 sm:px-6 md:grid-cols-3 md:gap-10">
            {benefits.map((b) => (
              <div key={b.title} className="py-4">
                <b.icon className="h-5 w-5 text-primary" />
                <h2 className="mt-4 text-lg font-semibold">{b.title}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{b.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6">
          <h2 className="text-3xl font-semibold tracking-tight">
            Cada decisión tiene reglas, límites y una razón detrás.
          </h2>
          <p className="mt-4 text-muted-foreground">
            Prototipo: TokenGate no ejecuta pagos reales ni mueve dinero.
          </p>
          <div className="mt-8">
            <GoogleCta label="Crear cuenta con Google" />
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:justify-between sm:px-6">
          <span>© 2026 TokenGate</span>
          <span>Control financiero para agentes de IA</span>
        </div>
      </footer>
    </div>
  );
}
