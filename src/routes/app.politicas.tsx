import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, Plus, Save, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { PageHeader, Panel, StatusBadge, Term } from "@/components/tg/primitives";
import { useTokenGate } from "@/lib/tokengate/store";
import { formatMoney, minorToInput, parseToMinor } from "@/lib/tokengate/format";
import { interpretRule, RULE_EXAMPLES, type PolicyChange } from "@/lib/tokengate/nl-rules";
import type { Currency, DisplayStatus, Policy } from "@/lib/tokengate/types";
import { JevPanel } from "@/components/tg/jev-panel";

export const Route = createFileRoute("/app/politicas")({
  head: () => ({
    meta: [
      { title: "Políticas de pago — blinka" },
      {
        name: "description",
        content: "Define límites, presupuesto, proveedores y umbrales de aprobación humana.",
      },
      { property: "og:title", content: "Políticas de pago — blinka" },
      { property: "og:description", content: "Las reglas que tus agentes siempre respetan." },
    ],
  }),
  component: Politicas,
});

const CURRENCIES: Currency[] = ["USD", "COP", "MXN", "BRL", "ARS", "EUR"];
type AmountKey = "transactionLimit" | "approvalThreshold" | "monthlyBudget";
type NumKey =
  | "contractTolerancePct"
  | "duplicateWindowDays"
  | "splitWindowDays"
  | "minConfidence"
  | "budgetAlertPct";

const show = (v: unknown, field: keyof Policy) =>
  Array.isArray(v)
    ? v.join(", ")
    : typeof v === "number" &&
        ["transactionLimit", "approvalThreshold", "monthlyBudget"].includes(field)
      ? formatMoney({ amountMinor: v, currency: "USD" }, { compact: true })
      : v === "block"
        ? "bloquear"
        : v === "review"
          ? "escalar"
          : String(v);

