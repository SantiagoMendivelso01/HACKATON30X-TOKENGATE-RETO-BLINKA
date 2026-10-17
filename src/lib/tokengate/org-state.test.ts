import { describe, expect, it } from "vitest";
import { ORG } from "./org";
import { apply, emptyRows, stateFromRows, type Action, type Rows, type State } from "./org-state";
import type { DecisionResult, Invoice } from "./types";

const invoice = (id: string, receivedAt = ""): Invoice => ({
  id,
  kind: "invoice",
  reference: `INV-${id}`,
  supplier: "Proveedor",
  amount: { amountMinor: 120_000, currency: "USD" },
  agentId: "agent",
  description: "Servicio",
  category: "Servicios",
  missingFields: [],
  receivedAt,
  channel: "upload",
  issueDate: "2026-10-01T00:00:00.000Z",
  dueDate: "2026-10-30T00:00:00Z",
  extractionConfidence: 100,
});

const result: DecisionResult = {
  outcome: "requires_approval",
  rules: [],
  reasons: ["human_approval_threshold"],
  explanation: "Supera el umbral.",
  policyVersion: "v1.0",
  baseAmountMinor: 120_000,
};

// What comes back from jsonb: undefined fields are dropped.
const viaDb = (rows: Rows): Rows => JSON.parse(JSON.stringify(rows)) as Rows;

/** Runs the actions like the store does and collects every row it would save. */
function run(actions: Action[]): { state: State; saved: Rows } {
  let state = stateFromRows(emptyRows());
  const saved = emptyRows();
  for (const a of actions) {
    const { next, writes } = apply(state, a);
    for (const k of Object.keys(saved) as (keyof Rows)[])
      (saved[k] as unknown[]).push(...writes[k]);
    state = next;
  }
  return { state, saved };
}

const orgFields = ({ clock, ...o }: State) => JSON.parse(JSON.stringify(o)) as unknown;

describe("persistence", () => {
  it("starts from the default policy when nothing is stored", () => {
    const s = stateFromRows(emptyRows());
    expect(s.policy).toEqual(ORG.policy);
    expect(s.invoices).toEqual([]);
    expect(s.audit).toEqual([]);
  });

  it("saves exactly what each action adds", () => {
    const { saved } = run([
      { type: "addInvoice", invoice: invoice("a") },
      { type: "review", subjectId: "a", action: "approved", result },
      { type: "savePolicy", policy: ORG.policy, summary: "Cambio" },
      { type: "audit", event: { type: "settings", actor: "X", actorKind: "human", summary: "s" } },
    ]);
    expect(saved.subjects.map((s) => s.id)).toEqual(["a"]);
    expect(saved.subjects[0]!.receivedAt).not.toBe("");
    expect(saved.reviews.map((r) => r.humanAction)).toEqual(["approved"]);
    expect(saved.policies.map((p) => p.version)).toEqual(["v1.1"]);
    expect(saved.audit.map((e) => e.type)).toEqual([
      "invoice_upload",
      "human_review",
      "policy_change",
      "settings",
    ]);
    expect(new Set(saved.audit.map((e) => e.id)).size).toBe(4);
  });

  it("rebuilds the same state after a reload", () => {
    const { state, saved } = run([
      { type: "addInvoice", invoice: invoice("a") },
      { type: "addInvoice", invoice: invoice("b") },
      { type: "review", subjectId: "a", action: "info_requested", note: "Falta el NIT", result },
      { type: "review", subjectId: "a", action: "approved", result },
      { type: "review", subjectId: "b", action: "rejected", result },
      { type: "savePolicy", policy: ORG.policy, summary: "Primera" },
      { type: "savePolicy", policy: { ...ORG.policy, minConfidence: 90 }, summary: "Segunda" },
    ]);
    const reloaded = stateFromRows(viaDb(saved));
    expect(orgFields(reloaded)).toEqual(orgFields(state));
    expect(reloaded.reviews["a"]?.action).toBe("approved");
    expect(reloaded.policy.version).toBe("v1.2");
    expect(reloaded.clock).toBeGreaterThanOrEqual(state.clock);
  });

  it("keeps new events after the stored ones even if the server clock is behind", () => {
    const future = "2999-01-01T00:00:00.000Z";
    const s = stateFromRows({
      ...emptyRows(),
      audit: [
        { id: "au-1", at: future, type: "system", actor: "s", actorKind: "system", summary: "x" },
      ],
    });
    const { writes } = apply(s, {
      type: "audit",
      event: { type: "settings", actor: "X", actorKind: "human", summary: "y" },
    });
    expect(writes.audit[0]!.at > future).toBe(true);
  });
});
