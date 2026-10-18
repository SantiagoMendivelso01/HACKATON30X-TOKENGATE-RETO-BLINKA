import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Ban,
  Check,
  ChevronDown,
  FileText,
  History,
  Lock,
  MessageSquareMore,
  Receipt,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { currentValue, specFor } from "@/lib/tokengate/missing-fields";
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
import { VERDICT } from "@/lib/tokengate/pipeline";
import { statusMeta, toneClasses } from "@/lib/tokengate/status";
import type { HumanAction } from "@/lib/tokengate/types";
import { DecisionPipeline } from "./decision-pipeline";
import { Money, NoMoneyNotice, StatusBadge, channelText } from "./primitives";
import { MicButton } from "./voice";

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
    title: "¿Rechazar este pago?",
    body: "El agente no lo pagará. La decisión quedará en el registro.",
    cta: "Rechazar",
    toast: "Pago rechazado y registrado.",
  },
  info_requested: {
    title: "¿Pedir más datos?",
    body: "El pago queda en espera hasta que el proveedor envíe lo que falta.",
    cta: "Pedir datos",
    toast: "Solicitud de datos registrada (simulada).",
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
  const { byId, review, completeFields, seed, policy } = useTokenGate();
  const [pending, setPending] = useState<HumanAction | null>(null);
  const [note, setNote] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [showInvoice, setShowInvoice] = useState(false);
  const e = byId.get(subjectId);
  if (!e) return <p className="text-sm text-muted-foreground">Registro no encontrado.</p>;
  const { subject: s, result, status } = e;
  const filling = pending === "info_requested" && s.missingFields.length > 0;
  const allValid = s.missingFields.every((l) => !specFor(l).validate(values[l] ?? ""));
  const meta = statusMeta[status];
  const verdict = VERDICT[status];
  const flagged = result.rules.filter((r) => r.status === "failed" || r.status === "needs_review");
  const applicable = result.rules.filter((r) => r.status !== "not_applicable").length;
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
    ["Llegó por", channelText(s.channel)],
    ["Cuenta destino", s.bankAccount ?? "—"],
    ["Categoría", s.category],
  ];

  return (
    <div className="space-y-5">
      {/* 1. Qué decidió, en una frase */}
      <section
        aria-labelledby="res"
        className={cn("tg-step rounded-2xl border p-5", toneClasses[meta.tone])}
      >
        <h3 id="res" className="display flex items-center gap-2.5 text-[26px] leading-tight">
          <meta.icon className="h-6 w-6 shrink-0" aria-hidden /> {verdict.title}
        </h3>
        <p className="mt-1.5 text-[15px] text-foreground/90">
          {flagged.length
            ? flagged[0]!.explanation
            : `Cumple las ${applicable} reglas que aplican a esta factura.`}
          {flagged.length > 1 && (
            <span className="text-foreground/70">
              {" "}
              Hay {flagged.length - 1} {flagged.length - 1 === 1 ? "motivo más" : "motivos más"} en
              el recorrido de abajo.
            </span>
          )}
        </p>
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
      </section>

      {/* 2. Tu turno */}
      {open ? (
        <section
          aria-labelledby="act"
          className="tg-glow-border tg-step rounded-2xl border border-primary/20 bg-accent/60 p-4"
          style={{ animationDelay: "90ms" }}
        >
          <h3 id="act" className="text-[15px] font-semibold">
            Tu turno: ¿qué hacemos con este pago?
          </h3>
          <p className="mt-0.5 text-sm text-muted-foreground">{verdict.next}</p>
          <div className="mt-3 flex flex-wrap gap-2 [&>button]:min-w-[140px] [&>button]:flex-1">
            <Button className="h-11" onClick={() => setPending("approved")}>
              <Check className="h-4 w-4" />
              Aprobar y pagar
            </Button>
            <Button variant="outline" className="h-11" onClick={() => setPending("rejected")}>
              <Ban className="h-4 w-4" />
              Rechazar
            </Button>
            {(status === "requires_approval" || s.missingFields.length > 0) && (
              <Button
                variant="outline"
                className="h-11"
                onClick={() => {
                  setValues(Object.fromEntries(s.missingFields.map((l) => [l, currentValue(s, l)])));
                  setPending("info_requested");
                }}
              >
                <MessageSquareMore className="h-4 w-4" />
                {s.missingFields.length > 0 ? "Completar datos" : "Pedir más datos"}
              </Button>
            )}
          </div>
        </section>
      ) : status === "blocked" ? (
        <div className="space-y-2">
          <p className="flex items-start gap-2 rounded-2xl border border-border bg-muted/60 p-3 text-sm text-muted-foreground">
            <Lock className="mt-0.5 h-4 w-4 shrink-0" />
            {verdict.next}
          </p>
          {s.missingFields.length > 0 && (
            <Button
              variant="outline"
              className="h-11"
              onClick={() => {
                setValues(Object.fromEntries(s.missingFields.map((l) => [l, currentValue(s, l)])));
                setPending("info_requested");
              }}
            >
              <MessageSquareMore className="h-4 w-4" />
              Completar datos
            </Button>
          )}
        </div>
      ) : null}

      {/* 3. Cómo lo decidió */}
      <section aria-labelledby="how">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h3 id="how" className="eyebrow">
            Cómo lo decidió el agente
          </h3>
          <span className="text-xs text-muted-foreground">
            Política {result.policyVersion} · {applicable - flagged.length} de {applicable} reglas
            en orden
          </span>
        </div>
        <DecisionPipeline subject={s} result={result} status={status} policy={policy} />
        <p className="mt-3 text-xs text-muted-foreground">
          Claude solo lee la factura. Deciden tus reglas, y JEV verifica la decisión.
        </p>
      </section>

      {e.payment && (
        <section
          aria-labelledby="pay"
          className="rounded-2xl border border-success/25 bg-success/5 p-4"
        >
          <h3 id="pay" className="eyebrow mb-2 flex items-center gap-1.5">
            <Receipt className="h-3.5 w-3.5" />
            Comprobante de pago (sandbox)
          </h3>
          <dl className="grid grid-cols-[120px_1fr] gap-y-1.5 text-sm">
            <dt className="text-muted-foreground">Transacción</dt>
            <dd className="font-mono text-xs">{e.payment.txn}</dd>
            <dt className="text-muted-foreground">Importe</dt>
            <dd>
              {formatMoney(s.amount)} → {formatBase(e.baseMinor)}
            </dd>
            <dt className="text-muted-foreground">Fecha</dt>
            <dd>{formatDateTime(e.payment.at)}</dd>
          </dl>
        </section>
      )}

      {/* 4. La factura */}
      <section className="rounded-2xl border border-border bg-card">
        <button
          type="button"
          onClick={() => setShowInvoice((v) => !v)}
          aria-expanded={showInvoice}
          className="flex w-full items-center gap-2 rounded-2xl px-4 py-3 text-left text-sm font-medium hover:bg-muted/40"
        >
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="flex-1">Ver la factura y los datos que leyó el agente</span>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform",
              showInvoice && "rotate-180",
            )}
          />
        </button>
        {showInvoice && (
          <div className="space-y-4 border-t border-border px-4 py-4">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
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
            {s.rawText && (
              <div>
                <p className="eyebrow mb-2">Documento original{s.sender ? ` · ${s.sender}` : ""}</p>
                <pre className="whitespace-pre-wrap rounded-xl border border-border bg-background p-3 font-mono text-xs leading-relaxed text-foreground/80">
                  {highlight(s.rawText)}
                </pre>
              </div>
            )}
          </div>
        )}
      </section>

      <Button variant="ghost" size="sm" className="h-9" asChild>
        <Link to="/app/auditoria" search={{ q: s.reference }}>
          <History className="h-4 w-4" />
          Ver en el registro
        </Link>
      </Button>
      <NoMoneyNotice />

      <AlertDialog open={pending !== null} onOpenChange={(o) => !o && setPending(null)}>
        {pending && (
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {filling ? "Completar los datos que faltan" : confirmCopy[pending].title}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {s.reference} · {s.supplier} · {formatMoney(s.amount)}.{" "}
                {filling
                  ? "Llena los datos faltantes; el agente volverá a evaluar el pago con tus reglas."
                  : confirmCopy[pending].body}
              </AlertDialogDescription>
            </AlertDialogHeader>
            {filling && (
              <div className="space-y-3">
                {s.missingFields.map((label, i) => {
                  const spec = specFor(label);
                  const v = values[label] ?? "";
                  const err = v ? spec.validate(v) : null;
                  return (
                    <div key={label} className="space-y-1">
                      <Label htmlFor={`mf-${i}`}>
                        {label} <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id={`mf-${i}`}
                        type={spec.input}
                        value={v}
                        placeholder={spec.placeholder}
                        maxLength={200}
                        aria-invalid={!!err}
                        onChange={(ev) => setValues((p) => ({ ...p, [label]: ev.target.value }))}
                      />
                      {err && <p className="text-xs text-destructive">{err}</p>}
                    </div>
                  );
                })}
              </div>
            )}
            <div className="flex items-center justify-between gap-2">
              <label className="text-sm font-medium" htmlFor="review-note">
                ¿Por qué? (opcional, queda en el registro)
              </label>
              <MicButton
                size="sm"
                onText={(t) => setNote((n) => (n ? `${n.trimEnd()} ${t}` : t).slice(0, 240))}
              />
            </div>
            <Textarea
              id="review-note"
              value={note}
              onChange={(ev) => setNote(ev.target.value)}
              placeholder="Escribe o dicta el motivo"
              maxLength={240}
            />
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                disabled={filling && !allValid}
                onClick={async () => {
                  const action = pending;
                  const n = note.trim() || undefined;
                  setNote("");
                  setPending(null);
                  if (filling) {
                    if (await completeFields(s.id, values, n))
                      toast.success("Datos completados. El agente reevaluó el pago.");
                    return;
                  }
                  if (await review(s.id, action, n)) toast.success(confirmCopy[action].toast);
                }}
              >
                {filling ? "Guardar y reevaluar" : confirmCopy[pending].cta}
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
