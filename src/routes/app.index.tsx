import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowUpRight, Ban, CalendarDays, CheckCircle2, FilePlus2, UserCheck, ScrollText, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, NoMoneyNotice, PageHeader, Panel, SimBadge, Term } from "@/components/tg/primitives";
import { SubjectTable } from "@/components/tg/subject-table";
import { DecisionSheet } from "@/components/tg/decision-detail";
import { useTokenGate } from "@/lib/tokengate/store";
import { categoryBreakdown, spendSeries } from "@/lib/tokengate/mock-data";
import { formatDateTime, formatMoney } from "@/lib/tokengate/format";
import { needsAttention, statusMeta } from "@/lib/tokengate/status";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/")({
  head: () => ({
    meta: [
      { title: "Resumen — TokenGate" },
      { name: "description", content: "Resumen de gasto, decisiones y facturas gestionadas por tus agentes." },
      { property: "og:title", content: "Resumen — TokenGate" },
      { property: "og:description", content: "Tus agentes operan. Tú mantienes el control." },
    ],
  }),
  component: Resumen,
});

const catColors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

function Resumen() {
  const { evaluatedInvoices, all } = useTokenGate();
  const [open, setOpen] = useState<string | null>(null);
  const [range, setRange] = useState("month");
  const attention = all.filter((e) => needsAttention(e.status)).length;
  const counts = {
    authorized: all.filter((e) => e.status === "authorized" || e.status === "human_approved").length,
    blocked: all.filter((e) => e.status === "blocked" || e.status === "human_rejected").length,
    escalated: attention,
  };
  const total = counts.authorized + counts.blocked + counts.escalated;
  const catTotal = categoryBreakdown.reduce((a, c) => a + c.amountMinor, 0);
  const empty = range === "next";

  const kpis = [
    { label: "Gasto gestionado", value: formatMoney({ amountMinor: 842000, currency: "USD" }, { compact: true }), sub: "Este mes", delta: "+12% vs. mes anterior" },
    { label: "Facturas procesadas", value: "128", sub: "Este mes" },
    { label: "Decisiones automáticas", value: "86%", sub: "Sin intervención humana" },
    { label: "Requieren tu atención", value: String(attention), sub: "Pendientes de revisión", highlight: true },
  ];

  return (
    <>
      <PageHeader
        title="Resumen"
        subtitle="Tus agentes operan. Tú mantienes el control."
        actions={
          <>
            <Select value={range} onValueChange={setRange}>
              <SelectTrigger className="h-10 sm:w-[150px]" aria-label="Periodo">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="month">Este mes</SelectItem>
                <SelectItem value="last">Mes anterior</SelectItem>
                <SelectItem value="next">Próximo mes</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" className="h-10" asChild><Link to="/app/decisiones"><ScrollText className="h-4 w-4" />Ver decisiones</Link></Button>
            <Button className="h-10" asChild><Link to="/app/facturas" search={{ upload: true }}><FilePlus2 className="h-4 w-4" />Nueva factura</Link></Button>
          </>
        }
      />

      <div className="mb-2 flex justify-end"><SimBadge>Cifras de demostración</SimBadge></div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className={cn("rounded-lg border border-border bg-surface p-4 shadow-soft", k.highlight && "border-warning/50")}>
            <p className="text-xs font-medium text-muted-foreground">{k.label}</p>
            <p className="tabular mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{k.value}</p>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
              {k.sub}
              {k.delta && <span className="inline-flex items-center gap-0.5 text-success"><ArrowUpRight className="h-3 w-3" />{k.delta}</span>}
            </p>
            {k.highlight && <Link to="/app/aprobaciones" className="mt-2 inline-block text-xs font-medium text-secondary hover:underline">Ir a aprobaciones</Link>}
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3 lg:items-start">
        <Panel
          className="lg:col-span-2"
          title="Actividad de gasto"
          description="Importe diario en USD · simulado"
          action={
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-chart-2" />Autorizado</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-chart-3" />Escalado</span>
            </div>
          }
        >
          {empty ? (
            <EmptyState icon={BarChart3} title="Sin actividad en este periodo" text="Todavía no hay gasto registrado. Vuelve a Este mes para ver la actividad." action={<Button variant="outline" onClick={() => setRange("month")}>Ver este mes</Button>} />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={spendSeries} margin={{ left: -16, right: 8, top: 8 }}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--popover-foreground)", fontSize: 12 }}
                    formatter={(v: number, n: string) => [`USD ${v}`, n === "autorizado" ? "Autorizado" : "Escalado"]}
                  />
                  <Area type="monotone" dataKey="autorizado" stackId="1" stroke="var(--chart-2)" fill="var(--chart-2)" fillOpacity={0.18} strokeWidth={2} isAnimationActive={false} />
                  <Area type="monotone" dataKey="escalado" stackId="1" stroke="var(--chart-3)" fill="var(--chart-3)" fillOpacity={0.25} strokeWidth={2} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="mt-4 border-t border-border pt-4">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Por categoría</p>
            <div className="flex h-2 overflow-hidden rounded-full bg-muted" role="img" aria-label="Distribución del gasto por categoría">
              {categoryBreakdown.map((c, i) => <div key={c.name} style={{ width: `${(c.amountMinor / catTotal) * 100}%`, background: catColors[i] }} />)}
            </div>
            <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-5">
              {categoryBreakdown.map((c, i) => (
                <li key={c.name} className="min-w-0 text-xs">
                  <span className="flex items-center gap-1.5 text-muted-foreground"><span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: catColors[i] }} />{c.name}</span>
                  <span className="tabular font-medium">{formatMoney({ amountMinor: c.amountMinor, currency: "USD" }, { compact: true })}</span>
                </li>
              ))}
            </ul>
          </div>
        </Panel>

        <div className="flex flex-col gap-4">
          <Panel title="Distribución de decisiones" description={`${total} decisiones simuladas`}>
            <div className="flex h-2 overflow-hidden rounded-full bg-muted">
              <div className="bg-success" style={{ width: `${(counts.authorized / total) * 100}%` }} />
              <div className="bg-warning" style={{ width: `${(counts.escalated / total) * 100}%` }} />
              <div className="bg-destructive" style={{ width: `${(counts.blocked / total) * 100}%` }} />
            </div>
            <ul className="mt-3 space-y-2 text-sm">
              {[
                { icon: CheckCircle2, label: "Autorizadas", n: counts.authorized, cls: "text-success" },
                { icon: UserCheck, label: "Escaladas a aprobación", n: counts.escalated, cls: "text-warning" },
                { icon: Ban, label: "Bloqueadas", n: counts.blocked, cls: "text-destructive" },
              ].map((r) => (
                <li key={r.label} className="flex items-center justify-between">
                  <span className="flex items-center gap-2"><r.icon className={cn("h-4 w-4", r.cls)} aria-hidden />{r.label}</span>
                  <span className="tabular font-medium">{r.n}</span>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Actividad del agente" bodyClassName="p-0">
            <ul className="divide-y divide-border">
              {evaluatedInvoices.slice(0, 5).map((e) => {
                const m = statusMeta[e.status];
                const reason = e.result.rules.find((r) => r.status !== "passed");
                return (
                  <li key={e.subject.id}>
                    <button type="button" onClick={() => setOpen(e.subject.id)} className="flex w-full gap-3 px-4 py-3 text-left hover:bg-muted/60 focus-visible:bg-muted focus-visible:outline-none">
                      <m.icon className={cn("mt-0.5 h-4 w-4 shrink-0", m.tone === "success" ? "text-success" : m.tone === "destructive" ? "text-destructive" : m.tone === "warning" ? "text-warning" : "text-secondary")} aria-hidden />
                      <span className="min-w-0">
                        <span className="block text-sm">Factura <span className="font-mono text-xs">{e.subject.reference}</span> {m.short.toLowerCase()}{reason ? `: ${reason.explanation.charAt(0).toLowerCase()}${reason.explanation.slice(1)}` : " automáticamente."}</span>
                        <span className="tabular text-xs text-muted-foreground">{formatDateTime(e.evaluatedAt)}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Panel>
        </div>
      </div>

      <Panel
        className="mt-4"
        title="Facturas recientes"
        description={<>Ejemplos simulados · <Term hint="Autorización simulada: el motor de reglas aprueba la operación, pero no se ejecuta ningún pago.">autorización simulada</Term></>}
        action={<Button variant="ghost" size="sm" className="h-9" asChild><Link to="/app/facturas">Ver todas</Link></Button>}
        bodyClassName="p-0"
      >
        <SubjectTable rows={evaluatedInvoices.slice(0, 6)} onOpen={setOpen} referenceLabel="Factura" dateLabel="Fecha límite" columns={["reference", "supplier", "agent", "amount", "date", "status"]} />
      </Panel>
      <NoMoneyNotice className="mt-4" />
      <DecisionSheet subjectId={open} onClose={() => setOpen(null)} />
    </>
  );
}
