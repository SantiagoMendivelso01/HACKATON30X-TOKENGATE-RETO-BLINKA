// Domain types for TokenGate. All money is stored in integer minor units (cents)
// to avoid floating-point arithmetic in limit and budget checks.

export type Currency = "USD" | "EUR" | "COP";

export type Money = { amountMinor: number; currency: Currency };

export type DecisionOutcome = "authorized" | "blocked" | "requires_approval" | "needs_information";

export type RuleId =
  | "supplier_authorized"
  | "within_transaction_limit"
  | "budget_available"
  | "currency_allowed"
  | "duplicate_check"
  | "human_approval_threshold"
  | "required_information";

export type RuleStatus = "passed" | "failed" | "needs_review";

export type RuleResult = {
  ruleId: RuleId;
  label: string;
  status: RuleStatus;
  explanation: string;
};

export type DecisionResult = {
  outcome: DecisionOutcome;
  rules: RuleResult[];
  reasons: string[];
  explanation: string;
  policyVersion: string;
};

export type SubjectKind = "invoice" | "purchase";

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
};

export type Category = "Software" | "Infraestructura" | "Operaciones" | "Marketing" | "Servicios" | "Diseño";

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

export type Policy = {
  version: string;
  transactionLimit: Record<Currency, number>;
  monthlyBudget: Record<Currency, number>;
  approvalThreshold: Record<Currency, number>;
  approvedSuppliers: string[];
  allowedCurrencies: Currency[];
  duplicateAction: "block" | "review";
  missingInfoAction: "request_information" | "block";
};

export type BudgetUsage = Record<Currency, number>; // minor units already committed this month

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
  type: "decision" | "human_review" | "policy_change" | "invoice_upload" | "settings" | "system";
  actor: string;
  actorKind: "agent" | "human" | "system";
  summary: string;
  reason?: string | undefined;
};
