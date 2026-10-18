import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Bot,
  Cog,
  FileUp,
  Gavel,
  Receipt,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  User,
  UserCheck,
  Download,
  ChevronDown,
  ScrollText,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  StatusBadge,
} from "@/components/tg/primitives";
import { useTokenGate, type TrailEvent } from "@/lib/tokengate/store";
import { DecisionPipeline } from "@/components/tg/decision-pipeline";
import { formatDateTime, formatMoney } from "@/lib/tokengate/format";
import { displayStatus } from "@/lib/tokengate/status";
import { cn } from "@/lib/utils";
import type { AuditEvent, DecisionOutcome } from "@/lib/tokengate/types";

export const Route = createFileRoute("/app/auditoria")({
  validateSearch: (s: Record<string, unknown>): {
    q?: string | undefined;
    tab?: "decisiones" | "cadena" | undefined;
  } => ({
    q: typeof s["q"] === "string" ? s["q"] : undefined,
    tab: s["tab"] === "cadena" ? "cadena" : s["tab"] === "decisiones" ? "decisiones" : undefined,
  }),
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Auditoría y Decisiones — blinka" },
      {
        name: "description",
        content:
          "Explicación paso a paso de por qué el agente pagó, frenó o escaló cada factura, y cadena de auditoría con hash.",
      },
      { property: "og:title", content: "Auditoría y Decisiones — blinka" },
      { property: "og:description", content: "Quién hizo qué, cuándo y por qué." },
    ],
  }),
  component: AuditoriaYDecisiones,
});

const typeMeta: Record<AuditEvent["type"], { label: string; icon: typeof Bot }> = {
  decision: { label: "Decisión del agente", icon: Gavel },
  human_review: { label: "Revisión humana", icon: UserCheck },
  payment: { label: "Pago (sandbox)", icon: Receipt },
  policy_change: { label: "Cambio de política", icon: SlidersHorizontal },
  invoice_upload: { label: "Factura recibida", icon: FileUp },
  settings: { label: "Configuración", icon: Cog },
  system: { label: "Evento del sistema", icon: ShieldCheck },
};

const OUTCOME_LABEL = {
  all: "Todos los resultados",
  authorized: "Autorizadas (Pagadas)",
  blocked: "Frenadas (Bloqueadas)",
  requires_approval: "Escaladas a humano",
  needs_information: "Pendientes de datos",
  human: "Decisiones de Finanzas",
} as const;

const ACTOR_LABEL = {
  all: "Cualquier origen",
  agent: "Agente pagador",
  human: "Personas (Finanzas)",
  system: "Sistema",
} as const;

function download(name: string, rows: (string | number)[][]) {
  const csv = rows
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
  a.download = name;
  a.click();
}