function Politicas() {
  const { policy, savePolicy, simulate, seed } = useTokenGate();
  const toForm = (p: Policy) => ({
    transactionLimit: minorToInput(p.transactionLimit),
    approvalThreshold: minorToInput(p.approvalThreshold),
    monthlyBudget: minorToInput(p.monthlyBudget),
    contractTolerancePct: String(p.contractTolerancePct),
    duplicateWindowDays: String(p.duplicateWindowDays),
    splitWindowDays: String(p.splitWindowDays),
    minConfidence: String(p.minConfidence),
    budgetAlertPct: String(p.budgetAlertPct),
    suppliers: p.approvedSuppliers,
    currencies: p.allowedCurrencies,
    duplicateAction: p.duplicateAction,
    missingInfoAction: p.missingInfoAction,
    newSupplierAction: p.newSupplierAction,
  });
  const [f, setF] = useState(() => toForm(policy));
  const [formVersion, setFormVersion] = useState(policy.version);
  if (formVersion !== policy.version) {
    setF(toForm(policy));
    setFormVersion(policy.version);
  }
  const [newSupplier, setNewSupplier] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Natural-language rule
  const [nl, setNl] = useState("");
  const [proposal, setProposal] = useState<{
    text: string;
    changes: PolicyChange[];
    next: Policy;
    diffs: { ref: string; supplier: string; before: DisplayStatus; after: DisplayStatus }[];
  } | null>(null);

  const interpret = (text: string) => {
    const changes = interpretRule(text, policy);
    const next = { ...policy } as Policy;
    changes.forEach((c) => ((next as Record<string, unknown>)[c.field] = c.after));
    const diffs = changes.length
      ? simulate(next).map((d) => ({
          ref: d.subject.reference,
          supplier: d.subject.supplier,
          before: d.before,
          after: d.after,
        }))
      : [];
    setProposal({ text, changes, next, diffs });
  };

  const save = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const e: Record<string, string> = {};
    const amt = {} as Record<AmountKey, number>;
    (["transactionLimit", "approvalThreshold", "monthlyBudget"] as AmountKey[]).forEach((k) => {
      const m = parseToMinor(f[k]);
      if (m === null || m <= 0) e[k] = "Importe no válido.";
      else amt[k] = m;
    });
    if (
      !e["approvalThreshold"] &&
      !e["transactionLimit"] &&
      amt.approvalThreshold > amt.transactionLimit
    )
      e["approvalThreshold"] = "El umbral no puede superar el límite por transacción.";
    if (!e["monthlyBudget"] && !e["transactionLimit"] && amt.transactionLimit > amt.monthlyBudget)
      e["transactionLimit"] = "El límite no puede superar el presupuesto.";
    const nums = {} as Record<NumKey, number>;
    (
      [
        "contractTolerancePct",
        "duplicateWindowDays",
        "splitWindowDays",
        "minConfidence",
        "budgetAlertPct",
      ] as NumKey[]
    ).forEach((k) => {
      const v = Number(f[k]);
      if (!Number.isFinite(v) || v < 0 || ((k.endsWith("Pct") || k === "minConfidence") && v > 100))
        e[k] = "Valor no válido.";
      else nums[k] = v;
    });
    if (f.currencies.length === 0) e["currencies"] = "Selecciona al menos una moneda.";
    if (f.suppliers.length === 0) e["suppliers"] = "Añade al menos un proveedor aprobado.";
    setErrors(e);
    if (Object.keys(e).length) {
      toast.error("Revisa los campos marcados antes de guardar.");
      return;
    }
    const saved = await savePolicy(
      {
        ...policy,
        ...amt,
        ...nums,
        approvedSuppliers: f.suppliers,
        allowedCurrencies: f.currencies,
        duplicateAction: f.duplicateAction,
        missingInfoAction: f.missingInfoAction,
        newSupplierAction: f.newSupplierAction,
      },
      "Política editada desde Políticas de pago.",
    );
    if (saved)
      toast.success(
        "Política guardada. Todas las decisiones se recalcularon con la nueva versión.",
      );
  };

  const field = (k: AmountKey | NumKey, label: React.ReactNode, prefix?: string, hint?: string) => (
    <div className="grid gap-1.5">
      <label className="text-xs font-medium text-muted-foreground" htmlFor={k}>
        {label}
      </label>
      <div className="relative">
        {prefix && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">
            {prefix}
          </span>
        )}
        <Input
          id={k}
          inputMode="decimal"
          value={f[k]}
          onChange={(e) => setF({ ...f, [k]: e.target.value })}
          aria-invalid={!!errors[k]}
          className={`tabular h-10 rounded-xl bg-background font-mono text-sm ${prefix ? "pl-12" : ""}`}
        />
      </div>
      {errors[k] ? (
        <p className="text-xs text-destructive">{errors[k]}</p>
      ) : (
        hint && <p className="text-[11px] text-muted-foreground">{hint}</p>
      )}
    </div>
  );

  const choice = <K extends "duplicateAction" | "missingInfoAction" | "newSupplierAction">(
    k: K,
    title: string,
    opts: [Policy[K], string][],
  ) => (
    <div>
      <p className="mb-2 text-sm font-medium">{title}</p>
      <RadioGroup
        value={f[k]}
        onValueChange={(v) => setF({ ...f, [k]: v as Policy[K] })}
        className="grid gap-2"
      >
        {opts.map(([v, l]) => (
          <label
            key={v}
            className="flex min-h-10 items-center gap-3 rounded-xl border border-border bg-background px-3 py-2 text-sm has-[[data-state=checked]]:border-primary"
          >
            <RadioGroupItem value={v} /> {l}
          </label>
        ))}
      </RadioGroup>
    </div>
  );

  return (
    <form onSubmit={save} noValidate>
      <PageHeader
        eyebrow={`Política de ${seed.name}`}
        title="Políticas de pago"
        subtitle={`Versión activa ${policy.version}. El agente nunca paga fuera de estas reglas; cada cambio crea una versión nueva y vuelve a evaluar todo el periodo.`}
        actions={
          <Button type="submit" className="h-10">
            <Save className="h-4 w-4" />
            Guardar cambios
          </Button>
        }
      />

      <div className="mb-6">
        <JevPanel />
      </div>

      <Panel
        className="mb-4"
        title={
          <span className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Escribe una regla en español
          </span>
        }
        description="El agente la traduce a la política y te muestra qué decisiones cambiarían antes de aplicarla. (Intérprete simulado; en producción lo hace Claude.)"
      >
        <Textarea
          value={nl}
          onChange={(e) => setNl(e.target.value)}
          placeholder={RULE_EXAMPLES[0]}
          className="min-h-20 rounded-xl bg-background text-[15px]"
        />
        <div className="my-3 flex flex-wrap gap-1.5">
          {RULE_EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setNl(ex)}
              className="rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground hover:border-primary/40 hover:text-primary"
            >
              {ex}
            </button>
          ))}
        </div>
        <Button type="button" onClick={() => nl.trim() && interpret(nl.trim())}>
          Interpretar y simular
          <ArrowRight className="h-4 w-4" />
        </Button>
        {proposal && (
          <div className="mt-4 rounded-2xl border border-primary/30 bg-accent p-4">
            {proposal.changes.length === 0 ? (
              <p className="text-sm">
                No entendí la regla. Prueba con importes, presupuesto, proveedores nuevos,
                duplicados, tolerancia, confianza o monedas.
              </p>
            ) : (
              <>
                <p className="eyebrow mb-1">Entendí</p>
                {proposal.changes.map((c) => (
                  <p key={c.field} className="text-[15px] font-medium">
                    {c.label}:{" "}
                    <s className="font-normal text-muted-foreground">{show(c.before, c.field)}</s> →{" "}
                    {show(c.after, c.field)}
                  </p>
                ))}
                <p className="mt-3 text-sm text-muted-foreground">
                  Simulación sobre todo el periodo:{" "}
                  <b className="text-foreground">{proposal.diffs.length}</b>{" "}
                  {proposal.diffs.length === 1 ? "decisión cambiaría" : "decisiones cambiarían"}.
                </p>
                {proposal.diffs.length > 0 && (
                  <ul className="mt-2 divide-y divide-border/70 rounded-xl border border-border bg-card">
                    {proposal.diffs.slice(0, 8).map((d) => (
                      <li
                        key={d.ref}
                        className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
                      >
                        <span className="min-w-0">
                          <span className="font-medium">{d.supplier}</span>{" "}
                          <span className="font-mono text-xs text-muted-foreground">{d.ref}</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <StatusBadge status={d.before} />→<StatusBadge status={d.after} />
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-3 flex gap-2">
                  <Button
                    type="button"
                    onClick={async () => {
                      const saved = await savePolicy(
                        proposal.next,
                        `Regla en lenguaje natural: “${proposal.text}”`,
                      );
                      if (!saved) return;
                      toast.success("Regla aplicada. Nueva versión de la política.");
                      setProposal(null);
                      setNl("");
                    }}
                  >
                    Aplicar regla
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setProposal(null)}>
                    Descartar
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="Límites"
          description={`En ${policy.baseCurrency}. Las facturas en otras monedas se convierten con la tabla de cambio.`}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {field(
              "approvalThreshold",
              <Term hint="Por encima de este importe, una persona de Finanzas debe aprobar.">
                Aprobación humana por encima de
              </Term>,
              "USD",
            )}
            {field("transactionLimit", "Límite por transacción", "USD", "Por encima, se bloquea.")}
            {field(
              "monthlyBudget",
              "Presupuesto del periodo",
              "USD",
              "Incluye lo pagado y lo reservado por aprobaciones.",
            )}
            {field("budgetAlertPct", "Alerta si queda menos de (%)")}
          </div>
        </Panel>

        <Panel
          title="Revisiones automáticas"
          description="Duplicados, pagos partidos, contrato y calidad de lectura."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {field("contractTolerancePct", "Tolerancia frente al contrato (%)")}
            {field("minConfidence", "Confianza mínima de lectura (%)")}
            {field("duplicateWindowDays", "Ventana de duplicados (días)")}
            {field("splitWindowDays", "Ventana de pagos partidos (días)")}
          </div>
        </Panel>

        <Panel
          title="Monedas permitidas"
          description="Unidades por 1 USD. Sin tasa, una moneda no se puede convertir: conéctala antes de permitirla."
        >
          <div className="flex flex-wrap gap-2">
            {CURRENCIES.map((c) => {
              const on = f.currencies.includes(c);
              return (
                <button
                  key={c}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    setF({
                      ...f,
                      currencies: on ? f.currencies.filter((x) => x !== c) : [...f.currencies, c],
                    })
                  }
                  className={`flex h-10 items-center gap-2 rounded-full border px-4 font-mono text-sm ${on ? "border-foreground bg-foreground text-background" : "border-border bg-card text-muted-foreground"}`}
                >
                  {c}
                  <span className="text-[11px] opacity-70">
                    {seed.fx[c]?.toLocaleString("en-US") ?? "sin tasa"}
                  </span>
                </button>
              );
            })}
          </div>
          {errors["currencies"] && (
            <p className="mt-2 text-xs text-destructive">{errors["currencies"]}</p>
          )}
        </Panel>

        <Panel title="Comportamiento ante dudas">
          <div className="grid gap-4">
            {choice("newSupplierAction", "Proveedor nuevo (no está en la lista)", [
              ["review", "Escalar a Finanzas"],
              ["block", "Bloquear"],
            ])}
            {choice("duplicateAction", "Posible duplicado (mismo importe en la ventana)", [
              ["review", "Escalar a Finanzas"],
              ["block", "Bloquear"],
            ])}
            {choice("missingInfoAction", "Falta información obligatoria", [
              ["request_information", "Pedir la información"],
              ["block", "Bloquear"],
            ])}
          </div>
        </Panel>

        <Panel
          className="lg:col-span-2"
          title="Proveedores aprobados"
          description={
            seed.suppliers.length
              ? "Los proveedores con contrato registrado también se validan contra su importe, moneda y cuenta bancaria."
              : "Lista de proveedores con los que los agentes pueden operar."
          }
        >
          <div className="flex flex-wrap gap-2">
            {f.suppliers.map((s) => (
              <span
                key={s}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-card py-1 pl-3 pr-1 text-sm"
              >
                {s}
                <button
                  type="button"
                  aria-label={`Quitar ${s}`}
                  onClick={() => setF({ ...f, suppliers: f.suppliers.filter((x) => x !== s) })}
                  className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
          </div>
          <div className="mt-3 flex max-w-md gap-2">
            <Input
              value={newSupplier}
              onChange={(e) => setNewSupplier(e.target.value)}
              placeholder="Nombre del proveedor"
              className="h-10 rounded-xl bg-background"
            />
            <Button
              type="button"
              variant="outline"
              className="h-10"
              onClick={() => {
                const v = newSupplier.trim();
                if (v && !f.suppliers.includes(v)) setF({ ...f, suppliers: [...f.suppliers, v] });
                setNewSupplier("");
              }}
            >
              <Plus className="h-4 w-4" />
              Añadir
            </Button>
          </div>
          {errors["suppliers"] && (
            <p className="mt-2 text-xs text-destructive">{errors["suppliers"]}</p>
          )}
          {seed.suppliers.length > 0 && (
            <div className="mt-5 overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[680px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2.5 font-medium">Proveedor</th>
                    <th className="px-4 py-2.5 font-medium">ID fiscal</th>
                    <th className="px-4 py-2.5 font-medium">Contrato</th>
                    <th className="px-4 py-2.5 font-medium">Cuenta registrada</th>
                  </tr>
                </thead>
                <tbody>
                  {seed.suppliers.map((s) => (
                    <tr key={s.name} className="border-b border-border/70 last:border-0">
                      <td className="px-4 py-2.5">
                        <span className="font-medium">{s.name}</span>
                        <span className="block text-xs text-muted-foreground">
                          {s.concept} · {s.country}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs">{s.taxId}</td>
                      <td className="px-4 py-2.5 tabular">
                        {s.contract.type === "fixed" ? "Fijo" : "Tope"}{" "}
                        {formatMoney({ amountMinor: s.contract.amountMinor, currency: s.currency })}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs">{s.bankAccount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </form>
  );
}
