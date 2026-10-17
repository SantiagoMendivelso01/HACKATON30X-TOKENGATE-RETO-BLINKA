import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ChevronDown,
  History,
  Ban,
  Check,
  MessageSquareMore,
  Lightbulb,
  Lock,
  Receipt,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useTokenGate } from "@/lib/tokengate/store";
import { INJECTION_PATTERNS } from "@/lib/tokengate/decision-engine";
import { formatBase, formatDate, formatDateTime, formatMoney } from "@/lib/tokengate/format";
import { statusMeta, toneClasses } from "@/lib/tokengate/status";
import type { HumanAction } from "@/lib/tokengate/types";
import { Money, NoMoneyNotice, RuleBadge, StatusBadge, channelText } from "./primitives";

const confirmCopy: Record<
  HumanAction,
  { title: string; body: string; cta: string; toast: string }
> = {
  approved: {
    title: "¿Aprobar y pagar?",
    body: "Tu aprobación queda registrada y el pago se envía al sandbox. No se mueve dinero real.",
    cta: "Aprobar y pagar (sandbox)",
    toast: "Aprobado. Pago enviado al sandbox: no se movió dinero real.",
  },
  rejected: {
    title: "¿Rechazar esta operación?",
    body: "El agente no podrá continuar con esta operación. La decisión quedará en el registro.",
    cta: "Rechazar",
    toast: "Operación rechazada y registrada.",
  },
  info_requested: {
    title: "¿Solicitar más información?",
    body: "La operación quedará pendiente hasta que el agente o el proveedor aporten los datos.",
    cta: "Solicitar información",
    toast: "Solicitud de información enviada (simulada).",
  },
};

function highlight(raw: string) {
  const marks: [number, number][] = [];
  for (const rx of INJECTION_PATTERNS) {
    const m = new RegExp(rx.source, "gi");
    let x: RegExpExecArray | null;
    while ((x = m.exec(raw))) {
      const end = raw.indexOf("\n", x.index);
      marks.push([x.index, end === -1 ? raw.length : end]);
    }
  }
  if (!marks.length) return raw;
  marks.sort((a, b) => a[0] - b[0]);
  const out: React.ReactNode[] = [];
  let i = 0;
  marks.forEach(([s, e], k) => {
    if (s < i) return;
    out.push(
      raw.slice(i, s),
      <mark key={k} className="rounded bg-destructive/10 px-0.5 font-semibold text-destructive">
        {raw.slice(s, e)}
      </mark>,
    );
    i = e;
  });
  out.push(raw.slice(i));
  return out;
}

