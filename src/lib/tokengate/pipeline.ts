// How a decision reads as a step-by-step pipeline: the engine's 14 rules grouped into four
// questions a finance person would ask, then the JEV cross-check and the final decision.
// Pure: no React, no network.
import { evaluateJevLocally, type JevDecisionEvaluation, type JevDecisionInput } from "./jev";
import type {
  DecisionOutcome,
  DecisionResult,
  DecisionSubject,
  DisplayStatus,
  Policy,
  RuleId,
  RuleResult,
  RuleStatus,
} from "./types";

export type StageId = "read" | "who" | "agreed" | "limits";

export type StageDef = {
  id: StageId;
  title: string;
  question: string;
  rules: RuleId[];
};

export const STAGES: StageDef[] = [
  {
    id: "read",
    title: "Leer la factura",
    question: "¿Se entiende, está completa y no trae trucos?",
    rules: ["extraction_confidence", "required_information", "prompt_injection"],
  },
  {
    id: "who",
    title: "Revisar quién cobra",
    question: "¿Es un proveedor conocido y pide pagar a su cuenta de siempre?",
    rules: ["supplier_authorized", "bank_account", "agent_scope"],
  },
  {
    id: "agreed",
    title: "Comparar con lo acordado",
    question: "¿Cuadra con el contrato y no es un cobro repetido?",
    rules: ["contract_match", "contract_currency", "currency_allowed", "duplicate_check"],
  },
  {
    id: "limits",
    title: "Revisar límites y presupuesto",
    question: "¿Está dentro de los montos que el agente puede pagar solo?",
    rules: [
      "within_transaction_limit",
      "human_approval_threshold",
      "split_payment",
      "budget_available",
    ],
  },
];

export type Stage = StageDef & {
  status: RuleStatus;
  checks: RuleResult[];
  /** One plain sentence with what this stage found. */
  summary: string;
};

const rank: Record<RuleStatus, number> = {
  failed: 3,
  needs_review: 2,
  passed: 1,
  not_applicable: 0,
};

const OK_SUMMARY: Record<StageId, string> = {
  read: "La factura se leyó bien, está completa y no trae instrucciones para el agente.",
  who: "Es un proveedor aprobado y la cuenta coincide con la registrada.",
  agreed: "Cuadra con lo acordado y no es un cobro repetido.",
  limits: "Está dentro de los límites y queda presupuesto en el mes.",
};

export function buildStages(result: DecisionResult): Stage[] {
  return STAGES.map((def) => {
    const checks = def.rules
      .map((id) => result.rules.find((r) => r.ruleId === id))
      .filter((r): r is RuleResult => !!r);
    const status = checks.reduce<RuleStatus>(
      (s, r) => (rank[r.status] > rank[s] ? r.status : s),
      "not_applicable",
    );
    const worst = checks.find((r) => r.status === status);
    const na = (id: RuleId) => checks.find((r) => r.ruleId === id)?.status === "not_applicable";
    const okSummary =
      def.id === "agreed" && na("contract_match")
        ? "No hay contrato con qué comparar; la moneda está permitida y no es un cobro repetido."
        : def.id === "who" && na("bank_account")
          ? "Es un proveedor aprobado (la factura no trae cuenta para comparar)."
          : OK_SUMMARY[def.id];
    const summary =
      status === "failed" || status === "needs_review"
        ? (worst?.explanation ?? "")
        : status === "passed"
          ? okSummary
          : "No aplica a esta operación.";
    return { ...def, status, checks, summary };
  });
}

/** Short reason in plain words for a rule that did not pass (rule labels say what is checked). */
export const FLAG_LABEL: Record<RuleId, string> = {
  extraction_confidence: "Lectura poco confiable",
  required_information: "Faltan datos",
  prompt_injection: "Instrucciones escondidas",
  supplier_authorized: "Proveedor no aprobado",
  agent_scope: "Fuera del alcance del agente",
  currency_allowed: "Moneda no permitida",
  contract_currency: "Moneda distinta al contrato",
  bank_account: "Cambió la cuenta bancaria",
  duplicate_check: "Cobro duplicado",
  contract_match: "No cuadra con el contrato",
  within_transaction_limit: "Supera el tope por factura",
  human_approval_threshold: "Monto alto: pide permiso",
  split_payment: "Posible pago partido",
  budget_available: "Sin presupuesto en el mes",
};

