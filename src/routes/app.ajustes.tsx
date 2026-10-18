import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { RotateCcw, Save, Plus, Trash2, Building2, FileSignature, Coins } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { PageHeader, Panel } from "@/components/tg/primitives";
import { useThemeState } from "@/components/tg/theme-toggle";
import { useTokenGate } from "@/lib/tokengate/store";
import { formatMoney, minorToInput, parseToMinor } from "@/lib/tokengate/format";
import type { Currency, Supplier } from "@/lib/tokengate/types";

export const Route = createFileRoute("/app/ajustes")({
  head: () => ({
    meta: [
      { title: "Ajustes — blinka" },
      {
        name: "description",
        content: "Organización, tasas de cambio, contratos de proveedores, tema y datos.",
      },
      { property: "og:title", content: "Ajustes — blinka" },
      { property: "og:description", content: "Configura el agente pagador para tu organización." },
    ],
  }),
  component: Ajustes,
});

const CURRENCIES: Currency[] = ["USD", "COP", "MXN", "BRL", "ARS", "EUR"];

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "FI";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

function Ajustes() {
  const { config, saveConfig, policy, savePolicy, mode } = useTokenGate();
  const [theme, setTheme] = useThemeState();

  // Organization & User form state
  const [orgName, setOrgName] = useState(config.name);
  const [jurisdiction, setJurisdiction] = useState(config.jurisdiction);
  const [period, setPeriod] = useState(config.period);
  const [inbox, setInbox] = useState(config.inbox);
  const [userName, setUserName] = useState(config.user.name);
  const [userRole, setUserRole] = useState(config.user.role);
  const [baselineUsed, setBaselineUsed] = useState(() => minorToInput(config.baselineUsedMinor));

  // FX rates form state (units per 1 USD)
  const [fx, setFx] = useState<Record<Currency, string>>(() => ({
    USD: "1",
    COP: String(config.fx.COP ?? 4150),
    MXN: String(config.fx.MXN ?? 18.2),
    BRL: String(config.fx.BRL ?? 5.4),
    ARS: String(config.fx.ARS ?? 980),
    EUR: String(config.fx.EUR ?? 0.92),
  }));

  const [orgError, setOrgError] = useState("");
  const [saving, setSaving] = useState(false);
  const [notif, setNotif] = useState({ approvals: true, blocked: true, weekly: false });

  // Supplier modal state
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

  // Sync local state if config changes from outside
  useEffect(() => {
    setOrgName(config.name);
    setJurisdiction(config.jurisdiction);
    setPeriod(config.period);
    setInbox(config.inbox);
    setUserName(config.user.name);
    setUserRole(config.user.role);
    setBaselineUsed(minorToInput(config.baselineUsedMinor));
    setFx({
      USD: "1",
      COP: String(config.fx.COP ?? 4150),
      MXN: String(config.fx.MXN ?? 18.2),
      BRL: String(config.fx.BRL ?? 5.4),
      ARS: String(config.fx.ARS ?? 980),
      EUR: String(config.fx.EUR ?? 0.92),
    });
  }, [config]);

  const saveAllSettings = async () => {
    if (orgName.trim().length < 2) {
      setOrgError("El nombre de la empresa debe tener al menos 2 caracteres.");
      return;
    }
    const parsedFx: Partial<Record<Currency, number>> = { USD: 1 };
    for (const c of CURRENCIES) {
      if (c === "USD") continue;
      const val = Number(fx[c].replace(",", "."));
      if (!Number.isFinite(val) || val <= 0) {
        setOrgError(`La tasa de cambio para ${c} debe ser un número mayor a 0.`);
        return;
      }
      parsedFx[c] = val;
    }
    const baseMinor = parseToMinor(baselineUsed) ?? 0;

    setOrgError("");
    setSaving(true);
    const nextConfig = {
      ...config,
      name: orgName.trim(),
      jurisdiction: jurisdiction.trim() || "Delaware, EE. UU.",
      period: period.trim() || config.period,
      inbox: inbox.trim(),
      user: {
        name: userName.trim() || "Finanzas",
        role: userRole.trim() || "Finanzas",
        initials: initialsOf(userName.trim() || "Finanzas"),
      },
      fx: parsedFx,
      baselineUsedMinor: Math.max(0, baseMinor),
    };
    const saved = await saveConfig(
      nextConfig,
      `Empresa: ${nextConfig.name} (${nextConfig.jurisdiction}) · Aprobador: ${nextConfig.user.name}`,
    );
    setSaving(false);
    if (saved) toast.success("Configuración de la organización guardada.");
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
      country: supForm.country.trim().toUpperCase() || "US",
      currency: supForm.currency,
      contract: { type: supForm.contractType, amountMinor: minor },
      bankAccount: supForm.bankAccount.trim(),
      concept: supForm.concept.trim() || "Servicios profesionales",
    };
    const filtered = config.suppliers.filter(
      (s) => s.name.toLowerCase() !== newSup.name.toLowerCase(),
    );
    const nextSuppliers = [...filtered, newSup];
    const saved = await saveConfig(
      { ...config, suppliers: nextSuppliers },
      `Contrato registrado para proveedor ${newSup.name} (${formatMoney({ amountMinor: minor, currency: newSup.currency })})`,
    );
    if (saved) {
      // Asegurar que también quede en la lista de proveedores aprobados de la política
      if (!policy.approvedSuppliers.includes(newSup.name)) {
        await savePolicy(
          { ...policy, approvedSuppliers: [...policy.approvedSuppliers, newSup.name] },
          `Proveedor con contrato añadido: ${newSup.name}`,
        );
      }
      toast.success(`Contrato de ${newSup.name} guardado.`);
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

  const removeSupplierContract = async (name: string) => {
    const nextSuppliers = config.suppliers.filter((s) => s.name !== name);
    const saved = await saveConfig(
      { ...config, suppliers: nextSuppliers },
      `Contrato eliminado: ${name}`,
    );
    if (saved) toast.success(`Contrato de ${name} eliminado.`);
  };

  return (
    <>
      <PageHeader
        eyebrow={`${config.name} · ${config.jurisdiction}`}
        title="Ajustes de la empresa"
        subtitle="Configura los datos de la empresa matriz, el equipo de Finanzas, tasas de cambio multimoneda y contratos con proveedores."
        actions={
          <Button className="h-10" onClick={saveAllSettings} disabled={saving}>
            <Save className="h-4 w-4" />
            {saving ? "Guardando…" : "Guardar cambios"}
          </Button>
        }
      />

      {orgError && (
        <div className="mb-4 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {orgError}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title={
            <span className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              Datos de la organización y aprobador
            </span>
          }
          description="Se reflejan en la barra lateral, en el dashboard y en las firmas del registro de auditoría."
        >
          <div className="grid gap-3.5">
            <div className="grid gap-1.5 sm:grid-cols-2">
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

            <div className="grid gap-1.5 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="period">Periodo contable activo</Label>
                <Input
                  id="period"
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                  placeholder="Ej. Octubre 2026"
                  className="h-10"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="inbox">Buzón de recepción de facturas</Label>
                <Input
                  id="inbox"
                  value={inbox}
                  onChange={(e) => setInbox(e.target.value)}
                  placeholder="Ej. pagos@andeslabs.co"
                  className="h-10"
                />
              </div>
            </div>

            <div className="grid gap-1.5 sm:grid-cols-3">
              <div className="grid gap-1.5">
                <Label htmlFor="uname">Responsable de Finanzas</Label>
                <Input
                  id="uname"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="Ej. Ana Gómez"
                  className="h-10"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="urole">Cargo / Rol</Label>
                <Input
                  id="urole"
                  value={userRole}
                  onChange={(e) => setUserRole(e.target.value)}
                  placeholder="Ej. Head of Finance"
                  className="h-10"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="base-used">Gasto previo del mes (USD)</Label>
                <Input
                  id="base-used"
                  inputMode="decimal"
                  value={baselineUsed}
                  onChange={(e) => setBaselineUsed(e.target.value)}
                  placeholder="0.00"
                  className="h-10"
                />
              </div>
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
          description="El motor convierte cada factura local (COP, MXN, BRL, ARS, EUR) a USD para verificar límites y presupuesto."
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {(["COP", "MXN", "BRL", "ARS", "EUR"] as Currency[]).map((c) => (
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
            Al guardar cambios, todas las facturas en moneda extranjera se recalcularán con estas
            tasas.
          </p>
        </Panel>
      </div>

      {/* Contratos con proveedores */}
      <Panel
        className="mt-4"
        title={
          <span className="flex items-center gap-2">
            <FileSignature className="h-4 w-4 text-primary" />
            Contratos acordados con proveedores y contratistas ({config.suppliers.length})
          </span>
        }
        description="El agente compara cada factura contra estos contratos: verifica NIT/ID fiscal (Regla #4), moneda pactada (Regla #7), cuenta bancaria registrada (Regla #8) e importe acordado fijo o tope (Regla #10)."
        action={
          <Button size="sm" onClick={() => setSupplierDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            Nuevo contrato
          </Button>
        }
        bodyClassName="p-0"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">Proveedor / Contratista</th>
                <th className="px-4 py-3 font-medium">ID Fiscal / País</th>
                <th className="px-4 py-3 font-medium">Acuerdo contractual</th>
                <th className="px-4 py-3 font-medium">Cuenta bancaria autorizada</th>
                <th className="px-4 py-3 font-medium">Concepto</th>
                <th className="px-4 py-3 text-right font-medium">Acción</th>
              </tr>
            </thead>
            <tbody>
              {config.suppliers.map((s) => (
                <tr key={s.name} className="border-b border-border/70 last:border-0">
                  <td className="px-4 py-3 font-medium">{s.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {s.taxId} · <span className="font-semibold text-foreground">{s.country}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium">
                      {s.contract.type === "fixed"
                        ? `Fijo (±${policy.contractTolerancePct}%)`
                        : "Tope máx."}
                    </span>{" "}
                    <span className="tabular font-medium">
                      {formatMoney({ amountMinor: s.contract.amountMinor, currency: s.currency })}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{s.bankAccount}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{s.concept}</td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-muted-foreground hover:text-destructive"
                      onClick={() => removeSupplierContract(s.name)}
                      aria-label={`Eliminar contrato de ${s.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
              {config.suppliers.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-sm text-muted-foreground">
                    No hay contratos registrados. Añade un proveedor para validar montos pactados y
                    cuentas bancarias.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel title="Tema">
          <RadioGroup
            value={theme}
            onValueChange={(v) => setTheme(v as "light" | "dark")}
            className="grid gap-2"
          >
            {(
              [
                ["light", "Claro"],
                ["dark", "Oscuro"],
              ] as const
            ).map(([v, l]) => (
              <label
                key={v}
                className="flex h-11 items-center gap-3 rounded-md border border-border px-3 text-sm has-[[data-state=checked]]:border-secondary"
              >
                <RadioGroupItem value={v} /> {l}
              </label>
            ))}
          </RadioGroup>
          <p className="mt-2 text-xs text-muted-foreground">
            Se guarda en este navegador. Por defecto se usa el tema claro de Blinka.
          </p>
        </Panel>
        <Panel title="Notificaciones">
          {(
            [
              ["approvals", "Nuevas solicitudes de aprobación"],
              ["blocked", "Operaciones bloqueadas por una política"],
              ["weekly", "Resumen semanal por correo"],
            ] as const
          ).map(([k, l]) => (
            <label key={k} className="flex h-11 items-center justify-between gap-3 text-sm">
              {l}
              <Switch
                checked={notif[k]}
                onCheckedChange={(v) => setNotif({ ...notif, [k]: v })}
                aria-label={l}
              />
            </label>
          ))}
        </Panel>
        <Panel title="Almacenamiento y Sandbox">
          <p className="text-sm text-muted-foreground">
            {mode === "supabase"
              ? "Facturas, revisiones, políticas, configuración de empresa y auditoría se guardan en Supabase en tiempo real."
              : "Sin Supabase configurado: los datos se guardan solo en memoria y se pierden al recargar."}{" "}
            El agente pagador opera en modo sandbox: no se mueve dinero bancario real.
          </p>
          {mode === "memory" && (
            <Button
              variant="outline"
              className="mt-4 h-10"
              onClick={() => window.location.reload()}
            >
              <RotateCcw className="h-4 w-4" />
              Vaciar datos en memoria
            </Button>
          )}
        </Panel>
      </div>

      {/* Modal para añadir contrato de proveedor */}
      <Dialog open={supplierDialogOpen} onOpenChange={setSupplierDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Registrar contrato de proveedor</DialogTitle>
            <DialogDescription>
              Define las condiciones acordadas con el proveedor o contratista para que el agente
              valide automáticamente sus facturas.
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
                <Label htmlFor="s-bank">Cuenta bancaria registrada</Label>
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
              <Button type="submit">Guardar contrato</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
