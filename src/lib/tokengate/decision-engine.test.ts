import { describe, expect, it } from "vitest";
import { evaluateDecision, type EngineContext } from "./decision-engine";
import { initialPolicy } from "./mock-data";
import { parseToMinor } from "./format";
import type { DecisionSubject } from "./types";

const base: DecisionSubject = {
  id: "t1",
  kind: "invoice",
  reference: "INV-T1",
  supplier: "Linear",
  amount: { amountMinor: 12000, currency: "USD" },
  agentId: "ag-saas",
  description: "",
  category: "Software",
  missingFields: [],
};
const ctx: EngineContext = { budgetUsage: { USD: 842000, EUR: 51000, COP: 96250000 }, otherSubjects: [] };
const run = (s: Partial<DecisionSubject>, c = ctx) => evaluateDecision({ ...base, ...s }, initialPolicy, c);

describe("decision engine", () => {
  it("authorizes an approved supplier below every threshold", () => {
    expect(run({}).outcome).toBe("authorized");
  });
  it("blocks an unknown supplier", () => {
    expect(run({ supplier: "Proveedor desconocido" }).outcome).toBe("blocked");
  });
  it("blocks amounts above the USD 1.000 transaction limit", () => {
    expect(run({ amount: { amountMinor: 100001, currency: "USD" } }).outcome).toBe("blocked");
  });
  it("requires human approval above USD 300", () => {
    expect(run({ amount: { amountMinor: 30001, currency: "USD" } }).outcome).toBe("requires_approval");
    expect(run({ amount: { amountMinor: 30000, currency: "USD" } }).outcome).toBe("authorized");
  });
  it("asks for information when fields are missing", () => {
    expect(run({ missingFields: ["NIF"] }).outcome).toBe("needs_information");
  });
  it("blocking rules take precedence over approval and missing info", () => {
    expect(run({ supplier: "X", missingFields: ["NIF"], amount: { amountMinor: 50000, currency: "USD" } }).outcome).toBe("blocked");
  });
  it("flags a duplicate for review", () => {
    const r = run({ id: "t2" }, { ...ctx, otherSubjects: [base] });
    expect(r.outcome).toBe("requires_approval");
  });
  it("blocks when remaining budget is insufficient", () => {
    expect(run({}, { ...ctx, budgetUsage: { USD: 1195000, EUR: 0, COP: 0 } }).outcome).toBe("blocked");
  });
  it("is deterministic for identical inputs", () => {
    expect(run({ amount: { amountMinor: 42000, currency: "USD" } })).toEqual(run({ amount: { amountMinor: 42000, currency: "USD" } }));
  });
  it("parses decimal input without floating point", () => {
    expect(parseToMinor("1.250,50")).toBe(125050);
    expect(parseToMinor("0.1")).toBe(10);
    expect(parseToMinor("abc")).toBeNull();
  });
});
