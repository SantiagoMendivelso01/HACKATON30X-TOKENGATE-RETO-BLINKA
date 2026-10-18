// The decision as a pipeline a finance person can follow: four questions the rules answer,
// the JEV cross-check, and the final decision. Problem steps open by themselves.
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Ban,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Cpu,
  FileSignature,
  Gauge,
  Gavel,
  Loader2,
  Minus,
  Radio,
  ScanText,
  UserRoundCheck,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { evaluateJevDecisionFn } from "@/lib/tokengate/jev.functions";
import {
  buildStages,
  crossCheck,
  JEV_OUTCOME_LABEL,
  jevInputFor,
  localCrossCheck,
  VERDICT,
  type CrossCheck,
  type StageId,
} from "@/lib/tokengate/pipeline";
import { statusMeta } from "@/lib/tokengate/status";
import type {
  DecisionResult,
  DecisionSubject,
  DisplayStatus,
  Policy,
  RuleStatus,
} from "@/lib/tokengate/types";

const STAGE_ICON: Record<StageId, LucideIcon> = {
  read: ScanText,
  who: UserRoundCheck,
  agreed: FileSignature,
  limits: Gauge,
};

const STATUS_UI: Record<
  RuleStatus,
  { icon: LucideIcon; label: string; node: string; text: string; line: string }
> = {
  passed: {
    icon: CheckCircle2,
    label: "En orden",
    node: "border-success/30 bg-success/10 text-success",
    text: "text-success",
    line: "bg-success/35",
  },
  needs_review: {
    icon: Clock3,
    label: "Necesita una persona",
    node: "border-warning/50 bg-warning/15 text-warning-foreground dark:text-warning",
    text: "text-warning-foreground dark:text-warning",
    line: "bg-border",
  },
  failed: {
    icon: XCircle,
    label: "No cumple",
    node: "border-destructive/40 bg-destructive/10 text-destructive",
    text: "text-destructive",
    line: "bg-border",
  },
  not_applicable: {
    icon: Minus,
    label: "No aplica",
    node: "border-border bg-muted text-muted-foreground",
    text: "text-muted-foreground",
    line: "bg-border",
  },
};

const FINAL_NODE: Record<"success" | "destructive" | "warning" | "info" | "neutral", string> = {
  success: "border-success bg-success text-white",
  destructive: "border-destructive bg-destructive text-white",
  warning: "border-warning bg-warning text-white",
  info: "border-foreground bg-foreground text-background",
  neutral: "border-border bg-muted text-muted-foreground",
};
const tone = (s: DisplayStatus) => statusMeta[s].tone;

function Step({
  index,
  icon: Icon,
  status,
  title,
  summary,
  last = false,
  open,
  onToggle,
  children,
  nodeClass,
  delay,
}: {
  index: number;
  icon: LucideIcon;
  status: RuleStatus;
  title: string;
  summary: React.ReactNode;
  last?: boolean;
  open?: boolean;
  onToggle?: () => void;
  children?: React.ReactNode;
  nodeClass?: string;
  delay: number;
}) {
  const ui = STATUS_UI[status];
  const flagged = status === "failed" || status === "needs_review";
  return (
    <li className="tg-step relative pb-5 pl-14 last:pb-0" style={{ animationDelay: `${delay}ms` }}>
      {!last && (
        <span
          aria-hidden
          className={cn("tg-line absolute bottom-0 left-[19px] top-11 w-0.5 rounded", ui.line)}
          style={{ animationDelay: `${delay + 120}ms` }}
        />
      )}
      <span
        className={cn(
          "absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-full border-2",
          nodeClass ?? ui.node,
        )}
      >
        <Icon className="h-[18px] w-[18px]" aria-hidden />
      </span>
      <div
        className={cn(
          "rounded-2xl border bg-card",
          flagged ? "shadow-soft" : "border-border/70",
          status === "failed" && "border-destructive/30",
          status === "needs_review" && "border-warning/45",
        )}
      >
        <button
          type="button"
          onClick={onToggle}
          disabled={!onToggle}
          aria-expanded={onToggle ? !!open : undefined}
          className="flex w-full items-start gap-3 rounded-2xl px-4 py-3 text-left enabled:hover:bg-muted/40"
        >
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                Paso {index}
              </span>
              <span className={cn("inline-flex items-center gap-1 text-xs font-medium", ui.text)}>
                <ui.icon className="h-3.5 w-3.5" aria-hidden />
                {ui.label}
              </span>
            </span>
            <span className="mt-0.5 block text-[15px] font-medium tracking-tight">{title}</span>
            <span className="mt-0.5 block text-sm text-muted-foreground">{summary}</span>
          </span>
          {onToggle && (
            <ChevronDown
              className={cn(
                "mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                open && "rotate-180",
              )}
              aria-hidden
            />
          )}
        </button>
        {open && children && <div className="border-t border-border/70 px-4 py-3">{children}</div>}
      </div>
    </li>
  );
}

