/**
 * Deterministic decision engine — FRONTEND SIMULATION.
 * Must move to a trusted backend before any real use. Pure function: same inputs, same output.
 * Precedence: any failed rule => blocked; else missing info => needs_information;
 * else any needs_review => requires_approval; else authorized.
 */
import type { BudgetUsage, DecisionResult, DecisionSubject, Policy, RuleResult } from "./types";
import { formatMoney } from "./format";

export type EngineContext = {
  budgetUsage: BudgetUsage;
  otherSubjects: DecisionSubject[];
};

export function evaluateDecision(
  subject: DecisionSubject,
  policy: Policy,
  ctx: EngineContext,
): DecisionResult {
  const { currency, amountMinor } = subject.amount;
  const fmt = (minor: number) => formatMoney({ amountMinor: minor, currency });
  const currencyAllowed = policy.allowedCurrencies.includes(currency);
  const rules: RuleResult[] = [];

  const supplierOk = policy.approvedSuppliers.includes(subject.supplier);
  rules.push({
    ruleId: "supplier_authorized",
    label: "¿El proveedor está autorizado?",
    status: supplierOk ? "passed" : "failed",
    explanation: supplierOk
      ? `${subject.supplier} está en la lista de proveedores aprobados.`
      : `${subject.supplier} no está en la lista de proveedores aprobados.`,
  });

  rules.push({
    ruleId: "currency_allowed",
    label: "¿La moneda está permitida?",
    status: currencyAllowed ? "passed" : "failed",
    explanation: currencyAllowed
      ? `${currency} es una moneda permitida.`
      : `${currency} no está entre las monedas permitidas.`,
  });

  const limit = policy.transactionLimit[currency];
  const withinLimit = currencyAllowed && amountMinor <= limit;
  rules.push({
    ruleId: "within_transaction_limit",
    label: "¿El importe está dentro del límite por transacción?",
    status: withinLimit ? "passed" : "failed",
    explanation: withinLimit
      ? `${fmt(amountMinor)} no supera el límite de ${fmt(limit)}.`
      : `${fmt(amountMinor)} supera el límite de ${fmt(limit)}.`,
  });

  const remaining = policy.monthlyBudget[currency] - (ctx.budgetUsage[currency] ?? 0);
  const budgetOk = currencyAllowed && amountMinor <= remaining;
  rules.push({
    ruleId: "budget_available",
    label: "¿Queda presupuesto suficiente?",
    status: budgetOk ? "passed" : "failed",
    explanation: budgetOk
      ? `Quedan ${fmt(remaining)} del presupuesto mensual.`
      : `Solo quedan ${fmt(Math.max(remaining, 0))} del presupuesto mensual.`,
  });

  const duplicate = ctx.otherSubjects.find(
    (o) =>
      o.id !== subject.id &&
      o.supplier === subject.supplier &&
      o.amount.amountMinor === amountMinor &&
      o.amount.currency === currency,
  );
  rules.push({
    ruleId: "duplicate_check",
    label: "¿Es un posible duplicado?",
    status: duplicate ? (policy.duplicateAction === "block" ? "failed" : "needs_review") : "passed",
    explanation: duplicate
      ? `Coincide en proveedor e importe con ${duplicate.reference}.`
      : "No se encontraron registros con el mismo proveedor e importe.",
  });

  const threshold = policy.approvalThreshold[currency];
  const needsHuman = amountMinor > threshold;
  rules.push({
    ruleId: "human_approval_threshold",
    label: "¿Requiere aprobación humana?",
    status: needsHuman ? "needs_review" : "passed",
    explanation: needsHuman
      ? `Supera el umbral de aprobación humana de ${fmt(threshold)}.`
      : `Está por debajo del umbral de aprobación humana de ${fmt(threshold)}.`,
  });

  const missing = subject.missingFields.length > 0;
  rules.push({
    ruleId: "required_information",
    label: "¿Falta información obligatoria?",
    status: missing ? (policy.missingInfoAction === "block" ? "failed" : "needs_review") : "passed",
    explanation: missing
      ? `Falta: ${subject.missingFields.join(", ")}.`
      : "Todos los campos obligatorios están completos.",
  });

  const failed = rules.filter((r) => r.status === "failed");
  const review = rules.filter((r) => r.status === "needs_review");
  const missingReview = missing && policy.missingInfoAction === "request_information";

  let outcome: DecisionResult["outcome"];
  let reasonRules: RuleResult[];
  if (failed.length) {
    outcome = "blocked";
    reasonRules = failed;
  } else if (missingReview) {
    outcome = "needs_information";
    reasonRules = rules.filter((r) => r.ruleId === "required_information");
  } else if (review.length) {
    outcome = "requires_approval";
    reasonRules = review;
  } else {
    outcome = "authorized";
    reasonRules = [];
  }

  const reasons = reasonRules.map((r) => r.ruleId);
  const lead: Record<DecisionResult["outcome"], string> = {
    authorized: "Autorizada automáticamente: las 7 reglas se cumplen.",
    blocked: "Bloqueada por una política.",
    requires_approval: "Requiere aprobación humana.",
    needs_information: "Pendiente de información.",
  };
  const explanation = [lead[outcome], ...reasonRules.map((r) => r.explanation)].join(" ");

  return { outcome, rules, reasons, explanation, policyVersion: policy.version };
}
