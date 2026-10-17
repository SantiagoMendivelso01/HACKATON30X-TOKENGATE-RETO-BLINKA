import { createFileRoute } from "@tanstack/react-router";
import { NoMoneyNotice, PageHeader, Panel, Term } from "@/components/tg/primitives";
import { useTokenGate } from "@/lib/tokengate/store";
import { formatBase, formatMoney, moneyParts } from "@/lib/tokengate/format";
import type { Currency } from "@/lib/tokengate/types";

export const Route = createFileRoute("/app/presupuestos")({
  head: () => ({
    meta: [
      { title: "Presupuestos — blinka" },
      {
        name: "description",
        content:
          "Presupuesto del periodo, saldo disponible, importes reservados y exposición por moneda.",
      },
      { property: "og:title", content: "Presupuestos — blinka" },
      {
        property: "og:description",
        content: "Cuánto queda, cuánto está reservado y cuánto se bloqueó.",
      },
    ],
  }),
  component: Presupuestos,
});

const STATE_COLOR = {
  prev: "var(--color-chart-5)",
  paid: "var(--color-success)",
  pending: "var(--color-warning)",
};

function Bars({ rows }: { rows: { name: string; paid: number; pending: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.paid + r.pending));
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li
          key={r.name}
          className="grid grid-cols-[minmax(110px,30%)_1fr_auto] items-center gap-3 text-sm"
          title={`${r.name}: pagado ${formatBase(r.paid)}, reservado ${formatBase(r.pending)}`}
        >
          <span className="truncate text-foreground/85">{r.name}</span>
          <span
            className="flex h-3 gap-[2px] overflow-hidden rounded-r"
            style={{ width: `${((r.paid + r.pending) / max) * 100}%`, minWidth: 2 }}
          >
            {r.paid > 0 && <span style={{ flex: r.paid, background: STATE_COLOR.paid }} />}
            {r.pending > 0 && <span style={{ flex: r.pending, background: STATE_COLOR.pending }} />}
          </span>
          <span className="tabular text-right text-xs font-medium">
            {formatBase(r.paid + r.pending)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Presupuestos() {
  const { policy, all, ledger, seed, agentName } = useTokenGate();
  const P = policy.monthlyBudget;
  const prev = seed.baselineUsedMinor;
  const paidBatch = ledger.spentMinor - prev;
  const blocked = all
    .filter((e) => e.state === "blocked" || e.state === "rejected")
    .reduce((s, e) => s + e.baseMinor, 0);
  const pct = (v: number) => `${Math.max(0, (v / P) * 100).toFixed(2)}%`;
  const used = Math.round(((ledger.spentMinor + ledger.committedMinor) / P) * 100);
  const p = moneyParts({ amountMinor: Math.max(ledger.availableMinor, 0), currency: "USD" });

  const group = (key: (e: (typeof all)[number]) => string) => {
    const m = new Map<string, { name: string; paid: number; pending: number }>();
    for (const e of all) {
      if (e.state !== "paid" && e.state !== "pending") continue;
      const k = key(e);
      const r = m.get(k) ?? { name: k, paid: 0, pending: 0 };
      if (e.state === "paid") r.paid += e.baseMinor;
      else r.pending += e.baseMinor;
      m.set(k, r);
    }
    return [...m.values()].sort((a, b) => b.paid + b.pending - (a.paid + a.pending));
  };

  const currencies = [...new Set(all.map((e) => e.subject.amount.currency))] as Currency[];
  const byCurrency = currencies
    .map((c) => {
      const mine = all.filter((e) => e.subject.amount.currency === c);
      const sum = (pred: (s: string) => boolean) => mine.filter((e) => pred(e.state));
      const native = (list: typeof mine) =>
        list.reduce((s, e) => s + e.subject.amount.amountMinor, 0);
      const base = (list: typeof mine) => list.reduce((s, e) => s + e.baseMinor, 0);
      const paid = sum((s) => s === "paid"),
        pend = sum((s) => s === "pending"),
        blk = sum((s) => s === "blocked" || s === "rejected");
      return {
        c,
        paid: native(paid),
        pend: native(pend),
        blk: native(blk),
        paidBase: base(paid),
        pendBase: base(pend),
        fx: seed.fx[c],
      };
    })
    .sort((a, b) => b.paidBase + b.pendBase - (a.paidBase + a.pendBase));

  return (
    <>
      <PageHeader
        eyebrow={`${seed.name} · ${seed.period}`}
        title="Presupuestos"
        subtitle="Lo pagado y lo reservado por aprobaciones salen del mismo presupuesto. Si una factura no cabe, el agente la bloquea."
      />

      <Panel>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow mb-1">Disponible</p>
            <p className="display text-5xl text-primary">
              <span className="money">
                <span className="cur">{p.cur}</span>
                {p.whole}
                <span className="cents">.{p.cents}</span>
              </span>
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              de {formatBase(P)} · usado o reservado {used}%
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-xs text-muted-foreground">Pagos previos</dt>
              <dd className="tabular font-medium">{formatBase(prev)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">
                <Term hint="Autorizado por el agente o aprobado por Finanzas y enviado al sandbox.">
                  Pagado en el lote
                </Term>
              </dt>
              <dd className="tabular font-medium">{formatBase(paidBatch)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">
                <Term hint="Operaciones que esperan una decisión humana; su importe queda apartado.">
                  Reservado
                </Term>
              </dt>
              <dd className="tabular font-medium">{formatBase(ledger.committedMinor)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Bloqueado o rechazado</dt>
              <dd className="tabular font-medium">{formatBase(blocked)}</dd>
            </div>
          </dl>
        </div>
        <div
          className="mt-5 flex h-2.5 gap-[2px] overflow-hidden rounded-full bg-muted"
          role="img"
          aria-label={`${used}% del presupuesto usado o reservado`}
        >
          <span style={{ width: pct(prev), background: STATE_COLOR.prev }} />
          <span style={{ width: pct(paidBatch), background: STATE_COLOR.paid }} />
          <span style={{ width: pct(ledger.committedMinor), background: STATE_COLOR.pending }} />
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
          {[
            ["Pagos previos", STATE_COLOR.prev],
            ["Pagado en el lote", STATE_COLOR.paid],
            ["Reservado", STATE_COLOR.pending],
          ].map(([l, c]) => (
            <span key={l} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: c }} />
              {l}
            </span>
          ))}
        </div>
      </Panel>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Por categoría" description="Pagado y reservado, equivalente en USD">
          <Bars rows={group((e) => e.subject.category)} />
        </Panel>
        <Panel title="Por agente" description="Pagado y reservado, equivalente en USD">
          <Bars rows={group((e) => agentName(e.subject.agentId))} />
        </Panel>
      </div>

      <Panel
        className="mt-4"
        title="Exposición por moneda"
        description="Importes en la moneda original y su equivalente en USD con la tabla de cambio configurada."
        bodyClassName="p-0"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-5 py-3 font-medium">Moneda</th>
                <th className="px-5 py-3 text-right font-medium">Pagado</th>
                <th className="px-5 py-3 text-right font-medium">Reservado</th>
                <th className="px-5 py-3 text-right font-medium">Bloqueado</th>
                <th className="px-5 py-3 text-right font-medium">Equivalente USD</th>
              </tr>
            </thead>
            <tbody>
              {byCurrency.map((r) => (
                <tr key={r.c} className="border-b border-border/70 last:border-0">
                  <td className="px-5 py-3">
                    <span className="font-mono font-medium">{r.c}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {r.fx ? `1 USD = ${r.fx.toLocaleString("en-US")}` : "sin tasa de cambio"}
                    </span>
                  </td>
                  <td className="tabular px-5 py-3 text-right">
                    {formatMoney({ amountMinor: r.paid, currency: r.c })}
                  </td>
                  <td className="tabular px-5 py-3 text-right">
                    {formatMoney({ amountMinor: r.pend, currency: r.c })}
                  </td>
                  <td className="tabular px-5 py-3 text-right text-muted-foreground">
                    {formatMoney({ amountMinor: r.blk, currency: r.c })}
                  </td>
                  <td className="tabular px-5 py-3 text-right font-medium">
                    {formatBase(r.paidBase + r.pendBase)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <NoMoneyNotice className="mt-4" />
    </>
  );
}