export function DecisionPipeline({
  subject,
  result,
  status,
  policy,
}: {
  subject: DecisionSubject;
  result: DecisionResult;
  status: DisplayStatus;
  policy: Policy;
}) {
  const stages = useMemo(() => buildStages(result), [result]);
  const [open, setOpen] = useState<Set<string>>(
    () =>
      new Set(
        stages.filter((s) => s.status === "failed" || s.status === "needs_review").map((s) => s.id),
      ),
  );
  const toggle = (id: string) =>
    setOpen((o) => {
      const n = new Set(o);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const [check, setCheck] = useState<CrossCheck>(() => localCrossCheck(subject, result, policy));
  const [asking, setAsking] = useState(false);
  const runJev = useServerFn(evaluateJevDecisionFn);
  const askLive = async () => {
    setAsking(true);
    try {
      const jev = await runJev({ data: jevInputFor(subject, result, policy) });
      setCheck(crossCheck(result, jev));
    } finally {
      setAsking(false);
    }
  };

  const verdict = VERDICT[status];
  const FinalIcon = status === "blocked" || status === "human_rejected" ? Ban : Gavel;
  const live = check.jev.evaluator === "jev-typesafe-api";

  return (
    <ol aria-label="Cómo decidió el agente" className="relative">
      {stages.map((s, i) => (
        <Step
          key={s.id}
          index={i + 1}
          icon={STAGE_ICON[s.id]}
          status={s.status}
          title={s.title}
          summary={s.summary}
          open={open.has(s.id)}
          onToggle={() => toggle(s.id)}
          delay={i * 110}
        >
          <p className="mb-2 text-xs text-muted-foreground">{s.question}</p>
          <ul className="grid gap-2.5">
            {s.checks.map((r) => {
              const ui = STATUS_UI[r.status];
              return (
                <li key={r.ruleId} className="flex gap-2.5">
                  <ui.icon className={cn("mt-0.5 h-4 w-4 shrink-0", ui.text)} aria-hidden />
                  <span className="min-w-0">
                    <span
                      className={cn(
                        "block text-sm font-medium",
                        r.status === "not_applicable" && "text-muted-foreground",
                      )}
                    >
                      {r.label}
                    </span>
                    <span className="block text-xs text-muted-foreground">{r.explanation}</span>
                    {r.rule && r.status !== "not_applicable" && (
                      <span className="block text-[11px] text-muted-foreground/80">
                        Tu regla: {r.rule}
                      </span>
                    )}
                    {(r.status === "failed" || r.status === "needs_review") && r.ifChanged && (
                      <span className="mt-1 block rounded-lg bg-muted/70 px-2 py-1 text-xs">
                        <b className="font-medium">Para que pasara:</b> {r.ifChanged}
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </Step>
      ))}

      <Step
        index={stages.length + 1}
        icon={Cpu}
        status={check.agrees ? "passed" : "needs_review"}
        title="Verificación cruzada con JEV"
        summary={
          <>
            JEV (TypeSafe AI) volvió a decidir con un esquema tipado:{" "}
            <b className="font-medium text-foreground">{JEV_OUTCOME_LABEL[check.jev.outcome]}</b> ·{" "}
            {Math.round(check.jev.confidence * 100)}% de confianza.{" "}
            {check.agrees
              ? "Coincide con tus reglas."
              : "No coincide: cuenta la decisión más estricta y conviene que lo revises."}
          </>
        }
        open={open.has("jev")}
        onToggle={() => toggle("jev")}
        nodeClass="border-primary/40 bg-accent text-primary tg-node-pulse"
        delay={stages.length * 110}
      >
        <p className="text-xs text-muted-foreground">{check.jev.explanation}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          JEV recibe la factura y lo que encontraron las reglas, y responde con una decisión tipada
          (pagar, pedir permiso o frenar) y su confianza. Nunca puede aflojar una regla: si no
          coincide, gana la decisión más estricta.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
            <Radio className={cn("h-3 w-3", live && "text-success")} aria-hidden />
            {live
              ? "Respuesta en vivo de la API de TypeSafe"
              : "Verificación local con el mismo esquema"}
          </span>
          {!live && subject.amount.amountMinor > 0 && (
            <Button type="button" size="sm" variant="outline" onClick={askLive} disabled={asking}>
              {asking ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Cpu className="h-3.5 w-3.5" />
              )}
              Consultar JEV en vivo
            </Button>
          )}
        </div>
      </Step>

      <Step
        index={stages.length + 2}
        icon={FinalIcon}
        status={
          status === "authorized" || status === "human_approved"
            ? "passed"
            : status === "blocked" || status === "human_rejected"
              ? "failed"
              : "needs_review"
        }
        title={verdict.title}
        summary={verdict.next}
        nodeClass={FINAL_NODE[tone(status)]}
        last
        delay={(stages.length + 1) * 110}
      />
    </ol>
  );
}