function AuditoriaYDecisiones() {
  const { trail, brokenAt, seed, mode, decisionLog, byId, policy } = useTokenGate();
  const search = Route.useSearch();
  const [tab, setTab] = useState<"decisiones" | "cadena">(search.tab ?? "decisiones");

  // Decisiones tab filters
  const [q, setQ] = useState(search.q ?? "");
  const [outcome, setOutcome] = useState<"all" | DecisionOutcome | "human">("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  // Hash chain tab filters
  const [type, setType] = useState<"all" | AuditEvent["type"]>("all");
  const [actor, setActor] = useState<"all" | AuditEvent["actorKind"]>("all");

  const decisionRows = useMemo(() => {
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
      return true;
    });
  }, [decisionLog, byId, q, outcome]);

  const events = useMemo(
    () =>
      trail
        .map((e, i) => ({ ...e, n: i + 1 }))
        .filter(
          (e) => (type === "all" || e.type === type) && (actor === "all" || e.actorKind === actor),
        )
        .reverse(),
    [trail, type, actor],
  );

  return (
    <>
      <PageHeader
        eyebrow="Explicabilidad e Integridad"
        title="Auditoría y Decisiones"
        subtitle="Cualquier persona puede entender por qué el agente pagó, frenó o pidió permiso con cada factura, sin abrir el código."
        actions={
          <Button
            variant="outline"
            className="h-10"
            onClick={() =>
              download(`auditoria-${seed.id}.csv`, [
                ["#", "fecha", "tipo", "actor", "evento", "motivo", "hash", "hash_anterior"],
                ...trail.map((e: TrailEvent, i) => [
                  i + 1,
                  e.at,
                  e.type,
                  e.actor,
                  e.summary,
                  e.reason ?? "",
                  e.hash,
                  e.prev,
                ]),
              ])
            }
          >
            <Download className="h-4 w-4" />
            Exportar auditoría CSV
          </Button>
        }
      />

      {/* Estado de la cadena criptográfica */}
      <div
        className={cn(
          "mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl px-4 py-3 text-sm font-medium",
          brokenAt < 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive",
        )}
      >
        <span className="flex items-center gap-2">
          {brokenAt < 0 ? <ShieldCheck className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
          {brokenAt < 0
            ? `Cadena criptográfica íntegra · ${trail.length} eventos verificados con hash`
            : `Cadena rota en el evento #${brokenAt + 1}: su contenido no coincide con el hash registrado`}
        </span>
        <span className="text-xs opacity-80">
          {mode === "supabase" ? "Persistido en Supabase" : "Modo memoria"}
        </span>
      </div>

      {/* Pestañas: Explicación por factura vs Cadena de eventos */}
      <div className="mb-4 flex flex-wrap gap-2 border-b border-border pb-3">
        <button
          type="button"
          onClick={() => setTab("decisiones")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
            tab === "decisiones"
              ? "bg-primary text-primary-foreground"
              : "border border-border bg-card text-muted-foreground hover:text-foreground"
          }`}
        >
          <ScrollText className="h-4 w-4" />
          Por qué decidió, factura por factura ({decisionRows.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("cadena")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
            tab === "cadena"
              ? "bg-primary text-primary-foreground"
              : "border border-border bg-card text-muted-foreground hover:text-foreground"
          }`}
        >
          <ShieldCheck className="h-4 w-4" />
          Registro firmado ({events.length})
        </button>
      </div>

      {tab === "decisiones" ? (
        <Panel
          bodyClassName="p-0"
          title={<span className="flex items-center gap-2">{decisionRows.length} decisiones</span>}
          description="Abre cualquier decisión para ver el recorrido paso a paso: qué revisó el agente, qué encontró y por qué pagó, frenó o pidió permiso."
        >
          <div className="grid gap-2 border-b border-border p-3 sm:grid-cols-[1fr_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por número de factura o proveedor…"
                className="h-10 pl-9"
                aria-label="Buscar decisiones"
              />
            </div>
            <Select value={outcome} onValueChange={(v) => setOutcome(v as typeof outcome)}>
              <SelectTrigger className="h-10 sm:w-56" aria-label="Resultado">
                <SelectValue>{OUTCOME_LABEL[outcome]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los resultados</SelectItem>
                <SelectItem value="authorized">Autorizadas (Pagadas)</SelectItem>
                <SelectItem value="blocked">Frenadas (Bloqueadas)</SelectItem>
                <SelectItem value="requires_approval">Escaladas a humano</SelectItem>
                <SelectItem value="needs_information">Pendientes de datos</SelectItem>
                <SelectItem value="human">Decisiones de Finanzas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {decisionRows.length === 0 ? (
            <EmptyState
              icon={ScrollText}
              title="Sin decisiones para estos filtros"
              text="Prueba con otra búsqueda o cambia el filtro de resultado."
              action={
                <Button
                  variant="outline"
                  onClick={() => {
                    setQ("");
                    setOutcome("all");
                  }}
                >
                  Limpiar filtros
                </Button>
              }
            />
          ) : (
            <ol className="divide-y divide-border">
              {decisionRows.map((d) => {
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
                      className="flex w-full items-start gap-3 px-4 py-3.5 text-left hover:bg-muted/60 focus-visible:bg-muted focus-visible:outline-none"
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                          d.actor === "human"
                            ? "bg-secondary/10 text-secondary"
                            : "bg-primary/10 text-primary",
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
                          <span className="text-sm font-medium">{s.supplier}</span>
                          <span className="tabular text-sm font-semibold">
                            {formatMoney(s.amount)}
                          </span>
                        </span>
                        <span className="mt-1 block text-xs text-foreground/85">
                          {d.result.explanation}
                        </span>
                        <span className="mt-1 block text-[11px] text-muted-foreground">
                          {d.actor === "human"
                            ? `Revisión humana por ${d.actorName}`
                            : "Agente pagador"}{" "}
                          · {formatDateTime(d.at)} · Política {d.result.policyVersion}
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
                      <div className="space-y-3 bg-muted/40 px-4 pb-4 pt-2 sm:pl-14">
                        <StatusBadge status={status} full className="sm:hidden" />
                        {d.note && (
                          <p className="rounded-lg border border-border bg-card px-3 py-2 text-xs">
                            <b>Nota de Finanzas:</b> “{d.note}”
                          </p>
                        )}
                        <DecisionPipeline
                          subject={s}
                          result={d.result}
                          status={status}
                          policy={policy}
                        />
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </Panel>
      ) : (
        <Panel
          bodyClassName="p-0"
          title={<span className="flex items-center gap-2">{events.length} eventos firmados</span>}
          description="Cada evento incluye su propio hash y el hash del evento anterior para garantizar que el registro no fue manipulado."
        >
          <div className="grid gap-2 border-b border-border p-3 sm:grid-cols-2">
            <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
              <SelectTrigger className="h-10 rounded-xl" aria-label="Tipo de evento">
                <SelectValue>
                  {type === "all" ? "Todos los tipos de evento" : typeMeta[type].label}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos de evento</SelectItem>
                {(Object.keys(typeMeta) as AuditEvent["type"][]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {typeMeta[k].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={actor} onValueChange={(v) => setActor(v as typeof actor)}>
              <SelectTrigger className="h-10 rounded-xl" aria-label="Iniciado por">
                <SelectValue>{ACTOR_LABEL[actor]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Cualquier origen</SelectItem>
                <SelectItem value="agent">Agente pagador</SelectItem>
                <SelectItem value="human">Personas (Finanzas)</SelectItem>
                <SelectItem value="system">Sistema</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {events.length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title="Sin eventos"
              text="No hay eventos para estos filtros."
            />
          ) : (
            <ol className="relative px-5 py-4">
              {events.map((e) => {
                const m = typeMeta[e.type];
                const broken = brokenAt >= 0 && e.n - 1 === brokenAt;
                const accent =
                  e.type === "decision" || e.type === "human_review" || e.type === "payment";
                return (
                  <li
                    key={`${e.n}-${e.hash}`}
                    className={cn(
                      "relative flex gap-3 pb-5 last:pb-0",
                      broken && "-mx-3 rounded-xl bg-destructive/10 px-3 pt-2",
                    )}
                  >
                    <span
                      className="absolute left-[15px] top-8 h-[calc(100%-2rem)] w-px bg-border"
                      aria-hidden
                    />
                    <span
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border",
                        accent
                          ? "border-primary/25 bg-accent text-primary"
                          : "border-border bg-card text-muted-foreground",
                      )}
                    >
                      <m.icon className="h-4 w-4" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{e.summary}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                        <span className="font-mono">#{e.n}</span>
                        <span
                          className={cn(
                            "rounded-full px-2 font-medium",
                            accent ? "bg-accent text-primary" : "bg-muted",
                          )}
                        >
                          {m.label}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          {e.actorKind === "agent" ? (
                            <Bot className="h-3 w-3" />
                          ) : e.actorKind === "human" ? (
                            <User className="h-3 w-3" />
                          ) : (
                            <Cog className="h-3 w-3" />
                          )}
                          {e.actor}
                        </span>
                        <span className="tabular">{formatDateTime(e.at)}</span>
                      </p>
                      {e.reason && <p className="mt-1 text-xs text-muted-foreground">{e.reason}</p>}
                      <p className="mt-1 font-mono text-[10.5px] text-muted-foreground/80">
                        hash {e.hash.slice(0, 12)} ← {e.prev.slice(0, 12)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </Panel>
      )}
      <NoMoneyNotice className="mt-4" />
    </>
  );
}
