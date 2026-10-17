// Simulated demo data. No record here represents a real payment or transfer.
import type { Money, Agent, AuditEvent, BudgetUsage, Category, Invoice, Policy, Purchase } from "./types";

const usd = (major: number) => ({ amountMinor: Math.round(major * 100), currency: "USD" as const });
const eur = (major: number) => ({ amountMinor: Math.round(major * 100), currency: "EUR" as const });
const cop = (major: number) => ({ amountMinor: Math.round(major * 100), currency: "COP" as const });

export const ORG_NAME = "Acme Studio";
export const CURRENT_USER = "Laura Gómez";

export const initialPolicy: Policy = {
  version: "v3.2",
  transactionLimit: { USD: 100000, EUR: 90000, COP: 400000000 },
  monthlyBudget: { USD: 1200000, EUR: 300000, COP: 4800000000 },
  approvalThreshold: { USD: 30000, EUR: 30000, COP: 120000000 },
  approvedSuppliers: ["Linear", "AWS", "Figma", "Notion", "HubSpot", "Vercel", "DHL", "Slack", "Google Workspace"],
  allowedCurrencies: ["USD", "EUR", "COP"],
  duplicateAction: "review",
  missingInfoAction: "request_information",
};

/** Amounts already committed this month before the records below. */
export const baselineUsage: BudgetUsage = { USD: 842000, EUR: 51000, COP: 96250000 };

export const agents: Agent[] = [
  { id: "ag-saas", name: "Compras SaaS", purpose: "Renueva y contrata herramientas de software.", status: "active", categories: ["Software"], spendingLimit: usd(1000), policyIds: ["Límite por transacción", "Proveedores aprobados", "Umbral de aprobación"] },
  { id: "ag-infra", name: "Infraestructura", purpose: "Gestiona facturas de nube y servidores.", status: "active", categories: ["Infraestructura"], spendingLimit: usd(1000), policyIds: ["Límite por transacción", "Presupuesto mensual"] },
  { id: "ag-ops", name: "Operaciones", purpose: "Logística, envíos y suministros de oficina.", status: "active", categories: ["Operaciones", "Servicios"], spendingLimit: eur(900), policyIds: ["Proveedores aprobados", "Duplicados"] },
  { id: "ag-design", name: "Diseño", purpose: "Licencias y recursos para el equipo de diseño.", status: "active", categories: ["Diseño", "Software"], spendingLimit: usd(500), policyIds: ["Límite por transacción"] },
  { id: "ag-mkt", name: "Marketing", purpose: "Herramientas y campañas de marketing.", status: "paused", categories: ["Marketing"], spendingLimit: usd(800), policyIds: ["Umbral de aprobación", "Presupuesto mensual"] },
];

type InvoiceSeed = [string, string, string, Category, Money, string, string, number, string[]?];
const invoiceSeeds: InvoiceSeed[] = [
  ["1032", "Google Workspace", "ag-saas", "Software", usd(72), "2026-10-02", "Licencias de correo y documentos, octubre.", 98],
  ["1033", "Vercel", "ag-infra", "Infraestructura", usd(240), "2026-10-05", "Plan Pro, alojamiento web.", 97],
  ["1034", "Slack", "ag-saas", "Software", usd(1450), "2026-10-08", "Renovación anual Business+.", 95],
  ["1035", "DHL", "ag-ops", "Operaciones", eur(310), "2026-10-10", "Envíos internacionales de muestras.", 91],
  ["1036", "HubSpot", "ag-mkt", "Marketing", usd(280), "2026-10-12", "Marketing Hub Starter.", 96],
  ["1037", "Notion", "ag-saas", "Software", usd(96), "2026-10-14", "Plan Plus, 8 miembros.", 72, ["NIF del proveedor"]],
  ["1039", "Figma", "ag-design", "Diseño", usd(45), "2026-10-18", "Figma Professional, 3 editores.", 99],
  ["1040", "Proveedor desconocido", "ag-ops", "Operaciones", eur(890), "2026-10-19", "Servicios de consultoría sin contrato.", 64],
  ["1041", "AWS", "ag-infra", "Infraestructura", usd(420), "2026-10-20", "EC2 y S3, consumo septiembre.", 94],
  ["1042", "Linear", "ag-saas", "Software", usd(120), "2026-10-21", "Plan Standard, 12 usuarios.", 99],
  ["1043", "Google Workspace", "ag-saas", "Software", usd(72), "2026-10-22", "Licencias de correo y documentos, octubre.", 97],
];

