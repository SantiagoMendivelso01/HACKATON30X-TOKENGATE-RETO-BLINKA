import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Save,
  Plus,
  Trash2,
  Building2,
  FileSignature,
  Coins,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  X,
  Cpu,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { useThemeState } from "@/components/tg/theme-toggle";
import { useTokenGate } from "@/lib/tokengate/store";
import { formatMoney, minorToInput, parseToMinor } from "@/lib/tokengate/format";
import { interpretRule, RULE_EXAMPLES, type PolicyChange } from "@/lib/tokengate/nl-rules";
import type { Currency, DisplayStatus, Policy, Supplier } from "@/lib/tokengate/types";

export const Route = createFileRoute("/app/ajustes")({
  head: () => ({
    meta: [
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
type AmountKey = "approvalThreshold" | "transactionLimit" | "monthlyBudget";
type TabId = "reglas" | "proveedores" | "empresa";

const showChangeValue = (v: unknown, field: keyof Policy) =>
  Array.isArray(v)
    ? v.join(", ")
    : typeof v === "number" &&
        ["transactionLimit", "approvalThreshold", "monthlyBudget"].includes(field)
      ? formatMoney({ amountMinor: v, currency: "USD" }, { compact: true })
      : v === "block"
        ? "frenar pago"
        : v === "review"
          ? "pedir permiso a Finanzas"
          : String(v);

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "FI";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

function ReglasYAjustes() {
  const { config, saveConfig, policy, savePolicy, simulate } = useTokenGate();
  const [theme, setTheme] = useThemeState();
  const [activeTab, setActiveTab] = useState<TabId>("reglas");

  // Policy state
  const [limits, setLimits] = useState({
    approvalThreshold: minorToInput(policy.approvalThreshold),
    transactionLimit: minorToInput(policy.transactionLimit),
    monthlyBudget: minorToInput(policy.monthlyBudget),
  });
  const [currencies, setCurrencies] = useState<Currency[]>(policy.allowedCurrencies);
  const [approvedSuppliers, setApprovedSuppliers] = useState<string[]>(policy.approvedSuppliers);
  const [actions, setActions] = useState({
    newSupplierAction: policy.newSupplierAction,
    duplicateAction: policy.duplicateAction,
    missingInfoAction: policy.missingInfoAction,
  });

  // Organization & FX state
  const [orgName, setOrgName] = useState(config.name);
  const [jurisdiction, setJurisdiction] = useState(config.jurisdiction);
  const [userName, setUserName] = useState(config.user.name);
  const [userRole, setUserRole] = useState(config.user.role);
  const [fx, setFx] = useState<Record<Currency, string>>(() => ({
    USD: "1",
    COP: String(config.fx.COP ?? 4150),
    EUR: String(config.fx.EUR ?? 0.92),
    MXN: String(config.fx.MXN ?? 18.2),
    BRL: String(config.fx.BRL ?? 5.4),
    ARS: String(config.fx.ARS ?? 980),
  }));

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Natural-language rule interpreter
  const [nl, setNl] = useState("");
  const [proposal, setProposal] = useState<{
    text: string;
    changes: PolicyChange[];
    next: Policy;
    diffs: { ref: string; supplier: string; before: DisplayStatus; after: DisplayStatus }[];
  } | null>(null);

  // Quick supplier or full contract modal
  const [quickSupplierName, setQuickSupplierName] = useState("");
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false);
  const [supForm, setSupForm] = useState({
    name: "",
    taxId: "",
    country: "CO",
    currency: "USD" as Currency,
    contractType: "fixed" as "fixed" | "cap",
    contractAmount: "1500.00",
    bankAccount: "",
    concept: "",
  });

  // Sync state when external policy or config updates
  useEffect(() => {
    setLimits({
      approvalThreshold: minorToInput(policy.approvalThreshold),
      transactionLimit: minorToInput(policy.transactionLimit),
      monthlyBudget: minorToInput(policy.monthlyBudget),
    });
    setCurrencies(policy.allowedCurrencies);
    setApprovedSuppliers(policy.approvedSuppliers);
    setActions({
      newSupplierAction: policy.newSupplierAction,
      duplicateAction: policy.duplicateAction,
      missingInfoAction: policy.missingInfoAction,
    });
  }, [policy]);

  useEffect(() => {
    setOrgName(config.name);
    setJurisdiction(config.jurisdiction);
    setUserName(config.user.name);
    setUserRole(config.user.role);
    setFx({
      USD: "1",
      COP: String(config.fx.COP ?? 4150),
      EUR: String(config.fx.EUR ?? 0.92),
      MXN: String(config.fx.MXN ?? 18.2),
      BRL: String(config.fx.BRL ?? 5.4),
      ARS: String(config.fx.ARS ?? 980),
    });
  }, [config]);

  const parsedFxNumbers = (): Partial<Record<Currency, number>> | null => {
    const out: Partial<Record<Currency, number>> = { USD: 1 };
    for (const c of CURRENCIES) {
      if (c === "USD") continue;
      const val = Number(fx[c].replace(",", "."));
      if (!Number.isFinite(val) || val <= 0) return null;
      out[c] = val;
    }
    return out;
  };

  const fxEquiv = (k: AmountKey): string | null => {
    const usdMinor = parseToMinor(limits[k]);
    if (!usdMinor || usdMinor <= 0) return null;
    const eurRate = Number(fx.EUR.replace(",", ".")) || config.fx.EUR || 0.92;
    const copRate = Number(fx.COP.replace(",", ".")) || config.fx.COP || 4150;
    const eurMinor = Math.round(usdMinor * eurRate);
    const copMinor = Math.round(usdMinor * copRate);
    return `≈ ${formatMoney({ amountMinor: eurMinor, currency: "EUR" }, { compact: true })} · ≈ ${formatMoney({ amountMinor: copMinor, currency: "COP" }, { compact: true })}`;
  };

  const interpret = (text: string) => {
    const currentFx = parsedFxNumbers() ?? config.fx;
    const changes = interpretRule(text, policy, currentFx);
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

  const saveAll = async () => {
    setErrorMsg("");
    const approvalMinor = parseToMinor(limits.approvalThreshold);
    const txLimitMinor = parseToMinor(limits.transactionLimit);
    const budgetMinor = parseToMinor(limits.monthlyBudget);

    if (!approvalMinor || approvalMinor <= 0) {
      setErrorMsg("El monto de pago automático debe ser mayor a 0.");
      return;
    }
    if (!txLimitMinor || txLimitMinor <= 0) {
      setErrorMsg("El tope máximo por factura debe ser mayor a 0.");
      return;
    }
    if (!budgetMinor || budgetMinor <= 0) {
      setErrorMsg("El presupuesto mensual debe ser mayor a 0.");
      return;
    }
    if (approvalMinor > txLimitMinor) {
      setErrorMsg("El monto de pago automático no puede ser mayor que el tope máximo por factura.");
      return;
    }
    if (txLimitMinor > budgetMinor) {
      setErrorMsg("El tope máximo por factura no puede superar el presupuesto mensual.");
      return;
    }
    if (currencies.length === 0) {
      setErrorMsg("Selecciona al menos una moneda permitida.");
      return;
    }
    if (approvedSuppliers.length === 0) {
      setErrorMsg("Mantén al menos un proveedor autorizado en la lista.");
      return;
    }
    if (orgName.trim().length < 2) {
      setErrorMsg("El nombre de la empresa debe tener al menos 2 caracteres.");
      return;
    }
    const nextFx = parsedFxNumbers();
    if (!nextFx) {
      setErrorMsg("Todas las tasas de cambio deben ser números mayores a 0.");
      return;
    }

    setSaving(true);
    const nextPolicy: Policy = {
      ...policy,
      approvalThreshold: approvalMinor,
      transactionLimit: txLimitMinor,
      monthlyBudget: budgetMinor,
      allowedCurrencies: currencies,
      approvedSuppliers,
      newSupplierAction: actions.newSupplierAction,
      duplicateAction: actions.duplicateAction,
      missingInfoAction: actions.missingInfoAction,
    };

    const nextConfig = {
      ...config,
      name: orgName.trim(),
      jurisdiction: jurisdiction.trim() || "Delaware, EE. UU.",
      user: {
        name: userName.trim() || "Finanzas",
        role: userRole.trim() || "Finanzas",
        initials: initialsOf(userName.trim() || "Finanzas"),
      },
      fx: nextFx,
    };

    const [polOk, cfgOk] = await Promise.all([
      savePolicy(nextPolicy, "Reglas de pago actualizadas desde Reglas y Ajustes."),
      saveConfig(
        nextConfig,
        `Ajustes actualizados: ${nextConfig.name} · Tasas y aprobador (${nextConfig.user.name})`,
      ),
    ]);
    setSaving(false);

    if (polOk && cfgOk) {
      toast.success(
        "Reglas y ajustes guardados. Todas las facturas fueron re-evaluadas con la nueva configuración.",
      );
    }
  };

  const addQuickSupplier = async () => {
    const name = quickSupplierName.trim();
    if (!name) return;
    if (approvedSuppliers.some((s) => s.toLowerCase() === name.toLowerCase())) {
      toast.error("Ese proveedor ya está en la lista autorizada.");
      return;
    }
    const nextList = [...approvedSuppliers, name];
    setApprovedSuppliers(nextList);
    setQuickSupplierName("");
    const saved = await savePolicy(
      { ...policy, approvedSuppliers: nextList },
      `Proveedor autorizado añadido: ${name}`,
    );
    if (saved) toast.success(`${name} añadido a proveedores autorizados.`);
  };

  const removeAuthorizedSupplier = async (name: string) => {
    const nextApproved = approvedSuppliers.filter((s) => s !== name);
    const nextContracts = config.suppliers.filter((s) => s.name !== name);
    setApprovedSuppliers(nextApproved);
    await Promise.all([
      savePolicy(
        { ...policy, approvedSuppliers: nextApproved },
        `Proveedor retirado de la lista autorizada: ${name}`,
      ),
      nextContracts.length !== config.suppliers.length
        ? saveConfig({ ...config, suppliers: nextContracts }, `Contrato eliminado: ${name}`)
        : Promise.resolve(true),
    ]);
    toast.success(`${name} retirado de proveedores autorizados.`);
  };

  const addSupplierContract = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!supForm.name.trim() || !supForm.taxId.trim() || !supForm.bankAccount.trim()) {
      toast.error("Completa nombre, ID fiscal y cuenta bancaria del proveedor.");
      return;
    }
    const minor = parseToMinor(supForm.contractAmount);
    if (minor === null || minor <= 0) {
      toast.error("Introduce un monto de contrato válido.");
      return;
    }
    const newSup: Supplier = {
      name: supForm.name.trim(),
      taxId: supForm.taxId.trim(),
      country: supForm.country.trim().toUpperCase() || "CO",
      currency: supForm.currency,
      contract: { type: supForm.contractType, amountMinor: minor },
      bankAccount: supForm.bankAccount.trim(),
      concept: supForm.concept.trim() || "Servicios profesionales",
    };
    const filtered = config.suppliers.filter(
      (s) => s.name.toLowerCase() !== newSup.name.toLowerCase(),
    );
    const nextSuppliers = [...filtered, newSup];
    const nextApproved = approvedSuppliers.includes(newSup.name)
      ? approvedSuppliers
      : [...approvedSuppliers, newSup.name];

    setApprovedSuppliers(nextApproved);
    const [cfgOk] = await Promise.all([
      saveConfig(
        { ...config, suppliers: nextSuppliers },
        `Contrato registrado para ${newSup.name} (${formatMoney({ amountMinor: minor, currency: newSup.currency })})`,
      ),
      savePolicy(
        { ...policy, approvedSuppliers: nextApproved },
        `Proveedor con contrato autorizado: ${newSup.name}`,
      ),
    ]);

    if (cfgOk) {
      toast.success(`Proveedor y contrato de ${newSup.name} guardados.`);
      setSupplierDialogOpen(false);
      setSupForm({
        name: "",
        taxId: "",
        country: "CO",
        currency: "USD",
        contractType: "fixed",
        contractAmount: "1500.00",
        bankAccount: "",
        concept: "",
      });
    }
  };

  return (
    <>
      <PageHeader
        eyebrow={`${config.name} · Política activa ${policy.version}`}
        title="Reglas de pago y Ajustes"
        subtitle="Define las reglas dentro de las cuales el agente paga solo, cuándo debe pedir permiso a una persona y con qué proveedores puede operar."
        actions={
          <Button className="h-10" onClick={saveAll} disabled={saving}>
            <Save className="h-4 w-4" />
            {saving ? "Guardando…" : "Guardar reglas y ajustes"}
          </Button>
        }
      />

      {errorMsg && (
        <div className="mb-4 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {errorMsg}
        </div>
      )}

      {/* Navegación por pestañas desde primeros principios */}
      <div className="mb-6 flex flex-wrap gap-2 border-b border-border pb-3">
        {(
          [
            {
              id: "reglas",
              label: "1. Límites y Reglas de Pago",
              icon: ShieldCheck,
              badge: policy.version,
            },
            {
              id: "proveedores",
              label: "2. Proveedores y Contratos",
              icon: FileSignature,
              badge: String(approvedSuppliers.length),
            },
            {
              id: "empresa",
              label: "3. Empresa, Tasas y Motor IA",
              icon: Building2,
              badge: "FX + JEV",
            },
          ] as const
        ).map((t) => {
          const Icon = t.icon;
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "border border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{t.label}</span>
              <span
                className={`rounded-full px-2 py-0.5 font-mono text-[11px] ${
                  active
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {t.badge}
              </span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: REGLAS Y LÍMITES DE PAGO */}
      {activeTab === "reglas" && (
        <div className="space-y-4">
          <Panel
            title={
              <span className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Escribe una regla en español y simula el impacto
              </span>
            }
            description="Escribe un cambio en lenguaje natural (en USD, EUR o COP). El agente calcula qué facturas cambiarían de decisión antes de que lo apliques."
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
              Interpretar y simular impacto
              <ArrowRight className="h-4 w-4" />
            </Button>

            {proposal && (
              <div className="mt-4 rounded-2xl border border-primary/30 bg-accent p-4">
                {proposal.changes.length === 0 ? (
                  <p className="text-sm">
                    No identifiqué un cambio concreto. Prueba con frases como:{" "}
                    <i>“Pide aprobación por encima de $800”</i>,{" "}
                    <i>“Sube el presupuesto a $25,000”</i> o <i>“Bloquea los duplicados”</i>.
                  </p>
                ) : (
                  <>
                    <p className="eyebrow mb-1">Cambio detectado</p>
                    {proposal.changes.map((c) => (
                      <p key={c.field} className="text-[15px] font-medium">
                        {c.label}:{" "}
                        <s className="font-normal text-muted-foreground">
                          {showChangeValue(c.before, c.field)}
                        </s>{" "}
                        → {showChangeValue(c.after, c.field)}
                      </p>
                    ))}
                    <p className="mt-3 text-sm text-muted-foreground">
                      Impacto sobre las facturas actuales:{" "}
                      <b className="text-foreground">{proposal.diffs.length}</b>{" "}
                      {proposal.diffs.length === 1
                        ? "factura cambiaría de estado"
                        : "facturas cambiarían de estado"}
                      .
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
                              <span className="font-mono text-xs text-muted-foreground">
                                {d.ref}
                              </span>
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
                            `Regla en español aplicada: “${proposal.text}”`,
                          );
                          if (!saved) return;
                          toast.success("Regla aplicada y facturas re-evaluadas.");
                          setProposal(null);
                          setNl("");
                        }}
                      >
                        Aplicar regla ahora
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

          <div className="grid gap-4 lg:grid-cols-3">
            <Panel
              title="1. Pago automático hasta"
              description="Si la factura es menor o igual a este monto y cumple las demás reglas, el agente la paga sin molestar a nadie. Por encima, pide permiso humano."
            >
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs text-muted-foreground">
                  USD
                </span>
                <Input
                  inputMode="decimal"
                  value={limits.approvalThreshold}
                  onChange={(e) => setLimits({ ...limits, approvalThreshold: e.target.value })}
                  className="tabular h-11 rounded-xl bg-background pl-12 font-mono text-base font-semibold"
                />
              </div>
              {fxEquiv("approvalThreshold") && (
                <p className="mt-2 font-mono text-xs text-primary">
                  {fxEquiv("approvalThreshold")}
                </p>
              )}
            </Panel>

            <Panel
              title="2. Tope máximo por factura"
              description="Ninguna factura individual puede superar este monto. Si lo supera, el agente la frena automáticamente por seguridad."
            >
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs text-muted-foreground">
                  USD
                </span>
                <Input
                  inputMode="decimal"
                  value={limits.transactionLimit}
                  onChange={(e) => setLimits({ ...limits, transactionLimit: e.target.value })}
                  className="tabular h-11 rounded-xl bg-background pl-12 font-mono text-base font-semibold"
                />
              </div>
              {fxEquiv("transactionLimit") && (
                <p className="mt-2 font-mono text-xs text-primary">{fxEquiv("transactionLimit")}</p>
              )}
            </Panel>

            <Panel
              title="3. Presupuesto mensual total"
              description="Bolsa disponible para todo el mes (sumando lo pagado y lo pendiente de aprobación). Si no alcanza el saldo, el agente frena el pago."
            >
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs text-muted-foreground">
                  USD
                </span>
                <Input
                  inputMode="decimal"
                  value={limits.monthlyBudget}
                  onChange={(e) => setLimits({ ...limits, monthlyBudget: e.target.value })}
                  className="tabular h-11 rounded-xl bg-background pl-12 font-mono text-base font-semibold"
                />
              </div>
              {fxEquiv("monthlyBudget") && (
                <p className="mt-2 font-mono text-xs text-primary">{fxEquiv("monthlyBudget")}</p>
              )}
            </Panel>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel
              title="¿Qué hacer ante casos especiales o sospechosos?"
              description="Define si el agente debe frenar el pago de raíz o pedir permiso a una persona de Finanzas."
            >
              <div className="grid gap-4">
                <div>
                  <p className="mb-1.5 text-sm font-medium">
                    Si el proveedor es nuevo (no está en la lista autorizada)
                  </p>
                  <RadioGroup
                    value={actions.newSupplierAction}
                    onValueChange={(v) =>
                      setActions({
                        ...actions,
                        newSupplierAction: v as Policy["newSupplierAction"],
                      })
                    }
                    className="grid gap-2 sm:grid-cols-2"
                  >
                    <label className="flex min-h-10 cursor-pointer items-center gap-2.5 rounded-xl border border-border bg-background px-3 py-2 text-sm has-[[data-state=checked]]:border-primary">
                      <RadioGroupItem value="review" /> Pedir permiso a Finanzas
                    </label>
                    <label className="flex min-h-10 cursor-pointer items-center gap-2.5 rounded-xl border border-border bg-background px-3 py-2 text-sm has-[[data-state=checked]]:border-primary">
                      <RadioGroupItem value="block" /> Frenar pago de inmediato
                    </label>
                  </RadioGroup>
                </div>

                <div>
                  <p className="mb-1.5 text-sm font-medium">
                    Si detecta un cobro duplicado (mismo proveedor e importe reciente)
                  </p>
                  <RadioGroup
                    value={actions.duplicateAction}
                    onValueChange={(v) =>
                      setActions({
                        ...actions,
                        duplicateAction: v as Policy["duplicateAction"],
                      })
                    }
                    className="grid gap-2 sm:grid-cols-2"
                  >
                    <label className="flex min-h-10 cursor-pointer items-center gap-2.5 rounded-xl border border-border bg-background px-3 py-2 text-sm has-[[data-state=checked]]:border-primary">
                      <RadioGroupItem value="block" /> Frenar pago de inmediato
                    </label>
                    <label className="flex min-h-10 cursor-pointer items-center gap-2.5 rounded-xl border border-border bg-background px-3 py-2 text-sm has-[[data-state=checked]]:border-primary">
                      <RadioGroupItem value="review" /> Pedir permiso a Finanzas
                    </label>
                  </RadioGroup>
                </div>

                <div>
                  <p className="mb-1.5 text-sm font-medium">
                    Si a la factura le faltan datos obligatorios (ID fiscal, cuenta o fecha)
                  </p>
                  <RadioGroup
                    value={actions.missingInfoAction}
                    onValueChange={(v) =>
                      setActions({
                        ...actions,
                        missingInfoAction: v as Policy["missingInfoAction"],
                      })
                    }
                    className="grid gap-2 sm:grid-cols-2"
                  >
                    <label className="flex min-h-10 cursor-pointer items-center gap-2.5 rounded-xl border border-border bg-background px-3 py-2 text-sm has-[[data-state=checked]]:border-primary">
                      <RadioGroupItem value="request_information" /> Escalar y pedir datos
                    </label>
                    <label className="flex min-h-10 cursor-pointer items-center gap-2.5 rounded-xl border border-border bg-background px-3 py-2 text-sm has-[[data-state=checked]]:border-primary">
                      <RadioGroupItem value="block" /> Frenar pago de inmediato
                    </label>
                  </RadioGroup>
                </div>
              </div>
            </Panel>

            <Panel
              title="Monedas autorizadas para pagar"
              description="Activa o desactiva las monedas en las que el agente puede recibir facturas. Si llega una factura en otra moneda, el agente la frena."
            >
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {CURRENCIES.map((c) => {
                  const on = currencies.includes(c);
                  return (
                    <button
                      key={c}
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        setCurrencies(on ? currencies.filter((x) => x !== c) : [...currencies, c])
                      }
                      className={`flex flex-col items-start justify-between rounded-xl border p-3 text-left transition-colors ${
                        on
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border bg-card text-muted-foreground opacity-70"
                      }`}
                    >
                      <div className="flex w-full items-center justify-between">
                        <span className="font-mono text-sm font-bold">{c}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            on
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {on ? "Activa" : "Bloqueada"}
                        </span>
                      </div>
                      <span className="mt-1 font-mono text-xs text-muted-foreground">
                        {c === "USD" ? "Moneda base" : `1 USD = ${fx[c]} ${c}`}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Puedes ajustar las tasas de cambio exactas de cada moneda en la pestaña{" "}
                <button
                  type="button"
                  onClick={() => setActiveTab("empresa")}
                  className="font-medium text-primary underline underline-offset-2"
                >
                  3. Empresa, Tasas y Motor IA
                </button>
                .
              </p>
            </Panel>
          </div>
        </div>
      )}

      {/* TAB 2: PROVEEDORES AUTORIZADOS Y CONTRATOS */}
      {activeTab === "proveedores" && (
        <div className="space-y-4">
          <Panel
            title={`Lista de beneficiarios autorizados (${approvedSuppliers.length})`}
            description="El agente verifica que quien cobra esté en esta lista (Regla #3). Puedes autorizar un proveedor rápidamente por su nombre o registrar su contrato completo abajo."
          >
            <div className="flex flex-wrap gap-2">
              {approvedSuppliers.map((s) => {
                const hasContract = config.suppliers.some(
                  (c) => c.name.toLowerCase() === s.toLowerCase(),
                );
                return (
                  <span
                    key={s}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card py-1 pl-3 pr-1.5 text-sm"
                  >
                    <span className="font-medium">{s}</span>
                    {hasContract && (
                      <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                        Con contrato
                      </span>
                    )}
                    <button
                      type="button"
                      aria-label={`Quitar ${s}`}
                      onClick={() => removeAuthorizedSupplier(s)}
                      className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                );
              })}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Input
                value={quickSupplierName}
                onChange={(e) => setQuickSupplierName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addQuickSupplier();
                  }
                }}
                placeholder="Nombre de un nuevo proveedor autorizado (ej. Figma Inc.)"
                className="h-10 max-w-sm rounded-xl bg-background"
              />
              <Button type="button" variant="outline" className="h-10" onClick={addQuickSupplier}>
                <Plus className="h-4 w-4" />
                Autorizar solo por nombre
              </Button>
              <Button type="button" className="h-10" onClick={() => setSupplierDialogOpen(true)}>
                <FileSignature className="h-4 w-4" />
                Registrar proveedor con contrato completo
              </Button>
            </div>
          </Panel>

          <Panel
            title={`Contratos y cuentas bancarias acordadas (${config.suppliers.length})`}
            description="Para estos proveedores, el agente además comprueba que la factura coincida con el NIT/ID fiscal, la cuenta bancaria, la moneda pactada y el monto acordado."
            bodyClassName="p-0"
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Proveedor / Contratista</th>
                    <th className="px-4 py-3 font-medium">ID Fiscal / País</th>
                    <th className="px-4 py-3 font-medium">Monto acordado</th>
                    <th className="px-4 py-3 font-medium">Cuenta bancaria registrada</th>
                    <th className="px-4 py-3 font-medium">Concepto</th>
                    <th className="px-4 py-3 text-right font-medium">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {config.suppliers.map((s) => (
                    <tr key={s.name} className="border-b border-border/70 last:border-0">
                      <td className="px-4 py-3 font-medium">{s.name}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {s.taxId} ·{" "}
                        <span className="font-semibold text-foreground">{s.country}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium">
                          {s.contract.type === "fixed"
                            ? `Fijo (±${policy.contractTolerancePct}%)`
                            : "Tope máx."}
                        </span>{" "}
                        <span className="tabular font-medium">
                          {formatMoney({
                            amountMinor: s.contract.amountMinor,
                            currency: s.currency,
                          })}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{s.bankAccount}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{s.concept}</td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-muted-foreground hover:text-destructive"
                          onClick={() => removeAuthorizedSupplier(s.name)}
                          aria-label={`Eliminar ${s.name}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {config.suppliers.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-6 text-center text-sm text-muted-foreground"
                      >
                        No hay contratos detallados registrados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      )}

      {/* TAB 3: EMPRESA, TASAS DE CAMBIO Y MOTOR IA */}
      {activeTab === "empresa" && (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel
              title={
                <span className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" />
                  Identidad de la empresa y aprobador humano
                </span>
              }
              description="Define el nombre de la empresa y la persona de Finanzas que autoriza pagos cuando una factura supera los límites automáticos."
            >
              <div className="grid gap-3.5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label htmlFor="org">Nombre de la empresa</Label>
                    <Input
                      id="org"
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      placeholder="Ej. Andes Labs Inc."
                      className="h-10"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="jur">Jurisdicción de constitución</Label>
                    <Input
                      id="jur"
                      value={jurisdiction}
                      onChange={(e) => setJurisdiction(e.target.value)}
                      placeholder="Ej. Delaware, EE. UU."
                      className="h-10"
                    />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label htmlFor="uname">Persona que aprueba pagos (Finanzas)</Label>
                    <Input
                      id="uname"
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                      placeholder="Ej. Valentina Ríos"
                      className="h-10"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="urole">Cargo</Label>
                    <Input
                      id="urole"
                      value={userRole}
                      onChange={(e) => setUserRole(e.target.value)}
                      placeholder="Ej. Head of Finance"
                      className="h-10"
                    />
                  </div>
                </div>

                <div className="pt-1">
                  <Label className="mb-1.5 block">Apariencia visual</Label>
                  <RadioGroup
                    value={theme}
                    onValueChange={(v) => setTheme(v as "light" | "dark")}
                    className="grid grid-cols-2 gap-2"
                  >
                    {(
                      [
                        ["light", "Tema Claro"],
                        ["dark", "Tema Oscuro"],
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
              </div>
            </Panel>

            <Panel
              title={
                <span className="flex items-center gap-2">
                  <Coins className="h-4 w-4 text-primary" />
                  Tasas de cambio multimoneda (1 USD =)
                </span>
              }
              description="El agente convierte cada factura en Pesos (COP, MXN, ARS), Reales (BRL) o Euros (EUR) a Dólares (USD) con estas equivalencias antes de evaluar los límites."
            >
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {(["COP", "EUR", "MXN", "BRL", "ARS"] as Currency[]).map((c) => (
                  <div key={c} className="grid gap-1.5">
                    <Label htmlFor={`fx-${c}`} className="font-mono text-xs">
                      1 USD en {c}
                    </Label>
                    <Input
                      id={`fx-${c}`}
                      inputMode="decimal"
                      value={fx[c]}
                      onChange={(e) => setFx({ ...fx, [c]: e.target.value })}
                      className="h-10 font-mono"
                    />
                  </div>
                ))}
                <div className="grid gap-1.5">
                  <Label className="font-mono text-xs text-muted-foreground">Moneda base</Label>
                  <Input value="1.00 USD" disabled className="h-10 font-mono" />
                </div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Al pulsar <b>Guardar reglas y ajustes</b>, todas las facturas en moneda local se
                recalcularán de inmediato con estas tasas.
              </p>
            </Panel>
          </div>

          <Panel
            title={
              <span className="flex items-center gap-2">
                <Cpu className="h-4 w-4 text-primary" />
                Probador en vivo del motor JEV (TypeSafe AI)
              </span>
            }
            description="Además de las 14 reglas deterministas locales, puedes consultar en vivo el motor externo JEV de TypeSafe AI con las políticas actuales."
          >
            <JevPanel />
          </Panel>
        </div>
      )}

      {/* Modal para añadir contrato completo */}
      <Dialog open={supplierDialogOpen} onOpenChange={setSupplierDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Registrar proveedor con contrato acordado</DialogTitle>
            <DialogDescription>
              El proveedor quedará autorizado y el agente validará sus facturas contra este monto,
              moneda, ID fiscal y cuenta bancaria.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={addSupplierContract} className="grid gap-3">
            <div className="grid gap-2 sm:grid-cols-[1fr_100px]">
              <div className="grid gap-1.5">
                <Label htmlFor="s-name">Nombre del proveedor o contratista</Label>
                <Input
                  id="s-name"
                  value={supForm.name}
                  onChange={(e) => setSupForm({ ...supForm, name: e.target.value })}
                  placeholder="Ej. Juliana Restrepo"
                  className="h-10"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="s-country">País (ISO)</Label>
                <Input
                  id="s-country"
                  maxLength={2}
                  value={supForm.country}
                  onChange={(e) => setSupForm({ ...supForm, country: e.target.value })}
                  placeholder="CO"
                  className="h-10 uppercase"
                />
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="s-tax">ID Fiscal (NIT / EIN / RFC / CUIT / CNPJ)</Label>
                <Input
                  id="s-tax"
                  value={supForm.taxId}
                  onChange={(e) => setSupForm({ ...supForm, taxId: e.target.value })}
                  placeholder="Ej. NIT 901234567-1"
                  className="h-10"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="s-bank">Cuenta bancaria autorizada</Label>
                <Input
                  id="s-bank"
                  value={supForm.bankAccount}
                  onChange={(e) => setSupForm({ ...supForm, bankAccount: e.target.value })}
                  placeholder="Ej. Bancolombia ****4821"
                  className="h-10"
                />
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <div className="grid gap-1.5">
                <Label>Tipo de acuerdo</Label>
                <Select
                  value={supForm.contractType}
                  onValueChange={(v) =>
                    setSupForm({ ...supForm, contractType: v as "fixed" | "cap" })
                  }
                >
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Monto fijo mensual</SelectItem>
                    <SelectItem value="cap">Tope máximo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="s-amt">Importe acordado</Label>
                <Input
                  id="s-amt"
                  inputMode="decimal"
                  value={supForm.contractAmount}
                  onChange={(e) => setSupForm({ ...supForm, contractAmount: e.target.value })}
                  placeholder="1500.00"
                  className="h-10"
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Moneda del contrato</Label>
                <Select
                  value={supForm.currency}
                  onValueChange={(v) => setSupForm({ ...supForm, currency: v as Currency })}
                >
                  <SelectTrigger className="h-10">
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

            <div className="grid gap-1.5">
              <Label htmlFor="s-concept">Concepto acordado</Label>
              <Input
                id="s-concept"
                value={supForm.concept}
                onChange={(e) => setSupForm({ ...supForm, concept: e.target.value })}
                placeholder="Ej. Desarrollo backend mensual"
                className="h-10"
              />
            </div>

            <DialogFooter className="mt-2">
              <Button type="button" variant="outline" onClick={() => setSupplierDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">Guardar proveedor y contrato</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
