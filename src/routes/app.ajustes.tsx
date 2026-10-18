import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Building2,
  ChevronDown,
  Coins,
  Cpu,
  FileSignature,
  Plus,
  ShieldCheck,
  Trash2,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader, Panel, StatusBadge } from "@/components/tg/primitives";
import { JevPanel } from "@/components/tg/jev-panel";
import { SayItBox } from "@/components/tg/voice";
import { useThemeState } from "@/components/tg/theme-toggle";
import { useTokenGate } from "@/lib/tokengate/store";
import { useServerFn } from "@tanstack/react-start";
import { readText } from "@/lib/tokengate/ai-read.functions";
import { readTextLocally } from "@/lib/tokengate/text-parse";
import { formatMoney, minorToInput, parseToMinor } from "@/lib/tokengate/format";
import { interpretRules, type PolicyChange } from "@/lib/tokengate/nl-rules";
import { cn } from "@/lib/utils";
import type { Currency, DisplayStatus, OrgConfig, Policy, Supplier } from "@/lib/tokengate/types";

export const Route = createFileRoute("/app/ajustes")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Reglas y Ajustes — blinka" },
      {
        name: "description",
        content:
          "Define las reglas de pago, límites, proveedores autorizados, contratos y tasas de cambio de tu empresa.",
      },
      { property: "og:title", content: "Reglas y Ajustes — blinka" },
      {
        property: "og:description",
        content: "Configura las reglas que el agente pagador siempre respeta.",
      },
    ],
  }),
  component: ReglasYAjustes,
});

const CURRENCIES: Currency[] = ["USD", "COP", "EUR", "MXN", "BRL", "ARS"];
type TabId = "reglas" | "proveedores" | "empresa";

const SAY_EXAMPLES = [
  "Pide permiso por encima de 2.000 dólares",
  "Nunca pagues más de 10.000 dólares en una factura",
  "El presupuesto del mes es de 80 mil dólares",
  "Frena a los proveedores nuevos",
];

const showChangeValue = (v: unknown, field: keyof Policy) =>
  Array.isArray(v)
    ? v.join(", ")
    : typeof v === "number" &&
        ["transactionLimit", "approvalThreshold", "monthlyBudget"].includes(field)
      ? formatMoney({ amountMinor: v, currency: "USD" }, { compact: true })
      : v === "block"
        ? "frenar"
        : v === "review"
          ? "pedirte permiso"
          : v === "request_information"
            ? "pedir los datos"
            : String(v);

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "FI";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

