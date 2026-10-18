import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Bot, ChevronDown, ScrollText, Search, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  EmptyState,
  NoMoneyNotice,
  PageHeader,
  Panel,
  RuleBadge,
  StatusBadge,
} from "@/components/tg/primitives";
import { useTokenGate } from "@/lib/tokengate/store";
import { formatDateTime, formatMoney } from "@/lib/tokengate/format";
import { displayStatus } from "@/lib/tokengate/status";
import type { DecisionOutcome } from "@/lib/tokengate/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/decisiones")({
  validateSearch: (s: Record<string, unknown>): { q?: string | undefined } => ({
    q: typeof s["q"] === "string" ? s["q"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Registro de decisiones — blinka" },
      { name: "description", content: "Historial de decisiones con evaluación regla por regla." },
      { property: "og:title", content: "Registro de decisiones — blinka" },
      {
        property: "og:description",
        content: "Cada decisión tiene reglas, límites y una razón detrás.",
      },
    ],
  }),
  component: Decisiones,
});

const OUTCOME_LABEL = {
  all: "Todos los resultados",
  authorized: "Autorizadas",
  blocked: "Bloqueadas",
  requires_approval: "Requieren aprobación",
  needs_information: "Pendientes de información",
  human: "Revisiones humanas",
} as const;

function Decisiones() {
  const { decisionLog, byId } = useTokenGate();
  const search = Route.useSearch();
  const [q, setQ] = useState(search.q ?? "");
  const [outcome, setOutcome] = useState<"all" | DecisionOutcome | "human">("all");
  const [period, setPeriod] = useState<"all" | "week">("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return decisionLog.filter((d) => {
      const s = byId.get(d.subjectId)?.subject;
      if (!s) return false;
      if (t && !s.reference.toLowerCase().includes(t) && !s.supplier.toLowerCase().includes(t))
        return false;
      if (
        outcome === "human"
          ? d.actor !== "human"
          : outcome !== "all" && (d.actor === "human" || d.result.outcome !== outcome)
      )
        return false;
      if (period === "week" && d.at < "2026-10-11") return false;
      return true;
    });
  }, [decisionLog, byId, q, outcome, period]);

  return (
    <>
      <PageHeader
        title="Registro de decisiones"
        subtitle="Historial cronológico de decisiones de agentes y revisiones humanas."
      />
      <Panel
        bodyClassName="p-0"
        title={<span className="flex items-center gap-2">{rows.length} registros</span>}
        description="Registro en memoria: no es inmutable ni a prueba de manipulación."
      >
        <div className="grid gap-2 border-b border-border p-3 sm:grid-cols-[1fr_auto_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar referencia o proveedor"
              className="h-10 pl-9"
              aria-label="Buscar decisiones"
            />
          </div>
          <Select value={outcome} onValueChange={(v) => setOutcome(v as typeof outcome)}>
            <SelectTrigger className="h-10 sm:w-52" aria-label="Resultado">
              <SelectValue>{OUTCOME_LABEL[outcome]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los resultados</SelectItem>
              <SelectItem value="authorized">Autorizadas</SelectItem>
              <SelectItem value="blocked">Bloqueadas</SelectItem>
              <SelectItem value="requires_approval">Requieren aprobación</SelectItem>
              <SelectItem value="needs_information">Pendientes de información</SelectItem>
              <SelectItem value="human">Revisiones humanas</SelectItem>
            </SelectContent>
          </Select>
          <Select value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
            <SelectTrigger className="h-10 sm:w-40" aria-label="Periodo">
              <SelectValue>{period === "week" ? "Últimos 7 días" : "Este mes"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Este mes</SelectItem>
              <SelectItem value="week">Últimos 7 días</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {rows.length === 0 ? (
          <EmptyState
            icon={ScrollText}
            title="Sin decisiones para estos filtros"
            text="Ajusta la búsqueda o el periodo."
            action={
              <Button
                variant="outline"
                onClick={() => {
                  setQ("");
                  setOutcome("all");
                  setPeriod("all");
                }}
              >
                Limpiar filtros
              </Button>
            }
          />
        ) : (
          <ol className="divide-y divide-border">
            {rows.map((d) => {
              const s = byId.get(d.subjectId)!.subject;
              const isOpen = expanded === d.id;
              const status =
                d.actor === "human" && d.humanAction
                  ? displayStatus(d.result.outcome, {
                      action: d.humanAction,
                      by: d.actorName,
                      at: d.at,
                    })
                  : d.result.outcome;
              return (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : d.id)}
                    aria-expanded={isOpen}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-muted/60 focus-visible:bg-muted focus-visible:outline-none"
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                        d.actor === "human"
                          ? "bg-secondary/10 text-secondary"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {d.actor === "human" ? (
                        <User className="h-4 w-4" />
                      ) : (
                        <Bot className="h-4 w-4" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="whitespace-nowrap font-mono text-xs font-medium">
                          {s.reference}
                        </span>
                        <span className="text-sm">{s.supplier}</span>
                        <span className="tabular text-sm text-muted-foreground">
                          {formatMoney(s.amount)}
                        </span>
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {d.actor === "human" ? "Revisión humana" : "Decisión del agente"} ·{" "}
                        {d.actorName} · {formatDateTime(d.at)} · Política {d.result.policyVersion}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <StatusBadge status={status} className="hidden sm:inline-flex" />
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 text-muted-foreground transition-transform",
                          isOpen && "rotate-180",
                        )}
                      />
                    </span>
                  </button>
                  {isOpen && (
                    <div className="space-y-3 bg-muted/40 px-4 pb-4 pt-1 sm:pl-14">
                      <StatusBadge status={status} full className="sm:hidden" />
                      <p className="text-sm">
                        {d.result.explanation}
                        {d.note ? ` Nota: “${d.note}”.` : ""}
                      </p>
                      <ul className="divide-y divide-border rounded-md border border-border bg-surface">
                        {d.result.rules.map((r) => (
                          <li
                            key={r.ruleId}
                            className="flex items-start justify-between gap-3 px-3 py-2"
                          >
                            <span className="min-w-0">
                              <span className="block text-sm">{r.label}</span>
                              <span className="text-xs text-muted-foreground">{r.explanation}</span>
                            </span>
                            <RuleBadge status={r.status} />
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </Panel>
      <NoMoneyNotice className="mt-4" />
    </>
  );
}
