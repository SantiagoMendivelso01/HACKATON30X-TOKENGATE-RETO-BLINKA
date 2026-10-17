import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronDown, History, Ban, Check, MessageSquareMore, FileSearch } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { agentName, useTokenGate } from "@/lib/tokengate/store";
import { formatDate, formatDateTime, formatMoney } from "@/lib/tokengate/format";
import { statusMeta, toneClasses } from "@/lib/tokengate/status";
import type { HumanAction } from "@/lib/tokengate/types";
import { NoMoneyNotice, RuleBadge, StatusBadge } from "./primitives";

const confirmCopy: Record<HumanAction, { title: string; body: string; cta: string; toast: string }> = {
  approved: {
    title: "¿Aprobar esta solicitud?",
    body: "Se registrará tu aprobación como una autorización simulada. No se realizará ningún pago ni transferencia.",
    cta: "Aprobar (simulado)",
    toast: "Aprobación registrada. Autorización simulada: no se movió dinero.",
  },
  rejected: {
    title: "¿Rechazar esta solicitud?",
    body: "El agente no podrá continuar con esta operación. La decisión quedará en el registro.",
    cta: "Rechazar",
    toast: "Solicitud rechazada y registrada.",
  },
  info_requested: {
    title: "¿Solicitar más información?",
    body: "La solicitud quedará pendiente hasta que el agente o el proveedor aporten los datos.",
    cta: "Solicitar información",
    toast: "Solicitud de información enviada al agente (simulada).",
  },
};

