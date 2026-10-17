import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCheck } from "lucide-react";
import { DecisionDetail, DecisionSheet } from "@/components/tg/decision-detail";
import { EmptyState, PageHeader, Panel, StatusBadge } from "@/components/tg/primitives";
import { useTokenGate } from "@/lib/tokengate/store";
import { formatMoney } from "@/lib/tokengate/format";
import { needsAttention } from "@/lib/tokengate/status";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/aprobaciones")({
  head: () => ({
    meta: [
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
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
          <Panel
            className="min-w-0"
            title={
              <span className="flex items-center gap-2">{queue.length} esperando tu decisión</span>
            }
            bodyClassName="p-0"
          >
            <ul className="divide-y divide-border" role="listbox" aria-label="Cola de aprobación">
              {queue.map((e) => {
                const reasonLabel =
                  e.result.rules.find((r) => r.status === "needs_review" || r.status === "failed")
                    ?.label ?? e.subject.description;
                return (
                  <li key={e.subject.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={current?.subject.id === e.subject.id}
                      onClick={() => {
                        setSelected(e.subject.id);
                        if (!window.matchMedia("(min-width: 1024px)").matches)
                          setMobileOpen(e.subject.id);
                      }}
                      className={cn(
                        "flex w-full flex-col gap-1 px-4 py-3 text-left hover:bg-muted/60 focus-visible:bg-muted focus-visible:outline-none",
                        current?.subject.id === e.subject.id && "bg-muted",
                      )}
                    >
                      <span className="flex w-full items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium">{e.subject.supplier}</span>
                        <span className="tabular text-sm font-medium">
                          {formatMoney(e.subject.amount)}
                        </span>
                      </span>
                      <span className="flex w-full items-center justify-between gap-2">
                        <span className="truncate text-xs text-muted-foreground">
                          <span className="font-mono">{e.subject.reference}</span> · {reasonLabel}
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
