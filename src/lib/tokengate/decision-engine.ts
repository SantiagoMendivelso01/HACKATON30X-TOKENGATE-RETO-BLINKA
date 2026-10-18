/**
 * Deterministic decision engine — FRONTEND SIMULATION.
 * Must move to a trusted backend before any real use. Pure function: same inputs, same output.
 * The LLM only extracts data; this engine decides. It authorizes only when every rule passes.
 * Precedence: any failed rule => blocked; else missing info => needs_information;
 * else any needs_review => requires_approval; else authorized.
 */
import type {
  Agent,
  DecisionOutcome,
  DecisionResult,
  DecisionSubject,
  FxTable,
  HumanReview,
  Policy,
  RuleResult,
  Supplier,
} from "./types";
import { daysBetween, formatBase, formatMoney, toBaseMinor } from "./format";
import { hash } from "./hash";

export type LedgerState = "paid" | "pending" | "blocked" | "rejected";

export type HistoryItem = { subject: DecisionSubject; state: LedgerState; baseMinor: number };

export type EngineContext = {
  fx: FxTable;
  suppliers: Supplier[];
  agents: Agent[];
  /** Subjects evaluated before this one, with their effective state. */
  history: HistoryItem[];
  /** Base-currency minor units already paid this period (including the baseline). */
  spentMinor: number;
  /** Base-currency minor units reserved by records waiting for a human. */
  committedMinor: number;
};

