import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  FileText,
  FlaskConical,
  Search,
  Upload,
  AlertTriangle,
  ScanText,
  Loader2,
  Sparkles,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { extractInvoice } from "@/lib/tokengate/ocr.functions";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { buildDemoCases, demoConfig, demoPolicy } from "@/lib/tokengate/demo-set";
import { EmptyState, NoMoneyNotice, PageHeader, Panel } from "@/components/tg/primitives";
import { SubjectTable } from "@/components/tg/subject-table";
import { DecisionSheet } from "@/components/tg/decision-detail";
import { useTokenGate } from "@/lib/tokengate/store";
import { formatDate, formatMoney, parseToMinor } from "@/lib/tokengate/format";
import { statusMeta } from "@/lib/tokengate/status";
import type { Category, Currency, DisplayStatus, Invoice } from "@/lib/tokengate/types";

const ALL_CURRENCIES: Currency[] = ["USD", "COP", "EUR", "MXN", "BRL", "ARS"];

type Search = { upload?: boolean | undefined; q?: string | undefined };
type FieldKey = "supplier" | "amount" | "due" | "description";

export const Route = createFileRoute("/app/facturas")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    upload: s["upload"] === true || s["upload"] === "true" ? true : undefined,
    q: typeof s["q"] === "string" ? s["q"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Facturas — blinka" },
      {
        name: "description",
        content:
          "Facturas evaluadas por el agente pagador con extracción OCR y decisión explicada.",
      },
      { property: "og:title", content: "Facturas — blinka" },
      { property: "og:description", content: "Busca, filtra y revisa cada factura y su decisión." },
    ],
  }),
  component: Facturas,
});

const PAGE = 8;

const SORT_LABEL = {
  due_desc: "Fecha límite: recientes",
  due_asc: "Fecha límite: antiguas",
  amount_desc: "Importe: mayor primero",
} as const;

const DEMO_PRESETS: {
  label: string;
  tag: string;
  supplier: string;
  amount: string;
  currency: Currency;
  taxId: string;
  account: string;
  number: string;
  description: string;
}[] = [
  {
    label: "Caso normal (Paga solo)",
    tag: "Autorizada",
    supplier: "Juliana Restrepo",
    amount: "1500.00",
    currency: "USD",
    taxId: "NIT 901234567-1",
    account: "Bancolombia ****4821",
    number: "CC-2026-109",
    description: "Honorarios desarrollo backend mensual acordado",
  },
  {
    label: "Supera límite automático",
    tag: "Pide permiso",
    supplier: "Datadog Inc.",
    amount: "2400.00",
    currency: "USD",
    taxId: "EIN 27-2825184",
    account: "JPMorgan ****3302",
    number: "DD-2026-884",
    description: "Observabilidad APM y logs de producción",
  },
  {
    label: "Beneficiario nuevo",
    tag: "Pide permiso",
    supplier: "Agencia Creativa Nómada SAS",
    amount: "650.00",
    currency: "USD",
    taxId: "NIT 901999888-2",
    account: "Davivienda ****1122",
    number: "FE-402",
    description: "Diseño de piezas gráficas para campaña Q4",
  },
  {
    label: "No cuadra con contrato",
    tag: "Frenada",
    supplier: "Juliana Restrepo",
    amount: "2950.00",
    currency: "USD",
    taxId: "NIT 901234567-1",
    account: "Bancolombia ****4821",
    number: "CC-2026-110",
    description: "Cobro mensual por encima de los $1,500 USD pactados",
  },
  {
    label: "En Euros (Conversión FX)",
    tag: "Multimoneda",
    supplier: "Stripe Inc.",
    amount: "420.00",
    currency: "EUR",
    taxId: "EIN 80-0429089",
    account: "Citi ****0912",
    number: "ST-EU-2026",
    description: "Comisiones de procesamiento internacional en Europa",
  },
];