export const initialInvoices: Invoice[] = invoiceSeeds.map(([n, supplier, agentId, category, amount, due, description, conf, missing]) => {
  const issue = new Date(due + "T00:00:00Z");
  issue.setUTCDate(issue.getUTCDate() - 14);
  return {
    id: `inv-${n}`,
    kind: "invoice",
    reference: `INV-2026-${n}`,
    supplier,
    agentId,
    category,
    amount,
    dueDate: `${due}T00:00:00Z`,
    issueDate: issue.toISOString(),
    description,
    extractionConfidence: conf,
    missingFields: missing ?? [],
  };
});

export const initialPurchases: Purchase[] = [
  { id: "pr-311", kind: "purchase", reference: "PR-311", supplier: "Figma", agentId: "ag-design", category: "Diseño", amount: usd(225), description: "Ampliar a 5 puestos de editor", requestedAt: "2026-10-15T09:12:00Z", budgetLine: "Diseño · Software", missingFields: [] },
  { id: "pr-312", kind: "purchase", reference: "PR-312", supplier: "AWS", agentId: "ag-infra", category: "Infraestructura", amount: usd(860), description: "Instancia GPU para pruebas de modelos (1 mes)", requestedAt: "2026-10-16T14:40:00Z", budgetLine: "Infraestructura · Nube", missingFields: [] },
  { id: "pr-313", kind: "purchase", reference: "PR-313", supplier: "Papelería Central", agentId: "ag-ops", category: "Operaciones", amount: eur(140), description: "Material de oficina trimestral", requestedAt: "2026-10-16T16:05:00Z", budgetLine: "Operaciones · Oficina", missingFields: [] },
  { id: "pr-314", kind: "purchase", reference: "PR-314", supplier: "HubSpot", agentId: "ag-mkt", category: "Marketing", amount: usd(650), description: "Complemento de automatización de campañas", requestedAt: "2026-10-17T08:30:00Z", budgetLine: "Marketing · Herramientas", missingFields: [] },
  { id: "pr-315", kind: "purchase", reference: "PR-315", supplier: "Slack", agentId: "ag-saas", category: "Software", amount: usd(2400), description: "Migración a Slack Enterprise Grid", requestedAt: "2026-10-17T10:02:00Z", budgetLine: "Software · Comunicación", missingFields: [] },
  { id: "pr-316", kind: "purchase", reference: "PR-316", supplier: "Vercel", agentId: "ag-infra", category: "Infraestructura", amount: usd(180), description: "Dominio y certificados para entorno de staging", requestedAt: "2026-10-17T11:45:00Z", budgetLine: "Infraestructura · Nube", missingFields: ["Centro de coste"] },
];

export const initialAudit: AuditEvent[] = [
  { id: "au-1", at: "2026-10-01T08:00:00Z", type: "policy_change", actor: CURRENT_USER, actorKind: "human", summary: "Política actualizada a v3.2", reason: "Umbral de aprobación reducido a USD 300,00." },
  { id: "au-2", at: "2026-10-01T08:01:00Z", type: "system", actor: "TokenGate", actorKind: "system", summary: "Entorno de demostración inicializado", reason: "Datos simulados cargados." },
  { id: "au-3", at: "2026-10-09T11:20:00Z", type: "settings", actor: CURRENT_USER, actorKind: "human", summary: "Agente Marketing pausado", reason: "Revisión de presupuesto trimestral." },
];

/** Daily simulated spend for the current month, in USD minor units. */
export const spendSeries = Array.from({ length: 17 }, (_, i) => {
  const day = i + 1;
  const base = [320, 410, 180, 520, 610, 240, 150, 480, 700, 390, 260, 540, 820, 470, 300, 650, 580][i];
  const escalated = [0, 60, 0, 120, 0, 0, 40, 0, 210, 0, 0, 90, 0, 140, 0, 0, 420][i];
  return { day: `${day} oct`, autorizado: base, escalado: escalated };
});

export const categoryBreakdown: { name: Category; amountMinor: number }[] = [
  { name: "Software", amountMinor: 352000 },
  { name: "Infraestructura", amountMinor: 241000 },
  { name: "Operaciones", amountMinor: 136000 },
  { name: "Marketing", amountMinor: 71000 },
  { name: "Servicios", amountMinor: 42000 },
];
