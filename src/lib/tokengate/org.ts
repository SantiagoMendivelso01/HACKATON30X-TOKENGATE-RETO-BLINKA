// The organization the app runs for. Placeholders until the company/auth integration fills them.
import type { OrgSeed } from "./types";

const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];
const today = new Date();

export const ORG: OrgSeed = {
  id: "org",
  name: "Mi empresa",
  jurisdiction: "Sin configurar",
  period: `${MESES[today.getMonth()]} ${today.getFullYear()}`,
  inbox: "",
  user: { name: "Finanzas", role: "Finanzas", initials: "FI" },
  fx: { USD: 1 },
  baselineUsedMinor: 0,
  policy: {
    version: "v1.0",
    baseCurrency: "USD",
    transactionLimit: 1_500_000,
    monthlyBudget: 6_500_000,
    approvalThreshold: 300_000,
    approvedSuppliers: [],
    allowedCurrencies: ["USD"],
    duplicateAction: "review",
    missingInfoAction: "request_information",
    newSupplierAction: "review",
    contractTolerancePct: 5,
    duplicateWindowDays: 30,
    splitWindowDays: 7,
    minConfidence: 85,
    budgetAlertPct: 20,
  },
  suppliers: [],
  agents: [],
};
