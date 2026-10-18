// The organization's stored state and how each action changes it. Pure: no React, no network.
// Every action returns the next state plus the rows it adds, so the store can save them first
// and only show the change once the database confirms it.
import { formatMoney } from "./format";
import { completeSubject } from "./missing-fields";
import { ORG } from "./org";
import type {
  AnySubject,
  AuditEvent,
  DecisionRecord,
  DecisionResult,
  HumanAction,
  HumanReview,
  Invoice,
  OrgConfig,
  Policy,
  Purchase,
} from "./types";

export const defaultConfig = (): OrgConfig => ({
  name: ORG.name,
  jurisdiction: ORG.jurisdiction,
  period: ORG.period,
  inbox: ORG.inbox,
  user: { ...ORG.user },
  fx: { ...ORG.fx },
  baselineUsedMinor: ORG.baselineUsedMinor,
  suppliers: [...ORG.suppliers],
  agents: [...ORG.agents],
});

export type OrgState = {
  config: OrgConfig;
  invoices: Invoice[];
  purchases: Purchase[];
  policy: Policy;
  reviews: Record<string, HumanReview>;
  humanLog: DecisionRecord[];
  audit: AuditEvent[];
};

export type State = OrgState & { clock: number };

/** What the database stores: only inputs. Agent decisions are recomputed by the engine. */
export type Rows = {
  subjects: AnySubject[];
  /** Human reviews, each with the engine result the person saw. */
  reviews: DecisionRecord[];
  /** Saved policy versions, oldest first. */
  policies: Policy[];
  audit: AuditEvent[];
};

export const emptyRows = (): Rows => ({ subjects: [], reviews: [], policies: [], audit: [] });

export type Action =
  | {
      type: "review";
      subjectId: string;
      action: HumanAction;
      note?: string | undefined;
      result: DecisionResult;
    }
  | { type: "savePolicy"; policy: Policy; summary: string }
  | { type: "saveConfig"; config: OrgConfig; summary: string }
  | { type: "addInvoice"; invoice: Invoice }
  | { type: "addPurchase"; purchase: Purchase }
  | { type: "completeFields"; subjectId: string; values: Record<string, string>; note?: string | undefined }
  | { type: "audit"; event: Omit<AuditEvent, "id" | "at"> };

const byAt = (a: { at: string }, b: { at: string }) => a.at.localeCompare(b.at);
const byReceived = (a: AnySubject, b: AnySubject) => a.receivedAt.localeCompare(b.receivedAt);

type StoredAuditEvent = AuditEvent & { config?: OrgConfig | undefined };

/** Rebuilds the state from stored rows. The latest review/config/policy is the one that counts. */
export function stateFromRows(rows: Rows, defaultPolicy: Policy = ORG.policy): State {
  // Deduplicate subjects by ID (keeping the latest entry if updated/corrected)
  const subjectMap = new Map<string, AnySubject>();
  for (const s of rows.subjects) {
    subjectMap.set(s.id, s);
  }
  const subjects = [...subjectMap.values()].sort(byReceived);
  const humanLog = [...rows.reviews].sort(byAt);
  const reviews: Record<string, HumanReview> = {};
  for (const r of humanLog)
    if (r.humanAction)
      reviews[r.subjectId] = { action: r.humanAction, by: r.actorName, at: r.at, note: r.note };

  const sortedAudit = ([...rows.audit] as StoredAuditEvent[]).sort(byAt);
  let config = defaultConfig();
  for (const e of sortedAudit) {
    if (e.config) {
      config = {
        ...config,
        ...e.config,
        user: e.config.user ?? config.user,
        fx: { ...config.fx, ...e.config.fx },
        suppliers: e.config.suppliers ?? config.suppliers,
        agents: e.config.agents ?? config.agents,
      };
    }
  }

  const audit = [...sortedAudit].reverse();
  const last = [...rows.reviews.map((r) => r.at), ...rows.audit.map((e) => e.at)]
    .map(Date.parse)
    .reduce((a, b) => Math.max(a, b), 0);

  const storedPolicy = rows.policies.at(-1);
  // If an older stored policy only had ["USD"] before multi-currency was configured, merge default currencies unless explicitly customized
  const policy: Policy = storedPolicy
    ? {
        ...storedPolicy,
        allowedCurrencies:
          storedPolicy.allowedCurrencies.length <= 1 &&
          !rows.audit.some((e) => e.type === "settings")
            ? defaultPolicy.allowedCurrencies
            : storedPolicy.allowedCurrencies,
      }
    : defaultPolicy;

  return {
    config,
    invoices: subjects.filter((s): s is Invoice => s.kind === "invoice"),
    purchases: subjects.filter((s): s is Purchase => s.kind === "purchase"),
    policy,
    reviews,
    humanLog: humanLog.reverse(),
    audit,
    // Keep the clock ahead of anything already stored so new events sort after them.
    clock: Math.max(Date.now(), last),
  };
}

