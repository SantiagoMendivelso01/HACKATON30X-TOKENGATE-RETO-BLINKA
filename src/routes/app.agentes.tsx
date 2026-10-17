import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Bot, ShieldOff } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { PageHeader, Panel, StatusBadge } from "@/components/tg/primitives";
import { useTokenGate } from "@/lib/tokengate/store";
import { formatBase, formatDateTime, formatMoney } from "@/lib/tokengate/format";
import { needsAttention } from "@/lib/tokengate/status";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/agentes")({
  head: () => ({
    meta: [
      { title: "Agentes — blinka" },
      {
        name: "description",
        content: "Agentes registrados, sus categorías permitidas y límites de gasto.",
      },
      { property: "og:title", content: "Agentes — blinka" },
      { property: "og:description", content: "Quién puede comprar qué, y hasta cuánto." },
    ],
  }),
  component: Agentes,
});

function Agentes() {
  const { all, seed } = useTokenGate();
  const agents = seed.agents;
  const statsOf = (id: string) => {
    const mine = all.filter((e) => e.subject.agentId === id);
    return {
      n: mine.length,
      paid: mine.filter((e) => e.state === "paid").reduce((s, e) => s + e.baseMinor, 0),
      pending: mine.filter((e) => needsAttention(e.status)).length,
      blocked: mine.filter((e) => e.state === "blocked").length,
    };
  };
  const [open, setOpen] = useState<string | null>(null);
  const agent = agents.find((a) => a.id === open);
  const activity = all.filter((e) => e.subject.agentId === open).slice(0, 6);

  return (
    <>
      <PageHeader
        eyebrow={seed.name}
        title="Agentes"
        subtitle="Agentes de IA que pagan y compran por la empresa. Cada uno tiene categorías, un límite por operación y puede pausarse."
      />
      <p className="mb-4 flex items-center gap-2 rounded-xl border border-dashed border-border bg-card px-3 py-2 text-xs text-muted-foreground">
        <ShieldOff className="h-4 w-4 shrink-0" />
        Agentes simulados: no pueden iniciar transferencias reales ni conectarse a cuentas
        bancarias.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {agents.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => setOpen(a.id)}
            className="rounded-2xl border border-border/70 bg-surface p-5 text-left shadow-soft transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-secondary/10 text-secondary">
                  <Bot className="h-4 w-4" />
                </span>
                <span className="font-semibold">{a.name}</span>
              </span>
              <span
                className={cn(
                  "rounded px-1.5 py-0.5 text-xs font-medium",
                  a.status === "active"
                    ? "bg-success/12 text-success"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {a.status === "active" ? "Activo" : "En pausa"}
              </span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{a.purpose}</p>
            <div className="mt-3 flex flex-wrap gap-1">
              {a.categories.map((c) => (
                <span key={c} className="rounded border border-border px-1.5 py-0.5 text-xs">
                  {c}
                </span>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Límite por operación{" "}
              <span className="tabular font-medium text-foreground">
                {formatMoney(a.spendingLimit)}
              </span>
            </p>
            {(() => {
              const st = statsOf(a.id);
              return (
                <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border/70 pt-3 text-xs">
                  <span>
                    <b className="block text-base font-medium tracking-tight">{st.n}</b>
                    <span className="text-muted-foreground">operaciones</span>
                  </span>
                  <span>
                    <b className="block text-base font-medium tracking-tight">
                      {formatBase(st.paid)}
                    </b>
                    <span className="text-muted-foreground">pagado</span>
                  </span>
                  <span>
                    <b className="block text-base font-medium tracking-tight">
                      {st.pending}
                      <span className="text-muted-foreground">/{st.blocked}</span>
                    </b>
                    <span className="text-muted-foreground">por aprobar/bloq.</span>
                  </span>
                </div>
              );
            })()}
          </button>
        ))}
      </div>

      <Sheet open={!!agent} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {agent && (
            <>
              <SheetHeader className="mb-4 text-left">
                <SheetTitle>{agent.name}</SheetTitle>
                <SheetDescription>{agent.purpose}</SheetDescription>
              </SheetHeader>
              <div className="space-y-4">
                <Panel title="Políticas asignadas">
                  <ul className="space-y-1 text-sm">
                    {agent.policyIds.map((p) => (
                      <li key={p}>· {p}</li>
                    ))}
                  </ul>
                </Panel>
                <Panel
                  title={<span className="flex items-center gap-2">Actividad reciente</span>}
                  bodyClassName="p-0"
                >
                  <ul className="divide-y divide-border">
                    {activity.length ? (
                      activity.map((e) => (
                        <li
                          key={e.subject.id}
                          className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm"
                        >
                          <span className="min-w-0">
                            <span className="block truncate">
                              {e.subject.reference} · {e.subject.supplier}
                            </span>
                            <span className="tabular text-xs text-muted-foreground">
                              {formatMoney(e.subject.amount)} · {formatDateTime(e.evaluatedAt)}
                            </span>
                          </span>
                          <StatusBadge status={e.status} />
                        </li>
                      ))
                    ) : (
                      <li className="px-4 py-6 text-sm text-muted-foreground">
                        Sin actividad este mes.
                      </li>
                    )}
                  </ul>
                </Panel>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
