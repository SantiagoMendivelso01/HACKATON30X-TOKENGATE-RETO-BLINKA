import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Swords, Trash2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyState, Money, PageHeader, Panel, StatusBadge } from "@/components/tg/primitives";
import { DecisionSheet } from "@/components/tg/decision-detail";
import { useTokenGate } from "@/lib/tokengate/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/red-team")({
  head: () => ({
    meta: [
      { title: "Red team — blinka" },
      {
        name: "description",
        content:
          "Un agente atacante fabrica facturas trampa para intentar que el pagador apruebe algo indebido.",
      },
      { property: "og:title", content: "Red team — blinka" },
      {
        property: "og:description",
        content: "Ataques lanzados, bloqueados y pagados indebidamente.",
      },
    ],
  }),
  component: RedTeam,
});

function RedTeam() {
  const { all, seed, launchAttack, clearAttacks } = useTokenGate();
  const [open, setOpen] = useState<string | null>(null);
  const atk = all.filter((e) => e.subject.attack);
  const blocked = atk.filter((e) => e.result.outcome === "blocked").length;
  const escalated = atk.filter(
    (e) => e.result.outcome === "requires_approval" || e.result.outcome === "needs_information",
  ).length;
  const paid = atk.filter((e) => e.result.outcome === "authorized").length;

  const stats: [string, number, string][] = [
    ["Ataques lanzados", atk.length, ""],
    ["Bloqueados", blocked, "text-destructive"],
    ["Escalados a una persona", escalated, "text-warning-foreground"],
    ["Pagados indebidamente", paid, paid ? "text-destructive" : "text-success"],
  ];

  return (
    <>
      <PageHeader
        eyebrow="Confianza"
        title="Red team"
        subtitle={`Un segundo agente fabrica ${seed.attacks.length} facturas trampa para ${seed.name}: suplantación, instrucciones escondidas, montos inflados, cambio de cuenta, duplicados y pagos partidos.`}
        actions={
          <>
            {atk.length > 0 && (
              <Button variant="outline" className="h-10" onClick={clearAttacks}>
                <Trash2 className="h-4 w-4" />
                Limpiar ataques
              </Button>
            )}
            <Button
              className="h-10"
              onClick={() => {
                launchAttack();
                toast.success("Ataque lanzado: el agente ya evaluó las facturas trampa.");
              }}
            >
              <Swords className="h-4 w-4" />
              Lanzar ataque
            </Button>
          </>
        }
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(([label, n, cls], i) => (
          <div
            key={label}
            className={cn(
              "rounded-2xl border bg-surface p-5 shadow-soft",
              i === 3 ? (paid ? "border-destructive" : "border-success/40") : "border-border/70",
            )}
          >
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className={cn("display mt-2 text-5xl", cls)}>{n}</p>
          </div>
        ))}
      </div>
      <Panel
        bodyClassName="p-0"
        title="Facturas trampa"
        description="Cada fila muestra qué regla detectó el ataque."
      >
        {atk.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title="Todavía no hay ataques"
            text="Lanza un ataque para ver cómo responde el agente pagador."
            action={
              <Button onClick={launchAttack}>
                <Swords className="h-4 w-4" />
                Lanzar ataque
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Técnica</th>
                  <th className="px-5 py-3 font-medium">Factura</th>
                  <th className="px-5 py-3 font-medium">Decisión</th>
                  <th className="px-5 py-3 font-medium">Cómo lo detectó</th>
                </tr>
              </thead>
              <tbody>
                {atk.map((e) => (
                  <tr
                    key={e.subject.id}
                    onClick={() => setOpen(e.subject.id)}
                    className="cursor-pointer border-b border-border/70 last:border-0 hover:bg-background/70"
                  >
                    <td className="px-5 py-3 font-medium">{e.subject.attack}</td>
                    <td className="px-5 py-3">
                      {e.subject.supplier}
                      <span className="block text-xs text-muted-foreground">
                        <Money value={e.subject.amount} />
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={e.status} />
                    </td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">
                      {e.result.rules
                        .filter((r) => r.status === "failed" || r.status === "needs_review")
                        .map((r) => r.label)
                        .join(" · ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <DecisionSheet subjectId={open} onClose={() => setOpen(null)} />
    </>
  );
}