export function DecisionDetail({ subjectId }: { subjectId: string }) {
  const { byId, review, seed } = useTokenGate();
  const [showAll, setShowAll] = useState(false);
  const [pending, setPending] = useState<HumanAction | null>(null);
  const [note, setNote] = useState("");
  const e = byId.get(subjectId);
  if (!e) return <p className="text-sm text-muted-foreground">Registro no encontrado.</p>;
  const { subject: s, result, status } = e;
  const meta = statusMeta[status];
  const flagged = result.rules.filter((r) => r.status === "failed" || r.status === "needs_review");
  const applicable = result.rules.filter((r) => r.status !== "not_applicable");
  const visibleRules =
    showAll || flagged.length === 0 ? (showAll ? result.rules : applicable) : flagged;
  const open = status === "requires_approval" || status === "needs_information";
  const isInvoice = s.kind === "invoice";

  const fields: [string, React.ReactNode][] = [
    ["Proveedor", s.supplier],
    [isInvoice ? "Factura del proveedor" : "Solicitud", s.invoiceNumber ?? s.reference],
    [
      "Importe",
      <span key="a">
        <Money value={s.amount} />
        {s.amount.currency !== "USD" && (
          <span className="ml-1 text-xs text-muted-foreground">
            ≈ {formatBase(e.baseMinor, { exact: true })} (1 USD = {seed.fx[s.amount.currency]}{" "}
            {s.amount.currency})
          </span>
        )}
      </span>,
    ],
    [
      isInvoice ? "Fecha límite" : "Solicitada",
      s.kind === "invoice" ? formatDate(s.dueDate) : formatDateTime(s.requestedAt),
    ],
    ["ID fiscal", s.supplierTaxId ?? "No detectado"],
    ["Categoría", s.category],
    ["Canal", channelText(s.channel)],
    ["Cuenta destino", s.bankAccount ?? "—"],
  ];

  return (
    <div className="space-y-5">
      <section
        aria-labelledby="res"
        className={cn("rounded-2xl border p-4", toneClasses[meta.tone])}
      >
        <h3 id="res" className="flex items-center gap-2 text-base font-semibold tracking-tight">
          <meta.icon className="h-4 w-4" aria-hidden /> {meta.label}
        </h3>
        <p className="mt-1.5 text-sm text-foreground/90">{result.explanation}</p>
        {e.review && (
          <p className="mt-2 text-xs text-foreground/80">
            {e.review.action === "approved"
              ? "Aprobada"
              : e.review.action === "rejected"
                ? "Rechazada"
                : "Información solicitada"}{" "}
            por {e.review.by} · {formatDateTime(e.review.at)}
            {e.review.note ? ` · “${e.review.note}”` : ""}
          </p>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          Política {result.policyVersion} · motor de reglas determinista · el modelo solo extrae
          datos
        </p>
      </section>

      {flagged.length > 0 && (
        <section aria-labelledby="cf" className="rounded-2xl border border-border bg-card p-4">
          <h3 id="cf" className="eyebrow mb-2 flex items-center gap-1.5">
            <Lightbulb className="h-3.5 w-3.5" />
            Qué habría cambiado la decisión
          </h3>
          <ul className="list-disc space-y-1 pl-5 text-sm text-foreground/85">
            {flagged.map((r) => (
              <li key={r.ruleId}>{r.ifChanged ?? r.explanation}</li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="act" className="space-y-2">
        <h3 id="act" className="eyebrow">
          Decisión de Finanzas
        </h3>
        {open ? (
          <div className="flex flex-wrap gap-2">
            <Button className="h-11 sm:h-9" onClick={() => setPending("approved")}>
              <Check className="h-4 w-4" />
              Aprobar y pagar
            </Button>
            <Button
              variant="outline"
              className="h-11 sm:h-9"
              onClick={() => setPending("rejected")}
            >
              <Ban className="h-4 w-4" />
              Rechazar
            </Button>
            {status === "requires_approval" && (
              <Button
                variant="outline"
                className="h-11 sm:h-9"
                onClick={() => setPending("info_requested")}
              >
                <MessageSquareMore className="h-4 w-4" />
                Solicitar información
              </Button>
            )}
          </div>
        ) : status === "blocked" ? (
          <p className="flex items-start gap-2 rounded-xl border border-border bg-muted/60 p-3 text-xs text-muted-foreground">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Bloqueada por una regla de la política. No se puede aprobar desde aquí: corrige la
            factura o cambia la política, y el agente la vuelve a evaluar.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">No requiere acción.</p>
        )}
        <Button variant="ghost" className="h-11 sm:h-9" asChild>
          <Link to="/app/decisiones" search={{ q: s.reference }}>
            <History className="h-4 w-4" />
            Ver historial
          </Link>
        </Button>
      </section>

      {e.payment && (
        <section
          aria-labelledby="pay"
          className="rounded-2xl border border-success/25 bg-success/5 p-4"
        >
          <h3 id="pay" className="eyebrow mb-2 flex items-center gap-1.5">
            <Receipt className="h-3.5 w-3.5" />
            Pago
          </h3>
          <dl className="grid grid-cols-[120px_1fr] gap-y-1.5 text-sm">
            <dt className="text-muted-foreground">Transacción</dt>
            <dd className="font-mono text-xs">{e.payment.txn}</dd>
            <dt className="text-muted-foreground">Riel</dt>
            <dd>{e.payment.rail}</dd>
            <dt className="text-muted-foreground">Importe</dt>
            <dd>
              {formatMoney(s.amount)} → {formatBase(e.baseMinor)}
            </dd>
            <dt className="text-muted-foreground">Fecha</dt>
            <dd>{formatDateTime(e.payment.at)}</dd>
          </dl>
        </section>
      )}

      <section aria-labelledby="rules">
        <div className="mb-2 flex items-center justify-between">
          <h3 id="rules" className="eyebrow">
            Evaluación de la política
          </h3>
          <span className="text-xs text-muted-foreground">
            {applicable.length - flagged.length}/{applicable.length} reglas cumplidas
          </span>
        </div>
        <ul className="divide-y divide-border/70 rounded-2xl border border-border bg-card">
          {visibleRules.map((r) => (
            <li key={r.ruleId} className="flex items-start justify-between gap-3 p-3">
              <div className="min-w-0">
                <p
                  className={cn(
                    "text-sm font-medium",
                    r.status === "not_applicable" && "text-muted-foreground",
                  )}
                >
                  {r.label}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{r.explanation}</p>
                {r.rule && r.status !== "not_applicable" && (
                  <p className="mt-0.5 text-[11px] text-muted-foreground/80">Regla: {r.rule}</p>
                )}
              </div>
              <RuleBadge status={r.status} />
            </li>
          ))}
        </ul>
        <Button
          variant="ghost"
          size="sm"
          className="mt-1 h-9"
          onClick={() => setShowAll((v) => !v)}
          aria-expanded={showAll}
        >
          <ChevronDown className={cn("h-4 w-4 transition-transform", showAll && "rotate-180")} />
          {showAll ? "Mostrar menos" : `Ver las ${result.rules.length} reglas`}
        </Button>
      </section>

      <section aria-labelledby="sum">
        <h3 id="sum" className="eyebrow mb-2">
          Datos extraídos
        </h3>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-2xl border border-border bg-card p-4">
          {fields.map(([k, v]) => (
            <div key={k} className="min-w-0">
              <dt className="text-xs text-muted-foreground">{k}</dt>
              <dd className="truncate text-sm font-medium">{v}</dd>
            </div>
          ))}
          <div className="col-span-2">
            <dt className="text-xs text-muted-foreground">Descripción</dt>
            <dd className="text-sm">{s.description}</dd>
          </div>
        </dl>
      </section>

      {s.rawText && (
        <section aria-labelledby="doc">
          <h3 id="doc" className="eyebrow mb-2">
            Documento original{s.sender ? ` · ${s.sender}` : ""}
          </h3>
          <pre className="whitespace-pre-wrap rounded-2xl border border-border bg-card p-4 font-mono text-xs leading-relaxed text-foreground/80">
            {highlight(s.rawText)}
          </pre>
        </section>
      )}
      <NoMoneyNotice />

      <AlertDialog open={pending !== null} onOpenChange={(o) => !o && setPending(null)}>
        {pending && (
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{confirmCopy[pending].title}</AlertDialogTitle>
              <AlertDialogDescription>
                {s.reference} · {s.supplier} · {formatMoney(s.amount)}. {confirmCopy[pending].body}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <label className="text-sm font-medium" htmlFor="review-note">
              Nota para el registro (opcional)
            </label>
            <Textarea
              id="review-note"
              value={note}
              onChange={(ev) => setNote(ev.target.value)}
              placeholder="Motivo de la decisión"
              maxLength={240}
            />
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  const action = pending;
                  setNote("");
                  setPending(null);
                  if (await review(s.id, action, note.trim() || undefined))
                    toast.success(confirmCopy[action].toast);
                }}
              >
                {confirmCopy[pending].cta}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        )}
      </AlertDialog>
    </div>
  );
}

export function DecisionSheet({
  subjectId,
  onClose,
  extra,
}: {
  subjectId: string | null;
  onClose: () => void;
  extra?: (subjectId: string) => React.ReactNode;
}) {
  const { byId } = useTokenGate();
  const e = subjectId ? byId.get(subjectId) : undefined;
  return (
    <Sheet open={!!subjectId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto bg-background sm:max-w-xl">
        {e && (
          <>
            <SheetHeader className="mb-4 text-left">
              <div className="flex items-center gap-2">
                <StatusBadge status={e.status} />
              </div>
              <SheetDescription>
                {e.subject.supplier} · {e.subject.reference}
              </SheetDescription>
              <SheetTitle className="display text-[32px] font-normal">
                <Money value={e.subject.amount} />
              </SheetTitle>
            </SheetHeader>
            {extra?.(e.subject.id)}
            <DecisionDetail subjectId={e.subject.id} />
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
