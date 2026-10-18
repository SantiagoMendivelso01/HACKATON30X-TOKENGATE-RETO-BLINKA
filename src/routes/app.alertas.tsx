import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { sevMeta } from "@/components/tg/severity";
import { EmptyState, PageHeader, Panel, StatusBadge } from "@/components/tg/primitives";
import { DecisionSheet } from "@/components/tg/decision-detail";
import { useTokenGate } from "@/lib/tokengate/store";
import { formatDateTime } from "@/lib/tokengate/format";
import { cn } from "@/lib/utils";
import type { AlertSeverity } from "@/lib/tokengate/types";

export const Route = createFileRoute("/app/alertas")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Alertas — blinka" },
      {
        name: "description",
        content: "Señales que el agente registró mientras revisaba facturas y compras.",
      },
      { property: "og:title", content: "Alertas — blinka" },
      {
        property: "og:description",
        content: "Duplicados, suplantaciones, cambios de cuenta y presupuesto bajo.",
      },
    ],
  }),
  component: Alertas,
});

function Alertas() {
  const { alerts, byId } = useTokenGate();
  const [sev, setSev] = useState<"all" | AlertSeverity>("all");
  const [open, setOpen] = useState<string | null>(null);
  const count = (s: AlertSeverity) => alerts.filter((a) => a.severity === s).length;
  const rows = alerts.filter((a) => sev === "all" || a.severity === sev);

  return (
    <>
      <PageHeader
        eyebrow="Monitoreo"
        title="Alertas"
        subtitle="Señales que el agente registró al revisar. Las críticas siempre terminan bloqueadas o en manos de una persona."
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        {(["critical", "high", "medium"] as AlertSeverity[]).map((s) => {
          const m = sevMeta[s];
          return (
            <button
              key={s}
              type="button"
              onClick={() => setSev(sev === s ? "all" : s)}
              aria-pressed={sev === s}
              className={cn(
                "rounded-2xl border bg-surface p-5 text-left shadow-soft transition-colors",
                sev === s ? "border-foreground" : "border-border/70 hover:border-input",
              )}
            >
              <span className={cn("flex items-center gap-2 text-sm font-medium", m.text)}>
                <m.icon className="h-4 w-4" />
                {m.label}
              </span>
              <span className="display mt-2 block text-4xl">{count(s)}</span>
            </button>
          );
        })}
      </div>
      <Panel bodyClassName="p-0" title={`${rows.length} alertas`}>
        {rows.length === 0 ? (
          <EmptyState icon={Bell} title="Sin alertas" text="No hay alertas con este filtro." />
        ) : (
          <ul className="divide-y divide-border/70">
            {rows.map((a, i) => {
              const e = a.subjectId ? byId.get(a.subjectId) : undefined;
              const m = sevMeta[a.severity];
              return (
                <li key={i}>
                  <button
                    type="button"
                    disabled={!e}
                    onClick={() => e && setOpen(e.subject.id)}
                    className="flex w-full items-center gap-4 px-5 py-3.5 text-left hover:bg-background/70 disabled:cursor-default"
                  >
                    <span className={cn("w-1 self-stretch rounded-full", m.bar)} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">{a.text}</span>
                      <span className="text-xs text-muted-foreground">
                        <span className={cn("font-medium", m.text)}>{m.label}</span>
                        {e
                          ? ` · ${e.subject.supplier} · ${e.subject.reference}`
                          : " · Periodo actual"}{" "}
                        · {formatDateTime(a.at)}
                      </span>
                    </span>
                    {e && <StatusBadge status={e.status} />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
      <DecisionSheet subjectId={open} onClose={() => setOpen(null)} />
    </>
  );
}