const norm = (s: string | undefined) =>
  (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
const leet = (s: string) =>
  norm(s)
    .replace(/0/g, "o")
    .replace(/1/g, "l")
    .replace(/3/g, "e")
    .replace(/5/g, "s")
    .replace(/rn/g, "m");
/** Tax ids compare without their type prefix: "NIT 901234567-1" equals "901234567-1". */
const normId = (s: string | undefined) =>
  (s ?? "")
    .toUpperCase()
    .replace(/^\s*(NIT|RFC|CUIT|CNPJ|CPF|CC|EIN|RUT|NIF|VAT)[\s.:#-]*/, "")
    .replace(/[^0-9A-Z]/g, "");

function levenshtein(a: string, b: string) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0]![j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i]![j] = Math.min(
        d[i - 1]![j]! + 1,
        d[i]![j - 1]! + 1,
        d[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
  return d[a.length]![b.length]!;
}

/** Text inside a document that tries to give orders to the agent. */
export const INJECTION_PATTERNS = [
  /ignor\w*\s+(las\s+|todas\s+las\s+)?(reglas|instrucciones|previous|all)/i,
  /aprueba\s+(este|el)\s+pago/i,
  /approve\s+this\s+payment/i,
  /\b(system|sistema)\s*:/i,
  /sin\s+aprobaci[oó]n\s+humana/i,
  /nota\s+para\s+el\s+asistente/i,
];

export function evaluateDecision(
  subject: DecisionSubject,
  policy: Policy,
  ctx: EngineContext,
): DecisionResult {
  const { currency } = subject.amount;
  const base = toBaseMinor(subject.amount, ctx.fx);
  const usd = formatBase;
  const rules: RuleResult[] = [];
  const add = (r: RuleResult) => rules.push(r);
  const na = (ruleId: RuleResult["ruleId"], label: string, explanation: string) =>
    add({ ruleId, label, status: "not_applicable", explanation });

  // 1. Extraction confidence (invoices read by the model)
  if (subject.kind === "invoice") {
    const conf = (subject as { extractionConfidence?: number }).extractionConfidence ?? 100;
    const ok = conf >= policy.minConfidence;
    add({
      ruleId: "extraction_confidence",
      label: "Lectura confiable de la factura",
      status: ok ? "passed" : "needs_review",
      rule: `Confianza mínima ${policy.minConfidence}%`,
      explanation: `Datos leídos con ${conf}% de confianza${ok ? "." : `, por debajo del mínimo de ${policy.minConfidence}%.`}`,
      ifChanged: `Se habría evaluado sin intervención si la lectura superara ${policy.minConfidence}% de confianza.`,
      alert: ok ? undefined : { severity: "medium", text: "Factura difícil de leer" },
    });
  } else
    na(
      "extraction_confidence",
      "Lectura confiable de la factura",
      "Solicitud creada por un agente: no requiere lectura.",
    );

  // 2. Required information
  const missing = subject.missingFields.length > 0;
  add({
    ruleId: "required_information",
    label: "Información obligatoria completa",
    status: missing ? (policy.missingInfoAction === "block" ? "failed" : "needs_review") : "passed",
    rule:
      policy.missingInfoAction === "block"
        ? "Si falta información → bloquear"
        : "Si falta información → pedirla",
    explanation: missing
      ? `Falta: ${subject.missingFields.join(", ")}.`
      : "Todos los campos obligatorios están completos.",
    ifChanged: `Se habría seguido evaluando si se completara: ${subject.missingFields.join(", ")}.`,
    alert: missing ? { severity: "medium", text: "Falta información obligatoria" } : undefined,
  });

  // 3. Injected instructions
  const hit = INJECTION_PATTERNS.map((r) => (subject.rawText ?? "").match(r)).find(Boolean);
  add({
    ruleId: "prompt_injection",
    label: "Sin instrucciones escondidas para el agente",
    status: hit ? "failed" : "passed",
    rule: "Un documento nunca puede dar órdenes al agente",
    explanation: hit
      ? `El documento intenta darle órdenes al agente (“${hit[0]}…”). El agente lo ignora y bloquea la operación.`
      : "El documento no contiene instrucciones dirigidas al agente.",
    ifChanged: "Ninguna instrucción dentro de un documento cambia las reglas: siempre se bloquea.",
    alert: hit ? { severity: "critical", text: "Intento de manipular al agente" } : undefined,
  });

  // 4. Supplier
  const approvedNames = policy.approvedSuppliers;
  const byTax = subject.supplierTaxId
    ? ctx.suppliers.find((s) => normId(s.taxId) === normId(subject.supplierTaxId))
    : undefined;
  const byName = ctx.suppliers.find((s) => norm(s.name) === norm(subject.supplier));
  const registered = byTax ?? byName;
  const approved = approvedNames.some(
    (n) => norm(n) === norm(registered?.name ?? subject.supplier),
  );
  const lookalike = !approved
    ? approvedNames.find(
        (n) =>
          leet(n) === leet(subject.supplier) ||
          (norm(n).length > 6 && levenshtein(norm(n), norm(subject.supplier)) <= 2),
      )
    : undefined;
  const taxMismatch =
    approved &&
    !byTax &&
    byName &&
    subject.supplierTaxId &&
    normId(subject.supplierTaxId) !== normId(byName.taxId);
  if (approved && !taxMismatch) {
    add({
      ruleId: "supplier_authorized",
      label: "Proveedor autorizado",
      status: "passed",
      rule: "Solo proveedores aprobados",
      explanation: `${registered?.name ?? subject.supplier} está en la lista de proveedores aprobados${registered ? ` (${registered.taxId})` : ""}.`,
    });
  } else if (taxMismatch && byName) {
    add({
      ruleId: "supplier_authorized",
      label: "Proveedor autorizado",
      status: "needs_review",
      rule: "Solo proveedores aprobados",
      explanation: `El nombre coincide con ${byName.name}, pero el ID fiscal ${subject.supplierTaxId} no coincide con el registrado (${byName.taxId}).`,
      ifChanged: "Se habría pagado si el ID fiscal coincidiera con el registrado.",
      alert: { severity: "critical", text: "ID fiscal no coincide con el proveedor registrado" },
    });
  } else if (lookalike) {
    add({
      ruleId: "supplier_authorized",
      label: "Proveedor autorizado",
      status: "failed",
      rule: "Solo proveedores aprobados",
      explanation: `“${subject.supplier}” no está aprobado y se parece mucho a “${lookalike}”. Posible suplantación.`,
      ifChanged:
        "No se paga a un nombre parecido a un proveedor conocido; hay que confirmarlo por un canal oficial.",
      alert: { severity: "critical", text: `Posible suplantación de ${lookalike}` },
    });
  } else {
    add({
      ruleId: "supplier_authorized",
      label: "Proveedor autorizado",
      status: policy.newSupplierAction === "block" ? "failed" : "needs_review",
      rule: `Proveedor nuevo → ${policy.newSupplierAction === "block" ? "bloquear" : "escalar"}`,
      explanation: `${subject.supplier} no está en la lista de proveedores aprobados.`,
      ifChanged: `Se habría seguido evaluando si ${subject.supplier} estuviera en la lista de proveedores aprobados.`,
      alert: { severity: "high", text: "Proveedor nuevo" },
    });
  }

  // 5. Agent scope
  const agent = ctx.agents.find((a) => a.id === subject.agentId);
  if (agent) {
    const agentLimit = toBaseMinor(agent.spendingLimit, ctx.fx);
    const catOk = agent.categories.includes(subject.category);
    const issues: string[] = [];
    if (base > agentLimit)
      issues.push(
        `${usd(base)} supera su límite de ${formatMoney(agent.spendingLimit, { compact: true })}`,
      );
    if (!catOk)
      issues.push(
        `${subject.category} no está entre sus categorías (${agent.categories.join(", ")})`,
      );
    const paused = agent.status === "paused";
    add({
      ruleId: "agent_scope",
      label: "Dentro del alcance del agente",
      status: paused ? "failed" : issues.length ? "needs_review" : "passed",
      rule: `${agent.name}: hasta ${formatMoney(agent.spendingLimit, { compact: true })} en ${agent.categories.join(", ")}`,
      explanation: paused
        ? `El agente ${agent.name} está en pausa y no puede operar.`
        : issues.length
          ? `${agent.name}: ${issues.join("; ")}.`
          : `${agent.name} puede gastar en ${subject.category} hasta ${formatMoney(agent.spendingLimit, { compact: true })}.`,
      ifChanged: paused
        ? `Se habría evaluado si ${agent.name} estuviera activo.`
        : `Se habría seguido evaluando si estuviera dentro del límite y las categorías de ${agent.name}.`,
      alert: paused
        ? { severity: "high", text: `Operación de un agente en pausa (${agent.name})` }
        : undefined,
    });
  } else na("agent_scope", "Dentro del alcance del agente", "Sin agente asignado.");

  // 6. Currency allowed
  const currencyOk = policy.allowedCurrencies.includes(currency);
  add({
    ruleId: "currency_allowed",
    label: "Moneda permitida",
    status: currencyOk ? "passed" : "failed",
    rule: `Monedas: ${policy.allowedCurrencies.join(", ")}`,
    explanation: currencyOk
      ? `${currency} es una moneda permitida.`
      : `${currency} no está entre las monedas permitidas.`,
    ifChanged: `Se habría seguido evaluando si ${currency} estuviera permitida.`,
    alert: currencyOk
      ? undefined
      : { severity: "medium", text: `Moneda no permitida (${currency})` },
  });

  // 7. Contract currency
  if (registered && approved) {
    const ok = currency === registered.currency;
    add({
      ruleId: "contract_currency",
      label: "Moneda acordada en el contrato",
      status: ok ? "passed" : "needs_review",
      rule: `Contrato en ${registered.currency}`,
      explanation: ok
        ? `Factura en ${currency}, igual que el contrato.`
        : `Factura en ${currency}, pero el contrato es en ${registered.currency}.`,
      ifChanged: `Se habría pagado si viniera en ${registered.currency}.`,
      alert: ok ? undefined : { severity: "medium", text: "Moneda distinta a la del contrato" },
    });
  } else na("contract_currency", "Moneda acordada en el contrato", "Sin contrato registrado.");

  // 8. Bank account
  if (registered && approved && subject.bankAccount) {
    const ok = subject.bankAccount === registered.bankAccount;
    add({
      ruleId: "bank_account",
      label: "Cuenta bancaria registrada",
      status: ok ? "passed" : "needs_review",
      rule: `Cuenta registrada: ${registered.bankAccount}`,
      explanation: ok
        ? `Coincide con la cuenta registrada (${registered.bankAccount}).`
        : `Pide pagar a ${subject.bankAccount}, pero la registrada es ${registered.bankAccount}.`,
      ifChanged: `Se habría pagado si la cuenta fuera la registrada (${registered.bankAccount}).`,
      alert: ok
        ? undefined
        : { severity: "high", text: `Cambio de cuenta bancaria de ${registered.name}` },
    });
  } else
    na(
      "bank_account",
      "Cuenta bancaria registrada",
      registered ? "La factura no trae cuenta." : "Sin proveedor registrado.",
    );

  // 9. Duplicates
  const sameSupplier = (h: HistoryItem) =>
    norm(h.subject.supplier) === norm(subject.supplier) ||
    (registered && norm(h.subject.supplier) === norm(registered.name));
  const exact = subject.invoiceNumber
    ? ctx.history.find((h) => sameSupplier(h) && h.subject.invoiceNumber === subject.invoiceNumber)
    : undefined;
  const near = !exact
    ? ctx.history.find(
        (h) =>
          sameSupplier(h) &&
          h.state !== "blocked" &&
          h.state !== "rejected" &&
          h.subject.amount.amountMinor === subject.amount.amountMinor &&
          h.subject.amount.currency === currency &&
          daysBetween(h.subject.receivedAt, subject.receivedAt) <= policy.duplicateWindowDays,
      )
    : undefined;
  add({
    ruleId: "duplicate_check",
    label: "No es un cobro duplicado",
    status: exact
      ? "failed"
      : near
        ? policy.duplicateAction === "block"
          ? "failed"
          : "needs_review"
        : "passed",
    rule: `Mismo número = duplicado; mismo importe en ${policy.duplicateWindowDays} días = posible duplicado`,
    explanation: exact
      ? `La factura ${subject.invoiceNumber} ya se recibió (${exact.subject.reference}).`
      : near
        ? `Coincide en proveedor e importe con ${near.subject.reference}, recibida hace ${Math.round(daysBetween(near.subject.receivedAt, subject.receivedAt))} días.`
        : "No hay otro registro igual en la ventana de revisión.",
    ifChanged: exact
      ? "Una factura con el mismo número nunca se paga dos veces."
      : "Se habría pagado si no existiera otro cobro con el mismo importe en la ventana.",
    alert: exact
      ? { severity: "high", text: "Cobro duplicado" }
      : near
        ? { severity: "medium", text: "Posible cobro duplicado" }
        : undefined,
  });

  // 10. Contract terms
  if (registered && approved) {
    const contractBase = toBaseMinor(
      { amountMinor: registered.contract.amountMinor, currency: registered.currency },
      ctx.fx,
    );
    let ok: boolean, explanation: string, ifChanged: string;
    const contractTxt = formatMoney({
      amountMinor: registered.contract.amountMinor,
      currency: registered.currency,
    });
    if (registered.contract.type === "fixed") {
      const dev = ((base - contractBase) / contractBase) * 100;
      ok = Math.abs(dev) <= policy.contractTolerancePct;
      explanation = `Contrato fijo ${contractTxt}. Esta factura: ${usd(base)} (${dev >= 0 ? "+" : ""}${dev.toFixed(1)}%, tolerancia ±${policy.contractTolerancePct}%).`;
      ifChanged = `Se habría pagado entre ${usd(contractBase * (1 - policy.contractTolerancePct / 100))} y ${usd(contractBase * (1 + policy.contractTolerancePct / 100))}.`;
    } else {
      ok = base <= contractBase;
      explanation = `Contrato con tope ${contractTxt}. Esta factura: ${usd(base)}.`;
      ifChanged = `Se habría pagado si el importe fuera de ${usd(contractBase)} o menos.`;
    }
    add({
      ruleId: "contract_match",
      label: "Cuadra con lo acordado",
      status: ok ? "passed" : "failed",
      rule: `Contrato ± ${policy.contractTolerancePct}%`,
      explanation,
      ifChanged,
      alert: ok ? undefined : { severity: "high", text: "El importe no cuadra con el contrato" },
    });
  } else na("contract_match", "Cuadra con lo acordado", "Sin contrato con qué comparar.");

  // 11. Transaction limit
  const withinLimit = base <= policy.transactionLimit;
  add({
    ruleId: "within_transaction_limit",
    label: "Dentro del límite por transacción",
    status: withinLimit ? "passed" : "failed",
    rule: `Máximo ${usd(policy.transactionLimit)} por pago`,
    explanation: `${usd(base)} ${withinLimit ? "no supera" : "supera"} el límite de ${usd(policy.transactionLimit)}.`,
    ifChanged: `Se habría seguido evaluando con un importe de ${usd(policy.transactionLimit)} o menos.`,
  });

  // 12. Human approval threshold
  const needsHuman = base > policy.approvalThreshold;
  add({
    ruleId: "human_approval_threshold",
    label: "No requiere aprobación humana por importe",
    status: needsHuman ? "needs_review" : "passed",
    rule: `Más de ${usd(policy.approvalThreshold)} → aprobación humana`,
    explanation: needsHuman
      ? `${usd(base)} supera el umbral de aprobación humana de ${usd(policy.approvalThreshold)}.`
      : `Está por debajo del umbral de aprobación humana de ${usd(policy.approvalThreshold)}.`,
    ifChanged: `Se habría autorizado sin intervención con un importe de ${usd(policy.approvalThreshold)} o menos.`,
  });

  // 13. Split payments
  const recent = ctx.history.filter(
    (h) =>
      sameSupplier(h) &&
      (h.state === "paid" || h.state === "pending") &&
      daysBetween(h.subject.receivedAt, subject.receivedAt) <= policy.splitWindowDays,
  );
  const windowSum = recent.reduce((s, h) => s + h.baseMinor, 0) + base;
  const split = recent.length > 0 && windowSum > policy.approvalThreshold;
  add({
    ruleId: "split_payment",
    label: "No parece un pago partido",
    status: split ? "needs_review" : "passed",
    rule: `Suma del proveedor en ${policy.splitWindowDays} días ≤ ${usd(policy.approvalThreshold)}`,
    explanation: split
      ? `Con ${recent.map((h) => h.subject.reference).join(", ")} suma ${usd(windowSum)} en ${policy.splitWindowDays} días, por encima del umbral.`
      : recent.length
        ? `Suma del proveedor en la ventana: ${usd(windowSum)}, dentro del umbral.`
        : "No hay otros cobros del proveedor en la ventana.",
    ifChanged: `Se habría autorizado si la suma del proveedor en ${policy.splitWindowDays} días no superara ${usd(policy.approvalThreshold)}.`,
    alert: split ? { severity: "high", text: "Posible pago fraccionado" } : undefined,
  });

  // 14. Budget
  const available = policy.monthlyBudget - ctx.spentMinor - ctx.committedMinor;
  const budgetOk = base <= available;
  add({
    ruleId: "budget_available",
    label: "Queda presupuesto en el periodo",
    status: budgetOk ? "passed" : "failed",
    rule: `Presupuesto ${usd(policy.monthlyBudget)} (pagado + reservado)`,
    explanation: `Disponible ${usd(Math.max(available, 0))} (pagado ${usd(ctx.spentMinor)}, reservado ${usd(ctx.committedMinor)}). Esta operación: ${usd(base)}.`,
    ifChanged: `Se habría autorizado con al menos ${usd(base)} disponibles en el periodo.`,
    alert: budgetOk ? undefined : { severity: "high", text: "Presupuesto insuficiente" },
  });

  const failed = rules.filter((r) => r.status === "failed");
  const review = rules.filter((r) => r.status === "needs_review");
  const missingReview = missing && policy.missingInfoAction === "request_information";

  let outcome: DecisionOutcome;
  let reasonRules: RuleResult[];
  if (failed.length) {
    outcome = "blocked";
    reasonRules = failed;
  } else if (missingReview) {
    outcome = "needs_information";
    reasonRules = rules.filter(
      (r) =>
        r.ruleId === "required_information" ||
        (r.ruleId === "extraction_confidence" && r.status !== "passed"),
    );
  } else if (review.length) {
    outcome = "requires_approval";
    reasonRules = review;
  } else {
    outcome = "authorized";
    reasonRules = [];
  }

  const checked = rules.filter((r) => r.status !== "not_applicable").length;
  const lead: Record<DecisionOutcome, string> = {
    authorized: `Autorizada automáticamente: cumple las ${checked} reglas que aplican.`,
    blocked: "Bloqueada por una política.",
    requires_approval: "Requiere aprobación humana.",
    needs_information: "Pendiente de información.",
  };
  const explanation = [lead[outcome], ...reasonRules.map((r) => r.explanation)].join(" ");

  return {
    outcome,
    rules,
    reasons: reasonRules.map((r) => r.ruleId),
    explanation,
    policyVersion: policy.version,
    baseAmountMinor: base,
  };
}

// ---------------------------------------------------------------------------
// Ledger: runs the engine over every record in arrival order, then applies human reviews.

export type LedgerEntry<T extends DecisionSubject = DecisionSubject> = {
  subject: T;
  result: DecisionResult;
  review?: HumanReview | undefined;
  state: LedgerState;
  baseMinor: number;
  payment?: { txn: string; rail: string; at: string } | undefined;
};

export type Ledger<T extends DecisionSubject = DecisionSubject> = {
  entries: LedgerEntry<T>[];
  spentMinor: number;
  committedMinor: number;
  availableMinor: number;
};

const stateOf = (o: DecisionOutcome): LedgerState =>
  o === "authorized" ? "paid" : o === "blocked" ? "blocked" : "pending";

export function runLedger<T extends DecisionSubject>(
  subjects: T[],
  policy: Policy,
  ctx: Omit<EngineContext, "history" | "spentMinor" | "committedMinor"> & {
    baselineUsedMinor: number;
  },
  reviews: Record<string, HumanReview> = {},
): Ledger<T> {
  const sorted = [...subjects].sort(
    (a, b) => a.receivedAt.localeCompare(b.receivedAt) || a.id.localeCompare(b.id),
  );
  let spent = ctx.baselineUsedMinor;
  let committed = 0;
  const history: HistoryItem[] = [];
  const entries: LedgerEntry<T>[] = [];
  for (const subject of sorted) {
    const result = evaluateDecision(subject, policy, {
      ...ctx,
      history,
      spentMinor: spent,
      committedMinor: committed,
    });
    const state = stateOf(result.outcome);
    const baseMinor = result.baseAmountMinor;
    if (state === "paid") spent += baseMinor;
    if (state === "pending") committed += baseMinor;
    const entry: LedgerEntry<T> = { subject, result, state, baseMinor };
    entries.push(entry);
    history.push({ subject, state, baseMinor });
  }
  // Human reviews apply in the order they were made. Pending records already reserved
  // their amount, so approving one moves it from reserved to paid.
  const byId = new Map(entries.map((e) => [e.subject.id, e]));
  Object.entries(reviews)
    .sort((a, b) => a[1].at.localeCompare(b[1].at))
    .forEach(([id, review]) => {
      const e = byId.get(id);
      if (!e || e.state !== "pending") return;
      e.review = review;
      if (review.action === "approved") {
        committed -= e.baseMinor;
        spent += e.baseMinor;
        e.state = "paid";
      } else if (review.action === "rejected") {
        committed -= e.baseMinor;
        e.state = "rejected";
      }
    });
  for (const e of entries) {
    if (e.state === "paid")
      e.payment = {
        txn: `sbx_${hash(e.subject.id + e.subject.reference).slice(0, 12)}`,
        rail: "Sandbox de pagos (simulado)",
        at: e.review?.at ?? e.subject.receivedAt,
      };
  }
  return {
    entries,
    spentMinor: spent,
    committedMinor: committed,
    availableMinor: policy.monthlyBudget - spent - committed,
  };
}
