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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState, PageHeader, Panel } from "@/components/tg/primitives";
import { useTokenGate, type TrailEvent } from "@/lib/tokengate/store";
import { formatDateTime } from "@/lib/tokengate/format";
import { cn } from "@/lib/utils";
import type { AuditEvent } from "@/lib/tokengate/types";

export const Route = createFileRoute("/app/auditoria")({
  head: () => ({
    meta: [
      { title: "Auditoría — blinka" },
      {
        name: "description",
        content: "Cronología encadenada por hash de acciones del sistema, agentes y personas.",
      },
      { property: "og:title", content: "Auditoría — blinka" },
      { property: "og:description", content: "Quién hizo qué, cuándo y por qué." },
    ],
  }),
  component: Auditoria,
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

function download(name: string, rows: (string | number)[][]) {
  const csv = rows
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  a.download = name;
  a.click();
}

const ACTOR_LABEL = {
  all: "Cualquier origen",
  agent: "Agentes",
  human: "Personas",
  system: "Sistema",
} as const;

function Auditoria() {
  const { trail, brokenAt, seed, mode } = useTokenGate();
  const [type, setType] = useState<"all" | AuditEvent["type"]>("all");
  const [actor, setActor] = useState<"all" | AuditEvent["actorKind"]>("all");

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
        eyebrow="Trazabilidad"
        title="Auditoría"
        subtitle="Cada evento queda encadenado con un hash al anterior. Si alguien edita o borra un evento pasado, la cadena se rompe y se nota."
        actions={
          <>
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
              Exportar CSV
            </Button>
          </>
        }
      />

      <div
        className={cn(
          "mb-4 flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium",
          brokenAt < 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive",
        )}
      >
        {brokenAt < 0 ? <ShieldCheck className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
        {brokenAt < 0
          ? `Cadena íntegra · ${trail.length} eventos verificados`
          : `Cadena rota en el evento #${brokenAt + 1}: su contenido no coincide con el hash registrado`}
      </div>

      <Panel
        bodyClassName="p-0"
        title={<span className="flex items-center gap-2">{events.length} eventos</span>}
        description={
          mode === "supabase"
            ? "Guardado en Supabase, de solo escritura: la base rechaza editar o borrar eventos, y el hash encadenado detecta cualquier cambio."
            : "En memoria con hash encadenado: se pierde al recargar. Configura Supabase para guardarlo."
        }
      >
        <div className="grid gap-2 border-b border-border p-3 sm:grid-cols-2">
          <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
            <SelectTrigger className="h-10 rounded-xl" aria-label="Tipo de evento">
              <SelectValue>
                {type === "all" ? "Todos los eventos" : typeMeta[type].label}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los eventos</SelectItem>
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
              <SelectItem value="agent">Agentes</SelectItem>
              <SelectItem value="human">Personas</SelectItem>
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
    </>
  );
}
