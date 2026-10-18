// Configuración inicial de la organización (empresa en EE. UU. con operación y proveedores en LatAm).
// Todos estos valores se pueden editar y guardar desde Ajustes, Agentes y Políticas.
import type { Agent, OrgSeed, Supplier } from "./types";

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
const usd = (major: number) => ({ amountMinor: Math.round(major * 100), currency: "USD" as const });

export const DEFAULT_SUPPLIERS: Supplier[] = [
  {
    name: "AWS",
    taxId: "EIN 91-1996405",
    country: "US",
    currency: "USD",
    contract: { type: "cap", amountMinor: 250_000 }, // Tope USD 2,500
    bankAccount: "JPMorgan Chase ****4102",
    concept: "Infraestructura cloud y cómputo",
  },
  {
    name: "Linear",
    taxId: "EIN 83-4019281",
    country: "US",
    currency: "USD",
    contract: { type: "fixed", amountMinor: 9_600 }, // USD 96 fijo
    bankAccount: "Silicon Valley Bank ****8820",
    concept: "Licencias de gestión de producto",
  },
  {
    name: "Código Norte S.A.S.",
    taxId: "NIT 901234567-1",
    country: "CO",
    currency: "USD",
    contract: { type: "fixed", amountMinor: 280_000 }, // USD 2,800 fijo
    bankAccount: "Davivienda ****7710",
    concept: "Desarrollo backend (retainer mensual)",
  },
  {
    name: "Juliana Restrepo",
    taxId: "CC 1020456789",
    country: "CO",
    currency: "COP",
    contract: { type: "fixed", amountMinor: 996_000_000 }, // COP 9.960.000 (~USD 2,400)
    bankAccount: "Bancolombia ****4821",
    concept: "Diseño UX/UI mensual",
  },
  {
    name: "Nube Azteca S.A. de C.V.",
    taxId: "RFC NAZ190312K45",
    country: "MX",
    currency: "MXN",
    contract: { type: "fixed", amountMinor: 3_640_000 }, // MXN 36,400 (~USD 2,000)
    bankAccount: "BBVA México ****3302",
    concept: "Hosting regional y soporte cloud",
  },
  {
    name: "Pereira & Costa Contabilidade Ltda.",
    taxId: "CNPJ 12345678000190",
    country: "BR",
    currency: "BRL",
    contract: { type: "fixed", amountMinor: 810_000 }, // BRL 8,100 (~USD 1,500)
    bankAccount: "Itaú ****5518",
    concept: "Contabilidad e impuestos Brasil",
  },
  {
    name: "Mateo Fernández",
    taxId: "CUIT 20-34567890-1",
    country: "AR",
    currency: "USD",
    contract: { type: "fixed", amountMinor: 180_000 }, // USD 1,800 fijo
    bankAccount: "Wise USD ****2290",
    concept: "QA manual y automatizado",
  },
  {
    name: "Lumen Legal LLC",
    taxId: "EIN 84-1234567",
    country: "US",
    currency: "USD",
    contract: { type: "cap", amountMinor: 300_000 }, // Tope USD 3,000
    bankAccount: "Chase ****9921",
    concept: "Asesoría legal corporativa",
  },
];

export const DEFAULT_AGENTS: Agent[] = [
  {
    id: "ag-contractors",
    name: "Contratistas LatAm",
    purpose: "Paga a diseñadores, desarrolladores y contratistas en la región.",
    status: "active",
    categories: ["Diseño", "Desarrollo", "Servicios"],
    spendingLimit: usd(8000),
    policyIds: [
      "Proveedores aprobados",
      "Contrato ± tolerancia",
      "Umbral de aprobación",
      "Cuenta registrada",
    ],
  },
  {
    id: "ag-cloud",
    name: "Infraestructura y nube",
    purpose: "Gestiona hosting, nube y licencias técnicas.",
    status: "active",
    categories: ["Infraestructura", "Software"],
    spendingLimit: usd(5000),
    policyIds: ["Límite por transacción", "Presupuesto mensual"],
  },
  {
    id: "ag-backoffice",
    name: "Back office",
    purpose: "Legal, contabilidad, logística y operaciones.",
    status: "active",
    categories: ["Legal", "Contabilidad", "Logística", "Operaciones"],
    spendingLimit: usd(5000),
    policyIds: ["Proveedores aprobados", "Duplicados", "Pagos partidos"],
  },
  {
    id: "ag-growth",
    name: "Crecimiento",
    purpose: "Herramientas y campañas de marketing.",
    status: "paused",
    categories: ["Marketing"],
    spendingLimit: usd(2000),
    policyIds: ["Umbral de aprobación"],
  },
];

export const ORG: OrgSeed = {
  id: "org",
  name: "Andes Labs Inc.",
  jurisdiction: "Delaware, EE. UU.",
  period: `${MESES[today.getMonth()]} ${today.getFullYear()}`,
  inbox: "pagos@andeslabs.co",
  user: { name: "Ana Gómez", role: "Finanzas", initials: "AG" },
  fx: { USD: 1, COP: 4150, MXN: 18.2, BRL: 5.4, ARS: 980, EUR: 0.92 },
  baselineUsedMinor: 0,
  policy: {
    version: "v1.0",
    baseCurrency: "USD",
    transactionLimit: 1_500_000,
    monthlyBudget: 6_500_000,
    approvalThreshold: 300_000,
    approvedSuppliers: DEFAULT_SUPPLIERS.map((s) => s.name),
    allowedCurrencies: ["USD", "COP", "MXN", "BRL", "ARS", "EUR"],
    duplicateAction: "review",
    missingInfoAction: "request_information",
    newSupplierAction: "review",
    contractTolerancePct: 5,
    duplicateWindowDays: 30,
    splitWindowDays: 7,
    minConfidence: 85,
    budgetAlertPct: 20,
  },
  suppliers: DEFAULT_SUPPLIERS,
  agents: DEFAULT_AGENTS,
};
