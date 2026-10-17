import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { NoMoneyNotice, PageHeader, Panel, SimBadge, Term } from "@/components/tg/primitives";
import { useTokenGate } from "@/lib/tokengate/store";
import { baselineUsage, categoryBreakdown } from "@/lib/tokengate/mock-data";
import { formatMoney } from "@/lib/tokengate/format";
import { needsAttention } from "@/lib/tokengate/status";
import type { Currency } from "@/lib/tokengate/types";

export const Route = createFileRoute("/app/presupuestos")({
  head: () => ({
    meta: [
      { title: "Presupuestos — TokenGate" },
      { name: "description", content: "Presupuesto mensual, saldo disponible e importes reservados por moneda." },
      { property: "og:title", content: "Presupuestos — TokenGate" },
      { property: "og:description", content: "Cuánto queda, cuánto está reservado y cuánto se bloqueó." },
    ],
  }),
  component: Presupuestos,
});

const catColors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

function Presupuestos() {
  const { policy, all } = useTokenGate();
  const [period, setPeriod] = useState("2026-10");
  const past = period !== "2026-10";

  const sum = (c: Currency, pred: (s: (typeof all)[number]["status"]) => boolean) =>
    all.filter((e) => e.subject.amount.currency === c && pred(e.status)).reduce((a, e) => a + e.subject.amount.amountMinor, 0);

  const catMax = Math.max(...categoryBreakdown.map((c) => c.amountMinor));

  return (
    <>
      <PageHeader
        title="Presupuestos"
        subtitle="Saldo disponible por moneda y destino del gasto."
        actions={
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="h-10 w-44" aria-label="Periodo"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="2026-10">Octubre 2026</SelectItem>
              <SelectItem value="2026-09">Septiembre 2026</SelectItem>
            </SelectContent>
          </Select>
        }
      />
      <div className="mb-2 flex justify-end"><SimBadge /></div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(["USD", "EUR", "COP"] as Currency[]).map((c) => {
          const budget = policy.monthlyBudget[c];
          const used = past ? Math.round(budget * 0.91) : baselineUsage[c];
          const approved = past ? 0 : sum(c, (s) => s === "authorized" || s === "human_approved");
          const reserved = past ? 0 : sum(c, needsAttention);
          const blocked = past ? 0 : sum(c, (s) => s === "blocked" || s === "human_rejected");
          const remaining = budget - used - approved - reserved;
          const pct = Math.min(100, Math.round(((used + approved) / budget) * 100));
          const m = (v: number) => formatMoney({ amountMinor: v, currency: c });
          return (
            <Panel key={c} title={`Presupuesto en ${c}`} description={past ? "Periodo cerrado" : "Periodo en curso"}>
              <p className="text-xs text-muted-foreground">Disponible</p>
              <p className="tabular text-3xl font-semibold tracking-tight">{m(Math.max(remaining, 0))}</p>
              <p className="tabular text-xs text-muted-foreground">de {m(budget)}</p>
              <Progress value={pct} className="mt-3 h-2" aria-label={`${pct}% consumido`} />
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-xs text-muted-foreground">Comprometido previo</dt><dd className="tabular font-medium">{m(used)}</dd></div>
                <div><dt className="text-xs text-muted-foreground"><Term hint="Autorizado por el motor o aprobado por una persona. Simulado: no se ha pagado.">Aprobado</Term></dt><dd className="tabular font-medium">{m(approved)}</dd></div>
                <div><dt className="text-xs text-muted-foreground"><Term hint="Importe de operaciones pendientes de revisión, apartado del saldo disponible.">Reservado</Term></dt><dd className="tabular font-medium">{m(reserved)}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Bloqueado</dt><dd className="tabular font-medium">{m(blocked)}</dd></div>
              </dl>
            </Panel>
          );
        })}
      </div>
      <Panel className="mt-4" title="Gasto por categoría" description="Importes en USD">
        <ul className="space-y-3">
          {categoryBreakdown.map((cat, i) => (
            <li key={cat.name} className="grid grid-cols-[110px_1fr_auto] items-center gap-3 text-sm">
              <span>{cat.name}</span>
              <span className="h-2 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full" style={{ width: `${(cat.amountMinor / catMax) * 100}%`, background: catColors[i] }} /></span>
              <span className="tabular text-right font-medium">{formatMoney({ amountMinor: past ? Math.round(cat.amountMinor * 0.9) : cat.amountMinor, currency: "USD" }, { compact: true })}</span>
            </li>
          ))}
        </ul>
      </Panel>
      <NoMoneyNotice className="mt-4" />
    </>
  );
}