/** Two-option switch that reads as a sentence ending. */
function Choice<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: [T, string][];
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-xl bg-muted p-1">
      {options.map(([v, l]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={cn(
            "whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
            value === v
              ? "bg-card text-foreground shadow-soft"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

/** A USD amount typed inside a sentence, with its equivalents underneath. */
function AmountInline({
  value,
  onChange,
  label,
  equiv,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  equiv: string | null;
}) {
  return (
    <span className="inline-flex flex-col leading-normal">
      <span className="relative inline-flex">
        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 font-mono text-[11px] text-muted-foreground">
          USD
        </span>
        <Input
          aria-label={label}
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="tabular h-10 w-36 rounded-xl bg-background pl-11 font-mono text-base font-semibold"
        />
      </span>
      {equiv && <span className="mt-0.5 font-mono text-[11px] text-primary">{equiv}</span>}
    </span>
  );
}

function Sentence({ n, children, hint }: { n: number; children: ReactNode; hint?: string }) {
  return (
    <li className="flex gap-3 border-b border-border/70 py-4 last:border-0">
      <span className="mt-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-primary">
        {n}
      </span>
      <div className="min-w-0">
        <p className="flex flex-wrap items-start gap-x-2 gap-y-2 text-[15px] leading-10">
          {children}
        </p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </div>
    </li>
  );
}

const emptySupplier = {
  name: "",
  taxId: "",
  country: "CO",
  currency: "USD" as Currency,
  contractType: "fixed" as "fixed" | "cap",
  contractAmount: "",
  bankAccount: "",
  concept: "",
};

// Editable drafts of the rules (policy) and the company settings (config), as form strings.
const fromPolicy = (p: Policy) => ({
  approvalThreshold: minorToInput(p.approvalThreshold),
  transactionLimit: minorToInput(p.transactionLimit),
  monthlyBudget: minorToInput(p.monthlyBudget),
  currencies: p.allowedCurrencies,
  newSupplierAction: p.newSupplierAction,
  duplicateAction: p.duplicateAction,
  missingInfoAction: p.missingInfoAction,
});
const fromConfig = (c: OrgConfig) => ({
  orgName: c.name,
  jurisdiction: c.jurisdiction,
  userName: c.user.name,
  userRole: c.user.role,
  fx: Object.fromEntries(
    CURRENCIES.map((cur) => [cur, String(cur === "USD" ? 1 : (c.fx[cur] ?? ""))]),
  ) as Record<Currency, string>,
});

function ReglasYAjustes() {
  const { config, saveConfig, policy, savePolicy, simulate } = useTokenGate();
  const [theme, setTheme] = useThemeState();
  const [activeTab, setActiveTab] = useState<TabId>("reglas");

  const [rules, setRules] = useState(() => fromPolicy(policy));
  const [org, setOrg] = useState(() => fromConfig(config));
  useEffect(() => setRules(fromPolicy(policy)), [policy]);
  useEffect(() => setOrg(fromConfig(config)), [config]);

  const [saving, setSaving] = useState(false);

  const parsedFx = (): Partial<Record<Currency, number>> | null => {
    const out: Partial<Record<Currency, number>> = { USD: 1 };
    for (const c of CURRENCIES) {
      if (c === "USD") continue;
      const val = Number(org.fx[c].replace(",", "."));
      if (!Number.isFinite(val) || val <= 0) return null;
      out[c] = val;
    }
    return out;
  };

  const draftPolicy = useMemo((): Policy | null => {
    const a = parseToMinor(rules.approvalThreshold);
    const t = parseToMinor(rules.transactionLimit);
    const b = parseToMinor(rules.monthlyBudget);
    if (!a || !t || !b) return null;
    return {
      ...policy,
      approvalThreshold: a,
      transactionLimit: t,
      monthlyBudget: b,
      allowedCurrencies: rules.currencies,
      newSupplierAction: rules.newSupplierAction,
      duplicateAction: rules.duplicateAction,
      missingInfoAction: rules.missingInfoAction,
    };
  }, [rules, policy]);

  const policyDirty =
    !draftPolicy ||
    (
      [
        "approvalThreshold",
        "transactionLimit",
        "monthlyBudget",
        "newSupplierAction",
        "duplicateAction",
        "missingInfoAction",
      ] as const
    ).some((k) => draftPolicy[k] !== policy[k]) ||
    [...rules.currencies].sort().join() !== [...policy.allowedCurrencies].sort().join();
  const orgBaseline = fromConfig(config);
  const configDirty = JSON.stringify(org) !== JSON.stringify(orgBaseline);
  const dirty = policyDirty || configDirty;
  const impact = useMemo(
    () => (draftPolicy && policyDirty ? simulate(draftPolicy) : []),
    [draftPolicy, policyDirty, simulate],
  );

  const validate = (): string | null => {
    const a = parseToMinor(rules.approvalThreshold);
    const t = parseToMinor(rules.transactionLimit);
    const b = parseToMinor(rules.monthlyBudget);
    if (!a || a <= 0) return "El monto que el agente paga solo debe ser mayor a 0.";
    if (!t || t <= 0) return "El tope por factura debe ser mayor a 0.";
    if (!b || b <= 0) return "El presupuesto del mes debe ser mayor a 0.";
    if (a > t) return "Lo que el agente paga solo no puede ser mayor que el tope por factura.";
    if (t > b) return "El tope por factura no puede superar el presupuesto del mes.";
    if (rules.currencies.length === 0) return "Deja al menos una moneda activa.";
    if (org.orgName.trim().length < 2) return "El nombre de la empresa es muy corto.";
    if (!parsedFx()) return "Todas las tasas de cambio deben ser números mayores a 0.";
    return null;
  };

  const saveAll = async () => {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    setSaving(true);
    const jobs: Promise<boolean>[] = [];
    if (policyDirty && draftPolicy)
      jobs.push(savePolicy(draftPolicy, "Reglas de pago actualizadas desde Reglas y Ajustes."));
    if (configDirty) {
      const userName = org.userName.trim() || "Finanzas";
      jobs.push(
        saveConfig(
          {
            ...config,
            name: org.orgName.trim(),
            jurisdiction: org.jurisdiction.trim() || "Delaware, EE. UU.",
            user: {
              name: userName,
              role: org.userRole.trim() || "Finanzas",
              initials: initialsOf(userName),
            },
            fx: parsedFx()!,
          },
          `Ajustes de empresa actualizados (${org.orgName.trim()})`,
        ),
      );
    }
    const ok = (await Promise.all(jobs)).every(Boolean);
    setSaving(false);
    if (ok) toast.success("Guardado. El agente ya revisó de nuevo todas las facturas.");
  };

  const discard = () => {
    setRules(fromPolicy(policy));
    setOrg(fromConfig(config));
  };

  const fxEquiv = (v: string): string | null => {
    const usdMinor = parseToMinor(v);
    if (!usdMinor || usdMinor <= 0) return null;
    const eur = Number(org.fx.EUR.replace(",", ".")) || 0.92;
    const cop = Number(org.fx.COP.replace(",", ".")) || 4150;
    return `≈ ${formatMoney({ amountMinor: Math.round(usdMinor * cop), currency: "COP" }, { compact: true })} · ${formatMoney({ amountMinor: Math.round(usdMinor * eur), currency: "EUR" }, { compact: true })}`;
  };

  // ---- Rules said in words ----
  const [said, setSaid] = useState("");
  const [proposal, setProposal] = useState<{
    text: string;
    changes: PolicyChange[];
    next: Policy;
    unread: string[];
    diffs: { ref: string; supplier: string; before: DisplayStatus; after: DisplayStatus }[];
  } | null>(null);
  const interpret = () => {
    const text = said.trim();
    if (!text) return;
    const { changes, next, unread } = interpretRules(text, policy, parsedFx() ?? config.fx);
    const diffs = changes.length
      ? simulate(next).map((d) => ({
          ref: d.subject.reference,
          supplier: d.subject.supplier,
          before: d.before,
          after: d.after,
        }))
      : [];
    setProposal({ text, changes, next, unread, diffs });
  };

  // ---- Suppliers ----
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [sup, setSup] = useState(emptySupplier);
  const [supSaid, setSupSaid] = useState("");
  const [supReading, setSupReading] = useState(false);
  const runRead = useServerFn(readText);
  const approved = policy.approvedSuppliers;
  const nameOnly = approved.filter(
    (n) => !config.suppliers.some((s) => s.name.toLowerCase() === n.toLowerCase()),
  );

  const readSupplier = async () => {
    const text = supSaid.trim();
    if (!text) return;
    setSupReading(true);
    let o = readTextLocally(text);
    let by: "claude" | "local" = "local";
    try {
      const res = await runRead({ data: { kind: "supplier", text } });
      o = res.fields;
      by = res.by;
    } catch {
      // keep the local reading
    }
    setSup((p) => ({
      ...p,
      name: o.supplier ?? p.name,
      taxId: o.supplierTaxId ?? p.taxId,
      country: o.country ?? p.country,
      currency: o.currency ?? p.currency,
      contractType: o.contractType ?? p.contractType,
      contractAmount: o.amount ?? p.contractAmount,
      bankAccount: o.bankAccount ?? p.bankAccount,
      concept: o.description ?? p.concept,
    }));
    setSupReading(false);
    toast.success(
      by === "claude"
        ? "Claude llenó los datos del proveedor. Revísalos y guarda."
        : "Llené lo que pude. Revisa y completa lo que falte.",
    );
  };

  const removeSupplier = async (name: string) => {
    const nextApproved = approved.filter((s) => s !== name);
    const nextContracts = config.suppliers.filter((s) => s.name !== name);
    const [a, b] = await Promise.all([
      savePolicy({ ...policy, approvedSuppliers: nextApproved }, `Proveedor retirado: ${name}`),
      nextContracts.length !== config.suppliers.length
        ? saveConfig({ ...config, suppliers: nextContracts }, `Contrato eliminado: ${name}`)
        : Promise.resolve(true),
    ]);
    if (a && b) toast.success(`${name} ya no está autorizado.`);
  };

  const saveSupplier = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const name = sup.name.trim();
    if (!name) {
      toast.error("Escribe el nombre del proveedor.");
      return;
    }
    const minor = sup.contractAmount.trim() ? parseToMinor(sup.contractAmount) : null;
    const withContract = minor !== null && minor > 0;
    if (sup.contractAmount.trim() && !withContract) {
      toast.error("El monto acordado no es válido.");
      return;
    }
    if (withContract && (!sup.taxId.trim() || !sup.bankAccount.trim())) {
      toast.error("Para registrar el contrato, completa el ID fiscal y la cuenta bancaria.");
      return;
    }
    const nextApproved = approved.some((s) => s.toLowerCase() === name.toLowerCase())
      ? approved
      : [...approved, name];
    const jobs: Promise<boolean>[] = [
      savePolicy({ ...policy, approvedSuppliers: nextApproved }, `Proveedor autorizado: ${name}`),
    ];
    if (withContract) {
      const s: Supplier = {
        name,
        taxId: sup.taxId.trim(),
        country: sup.country.trim().toUpperCase() || "CO",
        currency: sup.currency,
        contract: { type: sup.contractType, amountMinor: minor },
        bankAccount: sup.bankAccount.trim(),
        concept: sup.concept.trim() || "Servicios profesionales",
      };
      jobs.push(
        saveConfig(
          {
            ...config,
            suppliers: [
              ...config.suppliers.filter((x) => x.name.toLowerCase() !== name.toLowerCase()),
              s,
            ],
          },
          `Contrato registrado para ${name} (${formatMoney({ amountMinor: minor, currency: s.currency })})`,
        ),
      );
    }
    if (!(await Promise.all(jobs)).every(Boolean)) return;
    toast.success(
      withContract ? `${name} y su contrato quedaron guardados.` : `${name} quedó autorizado.`,
    );
    setSupplierOpen(false);
    setSup(emptySupplier);
    setSupSaid("");
  };

  const tabs = [
    { id: "reglas", label: "Reglas de pago", icon: ShieldCheck },
    { id: "proveedores", label: `Proveedores (${approved.length})`, icon: FileSignature },
    { id: "empresa", label: "Empresa", icon: Building2 },
  ] as const;

  return (
    <>
      <PageHeader
        eyebrow={`${config.name} · Política ${policy.version}`}
        title="Reglas y Ajustes"
        subtitle="Lo que el agente puede pagar solo, cuándo te pide permiso y a quién puede pagarle."
      />

      <div role="tablist" className="mb-6 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={activeTab === t.id}
            onClick={() => setActiveTab(t.id)}
            className={cn(
              "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors",
              activeTab === t.id
                ? "bg-foreground text-background"
                : "border border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "reglas" && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
          <div className="space-y-4">
            <Panel
              title="Tus reglas, en palabras"
              description="Cambia los montos directamente en la frase."
            >
              <ol>
                <Sentence
                  n={1}
                  hint="Si la factura cumple todas tus reglas. Por encima de este monto, te pide permiso."
                >
                  Paga sola las facturas de hasta
                  <AmountInline
                    label="Monto que el agente paga solo"
                    value={rules.approvalThreshold}
                    onChange={(v) => setRules({ ...rules, approvalThreshold: v })}
                    equiv={fxEquiv(rules.approvalThreshold)}
                  />
                </Sentence>
                <Sentence
                  n={2}
                  hint="Si una factura supera este monto, la frena aunque tú quieras aprobarla."
                >
                  Nunca paga una factura de más de
                  <AmountInline
                    label="Tope por factura"
                    value={rules.transactionLimit}
                    onChange={(v) => setRules({ ...rules, transactionLimit: v })}
                    equiv={fxEquiv(rules.transactionLimit)}
                  />
                </Sentence>
                <Sentence
                  n={3}
                  hint="Cuenta lo ya pagado y lo que espera tu permiso. Si no alcanza, frena el pago."
                >
                  En el mes puede gastar hasta
                  <AmountInline
                    label="Presupuesto del mes"
                    value={rules.monthlyBudget}
                    onChange={(v) => setRules({ ...rules, monthlyBudget: v })}
                    equiv={fxEquiv(rules.monthlyBudget)}
                  />
                  en total
                </Sentence>
                <Sentence n={4} hint="Si llega una factura en otra moneda, la frena.">
                  Acepta facturas en
                  {CURRENCIES.map((c) => {
                    const on = rules.currencies.includes(c);
                    return (
                      <button
                        key={c}
                        type="button"
                        aria-pressed={on}
                        onClick={() =>
                          setRules({
                            ...rules,
                            currencies: on
                              ? rules.currencies.filter((x) => x !== c)
                              : [...rules.currencies, c],
                          })
                        }
                        className={cn(
                          "rounded-full border px-3 py-1 font-mono text-xs font-semibold transition-colors",
                          on
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-card text-muted-foreground line-through",
                        )}
                      >
                        {c}
                      </button>
                    );
                  })}
                </Sentence>
              </ol>
            </Panel>

            <Panel
              title="Cuando algo se ve raro"
              description="¿El agente te pregunta o lo frena de una vez?"
            >
              <ul className="grid gap-3">
                {(
                  [
                    ["newSupplierAction", "Llega un proveedor que no está en tu lista"],
                    ["duplicateAction", "Parece un cobro repetido (mismo proveedor e importe)"],
                    ["missingInfoAction", "A la factura le faltan datos (ID fiscal, cuenta…)"],
                  ] as const
                ).map(([k, label]) => (
                  <li
                    key={k}
                    className="flex flex-col gap-2 rounded-xl border border-border/70 bg-background px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span className="text-sm">{label}</span>
                    {k === "missingInfoAction" ? (
                      <Choice
                        label={label}
                        value={rules.missingInfoAction}
                        onChange={(v) => setRules({ ...rules, missingInfoAction: v })}
                        options={[
                          ["request_information", "Pedir los datos"],
                          ["block", "Frenar"],
                        ]}
                      />
                    ) : (
                      <Choice
                        label={label}
                        value={rules[k]}
                        onChange={(v) => setRules({ ...rules, [k]: v })}
                        options={[
                          ["review", "Pedirme permiso"],
                          ["block", "Frenar"],
                        ]}
                      />
                    )}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-muted-foreground">
                Siempre se frenan, sin importar esto: cobros con el mismo número de factura, nombres
                que imitan a un proveedor y documentos que intentan darle órdenes al agente.
              </p>
            </Panel>
          </div>

          <div className="space-y-4">
            <Panel
              title="Dile al agente qué cambiar"
              description="Escribe o dicta con tus palabras. Antes de aplicar, ves qué facturas cambiarían."
            >
              <SayItBox
                value={said}
                onChange={setSaid}
                onSubmit={interpret}
                submitLabel="Ver qué cambiaría"
                placeholder="Ej. “Pide permiso por encima de 2.000 dólares y frena a los proveedores nuevos”"
                examples={SAY_EXAMPLES}
              />
              {proposal && (
                <div className="mt-4 rounded-2xl border border-primary/30 bg-accent p-4">
                  {proposal.changes.length === 0 ? (
                    <p className="text-sm">
                      No entendí un cambio concreto. Prueba con una de las frases de ejemplo.
                    </p>
                  ) : (
                    <>
                      <p className="eyebrow mb-1">Entendí esto</p>
                      <ul className="grid gap-1">
                        {proposal.changes.map((c) => (
                          <li key={c.field} className="text-[15px] font-medium">
                            {c.label}:{" "}
                            <s className="font-normal text-muted-foreground">
                              {showChangeValue(c.before, c.field)}
                            </s>{" "}
                            → {showChangeValue(c.after, c.field)}
                          </li>
                        ))}
                      </ul>
                      {proposal.unread.length > 0 && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          No entendí: “{proposal.unread.join("”, “")}”.
                        </p>
                      )}
                      <p className="mt-3 text-sm text-muted-foreground">
                        {proposal.diffs.length === 0
                          ? "Ninguna factura actual cambiaría de decisión."
                          : `${proposal.diffs.length} ${proposal.diffs.length === 1 ? "factura cambiaría" : "facturas cambiarían"} de decisión:`}
                      </p>
                      {proposal.diffs.length > 0 && (
                        <ul className="mt-2 divide-y divide-border/70 rounded-xl border border-border bg-card">
                          {proposal.diffs.slice(0, 6).map((d) => (
                            <li
                              key={d.ref}
                              className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
                            >
                              <span className="min-w-0 truncate font-medium">{d.supplier}</span>
                              <span className="flex items-center gap-1.5">
                                <StatusBadge status={d.before} />→<StatusBadge status={d.after} />
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          onClick={async () => {
                            if (
                              !(await savePolicy(
                                proposal.next,
                                `Regla dicha en español: “${proposal.text}”`,
                              ))
                            )
                              return;
                            toast.success("Listo. El agente ya revisó de nuevo las facturas.");
                            setProposal(null);
                            setSaid("");
                          }}
                        >
                          Aplicar
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
          </div>
        </div>
      )}

      {activeTab === "proveedores" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-xl text-sm text-muted-foreground">
              El agente solo paga a proveedores de esta lista. Si tiene contrato, también revisa que
              la factura cuadre con el monto, la moneda, el ID fiscal y la cuenta acordados.
            </p>
            <Button onClick={() => setSupplierOpen(true)}>
              <Plus className="h-4 w-4" />
              Agregar proveedor
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {config.suppliers
              .filter((s) => approved.some((n) => n.toLowerCase() === s.name.toLowerCase()))
              .map((s) => (
                <article
                  key={s.name}
                  className="flex flex-col rounded-2xl border border-border/70 bg-surface p-4 shadow-soft"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-[15px] font-medium">{s.name}</h3>
                      <p className="truncate text-xs text-muted-foreground">{s.concept}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removeSupplier(s.name)}
                      aria-label={`Quitar ${s.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="mt-3 text-lg font-medium tracking-tight">
                    {formatMoney({ amountMinor: s.contract.amountMinor, currency: s.currency })}
                    <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                      {s.contract.type === "fixed"
                        ? `fijo · ±${policy.contractTolerancePct}%`
                        : "como máximo"}
                    </span>
                  </p>
                  <dl className="mt-2 grid gap-0.5 text-xs text-muted-foreground">
                    <div>
                      Cuenta: <span className="font-mono text-foreground/80">{s.bankAccount}</span>
                    </div>
                    <div>
                      {s.taxId} · {s.country}
                    </div>
                  </dl>
                </article>
              ))}
            {nameOnly.map((n) => (
              <article
                key={n}
                className="flex items-start justify-between gap-2 rounded-2xl border border-dashed border-border p-4"
              >
                <div className="min-w-0">
                  <h3 className="truncate text-[15px] font-medium">{n}</h3>
                  <p className="text-xs text-muted-foreground">
                    Autorizado sin contrato: el agente no puede comparar montos ni cuenta.
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => removeSupplier(n)}
                  aria-label={`Quitar ${n}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </article>
            ))}
          </div>
        </div>
      )}

      {activeTab === "empresa" && (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel
              title={
                <span className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" />
                  Empresa y quién aprueba
                </span>
              }
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="org">Nombre de la empresa</Label>
                  <Input
                    id="org"
                    value={org.orgName}
                    onChange={(e) => setOrg({ ...org, orgName: e.target.value })}
                    className="h-10"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="jur">Dónde está constituida</Label>
                  <Input
                    id="jur"
                    value={org.jurisdiction}
                    onChange={(e) => setOrg({ ...org, jurisdiction: e.target.value })}
                    className="h-10"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="uname">Persona que aprueba pagos</Label>
                  <Input
                    id="uname"
                    value={org.userName}
                    onChange={(e) => setOrg({ ...org, userName: e.target.value })}
                    className="h-10"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="urole">Cargo</Label>
                  <Input
                    id="urole"
                    value={org.userRole}
                    onChange={(e) => setOrg({ ...org, userRole: e.target.value })}
                    className="h-10"
                  />
                </div>
              </div>
              <div className="mt-4">
                <Label className="mb-1.5 block">Apariencia</Label>
                <RadioGroup
                  value={theme}
                  onValueChange={(v) => setTheme(v as "light" | "dark")}
                  className="grid grid-cols-2 gap-2"
                >
                  {(
                    [
                      ["light", "Claro"],
                      ["dark", "Oscuro"],
                    ] as const
                  ).map(([v, l]) => (
                    <label
                      key={v}
                      className="flex h-10 cursor-pointer items-center gap-2.5 rounded-xl border border-border px-3 text-sm has-[[data-state=checked]]:border-primary"
                    >
                      <RadioGroupItem value={v} /> {l}
                    </label>
                  ))}
                </RadioGroup>
              </div>
            </Panel>

            <Panel
              title={
                <span className="flex items-center gap-2">
                  <Coins className="h-4 w-4 text-primary" />
                  Tasas de cambio (1 USD =)
                </span>
              }
              description="El agente pasa cada factura a dólares con estas tasas antes de revisar los límites."
            >
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {(["COP", "EUR", "MXN", "BRL", "ARS"] as Currency[]).map((c) => (
                  <div key={c} className="grid gap-1.5">
                    <Label htmlFor={`fx-${c}`} className="font-mono text-xs">
                      {c}
                    </Label>
                    <Input
                      id={`fx-${c}`}
                      inputMode="decimal"
                      value={org.fx[c]}
                      onChange={(e) => setOrg({ ...org, fx: { ...org.fx, [c]: e.target.value } })}
                      className="h-10 font-mono"
                    />
                  </div>
                ))}
              </div>
            </Panel>
          </div>

          <details className="group rounded-2xl border border-border/70 bg-surface shadow-soft">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-4 text-[15px] font-medium">
              <Cpu className="h-4 w-4 text-primary" />
              <span className="flex-1">Avanzado: probar JEV (TypeSafe AI) con un caso</span>
              <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>
            <div className="border-t border-border/70 p-5">
              <JevPanel />
            </div>
          </details>
        </div>
      )}

      {/* Barra de guardado: solo aparece si hay cambios, y muestra su impacto antes de guardar */}
      {dirty && activeTab !== "proveedores" && (
        <div className="sticky bottom-4 z-20 mt-6">
          <div className="mx-auto flex max-w-3xl flex-col gap-3 rounded-2xl border border-primary/30 bg-card/95 p-3 shadow-lg backdrop-blur sm:flex-row sm:items-center">
            <p className="flex-1 px-1 text-sm">
              <b className="font-medium">Tienes cambios sin guardar.</b>{" "}
              <span className="text-muted-foreground">
                {!policyDirty
                  ? "Son ajustes de la empresa."
                  : impact.length === 0
                    ? "Ninguna factura actual cambiaría de decisión."
                    : `${impact.length} ${impact.length === 1 ? "factura cambiaría" : "facturas cambiarían"} de decisión.`}
              </span>
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={discard} disabled={saving}>
                <Undo2 className="h-4 w-4" />
                Descartar
              </Button>
              <Button onClick={saveAll} disabled={saving}>
                {saving ? "Guardando…" : "Guardar cambios"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={supplierOpen} onOpenChange={setSupplierOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Agregar proveedor</DialogTitle>
            <DialogDescription>
              Cuéntale al agente quién es y qué se acordó. Él llena el formulario.
            </DialogDescription>
          </DialogHeader>
          <SayItBox
            value={supSaid}
            onChange={setSupSaid}
            onSubmit={readSupplier}
            busy={supReading}
            submitLabel={supReading ? "Leyendo…" : "Llenar con esto"}
            placeholder="Ej. “Juliana Restrepo, diseñadora en Colombia, cédula 1020456789. Le pagamos 9.960.000 pesos fijos al mes a su cuenta Bancolombia terminada en 4821.”"
            rows={3}
          />
          <form onSubmit={saveSupplier} className="mt-2 grid gap-3">
            <div className="grid gap-2 sm:grid-cols-[1fr_90px]">
              <div className="grid gap-1.5">
                <Label htmlFor="s-name">Nombre</Label>
                <Input
                  id="s-name"
                  value={sup.name}
                  onChange={(e) => setSup({ ...sup, name: e.target.value })}
                  className="h-10"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="s-country">País</Label>
                <Input
                  id="s-country"
                  maxLength={2}
                  value={sup.country}
                  onChange={(e) => setSup({ ...sup, country: e.target.value })}
                  className="h-10 uppercase"
                />
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-[1fr_130px_120px]">
              <div className="grid gap-1.5">
                <Label htmlFor="s-amt">Monto acordado (opcional)</Label>
                <Input
                  id="s-amt"
                  inputMode="decimal"
                  value={sup.contractAmount}
                  onChange={(e) => setSup({ ...sup, contractAmount: e.target.value })}
                  placeholder="Sin contrato"
                  className="h-10 font-mono"
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Tipo</Label>
                <Select
                  value={sup.contractType}
                  onValueChange={(v) => setSup({ ...sup, contractType: v as "fixed" | "cap" })}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Fijo</SelectItem>
                    <SelectItem value="cap">Como máximo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Moneda</Label>
                <Select
                  value={sup.currency}
                  onValueChange={(v) => setSup({ ...sup, currency: v as Currency })}
                >
                  <SelectTrigger className="h-10 font-mono">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="s-tax">ID fiscal</Label>
                <Input
                  id="s-tax"
                  value={sup.taxId}
                  onChange={(e) => setSup({ ...sup, taxId: e.target.value })}
                  placeholder="NIT, EIN, RFC, CUIT…"
                  className="h-10"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="s-bank">Cuenta a la que se le paga</Label>
                <Input
                  id="s-bank"
                  value={sup.bankAccount}
                  onChange={(e) => setSup({ ...sup, bankAccount: e.target.value })}
                  placeholder="Bancolombia ****4821"
                  className="h-10"
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="s-concept">Qué se le paga</Label>
              <Input
                id="s-concept"
                value={sup.concept}
                onChange={(e) => setSup({ ...sup, concept: e.target.value })}
                placeholder="Diseño UX/UI mensual"
                className="h-10"
              />
            </div>
            <DialogFooter className="mt-1">
              <Button type="button" variant="outline" onClick={() => setSupplierOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">Guardar proveedor</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
