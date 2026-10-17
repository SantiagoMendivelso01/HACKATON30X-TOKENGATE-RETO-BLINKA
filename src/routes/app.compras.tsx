import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ShoppingCart } from "lucide-react";
import { EmptyState, NoMoneyNotice, PageHeader, Panel } from "@/components/tg/primitives";
import { SubjectTable } from "@/components/tg/subject-table";
import { DecisionSheet } from "@/components/tg/decision-detail";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTokenGate } from "@/lib/tokengate/store";
import { needsAttention } from "@/lib/tokengate/status";

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

function Compras() {
  const { evaluatedPurchases } = useTokenGate();
  const [open, setOpen] = useState<string | null>(null);
  const [tab, setTab] = useState("all");
  const rows = evaluatedPurchases.filter(
    (e) =>
      tab === "all" || (tab === "pending" ? needsAttention(e.status) : !needsAttention(e.status)),
  );

  return (
    <>
      <PageHeader
        title="Compras"
        subtitle="Solicitudes de productos y servicios que tus agentes quieren contratar."
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
    </>
  );
}