export function DecisionDetail({ subjectId }: { subjectId: string }) {
  const { byId, review } = useTokenGate();
  const [showAll, setShowAll] = useState(false);
  const [pending, setPending] = useState<HumanAction | null>(null);
  const [note, setNote] = useState("");
  const e = byId.get(subjectId);
  if (!e) return <p className="text-sm text-muted-foreground">Registro no encontrado.</p>;
  const { subject: s, result, status } = e;
  const meta = statusMeta[status];
  const flagged = result.rules.filter((r) => r.status !== "passed");
  const visibleRules = showAll || flagged.length === 0 ? result.rules : flagged;
  const canAct = status === "requires_approval" || status === "needs_information" || status === "blocked";
  const isInvoice = s.kind === "invoice";

  const fields: [string, string][] = [
    ["Proveedor", s.supplier],
    [isInvoice ? "Factura" : "Solicitud", s.reference],
    ["Importe", formatMoney(s.amount)],
    [isInvoice ? "Fecha límite" : "Solicitada", s.kind === "invoice" ? formatDate(s.dueDate) : formatDateTime(s.requestedAt)],
    ["Agente", agentName(s.agentId)],
    ["Categoría", s.category],
  ];

  return (
    <div className="space-y-5">
      <section aria-labelledby="sum">
        <h3 id="sum" className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Resumen</h3>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-md border border-border p-3">
          {fields.map(([k, v]) => (
            <div key={k} className="min-w-0">
              <dt className="text-xs text-muted-foreground">{k}</dt>
              <dd className="tabular truncate text-sm font-medium">{v}</dd>
            </div>
          ))}
          <div className="col-span-2">
            <dt className="text-xs text-muted-foreground">Descripción</dt>
            <dd className="text-sm">{s.description}</dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="res" className={cn("rounded-md border p-3", toneClasses[meta.tone])}>
        <h3 id="res" className="flex items-center gap-2 text-sm font-semibold">
          <meta.icon className="h-4 w-4" aria-hidden /> {meta.label}
        </h3>
        <p className="mt-1 text-sm text-foreground/90">{result.explanation}</p>
        {e.review && (
          <p className="mt-2 text-xs text-foreground/80">
            Revisión humana de {e.review.by} · {formatDateTime(e.review.at)}
            {e.review.note ? ` · “${e.review.note}”` : ""}
          </p>
        )}
        <p className="mt-2 text-xs text-muted-foreground">Política {result.policyVersion} · evaluada por el motor de reglas (simulación en el navegador)</p>
      </section>

      <section aria-labelledby="rules">
        <div className="mb-2 flex items-center justify-between">
          <h3 id="rules" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Evaluación de la política</h3>
          <span className="text-xs text-muted-foreground">{result.rules.length - flagged.length}/{result.rules.length} reglas cumplidas</span>
        </div>
        <ul className="divide-y divide-border rounded-md border border-border">
          {visibleRules.map((r) => (
            <li key={r.ruleId} className="flex items-start justify-between gap-3 p-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{r.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{r.explanation}</p>
              </div>
              <RuleBadge status={r.status} />
            </li>
          ))}
        </ul>
        {flagged.length > 0 && (
          <Button variant="ghost" size="sm" className="mt-1 h-9" onClick={() => setShowAll((v) => !v)} aria-expanded={showAll}>
            <ChevronDown className={cn("h-4 w-4 transition-transform", showAll && "rotate-180")} />
            {showAll ? "Mostrar solo las reglas con incidencias" : `Ver las ${result.rules.length} reglas`}
          </Button>
        )}
      </section>

      <section aria-labelledby="act" className="space-y-2">
        <h3 id="act" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Acciones</h3>
        <div className="flex flex-wrap gap-2">
          {canAct && (
            <>
              <Button className="h-11 sm:h-9" onClick={() => setPending("approved")}><Check className="h-4 w-4" />Aprobar solicitud</Button>
              <Button variant="outline" className="h-11 sm:h-9" onClick={() => setPending("rejected")}><Ban className="h-4 w-4" />Rechazar solicitud</Button>
              <Button variant="outline" className="h-11 sm:h-9" onClick={() => setPending("info_requested")}><MessageSquareMore className="h-4 w-4" />Solicitar información</Button>
            </>
          )}
          {isInvoice && (
            <Button variant="ghost" className="h-11 sm:h-9" asChild>
              <Link to="/app/facturas"><FileSearch className="h-4 w-4" />Revisar factura</Link>
            </Button>
          )}
          <Button variant="ghost" className="h-11 sm:h-9" asChild>
            <Link to="/app/decisiones" search={{ q: s.reference }}><History className="h-4 w-4" />Ver historial</Link>
          </Button>
        </div>
        <NoMoneyNotice />
      </section>

      <AlertDialog open={pending !== null} onOpenChange={(o) => !o && setPending(null)}>
        {pending && (
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{confirmCopy[pending].title}</AlertDialogTitle>
              <AlertDialogDescription>
                {s.reference} · {s.supplier} · {formatMoney(s.amount)}. {confirmCopy[pending].body}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <label className="text-sm font-medium" htmlFor="review-note">Nota (opcional)</label>
            <Textarea id="review-note" value={note} onChange={(ev) => setNote(ev.target.value)} placeholder="Motivo de la decisión" maxLength={240} />
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  review(s.id, pending, note.trim() || undefined);
                  toast.success(confirmCopy[pending].toast);
                  setNote("");
                  setPending(null);
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

export function DecisionSheet({ subjectId, onClose, extra }: { subjectId: string | null; onClose: () => void; extra?: (subjectId: string) => React.ReactNode }) {
  const { byId } = useTokenGate();
  const e = subjectId ? byId.get(subjectId) : undefined;
  return (
    <Sheet open={!!subjectId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        {e && (
          <>
            <SheetHeader className="mb-4 text-left">
              <div className="flex items-center gap-2">
                <StatusBadge status={e.status} />
              </div>
              <SheetTitle className="text-xl">{e.subject.reference}</SheetTitle>
              <SheetDescription>{e.subject.kind === "invoice" ? "Factura" : "Solicitud de compra"} · datos simulados</SheetDescription>
            </SheetHeader>
            {extra?.(e.subject.id)}
            <DecisionDetail subjectId={e.subject.id} />
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
