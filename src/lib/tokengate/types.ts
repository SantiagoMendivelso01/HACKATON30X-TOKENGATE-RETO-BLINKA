// Domain types for the payment agent. All money is stored in integer minor units (cents)
// to avoid floating-point arithmetic in limit and budget checks. Policy limits live in the
// organization's base currency (USD); every subject is converted with the org's FX table.

export type Currency = "USD" | "EUR" | "COP" | "MXN" | "BRL" | "ARS";

export type Money = { amountMinor: number; currency: Currency };

export type DecisionOutcome = "authorized" | "blocked" | "requires_approval" | "needs_information";

export type RuleId =
  | "extraction_confidence"
  | "required_information"
  | "prompt_injection"
  | "supplier_authorized"
  | "agent_scope"
  | "currency_allowed"
  | "contract_currency"
  | "bank_account"
  | "duplicate_check"
  | "contract_match"
  | "within_transaction_limit"
  | "human_approval_threshold"
  | "split_payment"
  | "budget_available";

export type RuleStatus = "passed" | "failed" | "needs_review" | "not_applicable";

export type AlertSeverity = "critical" | "high" | "medium";

export type RuleResult = {
  ruleId: RuleId;
  label: string;
  status: RuleStatus;
  explanation: string;
  /** Human-readable rule the check applied, e.g. "Máximo USD 1,000 por pago". */
  rule?: string | undefined;
  /** What would have changed the outcome (counterfactual), only for failing rules. */
  ifChanged?: string | undefined;
  alert?: { severity: AlertSeverity; text: string } | undefined;
};

export type DecisionResult = {
  outcome: DecisionOutcome;
  rules: RuleResult[];
  reasons: RuleId[];
  explanation: string;
  policyVersion: string;
  /** Amount converted to the base currency, in minor units. */
  baseAmountMinor: number;
};

export type SubjectKind = "invoice" | "purchase";

export type Channel = "email" | "pdf" | "chat" | "image" | "agent" | "upload";

export type Category =
  | "Software"
  | "Infraestructura"
  | "Operaciones"
  | "Marketing"
  | "Servicios"
  | "Diseño"
  | "Desarrollo"
  | "Legal"
  | "Contabilidad"
  | "Logística";

/** Anything the decision engine can evaluate: an invoice or a purchase request. */
export type DecisionSubject = {
  id: string;
  kind: SubjectKind;
  reference: string;
  supplier: string;
  amount: Money;
  agentId: string;
  description: string;
  category: Category;
  missingFields: string[];
  /** When the agent received it (ISO). Decisions run in this order. */
  receivedAt: string;
  channel: Channel;
  /** The supplier's own invoice number, used for exact-duplicate detection. */
  invoiceNumber?: string | undefined;
  supplierTaxId?: string | undefined;
  bankAccount?: string | undefined;
  /** Original text of the document/message, scanned for injected instructions. */
  rawText?: string | undefined;
  sender?: string | undefined;
};

export type Invoice = DecisionSubject & {
  kind: "invoice";
  issueDate: string;
  dueDate: string;
  extractionConfidence: number; // 0-100
};

export type Purchase = DecisionSubject & {
  kind: "purchase";
  requestedAt: string;
  budgetLine: string;
};

export type AnySubject = Invoice | Purchase;

export type HumanAction = "approved" | "rejected" | "info_requested";

export type HumanReview = {
  action: HumanAction;
  by: string;
  at: string;
  note?: string | undefined;
};

/** Effective status shown in the UI: engine outcome, possibly overridden by a human review. */
export type DisplayStatus = DecisionOutcome | "human_approved" | "human_rejected";

export type Agent = {
  id: string;
  name: string;
  purpose: string;
  status: "active" | "paused";
  categories: Category[];
  spendingLimit: Money;
  policyIds: string[];
};

/** Registered supplier with the terms agreed in its contract. */
export type Supplier = {
  name: string;
  taxId: string;
  country: string;
  currency: Currency;
  contract: { type: "fixed" | "cap"; amountMinor: number };
  bankAccount: string;
  concept: string;
};

export type Policy = {
  version: string;
  baseCurrency: "USD";
  /** All limits below are in base-currency minor units. */
  transactionLimit: number;
  monthlyBudget: number;
  approvalThreshold: number;
  approvedSuppliers: string[];
  allowedCurrencies: Currency[];
  duplicateAction: "block" | "review";
  missingInfoAction: "request_information" | "block";
  newSupplierAction: "block" | "review";
  contractTolerancePct: number;
  duplicateWindowDays: number;
  splitWindowDays: number;
  minConfidence: number; // 0-100
  budgetAlertPct: number;
};

/** Units of each currency per 1 USD. */
export type FxTable = Partial<Record<Currency, number>>;

export type DecisionRecord = {
  id: string;
  subjectId: string;
  at: string;
  actor: "agent" | "human";
  actorName: string;
  result: DecisionResult;
  humanAction?: HumanAction | undefined;
  note?: string | undefined;
};

export type AuditEvent = {
  id: string;
  at: string;
  type:
    | "decision"
    | "human_review"
    | "policy_change"
    | "invoice_upload"
    | "settings"
    | "system"
    | "payment";
  actor: string;
  actorKind: "agent" | "human" | "system";
  summary: string;
  reason?: string | undefined;
  subjectId?: string | undefined;
};

/** The organization the app runs for: its people, suppliers, agents and policy. */
export type OrgSeed = {
  id: string;
  name: string;
  jurisdiction: string;
  period: string;
  inbox: string;
  user: { name: string; role: string; initials: string };
  fx: FxTable;
  /** Base-currency minor units already spent this period before these records. */
  baselineUsedMinor: number;
  policy: Policy;
  suppliers: Supplier[];
  agents: Agent[];
};
