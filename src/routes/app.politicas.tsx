import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Save, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, Panel, Term } from "@/components/tg/primitives";
import { useTokenGate } from "@/lib/tokengate/store";
import { minorToInput, parseToMinor } from "@/lib/tokengate/format";
import type { Currency, Policy } from "@/lib/tokengate/types";

export const Route = createFileRoute("/app/politicas")({
  head: () => ({
    meta: [
      { title: "Políticas de gasto — TokenGate" },
      { name: "description", content: "Define límites, presupuestos, proveedores y umbrales de aprobación." },
      { property: "og:title", content: "Políticas de gasto — TokenGate" },
      { property: "og:description", content: "Las reglas que tus agentes siempre respetan." },
    ],
  }),
  component: Politicas,
});

const CURRENCIES: Currency[] = ["USD", "EUR", "COP"];
type AmountKey = "transactionLimit" | "monthlyBudget" | "approvalThreshold";

function Politicas() {
  const { policy, savePolicy } = useTokenGate();
  const toForm = (p: Policy) => {
    const amt = (k: AmountKey) => ({ USD: minorToInput(p[k].USD), EUR: minorToInput(p[k].EUR), COP: minorToInput(p[k].COP) });
    return { transactionLimit: amt("transactionLimit"), monthlyBudget: amt("monthlyBudget"), approvalThreshold: amt("approvalThreshold"), suppliers: p.approvedSuppliers, currencies: p.allowedCurrencies, duplicateAction: p.duplicateAction, missingInfoAction: p.missingInfoAction };
  };
  const [f, setF] = useState(() => toForm(policy));
  const [newSupplier, setNewSupplier] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const setAmt = (k: AmountKey, c: Currency, v: string) => setF({ ...f, [k]: { ...f[k], [c]: v } });

  const save = (ev: React.FormEvent) => {
    ev.preventDefault();
    const e: Record<string, string> = {};
    const parsed = {} as Record<AmountKey, Record<Currency, number>>;
    (["transactionLimit", "monthlyBudget", "approvalThreshold"] as AmountKey[]).forEach((k) => {
      parsed[k] = { USD: 0, EUR: 0, COP: 0 };
      CURRENCIES.forEach((c) => {
        const m = parseToMinor(f[k][c]);
        if (m === null || m <= 0) e[`${k}.${c}`] = "Importe no válido.";
        else parsed[k][c] = m;
      });
    });
    CURRENCIES.forEach((c) => {
      if (!e[`approvalThreshold.${c}`] && !e[`transactionLimit.${c}`] && parsed.approvalThreshold[c] > parsed.transactionLimit[c])
        e[`approvalThreshold.${c}`] = "El umbral no puede superar el límite por transacción.";
      if (!e[`monthlyBudget.${c}`] && !e[`transactionLimit.${c}`] && parsed.transactionLimit[c] > parsed.monthlyBudget[c])
        e[`transactionLimit.${c}`] = "El límite no puede superar el presupuesto mensual.";
    });
    if (f.currencies.length === 0) e["currencies"] = "Selecciona al menos una moneda.";
    if (f.suppliers.length === 0) e["suppliers"] = "Añade al menos un proveedor aprobado.";
    setErrors(e);
    if (Object.keys(e).length) {
      toast.error("Revisa los campos marcados antes de guardar.");
      return;
    }
    savePolicy(
      { ...policy, ...parsed, approvedSuppliers: f.suppliers, allowedCurrencies: f.currencies, duplicateAction: f.duplicateAction, missingInfoAction: f.missingInfoAction },
      "Política editada desde Políticas de gasto.",
    );
    toast.success("Política guardada. Las decisiones se han recalculado con la nueva versión.");
  };

  const amountRow = (k: AmountKey, label: React.ReactNode) => (
    <div className="grid gap-2 sm:grid-cols-[1fr_160px_160px_160px] sm:items-start">
      <div className="pt-2 text-sm font-medium">{label}</div>
      {CURRENCIES.map((c) => (
        <div key={c} className="grid gap-1">
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">{c}</span>
            <Input inputMode="decimal" aria-label={`${typeof label === "string" ? label : k} en ${c}`} value={f[k][c]} onChange={(e) => setAmt(k, c, e.target.value)} aria-invalid={!!errors[`${k}.${c}`]} className="tabular h-10 pl-12" />
          </div>
          {errors[`${k}.${c}`] && <p className="text-xs text-destructive">{errors[`${k}.${c}`]}</p>}
        </div>
      ))}
    </div>
  );

  return (
    <form onSubmit={save} noValidate>
      <PageHeader
        title="Políticas de gasto"
        subtitle={`Versión activa ${policy.version}. Los cambios se aplican a todas las evaluaciones.`}
        actions={<Button type="submit" className="h-10"><Save className="h-4 w-4" />Guardar cambios</Button>}
      />
      <div className="grid gap-4">
        <Panel title="Límites e importes" description="Valores exactos con dos decimales. Ejemplo: 1.000,00">
          <div className="space-y-3">
            {amountRow("transactionLimit", <Term hint="Importe máximo que un agente puede autorizar en una sola operación. Por encima, se bloquea.">Límite por transacción</Term>)}
            {amountRow("monthlyBudget", "Presupuesto mensual")}
            {amountRow("approvalThreshold", <Term hint="Por encima de este importe, la operación se escala a una persona aunque cumpla el resto de reglas.">Umbral de aprobación humana</Term>)}
          </div>
        </Panel>

        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Proveedores aprobados" description="Solo estos proveedores pueden recibir autorizaciones automáticas.">
            <div className="flex flex-wrap gap-1.5">
              {f.suppliers.map((s) => (
                <span key={s} className="inline-flex items-center gap-1 rounded border border-border bg-background py-0.5 pl-2 pr-0.5 text-sm">
                  {s}
                  <button type="button" onClick={() => setF({ ...f, suppliers: f.suppliers.filter((x) => x !== s) })} className="rounded p-1 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Quitar ${s}`}><X className="h-3 w-3" /></button>
                </span>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <Input value={newSupplier} onChange={(e) => setNewSupplier(e.target.value)} placeholder="Nombre del proveedor" className="h-10" aria-label="Nuevo proveedor"
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); (e.currentTarget.nextElementSibling as HTMLButtonElement | null)?.click(); } }} />
              <Button type="button" variant="outline" className="h-10" onClick={() => {
                const v = newSupplier.trim();
                if (v && !f.suppliers.includes(v)) setF({ ...f, suppliers: [...f.suppliers, v] });
                setNewSupplier("");
              }}><Plus className="h-4 w-4" />Añadir</Button>
            </div>
            {errors["suppliers"] && <p className="mt-2 text-xs text-destructive">{errors["suppliers"]}</p>}
          </Panel>

          <Panel title="Monedas y reglas adicionales">
            <fieldset>
              <legend className="text-sm font-medium">Monedas permitidas</legend>
              <div className="mt-2 flex gap-4">
                {CURRENCIES.map((c) => (
                  <label key={c} className="flex h-10 items-center gap-2 text-sm">
                    <Checkbox checked={f.currencies.includes(c)} onCheckedChange={(v) => setF({ ...f, currencies: v ? [...f.currencies, c] : f.currencies.filter((x) => x !== c) })} />
                    {c}
                  </label>
                ))}
              </div>
              {errors["currencies"] && <p className="text-xs text-destructive">{errors["currencies"]}</p>}
            </fieldset>
            <div className="mt-4 grid gap-1.5">
              <Label>Posibles facturas duplicadas</Label>
              <Select value={f.duplicateAction} onValueChange={(v) => setF({ ...f, duplicateAction: v as Policy["duplicateAction"] })}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="review">Enviar a revisión humana</SelectItem>
                  <SelectItem value="block">Bloquear automáticamente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="mt-4 grid gap-1.5">
              <Label>Si falta información obligatoria</Label>
              <Select value={f.missingInfoAction} onValueChange={(v) => setF({ ...f, missingInfoAction: v as Policy["missingInfoAction"] })}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="request_information">Solicitar información</SelectItem>
                  <SelectItem value="block">Bloquear</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </Panel>
        </div>
        <p className="text-xs text-muted-foreground">La validación en el navegador es orientativa; los límites deberán aplicarse también en un backend de confianza.</p>
      </div>
    </form>
  );
}
