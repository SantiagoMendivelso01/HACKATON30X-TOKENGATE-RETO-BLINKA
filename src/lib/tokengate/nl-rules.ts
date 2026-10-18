// Natural-language rule interpreter — DEMO HEURISTIC.
// In production Claude would translate the sentence into a policy patch (structured output),
// and the same preview + simulation flow below would apply before saving.
import type { Currency, Policy } from "./types";

export type PolicyChange = {
  field: keyof Policy;
  label: string;
  before: Policy[keyof Policy];
  after: Policy[keyof Policy];
};

const CURRENCIES: Currency[] = ["USD", "EUR", "COP", "MXN", "BRL", "ARS"];

function firstNumber(t: string): number | null {
  const m = t.match(/(\d{1,3}(?:[.,]\d{3})+|\d+(?:[.,]\d+)?)\s*(k|mil)?\b/);
  if (!m) return null;
  let n = m[1]!;
  n =
    /[.,]\d{3}$/.test(n) || /[.,]\d{3}[.,]/.test(n) ? n.replace(/[.,]/g, "") : n.replace(",", ".");
  let v = parseFloat(n);
  if (m[2]) v *= 1000;
  return v;
}

export function interpretRule(
  text: string,
  policy: Policy,
  fx: Partial<Record<Currency, number>> = {
    USD: 1,
    COP: 4150,
    EUR: 0.92,
    MXN: 18.2,
    BRL: 5.4,
    ARS: 980,
  },
): PolicyChange[] {
  const t = text.toLowerCase();
  const num = firstNumber(t);
  const out: PolicyChange[] = [];
  const set = <K extends keyof Policy>(field: K, after: Policy[K], label: string) =>
    out.push({ field, label, before: policy[field], after });

  // Detect if the user wrote the amount in EUR, COP, MXN, BRL, or ARS and convert to USD minor units
  const detectRate = (): number => {
    if (/\b(cop|pesos?\s+colombianos?)\b/.test(t)) return fx.COP ?? 4150;
    if (/\b(eur|euros?|€)\b/.test(t)) return fx.EUR ?? 0.92;
    if (/\b(mxn|pesos?\s+mexicanos?)\b/.test(t)) return fx.MXN ?? 18.2;
    if (/\b(brl|reales?)\b/.test(t)) return fx.BRL ?? 5.4;
    if (/\b(ars|pesos?\s+argentinos?)\b/.test(t)) return fx.ARS ?? 980;
    if (/\bpesos?\b/.test(t)) return fx.COP ?? 4150;
    return 1; // USD
  };
  const minor = (v: number) => Math.round((v / detectRate()) * 100);

  if (/(nuev[oa]s?|desconocid)/.test(t) && /(benefici|proveedor)/.test(t)) {
    set(
      "newSupplierAction",
      /(fren|bloque|rechaz|nunca)/.test(t) ? "block" : "review",
      "Proveedor nuevo",
    );
  } else if (/duplicad/.test(t)) {
    set(
      "duplicateAction",
      /(fren|bloque|rechaz|nunca)/.test(t) ? "block" : "review",
      "Posibles duplicados",
    );
  } else if (/(%|por ciento|tolerancia)/.test(t) && num != null) {
    set("contractTolerancePct", num, "Tolerancia frente al contrato (%)");
  } else if (/confianza/.test(t) && num != null) {
    set("minConfidence", num <= 1 ? Math.round(num * 100) : num, "Confianza mínima de lectura (%)");
  } else if (/(presupuesto|mensual|al mes|por mes|periodo)/.test(t) && num != null) {
    set("monthlyBudget", minor(num), "Presupuesto del periodo (USD)");
  } else if (/(nunca|jam[aá]s|m[aá]ximo|tope|no pagues m[aá]s)/.test(t) && num != null) {
    set("transactionLimit", minor(num), "Límite por transacción (USD)");
  } else if (
    /(aprob|human|persona|revis|autoriz|permiso|consult|cfo|finanzas)/.test(t) &&
    num != null
  ) {
    set("approvalThreshold", minor(num), "Aprobación humana por encima de (USD)");
  }

  const mentioned = (t.match(/\b(usd|eur|cop|mxn|brl|ars)\b/g) ?? [])
    .map((c) => c.toUpperCase() as Currency)
    .filter((c) => CURRENCIES.includes(c));
  if (mentioned.length && /(no acept|prohib|no permit|bloque|quita|elimina)/.test(t)) {
    const remove: Currency[] = mentioned.filter((c) => c !== "USD");
    set(
      "allowedCurrencies",
      policy.allowedCurrencies.filter((c) => !remove.includes(c)),
      "Monedas permitidas",
    );
  } else if (mentioned.length && /(acept|permit|agrega|añade)/.test(t) && !out.length) {
    set(
      "allowedCurrencies",
      [...new Set([...policy.allowedCurrencies, ...mentioned])],
      "Monedas permitidas",
    );
  }
  return out;
}

/**
 * Several rules in one text, as people dictate them: "Pide permiso por encima de 2.000 dólares y
 * frena a los proveedores nuevos." Each sentence is read in order on top of the previous ones.
 */
export function interpretRules(
  text: string,
  policy: Policy,
  fx?: Partial<Record<Currency, number>>,
): { changes: PolicyChange[]; next: Policy; unread: string[] } {
  const parts = text
    .split(
      /[.;](?=\s|$)|\n+|,?\s+y\s+(?=(?:adem[aá]s\s+)?(?:nunca|jam[aá]s|fren|bloque|el presupuesto|presupuesto|cualquier|acepta|no acept|pide|exige|sube|baja|toler|si\b|que\b))/i,
    )
    .map((p) => p.trim())
    .filter((p) => p.length > 3);
  let next = { ...policy };
  const byField = new Map<keyof Policy, PolicyChange>();
  const unread: string[] = [];
  for (const p of parts) {
    const found = interpretRule(p, next, fx);
    if (!found.length) unread.push(p);
    for (const c of found) {
      const prev = byField.get(c.field);
      byField.set(c.field, { ...c, before: prev ? prev.before : c.before });
      next = { ...next, [c.field]: c.after };
    }
  }
  return { changes: [...byField.values()], next, unread };
}

export const RULE_EXAMPLES = [
  "Cualquier pago de más de 2.000 USD necesita aprobación de una persona",
  "Nunca pagues más de 10.000 USD en una sola factura",
  "El presupuesto de octubre es de 80.000 USD",
  "Frena cualquier pago a un proveedor nuevo",
  "Acepta una tolerancia de 10% frente al contrato",
  "No aceptes pagos en ARS",
];
