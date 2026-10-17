import { useMemo, useState, type ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Check, FilePlus2, ShieldAlert, Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChannelIcon, Money, NoMoneyNotice, StatusBadge } from "@/components/tg/primitives";
import { DecisionSheet } from "@/components/tg/decision-detail";
import { sevMeta } from "@/components/tg/severity";
import { useTokenGate, type EvaluatedSubject } from "@/lib/tokengate/store";
import { formatBase, formatDateTime } from "@/lib/tokengate/format";
import { needsAttention, statusMeta } from "@/lib/tokengate/status";
import { cn } from "@/lib/utils";
import type { AlertSeverity, DecisionOutcome, RuleId } from "@/lib/tokengate/types";

export const Route = createFileRoute("/app/")({
  head: () => ({
    meta: [
      { title: "Dashboard — blinka" },
      {
        name: "description",
        content: "Seguridad, autonomía y explicabilidad del agente pagador, medidas en vivo.",
      },
      { property: "og:title", content: "Dashboard — blinka" },
      { property: "og:description", content: "Tu agente paga solo lo que debe." },
    ],
  }),
  component: Dashboard,
});

// Colores por trabajo: decisión (estado) y una sola tinta de marca para magnitudes.
const OUT_COLOR: Record<DecisionOutcome, string> = {
  authorized: "var(--color-success)",
  requires_approval: "var(--color-warning)",
  needs_information: "oklch(0.8 0.1 85)",
  blocked: "var(--color-destructive)",
};
const OUT_LABEL: Record<DecisionOutcome, string> = {
  authorized: "Autorizar",
  requires_approval: "Escalar",
  needs_information: "Pedir info",
  blocked: "Bloquear",
};
const OUTS: DecisionOutcome[] = ["authorized", "requires_approval", "needs_information", "blocked"];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

