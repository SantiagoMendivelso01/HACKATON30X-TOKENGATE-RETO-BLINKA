import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Bot, Cog, FileUp, Gavel, ShieldCheck, SlidersHorizontal, User, UserCheck } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, PageHeader, Panel, SimBadge } from "@/components/tg/primitives";
import { useTokenGate } from "@/lib/tokengate/store";
import { formatDateTime } from "@/lib/tokengate/format";
import { statusMeta } from "@/lib/tokengate/status";
import type { AuditEvent } from "@/lib/tokengate/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/auditoria")({
  head: () => ({
    meta: [
      { title: "Auditoría — TokenGate" },
      { name: "description", content: "Cronología de acciones del sistema, agentes y personas." },
      { property: "og:title", content: "Auditoría — TokenGate" },
      { property: "og:description", content: "Quién hizo qué, cuándo y por qué." },
    ],
  }),
  component: Auditoria,
});

const typeMeta: Record<AuditEvent["type"], { label: string; icon: typeof Bot }> = {
  decision: { label: "Registro de decisión", icon: Gavel },
  human_review: { label: "Revisión humana", icon: UserCheck },
  policy_change: { label: "Cambio de política", icon: SlidersHorizontal },
  invoice_upload: { label: "Carga de factura", icon: FileUp },
  settings: { label: "Configuración", icon: Cog },
  system: { label: "Evento del sistema", icon: ShieldCheck },
};

function Auditoria() {
  const { audit, decisionLog, byId } = useTokenGate();
  const [type, setType] = useState<"all" | AuditEvent["type"]>("all");
  const [actor, setActor] = useState<"all" | AuditEvent["actorKind"]>("all");
  const [period, setPeriod] = useState<"all" | "week">("all");

  const events = useMemo(() => {
    const agentEvents: AuditEvent[] = decisionLog
      .filter((d) => d.actor === "agent")
      .map((d) => ({
        id: `ev-${d.id}`,
        at: d.at,
        type: "decision",
        actor: `Agente ${d.actorName}`,
        actorKind: "agent",
        summary: `${byId.get(d.subjectId)?.subject.reference}: ${statusMeta[d.result.outcome].label.toLowerCase()}`,
        reason: d.result.explanation,
      }));
    return [...audit, ...agentEvents]
      .filter((e) => (type === "all" || e.type === type) && (actor === "all" || e.actorKind === actor) && (period === "all" || e.at >= "2026-10-11"))
      .sort((a, b) => b.at.localeCompare(a.at));
  }, [audit, decisionLog, byId, type, actor, period]);

  return (
    <>
      <PageHeader title="Auditoría" subtitle="Cronología de acciones de agentes, personas y sistema." />
      <Panel bodyClassName="p-0" title={<span className="flex items-center gap-2">{events.length} eventos <SimBadge /></span>} description="Log de demostración en memoria. En producción debe residir en un backend de confianza.">
        <div className="grid gap-2 border-b border-border p-3 sm:grid-cols-3">
          <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
            <SelectTrigger className="h-10" aria-label="Tipo de acción"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las acciones</SelectItem>
              {(Object.keys(typeMeta) as AuditEvent["type"][]).map((k) => <SelectItem key={k} value={k}>{typeMeta[k].label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={actor} onValueChange={(v) => setActor(v as typeof actor)}>
            <SelectTrigger className="h-10" aria-label="Iniciado por"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Cualquier origen</SelectItem>
              <SelectItem value="agent">Agentes</SelectItem>
              <SelectItem value="human">Personas</SelectItem>
              <SelectItem value="system">Sistema</SelectItem>
            </SelectContent>
          </Select>
          <Select value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
            <SelectTrigger className="h-10" aria-label="Periodo"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Este mes</SelectItem>
              <SelectItem value="week">Últimos 7 días</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {events.length === 0 ? (
          <EmptyState icon={ShieldCheck} title="Sin eventos" text="No hay eventos para estos filtros." />
        ) : (
          <ol className="relative px-4 py-4">
            {events.map((e) => {
              const m = typeMeta[e.type];
              const isDecision = e.type === "decision" || e.type === "human_review";
              return (
                <li key={e.id} className="relative flex gap-3 pb-5 last:pb-0">
                  <span className="absolute left-[15px] top-8 h-[calc(100%-2rem)] w-px bg-border" aria-hidden />
                  <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full border", isDecision ? "border-secondary/30 bg-secondary/10 text-secondary" : "border-border bg-muted text-muted-foreground")}>
                    <m.icon className="h-4 w-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{e.summary}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                      <span className={cn("rounded px-1 font-medium", isDecision ? "bg-secondary/10 text-secondary" : "bg-muted")}>{m.label}</span>
                      <span className="inline-flex items-center gap-1">{e.actorKind === "agent" ? <Bot className="h-3 w-3" /> : e.actorKind === "human" ? <User className="h-3 w-3" /> : <Cog className="h-3 w-3" />}{e.actor}</span>
                      <span className="tabular">{formatDateTime(e.at)}</span>
                    </p>
                    {e.reason && <p className="mt-1 text-xs text-muted-foreground">Motivo: {e.reason}</p>}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </Panel>
    </>
  );
}
