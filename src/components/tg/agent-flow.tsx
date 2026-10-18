// "Cómo trabaja tu agente": the architecture as a live flow with this period's numbers.
// Invoice in → Claude reads → rules decide → JEV verifies → outcome → signed record.
import { Link } from "@tanstack/react-router";
import {
  Cpu,
  Fingerprint,
  Gavel,
  Inbox,
  ScanText,
  ShieldCheck,
  Waypoints,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Strands } from "./line-art";
import { CountUp } from "./primitives";

type To = "/app/facturas" | "/app/ajustes" | "/app/auditoria" | "/app/aprobaciones";

type Step = {
  icon: LucideIcon;
  title: string;
  value: number;
  of?: number;
  unit: string;
  sub: string;
  to: To;
  accent?: boolean;
};

const PRINCIPLES = ["La IA solo lee", "Tus reglas deciden", "JEV verifica", "Tú apruebas lo raro"];

export function AgentFlow({
  received,
  read,
  rules,
  jevAgree,
  paid,
  asked,
  stopped,
  events,
}: {
  received: number;
  read: number;
  rules: number;
  jevAgree: number;
  paid: number;
  asked: number;
  stopped: number;
  events: number;
}) {
  const steps: Step[] = [
    {
      icon: Inbox,
      title: "Llega la factura",
      value: received,
      unit: "recibidas",
      sub: "Por correo, PDF, foto o chat",
      to: "/app/facturas",
    },
    {
      icon: ScanText,
      title: "Claude la lee",
      value: read,
      unit: "leídas",
      sub: "Quién cobra, cuánto, moneda y fecha",
      to: "/app/facturas",
    },
    {
      icon: ShieldCheck,
      title: "Tus reglas deciden",
      value: rules,
      unit: "reglas",
      sub: "Límites, contratos, duplicados y presupuesto",
      to: "/app/ajustes",
    },
    {
      icon: Cpu,
      title: "JEV verifica",
      value: jevAgree,
      of: received,
      unit: "coinciden",
      sub: "TypeSafe AI decide otra vez con un esquema tipado",
      to: "/app/auditoria",
      accent: true,
    },
  ];
  const total = Math.max(1, paid + asked + stopped);

  return (
    <section
      aria-labelledby="flow-title"
      className="relative mb-5 overflow-hidden rounded-[20px] border border-border bg-gradient-to-br from-card to-background"
    >
      {/* Fondo: hilos que entran abiertos, pasan por la misma "puerta" y salen ordenados */}
      <Strands className="opacity-90" />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-64 w-[38rem] max-w-full -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl"
      />

      <div className="relative p-6 sm:p-8">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-xl">
            <p className="eyebrow flex items-center gap-1.5">
              <Waypoints className="h-3.5 w-3.5" />
              Cómo trabaja tu agente
            </p>
            <h2 id="flow-title" className="display mt-2 text-[30px] sm:text-[36px]">
              Cada factura cruza la misma puerta.
            </h2>
          </div>
          <ul className="flex flex-wrap gap-1.5">
            {PRINCIPLES.map((p) => (
              <li
                key={p}
                className="rounded-full border border-border/80 bg-card/70 px-3 py-1 text-xs text-muted-foreground backdrop-blur"
              >
                {p}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative">
          {/* Línea de metro con un pulso que viaja de paso en paso (pantallas anchas) */}
          <span
            aria-hidden
            className="absolute left-[4%] right-[4%] top-[22px] hidden h-px overflow-hidden bg-gradient-to-r from-primary/10 via-primary/40 to-primary/10 2xl:block"
          >
            <span className="tg-track-glow absolute inset-y-0 w-40 bg-gradient-to-r from-transparent via-primary to-transparent" />
          </span>

          <ol className="grid gap-x-4 gap-y-6 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-[repeat(4,minmax(0,1fr))_minmax(0,1.3fr)_minmax(0,1fr)]">
            {steps.map((s, i) => (
              <StepCard key={s.title} step={s} index={i} />
            ))}

            <li className="tg-step flex flex-col" style={{ animationDelay: "440ms" }}>
              <Node icon={Gavel} />
              <div className="relative mt-3 flex flex-1 flex-col overflow-hidden rounded-2xl border border-border/80 bg-card/75 p-4 backdrop-blur">
                <Numeral n={5} />
                <span className="text-[15px] font-medium">El agente decide</span>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <Outcome to="/app/facturas" n={paid} label="Pagadas" tone="success" />
                  <Outcome
                    to="/app/aprobaciones"
                    n={asked}
                    label="Piden permiso"
                    tone="warning"
                    strong={asked > 0}
                  />
                  <Outcome to="/app/facturas" n={stopped} label="Frenadas" tone="destructive" />
                </div>
                <div className="mt-3 flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-muted">
                  <span
                    className="bar-grow bg-success"
                    style={{ width: `${(paid / total) * 100}%` }}
                  />
                  <span
                    className="bar-grow bg-warning"
                    style={{ width: `${(asked / total) * 100}%` }}
                  />
                  <span
                    className="bar-grow bg-destructive"
                    style={{ width: `${(stopped / total) * 100}%` }}
                  />
                </div>
              </div>
            </li>

            <StepCard
              index={5}
              step={{
                icon: Fingerprint,
                title: "Queda registrado",
                value: events,
                unit: "eventos firmados",
                sub: "Cada decisión explicada y sellada con hash",
                to: "/app/auditoria",
              }}
            />
          </ol>
        </div>
      </div>
    </section>
  );
}

function Node({ icon: Icon, accent = false }: { icon: LucideIcon; accent?: boolean }) {
  return (
    <span
      className={cn(
        "relative z-10 flex h-11 w-11 items-center justify-center rounded-full border-2",
        accent
          ? "tg-node-pulse border-primary bg-primary text-primary-foreground"
          : "border-primary/40 bg-background text-primary",
      )}
    >
      <Icon className="h-[18px] w-[18px]" aria-hidden />
    </span>
  );
}

/** Big faint step number in the display face. */
function Numeral({ n }: { n: number }) {
  return (
    <span
      aria-hidden
      className="display pointer-events-none absolute right-3 top-1.5 select-none text-[44px] leading-none text-foreground/[0.07]"
    >
      {String(n).padStart(2, "0")}
    </span>
  );
}

function StepCard({ step: s, index }: { step: Step; index: number }) {
  return (
    <li className="tg-step flex flex-col" style={{ animationDelay: `${index * 110}ms` }}>
      <Node icon={s.icon} accent={!!s.accent} />
      <Link
        to={s.to}
        className={cn(
          "lift group relative mt-3 flex flex-1 flex-col overflow-hidden rounded-2xl border bg-card/75 p-4 backdrop-blur",
          s.accent ? "border-primary/45" : "border-border/80",
        )}
      >
        <Numeral n={index + 1} />
        <span className="text-[15px] font-medium group-hover:text-primary">{s.title}</span>
        <span className="mt-2 flex flex-wrap items-baseline gap-x-1.5">
          <span className={cn("display text-[40px] leading-none", s.accent && "text-primary")}>
            <CountUp value={s.value} />
          </span>
          {s.of != null && (
            <span className="display text-xl leading-none text-muted-foreground">/{s.of}</span>
          )}
          <span className="text-sm text-muted-foreground">{s.unit}</span>
        </span>
        <span className="mt-2 text-xs text-muted-foreground">{s.sub}</span>
      </Link>
    </li>
  );
}

const TONE = {
  success: "text-success",
  warning: "text-warning-foreground dark:text-warning",
  destructive: "text-destructive",
} as const;

function Outcome({
  to,
  n,
  label,
  tone,
  strong = false,
}: {
  to: To;
  n: number;
  label: string;
  tone: keyof typeof TONE;
  strong?: boolean;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "flex flex-col rounded-xl px-2 py-1.5 transition-colors hover:bg-muted",
        strong && "bg-warning/12 ring-1 ring-warning/40",
      )}
    >
      <span className={cn("display text-[32px] leading-none", TONE[tone])}>
        <CountUp value={n} />
      </span>
      <span className="mt-1 text-[11px] leading-tight text-muted-foreground">{label}</span>
    </Link>
  );
}
