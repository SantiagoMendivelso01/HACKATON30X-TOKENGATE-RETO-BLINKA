import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ShoppingCart, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { EmptyState, NoMoneyNotice, PageHeader, Panel } from "@/components/tg/primitives";
import { SubjectTable } from "@/components/tg/subject-table";
import { DecisionSheet } from "@/components/tg/decision-detail";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTokenGate } from "@/lib/tokengate/store";
import { parseToMinor } from "@/lib/tokengate/format";
import { needsAttention } from "@/lib/tokengate/status";
import type { Category, Currency, Purchase } from "@/lib/tokengate/types";

export const Route = createFileRoute("/app/compras")({
  head: () => ({
    meta: [
      { title: "Compras — blinka" },
      { name: "description", content: "Solicitudes de compra enviadas por tus agentes." },
      { property: "og:title", content: "Compras — blinka" },
      {
        property: "og:description",
        content: "Revisa, aprueba, bloquea o escala solicitudes de compra.",
      },
    ],
  }),
  component: Compras,
});

const ALL_CURRENCIES: Currency[] = ["USD", "COP", "MXN", "BRL", "ARS", "EUR"];

function Compras() {
  const { evaluatedPurchases, addPurchase, seed, now } = useTokenGate();
  const agents = seed.agents;
  const [open, setOpen] = useState<string | null>(null);
  const [tab, setTab] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    supplier: "",
    amount: "",
    currency: "USD" as Currency,
    agentId: agents[0]?.id ?? "",
    budgetLine: "Infraestructura · Nube",
    description: "",
  });

  const rows = evaluatedPurchases.filter(
    (e) =>
      tab === "all" || (tab === "pending" ? needsAttention(e.status) : !needsAttention(e.status)),
  );

  const submitPurchase = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!form.supplier.trim() || !form.description.trim()) {
      toast.error("Completa proveedor y descripción de la compra.");
      return;
    }
    const minor = parseToMinor(form.amount);
    if (minor === null || minor <= 0) {
      toast.error("Introduce un importe válido.");
      return;
    }
    const n = 200 + evaluatedPurchases.length + 1;
    const agent = agents.find((a) => a.id === form.agentId);
    const pr: Purchase = {
      id: `${seed.id}-pr-${n}`,
      kind: "purchase",
      reference: `PR-${n}`,
      supplier: form.supplier.trim(),
      amount: { amountMinor: minor, currency: form.currency },
      agentId: form.agentId || (agents[0]?.id ?? "ag-cloud"),
      category: (agent?.categories[0] ?? "Software") as Category,
      description: form.description.trim(),
      budgetLine: form.budgetLine.trim() || "General",
      missingFields: [],
      receivedAt: now,
      requestedAt: now,
      channel: "agent",
    };
    setSaving(true);
    const saved = await addPurchase(pr);
    setSaving(false);
    if (!saved) return;
    toast.success(`Solicitud de compra ${pr.reference} evaluada por el motor.`);
    setDialogOpen(false);
    setForm({ ...form, supplier: "", amount: "", description: "" });
    setOpen(pr.id);
  };

  return (
    <>
      <PageHeader
        title="Compras"
        subtitle="Solicitudes de productos y servicios que tus agentes quieren contratar."
        actions={
          <Button className="h-10" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            Nueva solicitud de compra
          </Button>
        }
      />
      <Tabs value={tab} onValueChange={setTab} className="mb-3">
        <TabsList>
          <TabsTrigger value="all">Todas</TabsTrigger>
          <TabsTrigger value="pending">Pendientes</TabsTrigger>
          <TabsTrigger value="resolved">Resueltas</TabsTrigger>
        </TabsList>
      </Tabs>
      <Panel
        bodyClassName="p-0"
        title={<span className="flex items-center gap-2">Solicitudes de compra</span>}
        description="Abre una solicitud para revisarla, aprobarla, rechazarla o pedir información."
      >
        {rows.length ? (
          <SubjectTable
            rows={rows}
            onOpen={setOpen}
            referenceLabel="Solicitud"
            dateLabel="Solicitada"
            columns={[
              "reference",
              "description",
              "agent",
              "supplier",
              "amount",
              "budget",
              "status",
            ]}
          />
        ) : (
          <EmptyState
            icon={ShoppingCart}
            title="No hay solicitudes aquí"
            text="Cuando un agente solicite una compra aparecerá en esta lista."
          />
        )}
      </Panel>
      <NoMoneyNotice className="mt-4" />
      <DecisionSheet subjectId={open} onClose={() => setOpen(null)} />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Simular solicitud de compra de un agente</DialogTitle>
            <DialogDescription>
              El agente solicita adquirir un servicio o herramienta; el motor evalúa si cumple las
              reglas de la empresa.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitPurchase} className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="pr-sup">Proveedor</Label>
              <Input
                id="pr-sup"
                value={form.supplier}
                onChange={(e) => setForm({ ...form, supplier: e.target.value })}
                placeholder="Ej. AWS, Linear, HubSpot"
                className="h-10"
              />
            </div>
            <div className="grid grid-cols-[1fr_110px] gap-2">
              <div className="grid gap-1.5">
                <Label htmlFor="pr-amt">Importe</Label>
                <Input
                  id="pr-amt"
                  inputMode="decimal"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="420.00"
                  className="h-10"
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Moneda</Label>
                <Select
                  value={form.currency}
                  onValueChange={(v) => setForm({ ...form, currency: v as Currency })}
                >
                  <SelectTrigger className="h-10">
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
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label>Agente solicitante</Label>
                <Select
                  value={form.agentId}
                  onValueChange={(v) => setForm({ ...form, agentId: v })}
                >
                  <SelectTrigger className="h-10">
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
              <div className="grid gap-1.5">
                <Label htmlFor="pr-line">Línea presupuestaria</Label>
                <Input
                  id="pr-line"
                  value={form.budgetLine}
                  onChange={(e) => setForm({ ...form, budgetLine: e.target.value })}
                  placeholder="Ej. Infraestructura · Nube"
                  className="h-10"
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pr-desc">Descripción</Label>
              <Textarea
                id="pr-desc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Ej. Instancia GPU para pruebas del modelo de extracción"
              />
            </div>
            <DialogFooter className="mt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                Enviar solicitud
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
