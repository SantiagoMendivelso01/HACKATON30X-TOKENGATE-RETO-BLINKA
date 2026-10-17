import { MoreHorizontal, Eye, History } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { agentName, type EvaluatedSubject } from "@/lib/tokengate/store";
import { formatBase, formatDate, formatDateTime, formatMoney } from "@/lib/tokengate/format";
import { ChannelIcon, Money, StatusBadge } from "./primitives";

type Col =
  "reference" | "supplier" | "agent" | "amount" | "date" | "status" | "description" | "budget";

const headers: Record<Col, string> = {
  reference: "Referencia",
  supplier: "Proveedor",
  agent: "Agente",
  amount: "Importe",
  date: "Fecha",
  status: "Estado",
  description: "Descripción",
  budget: "Presupuesto",
};

function dateOf(e: EvaluatedSubject) {
  const s = e.subject;
  return s.kind === "invoice" ? formatDate(s.dueDate) : formatDateTime(s.requestedAt);
}

export function SubjectTable({
  rows,
  onOpen,
  columns = ["reference", "supplier", "description", "amount", "date", "status"],
  dateLabel,
  referenceLabel,
}: {
  rows: EvaluatedSubject[];
  onOpen: (id: string) => void;
  columns?: Col[];
  dateLabel?: string;
  referenceLabel?: string;
}) {
  const label = (c: Col) =>
    (c === "date" && dateLabel) || (c === "reference" && referenceLabel) || headers[c];
  const cell = (e: EvaluatedSubject, c: Col) => {
    const s = e.subject;
    switch (c) {
      case "reference":
        return (
          <span className="whitespace-nowrap font-mono text-xs font-medium">{s.reference}</span>
        );
      case "supplier":
        return (
          <span className="flex min-w-0 items-center gap-3">
            <ChannelIcon channel={s.channel} />
            <span className="min-w-0">
              <span className="block truncate font-medium">{s.supplier}</span>
            </span>
          </span>
        );
      case "agent":
        return <span className="text-muted-foreground">{agentName(s.agentId)}</span>;
      case "amount":
        return (
          <span className="flex flex-col items-end">
            <Money value={s.amount} className="text-[15px] font-medium" />
            {s.amount.currency !== "USD" && (
              <span className="tabular text-xs text-muted-foreground">
                ≈ {formatBase(e.baseMinor)}
              </span>
            )}
          </span>
        );
      case "date":
        return <span className="tabular text-muted-foreground">{dateOf(e)}</span>;
      case "status":
        return <StatusBadge status={e.status} />;
      case "description":
        return <span className="line-clamp-1">{s.description}</span>;
      case "budget":
        return (
          <span className="text-muted-foreground">
            {s.kind === "purchase" ? s.budgetLine : s.category}
          </span>
        );
    }
  };

  const menu = (e: EvaluatedSubject) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          aria-label={`Acciones para ${e.subject.reference}`}
          onClick={(ev) => ev.stopPropagation()}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(ev) => ev.stopPropagation()}>
        <DropdownMenuItem onSelect={() => onOpen(e.subject.id)}>
          <Eye className="h-4 w-4" />
          Ver decisión
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/app/decisiones" search={{ q: e.subject.reference }}>
            <History className="h-4 w-4" />
            Ver historial
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <>
      {/* Desktop/tablet table */}
      <div className="relative hidden overflow-x-auto md:block">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              {columns.map((c) => (
                <th
                  key={c}
                  scope="col"
                  className={`px-5 py-3 font-medium ${c === "amount" ? "text-right" : ""}`}
                >
                  {label(c)}
                </th>
              ))}
              <th scope="col" className="px-2 py-2.5">
                <span className="sr-only">Acción</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr
                key={e.subject.id}
                tabIndex={0}
                onClick={() => onOpen(e.subject.id)}
                onKeyDown={(ev) => ev.key === "Enter" && onOpen(e.subject.id)}
                className="cursor-pointer border-b border-border/70 transition-colors last:border-0 hover:bg-background/70 focus-visible:bg-muted focus-visible:outline-none"
              >
                {columns.map((c) => (
                  <td
                    key={c}
                    className={`px-5 py-3 align-middle ${c === "amount" ? "text-right" : ""}`}
                  >
                    {cell(e, c)}
                  </td>
                ))}
                <td className="px-2 py-1 text-right">{menu(e)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Mobile condensed rows */}
      <ul className="divide-y divide-border md:hidden">
        {rows.map((e) => (
          <li key={e.subject.id} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpen(e.subject.id)}
              className="flex min-h-14 min-w-0 flex-1 flex-col gap-1 px-4 py-3 text-left focus-visible:bg-muted focus-visible:outline-none"
            >
              <span className="flex w-full items-center justify-between gap-2">
                <span className="truncate text-sm font-medium">{e.subject.supplier}</span>
                <span className="tabular shrink-0 text-sm font-medium">
                  {formatMoney(e.subject.amount)}
                </span>
              </span>
              <span className="flex w-full items-center justify-between gap-2">
                <span className="truncate font-mono text-xs text-muted-foreground">
                  {e.subject.reference} · {dateOf(e)}
                </span>
                <StatusBadge status={e.status} />
              </span>
            </button>
            <div className="pr-2">{menu(e)}</div>
          </li>
        ))}
      </ul>
    </>
  );
}
