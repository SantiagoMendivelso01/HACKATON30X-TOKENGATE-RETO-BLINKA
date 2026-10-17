import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Bot, ShieldOff, Plus, Play, Pause, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { PageHeader, Panel, StatusBadge } from "@/components/tg/primitives";
import { useTokenGate } from "@/lib/tokengate/store";
import { formatBase, formatDateTime, formatMoney, parseToMinor } from "@/lib/tokengate/format";
import { needsAttention } from "@/lib/tokengate/status";
import { cn } from "@/lib/utils";
import type { Agent, Category } from "@/lib/tokengate/types";

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

const ALL_CATEGORIES: Category[] = [
  "Software",
  "Infraestructura",
  "Operaciones",
  "Marketing",
  "Servicios",
  "Diseño",
  "Desarrollo",
  "Legal",
  "Contabilidad",
  "Logística",
];

function Agentes() {
  const { all, seed, config, saveConfig } = useTokenGate();
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
  const [createOpen, setCreateOpen] = useState(false);
  const [newAgent, setNewAgent] = useState({
    name: "",
    purpose: "",
    limitUsd: "3000.00",
    categories: ["Software", "Servicios"] as Category[],
  });

  const agent = agents.find((a) => a.id === open);
  const activity = all.filter((e) => e.subject.agentId === open).slice(0, 6);

  const toggleStatus = async (ag: Agent, ev?: React.MouseEvent) => {
    ev?.stopPropagation();
    const nextStatus: Agent["status"] = ag.status === "active" ? "paused" : "active";
    const nextAgents = config.agents.map((a) =>
      a.id === ag.id ? { ...a, status: nextStatus } : a,
    );
    const saved = await saveConfig(
      { ...config, agents: nextAgents },
      `Agente ${ag.name} ${nextStatus === "active" ? "activado" : "pausado"}`,
    );
    if (saved) {
      toast.success(
        `Agente ${ag.name} ${nextStatus === "active" ? "activado" : "puesto en pausa"}.`,
      );
    }
  };

  const deleteAgent = async (ag: Agent) => {
    const nextAgents = config.agents.filter((a) => a.id !== ag.id);
    const saved = await saveConfig(
      { ...config, agents: nextAgents },
      `Agente eliminado: ${ag.name}`,
    );
    if (saved) {
      toast.success(`Agente ${ag.name} eliminado.`);
      setOpen(null);
    }
  };

  const handleCreateAgent = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!newAgent.name.trim() || !newAgent.purpose.trim()) {
      toast.error("Indica el nombre y propósito del agente.");
      return;
    }
    if (newAgent.categories.length === 0) {
      toast.error("Selecciona al menos una categoría permitida.");
      return;
    }
    const minor = parseToMinor(newAgent.limitUsd);
    if (minor === null || minor <= 0) {
      toast.error("Introduce un límite por operación válido en USD.");
      return;
    }
    const id = `ag-${newAgent.name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString().slice(-4)}`;
    const created: Agent = {
      id,
      name: newAgent.name.trim(),
      purpose: newAgent.purpose.trim(),
      status: "active",
      categories: newAgent.categories,
      spendingLimit: { amountMinor: minor, currency: "USD" },
      policyIds: ["Proveedores aprobados", "Límite por transacción", "Umbral de aprobación"],
    };
    const saved = await saveConfig(
      { ...config, agents: [...config.agents, created] },
      `Nuevo agente creado: ${created.name} (límite ${formatMoney(created.spendingLimit)})`,
    );
    if (saved) {
      toast.success(`Agente ${created.name} creado.`);
      setCreateOpen(false);
      setNewAgent({
        name: "",
        purpose: "",
        limitUsd: "3000.00",
        categories: ["Software", "Servicios"],
      });
    }
  };

  const toggleCategory = (cat: Category) => {
    setNewAgent((prev) => ({
      ...prev,
      categories: prev.categories.includes(cat)
        ? prev.categories.filter((c) => c !== cat)
        : [...prev.categories, cat],
    }));
  };

  return (
    <>
      <PageHeader
        eyebrow={seed.name}
        title="Agentes"
        subtitle="Agentes de IA que pagan y compran por la empresa. Cada uno tiene categorías permitidas, un límite por operación y puede pausarse en cualquier momento."
        actions={
          <Button className="h-10" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Nuevo agente
          </Button>
        }
      />
      <p className="mb-4 flex items-center gap-2 rounded-xl border border-dashed border-border bg-card px-3 py-2 text-xs text-muted-foreground">
        <ShieldOff className="h-4 w-4 shrink-0" />
        Agentes en modo sandbox: si pausas un agente, el motor bloquea de inmediato cualquier
        factura o compra asociada a él (Regla #5).
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {agents.map((a) => (
          <div
            key={a.id}
            role="button"
            tabIndex={0}
            onClick={() => setOpen(a.id)}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setOpen(a.id)}
            className="cursor-pointer rounded-2xl border border-border/70 bg-surface p-5 text-left shadow-soft transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-secondary/10 text-secondary">
                  <Bot className="h-4 w-4" />
                </span>
                <span className="font-semibold">{a.name}</span>
              </span>
              <button
                type="button"
                onClick={(ev) => void toggleStatus(a, ev)}
                title={a.status === "active" ? "Pausar agente" : "Activar agente"}
                className={cn(
                  "inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium transition-opacity hover:opacity-80",
                  a.status === "active"
                    ? "bg-success/12 text-success"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {a.status === "active" ? (
                  <>
                    <Pause className="h-3 w-3" /> Activo
                  </>
                ) : (
                  <>
                    <Play className="h-3 w-3" /> En pausa
                  </>
                )}
              </button>
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
          </div>
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
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={agent.status === "active" ? "outline" : "default"}
                    size="sm"
                    onClick={() => void toggleStatus(agent)}
                  >
                    {agent.status === "active" ? (
                      <>
                        <Pause className="h-4 w-4" /> Pausar agente
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4" /> Activar agente
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => void deleteAgent(agent)}
                  >
                    <Trash2 className="h-4 w-4" /> Eliminar agente
                  </Button>
                </div>
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

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo agente pagador</DialogTitle>
            <DialogDescription>
              Define el alcance de gasto y las categorías en las que este agente puede operar.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateAgent} className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="ag-name">Nombre del agente</Label>
              <Input
                id="ag-name"
                value={newAgent.name}
                onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })}
                placeholder="Ej. Contratistas LatAm"
                className="h-10"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ag-purpose">Propósito</Label>
              <Input
                id="ag-purpose"
                value={newAgent.purpose}
                onChange={(e) => setNewAgent({ ...newAgent, purpose: e.target.value })}
                placeholder="Ej. Paga honorarios mensuales de ingeniería y diseño"
                className="h-10"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ag-limit">Límite máximo por operación (USD)</Label>
              <Input
                id="ag-limit"
                inputMode="decimal"
                value={newAgent.limitUsd}
                onChange={(e) => setNewAgent({ ...newAgent, limitUsd: e.target.value })}
                placeholder="3000.00"
                className="h-10"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Categorías autorizadas</Label>
              <div className="flex flex-wrap gap-1.5">
                {ALL_CATEGORIES.map((cat) => {
                  const active = newAgent.categories.includes(cat);
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => toggleCategory(cat)}
                      className={cn(
                        "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>
            </div>
            <DialogFooter className="mt-2">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">Crear agente</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