/** The plain reason of the first rule that did not pass, if any. */
export const mainFlag = (result: DecisionResult): string | null => {
  const r = result.rules.find((x) => x.status === "failed" || x.status === "needs_review");
  return r ? FLAG_LABEL[r.ruleId] : null;
};

/** Headline and next step in plain words, per final status. */
export const VERDICT: Record<DisplayStatus, { title: string; next: string }> = {
  authorized: {
    title: "El agente pagó esta factura",
    next: "Cumple todas tus reglas. No tienes que hacer nada.",
  },
  blocked: {
    title: "El agente frenó este pago",
    next: "Rompe una regla, así que nadie puede aprobarla desde aquí. Si es un error, corrige la factura o ajusta la regla y el agente la vuelve a revisar.",
  },
  requires_approval: {
    title: "El agente necesita tu permiso",
    next: "Todo lo demás está en orden, pero tus reglas piden que una persona lo confirme.",
  },
  needs_information: {
    title: "Faltan datos para decidir",
    next: "Pide los datos al proveedor, o decide tú si ya los tienes.",
  },
  human_approved: {
    title: "Aprobada por una persona",
    next: "El pago se envió al sandbox. No se movió dinero real.",
  },
  human_rejected: {
    title: "Rechazada por una persona",
    next: "No se pagará. La decisión quedó en el registro.",
  },
};

// ---------------------------------------------------------------------------
// JEV cross-check: JEV gets the invoice plus what the rules found and decides again with a typed
// schema. If both don't agree, the stricter one is what counts and a person should look at it.

const strictness: Record<DecisionOutcome, number> = {
  authorized: 0,
  needs_information: 1,
  requires_approval: 1,
  blocked: 2,
};

const ruleOf = (result: DecisionResult, id: RuleId) => result.rules.find((r) => r.ruleId === id);

export function jevInputFor(
  subject: DecisionSubject,
  result: DecisionResult,
  policy: Policy,
): JevDecisionInput {
  const supplier = ruleOf(result, "supplier_authorized");
  const duplicate = ruleOf(result, "duplicate_check");
  const contradictions = result.rules.filter(
    (r) =>
      r.status === "failed" &&
      !["duplicate_check", "within_transaction_limit", "required_information"].includes(r.ruleId),
  );
  const signals = result.rules.filter(
    (r) =>
      r.status === "needs_review" &&
      !["supplier_authorized", "human_approval_threshold", "required_information"].includes(
        r.ruleId,
      ),
  );
  return {
    supplier: subject.supplier,
    amount: subject.amount.amountMinor / 100,
    currency: subject.amount.currency,
    amountUsd: Math.max(result.baseAmountMinor, 1) / 100,
    isApprovedSupplier: supplier?.status === "passed",
    isNewSupplier: supplier?.status !== "passed",
    dailySpentUsd: 0,
    dailyApprovalThresholdUsd: policy.approvalThreshold / 100,
    dailyLimitMaxUsd: policy.transactionLimit / 100,
    invoiceNumber: subject.invoiceNumber,
    isDuplicate: duplicate?.status === "failed",
    duplicateDetails: duplicate?.status === "failed" ? duplicate.explanation : undefined,
    missingFields: subject.missingFields,
    hasContradictions: contradictions.length > 0,
    contradictionDetails: contradictions.map((r) => r.explanation).join(" ") || undefined,
    reviewSignals: signals.map((r) => `${r.label}: ${r.explanation}`),
  };
}

export type CrossCheck = {
  jev: JevDecisionEvaluation;
  agrees: boolean;
  /** The stricter of the two outcomes. */
  strictest: DecisionOutcome;
};

export function crossCheck(result: DecisionResult, jev: JevDecisionEvaluation): CrossCheck {
  const same =
    jev.outcome === result.outcome ||
    (strictness[jev.outcome] === strictness[result.outcome] && jev.outcome !== "authorized");
  return {
    jev,
    agrees: same,
    strictest: strictness[jev.outcome] > strictness[result.outcome] ? jev.outcome : result.outcome,
  };
}

/** Local, instant JEV verification (same typed schema as the live TypeSafe API). */
export const localCrossCheck = (
  subject: DecisionSubject,
  result: DecisionResult,
  policy: Policy,
): CrossCheck => crossCheck(result, evaluateJevLocally(jevInputFor(subject, result, policy)));

export const JEV_OUTCOME_LABEL: Record<DecisionOutcome, string> = {
  authorized: "Pagar",
  requires_approval: "Pedir permiso",
  needs_information: "Pedir datos",
  blocked: "Frenar",
};