/** Loads the fictional invoice set (src/lib/tokengate/demo-set.ts) with its suppliers and policy. */
function LoadDemoSet() {
  const { addInvoice, saveConfig, savePolicy, seed, byId } = useTokenGate();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const cases = buildDemoCases();
  const missing = cases.filter((c) => !byId.has(c.invoice.id));
  const traps = cases.filter((c) => c.trap).length;

  const load = async () => {
    setLoading(true);
    try {
      const { id: _id, policy: _policy, ...config } = seed;
      if (
        !(await saveConfig(
          demoConfig(config),
          "Set de demostración: proveedores con contrato y pagos previos del mes",
        ))
      )
        return;
      if (
        !(await savePolicy(
          demoPolicy(),
          "Set de demostración: política base con los proveedores registrados aprobados",
        ))
      )
        return;
      for (const c of missing) if (!(await addInvoice(c.invoice))) return;
      toast.success(`${missing.length} facturas del set evaluadas por el agente.`);
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        className="h-10"
        disabled={missing.length === 0}
        title={missing.length === 0 ? "El set de demostración ya está cargado" : undefined}
        onClick={() => setOpen(true)}
      >
        <FlaskConical className="h-4 w-4" />
        {missing.length === 0 ? "Set de demostración cargado" : "Cargar set de demostración"}
      </Button>
      <AlertDialog open={open} onOpenChange={(o) => !loading && setOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cargar set de demostración</AlertDialogTitle>
            <AlertDialogDescription>
              {cases.length} facturas ficticias ({cases.length - traps} normales y {traps} casos
              trampa: duplicado, proveedor nuevo, no cuadra con el contrato, monto que pide
              aprobación, presupuesto insuficiente, suplantación, cambio de cuenta, instrucciones
              escondidas y datos faltantes). También guarda la configuración del set (proveedores
              con contrato y USD 41,500 ya pagados este mes) y una nueva versión de la política
              base. Las versiones anteriores quedan en la auditoría.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={loading}
              onClick={(ev) => {
                ev.preventDefault();
                void load();
              }}
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Cargar {missing.length} facturas
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function Facturas() {
  const { evaluatedInvoices, byId, seed } = useTokenGate();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/app/facturas" });
  const [q, setQ] = useState(search.q ?? "");
  const [status, setStatus] = useState<"all" | DisplayStatus>("all");
  const [currency, setCurrency] = useState<"all" | Currency>("all");
  const [sort, setSort] = useState<"due_desc" | "due_asc" | "amount_desc">("due_desc");
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<string | null>(null);

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    const list = evaluatedInvoices.filter((e) => {
      const s = e.subject;
      return (
        (!t ||
          s.reference.toLowerCase().includes(t) ||
          s.supplier.toLowerCase().includes(t) ||
          s.description.toLowerCase().includes(t)) &&
        (status === "all" || e.status === status) &&
        (currency === "all" || s.amount.currency === currency)
      );
    });
    return [...list].sort((a, b) =>
      sort === "amount_desc"
        ? b.subject.amount.amountMinor - a.subject.amount.amountMinor
        : sort === "due_asc"
          ? a.subject.dueDate.localeCompare(b.subject.dueDate)
          : b.subject.dueDate.localeCompare(a.subject.dueDate),
    );
  }, [evaluatedInvoices, q, status, currency, sort]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const visible = rows.slice(page * PAGE, page * PAGE + PAGE);
  const reset = () => {
    setQ("");
    setStatus("all");
    setCurrency("all");
    setPage(0);
  };

  return (
    <>
      <PageHeader
        title="Facturas y Cuentas de Cobro"
        subtitle="El agente lee quién cobra, cuánto, en qué moneda y para cuándo; luego decide si pagar, frenar o pedir permiso según tus reglas."
        eyebrow={seed.inbox ? `Buzón activo · ${seed.inbox}` : "Bandeja de entrada"}
        actions={
          <>
            <LoadDemoSet />
            <Button className="h-10" onClick={() => navigate({ search: { upload: true } })}>
              <Upload className="h-4 w-4" />
              Cargar factura (OCR / Manual)
            </Button>
          </>
        }
      />

      <Panel
        bodyClassName="p-0"
        title={<span className="flex items-center gap-2">{rows.length} facturas evaluadas</span>}
      >
        <div className="grid gap-2 border-b border-border p-3 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(0);
              }}
              placeholder="Buscar por factura, proveedor o concepto…"
              className="h-10 pl-9"
              aria-label="Buscar facturas"
            />
          </div>
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v as typeof status);
              setPage(0);
            }}
          >
            <SelectTrigger className="h-10 lg:w-48" aria-label="Estado">
              <SelectValue>
                {status === "all" ? "Todas las decisiones" : statusMeta[status].short}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las decisiones</SelectItem>
              {(Object.keys(statusMeta) as DisplayStatus[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {statusMeta[k].short}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={currency}
            onValueChange={(v) => {
              setCurrency(v as typeof currency);
              setPage(0);
            }}
          >
            <SelectTrigger className="h-10 lg:w-36" aria-label="Moneda">
              <SelectValue>{currency === "all" ? "Monedas (Todas)" : currency}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Monedas (Todas)</SelectItem>
              {ALL_CURRENCIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
            <SelectTrigger className="h-10 lg:w-48" aria-label="Ordenar">
              <SelectValue>{SORT_LABEL[sort]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="due_desc">Fecha límite: recientes</SelectItem>
              <SelectItem value="due_asc">Fecha límite: antiguas</SelectItem>
              <SelectItem value="amount_desc">Importe: mayor primero</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {visible.length ? (
          <SubjectTable
            rows={visible}
            onOpen={setOpen}
            referenceLabel="Factura"
            dateLabel="Vence"
          />
        ) : (
          <EmptyState
            icon={FileText}
            title="No hay facturas con estos filtros"
            text="Prueba con otros criterios o limpia los filtros."
            action={
              <Button variant="outline" onClick={reset}>
                Limpiar filtros
              </Button>
            }
          />
        )}
        <div className="flex items-center justify-between border-t border-border px-4 py-2 text-xs text-muted-foreground">
          <span>
            Página {page + 1} de {pages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              disabled={page >= pages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              Siguiente
            </Button>
          </div>
        </div>
      </Panel>
      <NoMoneyNotice className="mt-4" />

      <DecisionSheet
        subjectId={open}
        onClose={() => setOpen(null)}
        extra={(id) => {
          const s = byId.get(id)?.subject;
          if (!s || s.kind !== "invoice") return null;
          const inv = s as Invoice;
          return (
            <section className="mb-5 rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold uppercase tracking-wide text-muted-foreground">
                  Extracción de datos
                </span>
                <span className="tabular font-medium">
                  {inv.extractionConfidence}% de confianza
                </span>
              </div>
              <Progress
                value={inv.extractionConfidence}
                className="mt-2 h-1.5"
                aria-label="Confianza de extracción"
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Emitida el {formatDate(inv.issueDate)}
              </p>
              {inv.missingFields.length > 0 ? (
                <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-warning-foreground">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Falta información: {inv.missingFields.join(", ")}
                </p>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">
                  Todos los campos obligatorios se extrajeron correctamente.
                </p>
              )}
            </section>
          );
        }}
      />
      <UploadDialog
        open={!!search.upload}
        onClose={() => navigate({ search: {} })}
        onCreated={setOpen}
      />
    </>
  );
}

function UploadDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const { addInvoice, evaluatedInvoices, seed, now } = useTokenGate();
  const [f, setF] = useState({
    supplier: "",
    amount: "",
    currency: "USD" as Currency,
    due: new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10),
    taxId: "",
    description: "",
    number: "",
    account: "",
  });
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ocrUsed, setOcrUsed] = useState(false);
  const runOcr = useServerFn(extractInvoice);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (!/^(application\/pdf|image\/(png|jpeg|webp))$/.test(file.type)) {
      toast.error("Formato no admitido. Usa PDF, PNG, JPG o WEBP.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("El archivo supera 10 MB.");
      return;
    }
    setScanning(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(String(fr.result).split(",")[1] ?? "");
        fr.onerror = () => reject(fr.error);
        fr.readAsDataURL(file);
      });
      const res = await runOcr({ data: { fileName: file.name, mimeType: file.type, base64 } });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const o = res.invoice;
      setF((prev) => ({
        ...prev,
        supplier: o.supplier ?? prev.supplier,
        amount: o.amount ?? prev.amount,
        currency: (ALL_CURRENCIES as string[]).includes(o.currency ?? "")
          ? (o.currency as Currency)
          : prev.currency,
        number: o.invoiceNumber ?? prev.number,
        due: o.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(o.dueDate) ? o.dueDate : prev.due,
        taxId: o.supplierTaxId ?? prev.taxId,
        description: o.description ?? prev.description,
      }));
      setOcrUsed(true);
      if (o.currency && !(ALL_CURRENCIES as string[]).includes(o.currency))
        toast.warning(`Moneda detectada ${o.currency}: no está soportada, revisa el campo.`);
      toast.success("Datos extraídos con Claude OCR. Revísalos antes de evaluar.");
    } catch {
      toast.error("No se pudo procesar el archivo. Inténtalo de nuevo.");
    } finally {
      setScanning(false);
    }
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const e: Partial<Record<FieldKey, string>> = {};
    const minor = parseToMinor(f.amount);
    if (!f.supplier.trim()) e.supplier = "Indica quién cobra (proveedor o contratista).";
    if (minor === null || minor <= 0) e.amount = "Introduce un importe válido, por ejemplo 250.00.";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.due)) e.due = "Selecciona una fecha límite.";
    if (!f.description.trim()) e.description = "Añade el concepto o descripción del cobro.";
    setErrors(e);
    if (Object.keys(e).length || minor === null) return;
    const n = 3000 + evaluatedInvoices.length;
    const inv: Invoice = {
      id: `${seed.id}-up-${n}`,
      kind: "invoice",
      reference: `INV-${now.slice(0, 4)}-${n}`,
      receivedAt: now,
      channel: "upload",
      invoiceNumber: f.number.trim() || undefined,
      supplierTaxId: f.taxId.trim() || undefined,
      bankAccount: f.account.trim() || undefined,
      sender: ocrUsed ? "Extracción OCR (PDF/Imagen)" : "Carga directa",
      supplier: f.supplier.trim(),
      amount: { amountMinor: minor, currency: f.currency },
      agentId: "agent-default",
      category: "Servicios" as Category,
      description: f.description.trim(),
      dueDate: `${f.due}T00:00:00Z`,
      issueDate: now,
      extractionConfidence: ocrUsed ? (f.taxId.trim() ? 94 : 78) : 100,
      missingFields: f.taxId.trim() ? [] : ["ID fiscal del proveedor"],
    };
    setSaving(true);
    const saved = await addInvoice(inv);
    setSaving(false);
    if (!saved) return;
    toast.success(`Factura ${inv.reference} evaluada por el agente.`);
    setF({ ...f, supplier: "", amount: "", taxId: "", description: "", number: "", account: "" });
    setOcrUsed(false);
    onClose();
    onCreated(inv.id);
  };

  const field = (k: FieldKey) =>
    errors[k] && (
      <p id={`${k}-err`} className="text-xs text-destructive">
        {errors[k]}
      </p>
    );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Cargar factura para que el agente decida</DialogTitle>
          <DialogDescription>
            Sube un PDF/imagen para extraer los datos con OCR, o elige un caso de prueba para ver
            cómo responde el agente.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-3" noValidate>
          <label className="flex min-h-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-primary/40 bg-primary/5 px-4 py-3 text-center text-sm hover:bg-primary/10 focus-within:ring-2 focus-within:ring-ring">
            {scanning ? (
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            ) : (
              <ScanText className="h-5 w-5 text-primary" />
            )}
            <span className="font-medium">
              {scanning
                ? "Claude está leyendo la factura…"
                : "Subir PDF o imagen para extraer con OCR"}
            </span>
            <span className="text-xs text-muted-foreground">
              Extrae proveedor, monto, moneda, NIT/EIN, fecha límite y concepto automáticamente
            </span>
            <input
              type="file"
              accept="application/pdf,image/png,image/jpeg,image/webp"
              className="sr-only"
              disabled={scanning}
              onChange={(e) => {
                void onFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>

          {/* Casos rápidos del Reto Blinka */}
          <div className="rounded-xl border border-border bg-muted/30 p-2.5">
            <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <Sparkles className="h-3 w-3 text-primary" />O rellena un caso de prueba con 1 clic:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {DEMO_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => {
                    setF((prev) => ({
                      ...prev,
                      supplier: p.supplier,
                      amount: p.amount,
                      currency: p.currency,
                      taxId: p.taxId,
                      account: p.account,
                      number: p.number,
                      description: p.description,
                    }));
                    setErrors({});
                  }}
                  className="rounded-lg border border-border bg-card px-2.5 py-1 text-left text-xs transition-colors hover:border-primary/50 hover:bg-accent"
                >
                  <span className="font-medium">{p.label}</span>{" "}
                  <span className="text-[10px] text-muted-foreground">({p.tag})</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="sup">¿A quién se le paga? (Proveedor / Contratista)</Label>
            <Input
              id="sup"
              value={f.supplier}
              onChange={(e) => setF({ ...f, supplier: e.target.value })}
              placeholder="Ej. Juliana Restrepo o AWS"
              aria-invalid={!!errors.supplier}
              aria-describedby="supplier-err"
              className="h-10"
            />
            {field("supplier")}
          </div>

          <div className="grid grid-cols-[1fr_110px_145px] gap-2">
            <div className="grid gap-1.5">
              <Label htmlFor="amt">¿Cuánto?</Label>
              <Input
                id="amt"
                inputMode="decimal"
                value={f.amount}
                onChange={(e) => setF({ ...f, amount: e.target.value })}
                placeholder="1500.00"
                aria-invalid={!!errors.amount}
                aria-describedby="amount-err"
                className="h-10 font-mono"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Moneda</Label>
              <Select
                value={f.currency}
                onValueChange={(v) => setF({ ...f, currency: v as Currency })}
              >
                <SelectTrigger className="h-10 font-mono" aria-label="Moneda">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALL_CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="due">¿Para cuándo?</Label>
              <Input
                id="due"
                type="date"
                value={f.due}
                onChange={(e) => setF({ ...f, due: e.target.value })}
                className="h-10"
              />
            </div>
          </div>
          {field("amount")}
          {field("due")}

          {f.currency !== "USD" &&
            (() => {
              const m = parseToMinor(f.amount);
              if (!m || m <= 0) return null;
              const rate = seed.fx[f.currency] ?? 1;
              const usdMinor = Math.round(m / rate);
              return (
                <p className="-mt-1 font-mono text-xs text-primary">
                  Equivalencia: {formatMoney({ amountMinor: m, currency: f.currency })} ≈{" "}
                  <b>{formatMoney({ amountMinor: usdMinor, currency: "USD" })}</b> (tasa: 1 USD ={" "}
                  {rate.toLocaleString("en-US")} {f.currency})
                </p>
              );
            })()}

          <div className="grid gap-2 sm:grid-cols-3">
            <div className="grid gap-1.5">
              <Label htmlFor="tax">ID Fiscal (NIT / EIN)</Label>
              <Input
                id="tax"
                value={f.taxId}
                onChange={(e) => setF({ ...f, taxId: e.target.value })}
                placeholder="NIT 901234567-1"
                className="h-10"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="acc">Cuenta destino</Label>
              <Input
                id="acc"
                value={f.account}
                onChange={(e) => setF({ ...f, account: e.target.value })}
                placeholder="Bancolombia ****4821"
                className="h-10"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="num">N.º de factura</Label>
              <Input
                id="num"
                value={f.number}
                onChange={(e) => setF({ ...f, number: e.target.value })}
                placeholder="INV-2026-10"
                className="h-10"
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="desc">Concepto / Descripción</Label>
            <Textarea
              id="desc"
              value={f.description}
              onChange={(e) => setF({ ...f, description: e.target.value })}
              placeholder="Ej. Desarrollo backend mensual acordado"
              aria-invalid={!!errors.description}
              className="min-h-16"
            />
            {field("description")}
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={scanning || saving}>
              Evaluar con el agente
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