function Card({
  title,
  sub,
  children,
  table,
  className,
}: {
  title: string;
  sub?: string;
  children: ReactNode;
  table?: ReactNode;
  className?: string;
}) {
  const [showTable, setShowTable] = useState(false);
  return (
    <section
      className={cn(
        "flex flex-col rounded-2xl border border-border/70 bg-surface p-5 shadow-soft",
        className,
      )}
    >
      <div className="mb-4 flex items-start gap-3">
        <div className="min-w-0">
          <h2 className="text-[15px] font-medium tracking-tight">{title}</h2>
          {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
        </div>
        {table && (
          <Button
            variant="outline"
            size="sm"
            className="ml-auto h-8 shrink-0"
            onClick={() => setShowTable((v) => !v)}
          >
            {showTable ? "Ver gráfico" : "Ver tabla"}
          </Button>
        )}
      </div>
      {showTable ? table : children}
    </section>
  );
}

function Table({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            {head.map((h, i) => (
              <th key={h} className={cn("px-2 py-2 font-medium", i ? "text-right" : "text-left")}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, j) => (
            <tr key={j} className="border-b border-border/60 last:border-0">
              {r.map((c, i) => (
                <td key={i} className={cn("tabular px-2 py-2", i && "text-right")}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Legend({ items }: { items: [string, string][] }) {
  return (
    <div className="mb-2 flex flex-wrap gap-4 text-xs text-foreground/75">
      {items.map(([c, l]) => (
        <span key={l} className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: c }} />
          {l}
        </span>
      ))}
    </div>
  );
}

function DailyChart({ regs }: { regs: EvaluatedSubject[] }) {
  const days = useMemo(() => {
    const map = new Map<string, Record<DecisionOutcome, number>>();
    for (const r of regs) {
      const d = r.subject.receivedAt.slice(0, 10);
      const v = map.get(d) ?? {
        authorized: 0,
        requires_approval: 0,
        needs_information: 0,
        blocked: 0,
      };
      v[r.result.outcome]++;
      map.set(d, v);
    }
    const keys = [...map.keys()].sort();
    if (!keys.length) return [];
    const out: [string, Record<DecisionOutcome, number>][] = [];
    for (
      let t = Date.parse(keys[0]! + "T00:00:00Z");
      t <= Date.parse(keys[keys.length - 1]! + "T00:00:00Z");
      t += 86_400_000
    ) {
      const k = new Date(t).toISOString().slice(0, 10);
      out.push([
        k,
        map.get(k) ?? { authorized: 0, requires_approval: 0, needs_information: 0, blocked: 0 },
      ]);
    }
    return out;
  }, [regs]);
  if (!days.length)
    return <p className="text-sm text-muted-foreground">Sin datos en este periodo.</p>;
  const W = 680,
    H = 220,
    L = 28,
    R = 6,
    T = 12,
    B = 26,
    iw = W - L - R,
    ih = H - T - B;
  const tot = (v: Record<DecisionOutcome, number>) => OUTS.reduce((s, o) => s + v[o], 0);
  const maxV = Math.max(1, ...days.map(([, v]) => tot(v)));
  const step = Math.max(1, Math.ceil(maxV / 4));
  const top = Math.ceil(maxV / step) * step;
  const y = (v: number) => T + ih - (v / top) * ih;
  const slot = iw / days.length,
    bw = Math.min(24, slot * 0.62);
  const every = Math.ceil(days.length / 9);
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full overflow-visible"
      role="img"
      aria-label="Decisiones por día"
    >
      {Array.from({ length: top / step + 1 }, (_, i) => i * step).map((t) => (
        <g key={t}>
          <line
            x1={L}
            x2={W - R}
            y1={y(t)}
            y2={y(t)}
            stroke="var(--color-border)"
            strokeWidth={1}
            opacity={0.7}
          />
          <text
            x={L - 8}
            y={y(t) + 4}
            textAnchor="end"
            fontSize={11}
            fill="var(--color-muted-foreground)"
          >
            {t}
          </text>
        </g>
      ))}
      {days.map(([k, v], i) => {
        const x = L + i * slot + (slot - bw) / 2;
        const segs = OUTS.filter((o) => v[o] > 0);
        let acc = 0;
        const [, mm, dd] = k.split("-");
        return (
          <g key={k}>
            <title>{`${+dd!} ${MESES[+mm! - 1]}: ${tot(v)} decisiones — ${OUTS.map((o) => `${OUT_LABEL[o]} ${v[o]}`).join(" · ")}`}</title>
            {segs.map((o, j) => {
              const y0 = y(acc + v[o]),
                h = (v[o] / top) * ih,
                gap = j > 0 ? 2 : 0,
                isTop = j === segs.length - 1;
              acc += v[o];
              const hh = Math.max(0, h - gap),
                r = Math.min(4, hh, bw / 2);
              return isTop ? (
                <path
                  key={o}
                  d={`M${x},${y0 + hh}V${y0 + r}Q${x},${y0} ${x + r},${y0}H${x + bw - r}Q${x + bw},${y0} ${x + bw},${y0 + r}V${y0 + hh}Z`}
                  fill={OUT_COLOR[o]}
                />
              ) : (
                <rect key={o} x={x} y={y0} width={bw} height={hh} fill={OUT_COLOR[o]} />
              );
            })}
            {(i % every === 0 || i === days.length - 1) && (
              <text
                x={x + bw / 2}
                y={H - 6}
                textAnchor="middle"
                fontSize={11}
                fill="var(--color-muted-foreground)"
              >
                {+dd!} {MESES[+mm! - 1]}
              </text>
            )}
            <rect x={L + i * slot} y={T} width={slot} height={ih} fill="transparent" />
          </g>
        );
      })}
      <line x1={L} x2={W - R} y1={y(0)} y2={y(0)} stroke="var(--color-input)" />
    </svg>
  );
}

function Dashboard() {
  const { all, alerts, seed, policy, ledger } = useTokenGate();
  const [open, setOpen] = useState<string | null>(null);
  const [range, setRange] = useState<"all" | "7d">("all");
  const [withAttacks, setWithAttacks] = useState(true);
  const hasAttacks = all.some((e) => e.subject.attack);

  let regs = all;
  if (!withAttacks) regs = regs.filter((e) => !e.subject.attack);
  if (range === "7d" && regs.length) {
    const max = Math.max(...regs.map((e) => Date.parse(e.subject.receivedAt)));
    regs = regs.filter((e) => Date.parse(e.subject.receivedAt) >= max - 7 * 86_400_000);
  }
  const n = regs.length;

  // Los tres criterios del reto
  const improper = regs.filter(
    (e) =>
      e.result.outcome === "authorized" &&
      ((e.subject.expected && e.subject.expected !== "authorized") || e.subject.attack),
  ).length;
  const outsideRules = regs.filter(
    (e) =>
      e.result.outcome === "authorized" &&
      e.result.rules.some((r) => r.status === "failed" || r.status === "needs_review"),
  ).length;
  const unsafe = improper + outsideRules;
  const autonomous = regs.filter(
    (e) => e.result.outcome === "authorized" || e.result.outcome === "blocked",
  ).length;
  const withExp = regs.filter((e) => e.subject.expected);
  const hits = withExp.filter((e) => e.subject.expected === e.result.outcome).length;
  const explained = regs.filter(
    (e) =>
      e.result.explanation &&
      e.result.rules.length >= 14 &&
      e.result.rules.every(
        (r) => r.status === "passed" || r.status === "not_applicable" || r.ifChanged,
      ),
  ).length;
  const processed = regs.reduce((s, e) => s + e.baseMinor, 0);
  const atk = regs.filter((e) => e.subject.attack);
  const atkPaid = atk.filter((e) => e.result.outcome === "authorized").length;

  // Resultado final por estado
  const finals = [
    { k: "Pagado", c: "var(--color-success)", list: regs.filter((e) => e.state === "paid") },
    {
      k: "Por decidir",
      c: "var(--color-warning)",
      list: regs.filter((e) => needsAttention(e.status)),
    },
    {
      k: "Bloqueado",
      c: "var(--color-destructive)",
      list: regs.filter((e) => e.state === "blocked"),
    },
    { k: "Rechazado", c: "var(--color-chart-5)", list: regs.filter((e) => e.state === "rejected") },
  ].map((x) => ({ ...x, n: x.list.length, usd: x.list.reduce((s, e) => s + e.baseMinor, 0) }));

  // Motivos
  const reasons = new Map<RuleId, { label: string; n: number; failed: number; review: number }>();
  for (const e of regs)
    for (const r of e.result.rules) {
      if (r.status !== "failed" && r.status !== "needs_review") continue;
      const v = reasons.get(r.ruleId) ?? { label: r.label, n: 0, failed: 0, review: 0 };
      v.n++;
      if (r.status === "failed") v.failed++;
      else v.review++;
      reasons.set(r.ruleId, v);
    }
  const reasonRows = [...reasons.values()].sort((a, b) => b.n - a.n);
  const maxReason = Math.max(1, ...reasonRows.map((r) => r.n));

  // Matriz esperado vs agente
  const mKeys: DecisionOutcome[] = [
    "authorized",
    "requires_approval",
    "needs_information",
    "blocked",
  ];
  const matrix = (e: DecisionOutcome, a: DecisionOutcome) =>
    withExp.filter((x) => x.subject.expected === e && x.result.outcome === a).length;
  const mMax = Math.max(1, ...mKeys.flatMap((e) => mKeys.map((a) => matrix(e, a))));

  // Cola
  const queue = regs
    .filter((e) => needsAttention(e.status))
    .sort((a, b) => a.subject.receivedAt.localeCompare(b.subject.receivedAt));
  const ages = queue
    .map((e) => Math.floor((Date.now() - Date.parse(e.subject.receivedAt)) / 86_400_000))
    .sort((a, b) => a - b);
  const sevCount = (s: AlertSeverity) => alerts.filter((a) => a.severity === s).length;
  const maxSev = Math.max(1, sevCount("critical"), sevCount("high"), sevCount("medium"));

  const P = policy.monthlyBudget,
    prev = seed.baselineUsedMinor;
  const w = (v: number) => `${Math.max(0, (v / P) * 100).toFixed(2)}%`;

  const chip = (on: boolean, label: string, onClick: () => void, disabled = false) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "h-9 rounded-full border px-4 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-45",
        on
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-card text-foreground/80 hover:border-input",
      )}
    >
      {label}
    </button>
  );

  return (
    <>
      <section className="relative mb-5 overflow-hidden rounded-[20px] border border-border bg-gradient-to-br from-card to-background p-7 sm:p-9">
        <Waves />
        <div className="relative max-w-xl">
          <p className="eyebrow mb-3">
            KPIs del agente · {seed.name} · {seed.period}
          </p>
          <h1 className="display text-[40px] sm:text-[44px]">Tu agente paga solo lo que debe.</h1>
          <p className="mt-3 text-[15px] text-muted-foreground">
            Seguridad, autonomía y explicabilidad —los tres criterios del reto— medidos en vivo
            sobre {n} decisiones de facturas y compras.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button asChild>
              <Link to="/app/facturas" search={{ upload: true }}>
                <FilePlus2 className="h-4 w-4" />
                Cargar factura
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/app/aprobaciones">
                Aprobaciones · {queue.length}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {chip(range === "all", "Todo el periodo", () => setRange("all"))}
        {chip(range === "7d", "Últimos 7 días", () => setRange("7d"))}
        <span className="mx-1 h-5 w-px bg-border" />
        {chip(
          withAttacks && hasAttacks,
          hasAttacks
            ? `${withAttacks ? "✓ " : ""}Incluir ataques · ${all.filter((e) => e.subject.attack).length}`
            : "Sin facturas de ataque",
          () => setWithAttacks((v) => !v),
          !hasAttacks,
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <section
          className={cn(
            "relative flex flex-col overflow-hidden rounded-2xl border p-6 shadow-soft",
            unsafe
              ? "border-destructive bg-gradient-to-b from-card to-destructive/10"
              : "border-success/30 bg-gradient-to-b from-card to-success/10",
          )}
        >
          <p className="eyebrow">Seguridad</p>
          <p
            className={cn(
              "display mt-1 text-[96px] leading-none",
              unsafe ? "text-destructive" : "text-success",
            )}
          >
            {unsafe}
          </p>
          <p className="mt-2 flex items-center gap-2 text-base font-medium">
            <span
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded-full text-white",
                unsafe ? "bg-destructive" : "bg-success",
              )}
            >
              {unsafe ? <ShieldAlert className="h-3 w-3" /> : <Check className="h-3 w-3" />}
            </span>
            pagos fuera de las reglas
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            Aprobar un pago indebido descalifica. El agente solo autoriza cuando todas las reglas
            que aplican se cumplen; lo demás lo bloquea o lo escala.
          </p>
          <div className="mt-auto grid grid-cols-2 gap-3 border-t border-border/70 pt-4">
            <div>
              <b className="block text-2xl font-medium tracking-tight">
                {regs.filter((e) => e.result.outcome === "authorized").length}
              </b>
              <span className="text-xs text-muted-foreground">autorizaciones revisadas</span>
            </div>
            <div>
              <b className="block text-2xl font-medium tracking-tight">
                {atk.length ? `${atk.length - atkPaid}/${atk.length}` : "—"}
              </b>
              <span className="text-xs text-muted-foreground">ataques bloqueados o escalados</span>
            </div>
          </div>
        </section>

        <div className="grid gap-4 sm:grid-cols-2">
          <Tile
            label="Autonomía"
            value={`${pct(autonomous, n)}%`}
            meter={pct(autonomous, n)}
            hint={`${autonomous} de ${n} decididas sin intervención humana`}
          />
          <Tile
            label="Precisión"
            value={
              withExp.length ? (
                <>
                  {hits}
                  <span className="text-muted-foreground/50">/{withExp.length}</span>
                </>
              ) : (
                "—"
              )
            }
            meter={pct(hits, withExp.length)}
            hint={
              withExp.length
                ? `${pct(hits, withExp.length)}% coincide con la decisión esperada del set de prueba`
                : "Esta organización no tiene set de prueba con respuesta conocida"
            }
          />
          <Tile
            label="Explicabilidad"
            value={`${pct(explained, n)}%`}
            meter={pct(explained, n)}
            hint="Con motivo en lenguaje claro, 14 reglas evaluadas y “qué habría cambiado”"
          />
          <Tile
            label="Monto procesado"
            value={<Money value={{ amountMinor: processed, currency: "USD" }} />}
            hint={`${n} operaciones · ${new Set(regs.map((e) => e.subject.amount.currency)).size} monedas · ${seed.agents.length} agentes`}
          />
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card
          title="Decisiones por día"
          sub="Según lo que decidió el agente al recibir cada operación"
          table={
            <Table
              head={["Resultado", "Operaciones"]}
              rows={OUTS.map((o) => [
                OUT_LABEL[o],
                regs.filter((e) => e.result.outcome === o).length,
              ])}
            />
          }
        >
          <Legend items={OUTS.map((o) => [OUT_COLOR[o], OUT_LABEL[o]])} />
          <DailyChart regs={regs} />
        </Card>
        <Card
          title="Resultado del lote"
          sub="Estado final, incluidas las decisiones de Finanzas"
          table={
            <Table
              head={["Estado", "Ops.", "%", "USD"]}
              rows={finals.map((f) => [f.k, f.n, `${pct(f.n, n)}%`, formatBase(f.usd)])}
            />
          }
        >
          <div className="mb-4 flex h-3.5 gap-[2px] overflow-hidden rounded-full">
            {finals
              .filter((f) => f.n)
              .map((f) => (
                <span
                  key={f.k}
                  title={`${f.k}: ${f.n} (${pct(f.n, n)}%) · ${formatBase(f.usd)}`}
                  style={{ flex: f.n, background: f.c }}
                />
              ))}
          </div>
          <ul className="divide-y divide-border/60 text-sm">
            {finals.map((f) => (
              <li
                key={f.k}
                className="grid grid-cols-[12px_1fr_auto_auto_auto] items-center gap-3 py-2"
              >
                <span className="h-2 w-2 rounded-full" style={{ background: f.c }} />
                <span>{f.k}</span>
                <span className="tabular font-medium">{f.n}</span>
                <span className="tabular w-10 text-right text-muted-foreground">
                  {pct(f.n, n)}%
                </span>
                <span className="w-20 text-right font-mono text-xs text-foreground/75">
                  {formatBase(f.usd)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card
          title="Por qué bloquea o escala"
          sub="Reglas que no se cumplieron, en número de operaciones"
          table={
            <Table
              head={["Regla", "Total", "Bloquea", "Escala"]}
              rows={reasonRows.map((r) => [r.label, r.n, r.failed, r.review])}
            />
          }
        >
          {reasonRows.length ? (
            <ul className="space-y-1.5">
              {reasonRows.map((r) => (
                <li
                  key={r.label}
                  className="grid grid-cols-[minmax(140px,42%)_1fr_auto] items-center gap-3 py-1"
                  title={`${r.label}: ${r.n} (bloquea ${r.failed} · escala ${r.review})`}
                >
                  <span className="text-[13px] leading-tight text-foreground/80">{r.label}</span>
                  <span className="flex items-center gap-2">
                    <span
                      className="h-3 rounded-r bg-primary"
                      style={{ width: `${(r.n / maxReason) * 100}%`, minWidth: 2 }}
                    />
                    <span className="tabular text-xs font-medium">{r.n}</span>
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-medium",
                      r.failed >= r.review
                        ? "bg-destructive/10 text-destructive"
                        : "bg-warning/15 text-warning-foreground",
                    )}
                  >
                    {r.failed >= r.review ? "Bloquea" : "Escala"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Ninguna regla falló.</p>
          )}
        </Card>

        {withExp.length > 0 ? (
          <Card
            title="Decisión esperada vs. agente"
            sub={`Set de prueba con respuesta conocida (${withExp.length}). “Autorizar” fuera de la diagonal sería un pago indebido.`}
            table={
              <Table
                head={["Esperado \\ Agente", ...mKeys.map((k) => OUT_LABEL[k])]}
                rows={mKeys.map((e) => [OUT_LABEL[e], ...mKeys.map((a) => matrix(e, a))])}
              />
            }
          >
            <div className="grid grid-cols-[76px_repeat(4,minmax(0,1fr))] gap-1">
              <span />
              {mKeys.map((k) => (
                <span
                  key={k}
                  className="py-1 text-center text-[11px] font-medium text-muted-foreground"
                >
                  {OUT_LABEL[k]}
                </span>
              ))}
              {mKeys.map((e) => [
                <span
                  key={e}
                  className="flex items-center justify-end pr-2 text-right text-[11px] font-medium text-muted-foreground"
                >
                  {OUT_LABEL[e]}
                </span>,
                ...mKeys.map((a) => {
                  const v = matrix(e, a);
                  const risk = e !== "authorized" && a === "authorized";
                  const ok = e === a;
                  const alpha = v ? 0.18 + (v / mMax) * 0.82 : 0;
                  return (
                    <div
                      key={e + a}
                      title={`Esperado ${OUT_LABEL[e]} · Agente ${OUT_LABEL[a]}: ${v}`}
                      className={cn(
                        "flex min-h-14 flex-col items-center justify-center rounded-xl",
                        risk && "ring-1 ring-inset ring-destructive/70",
                        !v && "bg-accent",
                      )}
                      style={
                        v
                          ? {
                              background: `color-mix(in oklch, var(--color-primary) ${Math.round(alpha * 100)}%, var(--color-card))`,
                              color: alpha > 0.5 ? "white" : undefined,
                            }
                          : undefined
                      }
                    >
                      <b className="text-xl font-medium tracking-tight">{v}</b>
                      {(risk || (ok && v > 0)) && (
                        <small
                          className={cn(
                            "text-[9.5px] uppercase tracking-[0.08em]",
                            risk ? "font-semibold text-destructive" : "opacity-80",
                          )}
                        >
                          {risk ? "riesgo" : "acierto"}
                        </small>
                      )}
                    </div>
                  );
                }),
              ])}
            </div>
            <div className="mt-2 flex justify-between pl-[80px] text-[11px] text-muted-foreground">
              <span>↓ Esperado</span>
              <span>Agente →</span>
            </div>
          </Card>
        ) : (
          <Card title="Actividad del agente" sub="Últimas decisiones">
            <ActivityList regs={regs.slice(0, 6)} onOpen={setOpen} />
          </Card>
        )}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card
          title="Presupuesto del periodo"
          sub={`Usado o reservado: ${pct(ledger.spentMinor + ledger.committedMinor, P)}%`}
        >
          <p className="display text-3xl">
            <Money value={{ amountMinor: Math.max(0, ledger.availableMinor), currency: "USD" }} />{" "}
            <span className="text-sm font-normal tracking-normal text-muted-foreground">
              disponibles de {formatBase(P)}
            </span>
          </p>
          <div className="mt-4 flex h-2.5 gap-[2px] overflow-hidden rounded-full bg-muted">
            <span
              title={`Pagos previos ${formatBase(prev)}`}
              style={{ width: w(prev), background: "var(--color-chart-5)" }}
            />
            <span
              title={`Pagado en el lote ${formatBase(ledger.spentMinor - prev)}`}
              style={{ width: w(ledger.spentMinor - prev), background: "var(--color-success)" }}
            />
            <span
              title={`Reservado ${formatBase(ledger.committedMinor)}`}
              style={{ width: w(ledger.committedMinor), background: "var(--color-warning)" }}
            />
          </div>
          <ul className="mt-3 divide-y divide-border/60 text-sm">
            {[
              ["Pagos previos", prev, "var(--color-chart-5)"],
              ["Pagado en el lote", ledger.spentMinor - prev, "var(--color-success)"],
              ["Reservado", ledger.committedMinor, "var(--color-warning)"],
            ].map(([l, v, c]) => (
              <li key={l as string} className="flex items-center gap-2 py-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: c as string }} />
                <span className="flex-1">{l}</span>
                <span className="font-mono text-xs">{formatBase(v as number)}</span>
              </li>
            ))}
          </ul>
          <Button variant="outline" size="sm" className="mt-3 w-fit" asChild>
            <Link to="/app/presupuestos">Ver presupuestos</Link>
          </Button>
        </Card>

        <Card title="Cola de aprobación" sub="Lo que espera una decisión humana">
          <p className="display text-3xl">
            {queue.length}{" "}
            <span className="text-sm font-normal tracking-normal text-muted-foreground">
              operaciones · {formatBase(queue.reduce((s, e) => s + e.baseMinor, 0))}
            </span>
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3 border-y border-border/60 py-3">
            <div>
              <b className="block text-xl font-medium">
                {ages.length ? ages[ages.length - 1] : 0} d
              </b>
              <span className="text-xs text-muted-foreground">la más antigua</span>
            </div>
            <div>
              <b className="block text-xl font-medium">
                {ages.length ? ages[Math.floor(ages.length / 2)] : 0} d
              </b>
              <span className="text-xs text-muted-foreground">espera mediana</span>
            </div>
          </div>
          <ActivityList regs={queue.slice(0, 3)} onOpen={setOpen} compact />
          <Button variant="outline" size="sm" className="mt-3 w-fit" asChild>
            <Link to="/app/aprobaciones">Ir a aprobaciones</Link>
          </Button>
        </Card>

        <Card title="Alertas y red team" sub="Señales registradas y ataques del agente atacante">
          <ul className="space-y-2">
            {(["critical", "high", "medium"] as AlertSeverity[]).map((s) => {
              const m = sevMeta[s];
              return (
                <li key={s} className="grid grid-cols-[84px_1fr_auto] items-center gap-3 text-sm">
                  <span className={cn("flex items-center gap-1.5 font-medium", m.text)}>
                    <m.icon className="h-3.5 w-3.5" />
                    {m.label}
                  </span>
                  <span
                    className={cn("h-3 rounded-r", m.bar)}
                    style={{ width: `${(sevCount(s) / maxSev) * 100}%`, minWidth: 2 }}
                  />
                  <span className="tabular text-xs font-medium">{sevCount(s)}</span>
                </li>
              );
            })}
          </ul>
          <div className="mt-4 rounded-xl border border-border bg-background p-3 text-sm">
            {atk.length ? (
              <p>
                <b className="font-medium">{atk.length} ataques:</b>{" "}
                {atk.filter((e) => e.result.outcome === "blocked").length} bloqueados,{" "}
                {atk.length - atkPaid - atk.filter((e) => e.result.outcome === "blocked").length}{" "}
                escalados,{" "}
                <b className={atkPaid ? "text-destructive" : "text-success"}>{atkPaid} pagados</b>.
              </p>
            ) : (
              <p className="text-muted-foreground">Todavía no se ha lanzado un ataque.</p>
            )}
          </div>
          <div className="mt-3 flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/app/alertas">Ver alertas</Link>
            </Button>
            <Button size="sm" asChild>
              <Link to="/app/red-team">
                <Swords className="h-3.5 w-3.5" />
                Red team
              </Link>
            </Button>
          </div>
        </Card>
      </div>

      <NoMoneyNotice className="mt-4" />
      <DecisionSheet subjectId={open} onClose={() => setOpen(null)} />
    </>
  );
}

function Tile({
  label,
  value,
  hint,
  meter,
}: {
  label: string;
  value: ReactNode;
  hint: string;
  meter?: number;
}) {
  return (
    <section className="rounded-2xl border border-border/70 bg-surface p-5 shadow-soft">
      <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
      <p className="display mt-1.5 text-[38px]">{value}</p>
      {meter !== undefined && (
        <div className="my-3 h-1.5 overflow-hidden rounded-full bg-accent">
          <div className="h-full rounded-full bg-primary" style={{ width: `${meter}%` }} />
        </div>
      )}
      <p className={cn("text-xs text-muted-foreground", meter === undefined && "mt-3")}>{hint}</p>
    </section>
  );
}

function ActivityList({
  regs,
  onOpen,
  compact = false,
}: {
  regs: EvaluatedSubject[];
  onOpen: (id: string) => void;
  compact?: boolean;
}) {
  if (!regs.length) return <p className="py-2 text-sm text-muted-foreground">Nada pendiente.</p>;
  return (
    <ul className="divide-y divide-border/60">
      {regs.map((e) => (
        <li key={e.subject.id}>
          <button
            type="button"
            onClick={() => onOpen(e.subject.id)}
            className="flex w-full items-center gap-3 py-2.5 text-left"
          >
            {!compact && <ChannelIcon channel={e.subject.channel} attack={!!e.subject.attack} />}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium hover:text-primary">
                {e.subject.supplier}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {e.result.rules.find((r) => r.status === "failed" || r.status === "needs_review")
                  ?.label ?? statusMeta[e.status].label}{" "}
                · {formatDateTime(e.evaluatedAt)}
              </span>
            </span>
            <span className="flex flex-col items-end gap-1">
              <span className="text-sm">{formatBase(e.baseMinor)}</span>
              {!compact && <StatusBadge status={e.status} />}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function Waves() {
  const paths = Array.from({ length: 90 }, (_, i) => {
    const t = i / 89,
      e = t * t * (3 - 2 * t);
    return `M${(250 + t * 70).toFixed(1)} -20 C ${(420 - e * 210).toFixed(1)} 150, ${(150 + e * 260).toFixed(1)} 210, ${(40 + e * 640).toFixed(1)} ${(460 - e * 120).toFixed(1)}`;
  });
  return (
    <svg
      className="pointer-events-none absolute -right-10 -top-8 hidden h-[calc(100%+64px)] w-[52%] sm:block"
      viewBox="0 0 600 420"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
      aria-hidden
    >
      {paths.map((d, i) => (
        <path key={i} d={d} stroke="#5f6f93" strokeWidth={0.7} strokeOpacity={0.5} />
      ))}
    </svg>
  );
}
