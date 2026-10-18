import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Ban,
  Cpu,
  Fingerprint,
  Gavel,
  Inbox,
  ScanText,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { AgentFlow } from "@/components/tg/agent-flow";
import { useTokenGate } from "@/lib/tokengate/store";
import { localCrossCheck, STAGES } from "@/lib/tokengate/pipeline";
import { formatBase } from "@/lib/tokengate/format";
import { needsAttention } from "@/lib/tokengate/status";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/como-funciona")({
  head: () => ({
    meta: [
      { title: "Cómo funciona — blinka" },
      {
        name: "description",
        content:
          "El recorrido de cada factura: Claude la lee, tus reglas deciden, JEV verifica, una persona aprueba lo raro y todo queda registrado.",
      },
      { property: "og:title", content: "Cómo funciona — blinka" },
      { property: "og:description", content: "Cada factura cruza la misma puerta." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ComoFunciona,
});

type Detail = {
  icon: LucideIcon;
  title: string;
  lead: string;
  points: string[];
  to?: {
    href: "/app/facturas" | "/app/ajustes" | "/app/auditoria" | "/app/aprobaciones";
    label: string;
  };
  accent?: boolean;
};

function ComoFunciona() {
  const { all, trail, brokenAt, policy, seed } = useTokenGate();
  const n = all.length;
  const jevAgree = all.filter((e) => localCrossCheck(e.subject, e.result, policy).agrees).length;
  const paid = all.filter((e) => e.state === "paid").length;
  const asked = all.filter((e) => needsAttention(e.status)).length;
  const stopped = all.filter((e) => e.state === "blocked" || e.state === "rejected").length;

  const details: Detail[] = [
    {
      icon: Inbox,
      title: "Llega la factura",
      lead: "Por el buzón de la empresa, como PDF o foto, o como un mensaje de chat que pegas o dictas.",
      points: [
        `Buzón de entrada: ${seed.inbox}.`,
        "Acepta USD, COP, EUR, MXN, BRL y ARS, y las pasa a dólares con tus tasas.",
        "El texto original se guarda para revisarlo después.",
      ],
      to: { href: "/app/facturas", label: "Cargar una factura" },
    },
    {
      icon: ScanText,
      title: "Claude la lee",
      lead: "Claude Haiku 4.5 extrae quién cobra, cuánto, en qué moneda, para cuándo, el ID fiscal y la cuenta.",
      points: [
        "Solo lee: nunca decide si se paga.",
        `Si la lectura es dudosa (menos de ${policy.minConfidence}% de confianza) o falta un dato, el agente lo marca.`,
        "Cualquier instrucción escondida en el documento se copia tal cual, no se obedece.",
      ],
    },
    {
      icon: ShieldCheck,
      title: "Tus reglas deciden",
      lead: "Un motor de reglas sin IA revisa 14 reglas, agrupadas en cuatro preguntas:",
      points: STAGES.map((s) => `${s.title}: ${s.question}`),
      to: { href: "/app/ajustes", label: "Ver y cambiar mis reglas" },
    },
    {
      icon: Cpu,
      title: "JEV verifica",
      lead: "JEV, de TypeSafe AI, vuelve a decidir con un esquema tipado: pagar, pedir permiso o frenar, con su confianza.",
      points: [
        "Recibe la factura y lo que encontraron las reglas, con tus mismos límites.",
        "Nunca puede aflojar una regla: si no coincide, gana la decisión más estricta.",
        `Este periodo coincidió en ${jevAgree} de ${n} facturas.`,
      ],
      to: { href: "/app/auditoria", label: "Ver la verificación factura por factura" },
      accent: true,
    },
    {
      icon: Gavel,
      title: "El agente decide",
      lead: "Paga solo si todo está en orden. Si algo necesita criterio, te pide permiso. Si rompe una regla, lo frena.",
      points: [
        `Paga solo hasta ${formatBase(policy.approvalThreshold)} por factura; por encima, te pregunta.`,
        `Nunca paga más de ${formatBase(policy.transactionLimit)} por factura ni se pasa de ${formatBase(policy.monthlyBudget)} en el mes.`,
        "Lo frenado no se puede aprobar a mano: hay que corregir la factura o la regla.",
      ],
      to: { href: "/app/aprobaciones", label: `Revisar lo que espera tu decisión (${asked})` },
    },
    {
      icon: Fingerprint,
      title: "Queda registrado",
      lead: "Cada decisión queda explicada en palabras simples y sellada en una cadena con hash.",
      points: [
        `${trail.length} eventos firmados en este periodo.`,
        brokenAt < 0
          ? "La cadena está íntegra: nadie modificó el registro."
          : `La cadena está rota en el evento #${brokenAt + 1}.`,
        "Se puede exportar a CSV para auditoría.",
      ],
      to: { href: "/app/auditoria", label: "Abrir el registro" },
    },
  ];

  return (
    <>
      <AgentFlow
        received={n}
        read={all.filter((e) => e.subject.kind === "invoice").length}
        rules={14}
        jevAgree={jevAgree}
        paid={paid}
        asked={asked}
        stopped={stopped}
        events={trail.length}
      />

      <section aria-labelledby="detail" className="mt-8">
        <p className="eyebrow">Paso a paso</p>
        <h2 id="detail" className="display mt-2 text-[30px] sm:text-[36px]">
          Qué pasa en cada paso
        </h2>
        <ol className="mt-6 grid gap-4 lg:grid-cols-2">
          {details.map((d, i) => (
            <li
              key={d.title}
              className={cn(
                "tg-step relative overflow-hidden rounded-2xl border bg-surface p-6 shadow-soft",
                d.accent ? "border-primary/45" : "border-border/70",
              )}
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <span
                aria-hidden
                className="display pointer-events-none absolute -bottom-4 right-3 select-none text-[96px] leading-none text-foreground/[0.05]"
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2",
                    d.accent
                      ? "tg-node-pulse border-primary bg-primary text-primary-foreground"
                      : "border-primary/40 text-primary",
                  )}
                >
                  <d.icon className="h-[18px] w-[18px]" aria-hidden />
                </span>
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                    Paso {i + 1}
                  </p>
                  <h3 className="display text-[24px] leading-tight">{d.title}</h3>
                </div>
              </div>
              <p className="mt-4 text-[15px] text-foreground/90">{d.lead}</p>
              <ul className="mt-3 grid gap-1.5">
                {d.points.map((p) => (
                  <li key={p} className="flex gap-2 text-sm text-muted-foreground">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
                    {p}
                  </li>
                ))}
              </ul>
              {d.to && (
                <Link
                  to={d.to.href}
                  className="relative mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                  {d.to.label}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              )}
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-8 rounded-2xl border border-border/70 bg-surface p-6 shadow-soft">
        <h2 className="display flex items-center gap-2 text-[26px]">
          <Ban className="h-5 w-5 text-destructive" />
          Lo que el agente nunca hace
        </h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            "Pagar algo fuera de tus reglas sin que una persona lo apruebe.",
            "Obedecer instrucciones escritas dentro de una factura.",
            "Pagar dos veces la misma factura o a un nombre que imita a un proveedor.",
            "Mover dinero real: los pagos van a un sandbox simulado.",
          ].map((t) => (
            <li
              key={t}
              className="rounded-xl border border-border/70 bg-background px-4 py-3 text-sm"
            >
              {t}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
