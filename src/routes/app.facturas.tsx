import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { FileText, Search, Upload, AlertTriangle, ScanText, Loader2, MailPlus } from "lucide-react";
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
import { EmptyState, NoMoneyNotice, PageHeader, Panel, SimBadge } from "@/components/tg/primitives";
import { SubjectTable } from "@/components/tg/subject-table";
import { DecisionSheet } from "@/components/tg/decision-detail";
import { useTokenGate } from "@/lib/tokengate/store";
import { formatDate, parseToMinor } from "@/lib/tokengate/format";
import { statusMeta } from "@/lib/tokengate/status";
import type { Category, Currency, DisplayStatus, Invoice } from "@/lib/tokengate/types";

const ALL_CURRENCIES: Currency[] = ["USD", "COP", "MXN", "BRL", "ARS", "EUR"];

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
        content: "Facturas gestionadas por tus agentes, con extracción y decisión explicada.",
      },
      { property: "og:title", content: "Facturas — blinka" },
      { property: "og:description", content: "Busca, filtra y revisa cada factura y su decisión." },
    ],
  }),
  component: Facturas,
});

const PAGE = 8;

function Facturas() {
  const { evaluatedInvoices, byId, seed, receiveInvoice } = useTokenGate();
  const agents = seed.agents;
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/app/facturas" });
  const [q, setQ] = useState(search.q ?? "");
  const [status, setStatus] = useState<"all" | DisplayStatus>("all");
  const [agent, setAgent] = useState("all");
  const [currency, setCurrency] = useState<"all" | Currency>("all");
  const [sort, setSort] = useState<"due_desc" | "due_asc" | "amount_desc">("due_desc");
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<string | null>(null);

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    const list = evaluatedInvoices.filter((e) => {
      const s = e.subject;
      return (
        (!t || s.reference.toLowerCase().includes(t) || s.supplier.toLowerCase().includes(t)) &&
        (status === "all" || e.status === status) &&
        (agent === "all" || s.agentId === agent) &&
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
  }, [evaluatedInvoices, q, status, agent, currency, sort]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const visible = rows.slice(page * PAGE, page * PAGE + PAGE);
  const reset = () => {
    setQ("");
    setStatus("all");
    setAgent("all");
    setCurrency("all");
    setPage(0);
  };

  return (
    <>
      <PageHeader
        title="Facturas"
        subtitle="Llegan por correo, PDF, imagen o chat. El agente lee cada una y decide: autorizar, bloquear o escalar."
        eyebrow={`Bandeja · ${seed.inbox}`}
        actions={
          <>
            <Button
              variant="outline"
              className="h-10"
              onClick={() => {
                receiveInvoice();
                toast.success("Correo nuevo recibido: el agente ya lo evaluó (simulado).");
              }}
            >
              <MailPlus className="h-4 w-4" />
              Simular correo entrante
            </Button>
            <Button className="h-10" onClick={() => navigate({ search: { upload: true } })}>
              <Upload className="h-4 w-4" />
              Cargar factura
            </Button>
          </>
        }
      />

      <Panel
        bodyClassName="p-0"
        title={
          <span className="flex items-center gap-2">
            {rows.length} facturas <SimBadge />
          </span>
        }
      >
        <div className="grid gap-2 border-b border-border p-3 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto_auto_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(0);
              }}
              placeholder="Buscar por factura o proveedor"
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
            <SelectTrigger className="h-10 lg:w-44" aria-label="Estado">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              {(Object.keys(statusMeta) as DisplayStatus[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {statusMeta[k].short}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={agent}
            onValueChange={(v) => {
              setAgent(v);
              setPage(0);
            }}
          >
            <SelectTrigger className="h-10 lg:w-40" aria-label="Agente">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los agentes</SelectItem>
              {agents.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
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
            <SelectTrigger className="h-10 lg:w-32" aria-label="Moneda">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {ALL_CURRENCIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
            <SelectTrigger className="h-10 lg:w-48" aria-label="Ordenar">
              <SelectValue />
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
            dateLabel="Fecha límite"
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
  const agents = seed.agents;
  const [f, setF] = useState({
    supplier: "",
    amount: "",
    currency: "USD" as Currency,
    due: "2026-10-30",
    agentId: agents[0]?.id ?? "",
    taxId: "",
    description: "",
    number: "",
    account: "",
  });
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [scanning, setScanning] = useState(false);
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
      toast.success("Datos extraídos. Revísalos antes de cargar la factura.");
    } catch {
      toast.error("No se pudo procesar el archivo. Inténtalo de nuevo.");
    } finally {
      setScanning(false);
    }
  };

  const submit = (ev: React.FormEvent) => {
    ev.preventDefault();
    const e: Partial<Record<FieldKey, string>> = {};
    const minor = parseToMinor(f.amount);
    if (!f.supplier.trim()) e.supplier = "Indica el proveedor.";
    if (minor === null || minor <= 0) e.amount = "Introduce un importe válido, por ejemplo 250,00.";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(f.due)) e.due = "Selecciona una fecha límite.";
    if (!f.description.trim()) e.description = "Añade una breve descripción.";
    setErrors(e);
    if (Object.keys(e).length || minor === null) return;
    const n = 3000 + evaluatedInvoices.length;
    const agent = agents.find((a) => a.id === f.agentId);
    const inv: Invoice = {
      id: `${seed.id}-up-${n}`,
      kind: "invoice",
      reference: `${seed.id === "andes" ? "AL" : "INV"}-2026-${n}`,
      receivedAt: now,
      channel: "upload",
      invoiceNumber: f.number.trim() || undefined,
      supplierTaxId: f.taxId.trim() || undefined,
      bankAccount: f.account.trim() || undefined,
      sender: "Carga manual",
      supplier: f.supplier.trim(),
      amount: { amountMinor: minor, currency: f.currency },
      agentId: f.agentId,
      category: (agent?.categories[0] ?? "Servicios") as Category,
      description: f.description.trim(),
      dueDate: `${f.due}T00:00:00Z`,
      issueDate: now,
      extractionConfidence: ocrUsed ? (f.taxId.trim() ? 92 : 74) : 100,
      missingFields: f.taxId.trim() ? [] : ["ID fiscal del proveedor"],
    };
    addInvoice(inv);
    toast.success(`Factura ${inv.reference} cargada y evaluada (simulación).`);
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
          <DialogTitle>Cargar factura</DialogTitle>
          <DialogDescription>
            Introduce los datos de la factura. Se evaluará con la política actual; no se realizará
            ningún pago.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-3" noValidate>
          <label className="flex min-h-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed border-input bg-muted/40 px-4 py-3 text-center text-sm hover:bg-muted focus-within:ring-2 focus-within:ring-ring">
            {scanning ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : (
              <ScanText className="h-5 w-5 text-muted-foreground" />
            )}
            <span className="font-medium">
              {scanning ? "Leyendo la factura…" : "Subir PDF o imagen para rellenar con OCR"}
            </span>
            <span className="text-xs text-muted-foreground">
              PDF, PNG, JPG o WEBP · máx. 10 MB · lectura con OCR
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
          <div className="grid gap-1.5">
            <Label htmlFor="sup">Proveedor</Label>
            <Input
              id="sup"
              value={f.supplier}
              onChange={(e) => setF({ ...f, supplier: e.target.value })}
              placeholder="Ej. AWS"
              aria-invalid={!!errors.supplier}
              aria-describedby="supplier-err"
              className="h-10"
            />
            {field("supplier")}
          </div>
          <div className="grid grid-cols-[1fr_110px] gap-2">
            <div className="grid gap-1.5">
              <Label htmlFor="amt">Importe</Label>
              <Input
                id="amt"
                inputMode="decimal"
                value={f.amount}
                onChange={(e) => setF({ ...f, amount: e.target.value })}
                placeholder="250,00"
                aria-invalid={!!errors.amount}
                aria-describedby="amount-err"
                className="h-10"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Moneda</Label>
              <Select
                value={f.currency}
                onValueChange={(v) => setF({ ...f, currency: v as Currency })}
              >
                <SelectTrigger className="h-10" aria-label="Moneda">
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
          </div>
          {field("amount")}
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="due">Fecha límite</Label>
              <Input
                id="due"
                type="date"
                value={f.due}
                onChange={(e) => setF({ ...f, due: e.target.value })}
                className="h-10"
              />
              {field("due")}
            </div>
            <div className="grid gap-1.5">
              <Label>Agente</Label>
              <Select value={f.agentId} onValueChange={(v) => setF({ ...f, agentId: v })}>
                <SelectTrigger className="h-10" aria-label="Agente">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="tax">
              ID fiscal del proveedor{" "}
              <span className="font-normal text-muted-foreground">
                (si falta, se pedirá información)
              </span>
            </Label>
            <Input
              id="tax"
              value={f.taxId}
              onChange={(e) => setF({ ...f, taxId: e.target.value })}
              placeholder="Ej. NIT 901234567-1"
              className="h-10"
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="num">Número de factura</Label>
              <Input
                id="num"
                value={f.number}
                onChange={(e) => setF({ ...f, number: e.target.value })}
                placeholder="Ej. CN-2026-10"
                className="h-10"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="acc">Cuenta destino</Label>
              <Input
                id="acc"
                value={f.account}
                onChange={(e) => setF({ ...f, account: e.target.value })}
                placeholder="Ej. Davivienda ****7710"
                className="h-10"
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="desc">Descripción</Label>
            <Textarea
              id="desc"
              value={f.description}
              onChange={(e) => setF({ ...f, description: e.target.value })}
              aria-invalid={!!errors.description}
            />
            {field("description")}
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={scanning}>
              Cargar y evaluar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
