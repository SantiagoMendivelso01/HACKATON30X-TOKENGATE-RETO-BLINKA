import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCheck } from "lucide-react";
import { DecisionDetail, DecisionSheet } from "@/components/tg/decision-detail";
import { CountUp, EmptyState, PageHeader, Panel, StatusBadge } from "@/components/tg/primitives";
import { useTokenGate } from "@/lib/tokengate/store";
import { formatMoney } from "@/lib/tokengate/format";
import { needsAttention } from "@/lib/tokengate/status";
import { mainFlag } from "@/lib/tokengate/pipeline";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/aprobaciones")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Por aprobar — blinka" },
      { name: "description", content: "Facturas escaladas que requieren permiso de una persona." },
      { property: "og:title", content: "Por aprobar — blinka" },
      {
        property: "og:description",
        content: "Aprueba, rechaza o pide información con contexto completo.",
      },
    ],
  }),
  component: Aprobaciones,
});

function Aprobaciones() {
  const { all } = useTokenGate();
  const queue = all.filter((e) => needsAttention(e.status));
  const [selected, setSelected] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState<string | null>(null);
  const current = queue.find((e) => e.subject.id === selected) ?? queue[0];

  return (
    <>
      <PageHeader
        title="Por aprobar (Permiso humano)"
        subtitle="Cuando una factura supera el límite automático, viene de un proveedor nuevo o le faltan datos, el agente te pide permiso aquí antes de pagar."
      />
      {queue.length === 0 ? (
        <Panel>
          <EmptyState
            icon={CheckCheck}
            title="Todo al día"
            text="No hay facturas pendientes de permiso humano en este momento."
          />
        </Panel>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
          <Panel
            className="min-w-0 lg:sticky lg:top-20 lg:self-start"
            title={
              <span className="flex items-baseline gap-2">
                <span className="display text-[32px] leading-none text-primary">
                  <CountUp value={queue.length} />
                </span>
                {queue.length === 1 ? "pago espera tu decisión" : "pagos esperan tu decisión"}
              </span>
            }
            bodyClassName="p-0"
          >
            <ul className="divide-y divide-border" role="listbox" aria-label="Cola de aprobación">
              {queue.map((e, i) => {
                const reasonLabel = mainFlag(e.result) ?? e.subject.description;
                const active = current?.subject.id === e.subject.id;
                return (
                  <li
                    key={e.subject.id}
                    className="tg-row"
                    style={{ animationDelay: `${i * 70}ms` }}
                  >
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => {
                        setSelected(e.subject.id);
                        if (!window.matchMedia("(min-width: 1024px)").matches)
                          setMobileOpen(e.subject.id);
                      }}
                      className={cn(
                        "relative flex w-full flex-col gap-1.5 px-4 py-3.5 text-left transition-colors hover:bg-muted/60 focus-visible:bg-muted focus-visible:outline-none",
                        active && "bg-accent/70",
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "absolute inset-y-2 left-0 w-1 origin-center rounded-r-full bg-primary transition-transform duration-300",
                          active ? "scale-y-100" : "scale-y-0",
                        )}
                      />
                      <span className="flex w-full items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium">{e.subject.supplier}</span>
                        <span className="tabular shrink-0 text-sm font-semibold">
                          {formatMoney(e.subject.amount)}
                        </span>
                      </span>
                      <span className="text-[13px] text-foreground/80">{reasonLabel}</span>
                      <span className="flex w-full items-center justify-between gap-2">
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {e.subject.reference}
                        </span>
                        <StatusBadge status={e.status} />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Panel>
          {current && (
            <Panel
              className="hidden min-w-0 lg:block"
              title={`${current.subject.kind === "invoice" ? "Factura" : "Solicitud"} ${current.subject.reference}`}
            >
              <DecisionDetail key={current.subject.id} subjectId={current.subject.id} />
            </Panel>
          )}
        </div>
      )}
      <DecisionSheet subjectId={mobileOpen} onClose={() => setMobileOpen(null)} />
    </>
  );
}