const actionLabel: Record<HumanAction, string> = {
  approved: "aprobada: pago enviado al sandbox (simulado, sin movimiento de dinero)",
  rejected: "rechazada",
  info_requested: "devuelta: se solicitó más información",
};

/** Applies an action: the next state and the rows to store for it. */
export function apply(state: State, a: Action): { next: State; writes: Rows } {
  // Never go back in time, even if two actions land in the same millisecond.
  const clock = Math.max(Date.now(), state.clock + 1);
  const at = new Date(clock).toISOString();
  const o = state;
  const user = o.config.user.name;
  const writes = emptyRows();
  const put = (next: Partial<OrgState>) => ({ next: { ...state, ...next, clock }, writes });
  const event = (
    e: Omit<AuditEvent, "id" | "at"> & { config?: OrgConfig | undefined },
  ): AuditEvent => {
    const out = { ...e, id: `au-${clock}`, at };
    writes.audit.push(out);
    return out;
  };

  switch (a.type) {
    case "review": {
      const subject = [...o.invoices, ...o.purchases].find((s) => s.id === a.subjectId);
      const ref = subject?.reference ?? a.subjectId;
      const record: DecisionRecord = {
        id: `hd-${clock}`,
        subjectId: a.subjectId,
        at,
        actor: "human",
        actorName: user,
        result: a.result,
        humanAction: a.action,
        note: a.note,
      };
      writes.reviews.push(record);
      return put({
        reviews: { ...o.reviews, [a.subjectId]: { action: a.action, by: user, at, note: a.note } },
        humanLog: [record, ...o.humanLog],
        audit: [
          event({
            type: "human_review",
            actor: user,
            actorKind: "human",
            summary: `${ref} ${actionLabel[a.action]}`,
            reason: a.note || undefined,
            subjectId: a.subjectId,
          }),
          ...o.audit,
        ],
      });
    }
    case "savePolicy": {
      const [maj, min] = o.policy.version.slice(1).split(".").map(Number);
      const policy = { ...a.policy, version: `v${maj}.${(min ?? 0) + 1}` };
      writes.policies.push(policy);
      return put({
        policy,
        audit: [
          event({
            type: "policy_change",
            actor: user,
            actorKind: "human",
            summary: `Política actualizada a ${policy.version}`,
            reason: a.summary,
          }),
          ...o.audit,
        ],
      });
    }
    case "saveConfig": {
      const actor = a.config.user.name || user;
      return put({
        config: a.config,
        audit: [
          event({
            type: "settings",
            actor,
            actorKind: "human",
            summary: "Configuración de organización actualizada",
            reason: a.summary,
            config: a.config,
          }),
          ...o.audit,
        ],
      });
    }
    case "addInvoice": {
      const invoice = { ...a.invoice, receivedAt: a.invoice.receivedAt || at };
      writes.subjects.push(invoice);
      return put({
        invoices: [...o.invoices, invoice],
        audit: [
          event({
            type: "invoice_upload",
            actor: user,
            actorKind: "human",
            summary: `Factura ${invoice.reference} cargada`,
            reason: `${invoice.supplier} · ${formatMoney(invoice.amount)}`,
            subjectId: invoice.id,
          }),
          ...o.audit,
        ],
      });
    }
    case "addPurchase": {
      const purchase = {
        ...a.purchase,
        receivedAt: a.purchase.receivedAt || at,
        requestedAt: a.purchase.requestedAt || at,
      };
      writes.subjects.push(purchase);
      return put({
        purchases: [...o.purchases, purchase],
        audit: [
          event({
            type: "invoice_upload",
            actor: user,
            actorKind: "human",
            summary: `Solicitud de compra ${purchase.reference} registrada`,
            reason: `${purchase.supplier} · ${formatMoney(purchase.amount)}`,
            subjectId: purchase.id,
          }),
          ...o.audit,
        ],
      });
    }
    case "completeFields": {
      const prev = [...o.invoices, ...o.purchases].find((s) => s.id === a.subjectId);
      if (!prev) return { next: state, writes };
      const updated = completeSubject(prev, a.values);
      const filled = prev.missingFields.filter((l) => !updated.missingFields.includes(l));
      writes.subjects.push(updated);
      return put({
        invoices: o.invoices.map((s) => (s.id === updated.id ? (updated as Invoice) : s)),
        purchases: o.purchases.map((s) => (s.id === updated.id ? (updated as Purchase) : s)),
        audit: [
          event({
            type: "human_review",
            actor: user,
            actorKind: "human",
            summary: `${prev.reference}: datos completados (${filled.join(", ") || "ninguno"}) y reevaluada`,
            reason: a.note || undefined,
            subjectId: prev.id,
          }),
          ...o.audit,
        ],
      });
    }
    case "audit":
      return put({ audit: [event(a.event), ...o.audit] });
  }
}
