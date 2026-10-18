import { describe, expect, it } from "vitest";
import { runLedger } from "./decision-engine";
import { buildDemoCases, demoConfig, demoPolicy } from "./demo-set";

describe("set de demostración", () => {
  const cases = buildDemoCases(new Date("2026-10-17T12:00:00Z"));
  const config = demoConfig();
  const ledger = runLedger(
    cases.map((c) => c.invoice),
    demoPolicy(),
    {
      fx: config.fx,
      suppliers: config.suppliers,
      agents: config.agents,
      baselineUsedMinor: config.baselineUsedMinor,
    },
  );

  it.each(cases.map((c, i) => [c.invoice.reference, c, i] as const))(
    "%s decide lo esperado",
    (_ref, c, i) => {
      const e = ledger.entries[i]!;
      expect(e.subject.id).toBe(c.invoice.id);
      expect({ case: c.label, outcome: e.result.outcome }).toEqual({
        case: c.label,
        outcome: c.expected,
      });
    },
  );

  it("nunca autoriza una factura con una regla incumplida", () => {
    for (const e of ledger.entries)
      if (e.result.outcome === "authorized")
        expect(
          e.result.rules.filter((r) => r.status === "failed" || r.status === "needs_review"),
        ).toEqual([]);
  });

  it("bloquea el caso de presupuesto solo por presupuesto", () => {
    const budget = ledger.entries.at(-1)!;
    expect(budget.result.reasons).toEqual(["budget_available"]);
  });

  it("incluye los cinco casos trampa del reto", () => {
    const reasons = new Set(ledger.entries.flatMap((e) => e.result.reasons));
    for (const r of [
      "duplicate_check",
      "supplier_authorized",
      "contract_match",
      "human_approval_threshold",
      "budget_available",
    ] as const)
      expect(reasons).toContain(r);
  });
});
