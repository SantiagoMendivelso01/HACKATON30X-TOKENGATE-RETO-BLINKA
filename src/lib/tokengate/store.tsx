// In-memory demo store (React context). Not a tamper-proof audit log; resets on reload.
import { createContext, useContext, useMemo, useReducer, type ReactNode } from "react";
import { evaluateDecision } from "./decision-engine";
import { CURRENT_USER, baselineUsage, initialAudit, initialInvoices, initialPolicy, initialPurchases, agents } from "./mock-data";
import { displayStatus } from "./status";
import type { AnySubject, AuditEvent, DecisionRecord, DecisionResult, DecisionSubject, DisplayStatus, HumanAction, HumanReview, Invoice, Policy, Purchase } from "./types";

type State = {
  invoices: Invoice[];
  purchases: Purchase[];
  policy: Policy;
  reviews: Record<string, HumanReview>;
  humanLog: DecisionRecord[];
  audit: AuditEvent[];
  clock: number; // monotonic demo clock (ms) so new events sort after seed data
};

type Action =
  | { type: "review"; subjectId: string; action: HumanAction; note?: string | undefined; result: DecisionResult }
  | { type: "savePolicy"; policy: Policy; summary: string }
  | { type: "addInvoice"; invoice: Invoice }
  | { type: "audit"; event: Omit<AuditEvent, "id" | "at"> };

const START = Date.parse("2026-10-17T12:00:00Z");

function nextAt(state: State) {
  const clock = state.clock + 60_000;
  return { clock, at: new Date(clock).toISOString() };
}

const actionLabel: Record<HumanAction, string> = {
  approved: "aprobada (autorización simulada, sin movimiento de dinero)",
  rejected: "rechazada",
  info_requested: "devuelta: se solicitó más información",
};

function reducer(state: State, a: Action): State {
  const { clock, at } = nextAt(state);
  switch (a.type) {
    case "review": {
      const subject = [...state.invoices, ...state.purchases].find((s) => s.id === a.subjectId);
      const ref = subject?.reference ?? a.subjectId;
      return {
        ...state,
        clock,
        reviews: { ...state.reviews, [a.subjectId]: { action: a.action, by: CURRENT_USER, at, note: a.note } },
        humanLog: [
          { id: `hd-${clock}`, subjectId: a.subjectId, at, actor: "human", actorName: CURRENT_USER, result: a.result, humanAction: a.action, note: a.note },
          ...state.humanLog,
        ],
        audit: [
          { id: `au-${clock}`, at, type: "human_review", actor: CURRENT_USER, actorKind: "human", summary: `${ref} ${actionLabel[a.action]}`, reason: a.note || undefined },
          ...state.audit,
        ],
      };
    }
    case "savePolicy": {
      const [maj, min] = state.policy.version.slice(1).split(".").map(Number);
      const policy = { ...a.policy, version: `v${maj}.${(min ?? 0) + 1}` };
      return {
        ...state,
        clock,
        policy,
        audit: [{ id: `au-${clock}`, at, type: "policy_change", actor: CURRENT_USER, actorKind: "human", summary: `Política actualizada a ${policy.version}`, reason: a.summary }, ...state.audit],
      };
    }
    case "addInvoice":
      return {
        ...state,
        clock,
        invoices: [...state.invoices, a.invoice],
        audit: [{ id: `au-${clock}`, at, type: "invoice_upload", actor: CURRENT_USER, actorKind: "human", summary: `Factura ${a.invoice.reference} cargada`, reason: `${a.invoice.supplier} · simulación` }, ...state.audit],
      };
    case "audit":
      return { ...state, clock, audit: [{ ...a.event, id: `au-${clock}`, at }, ...state.audit] };
  }
}

export type EvaluatedSubject<T extends DecisionSubject = AnySubject> = {
  subject: T;
  result: DecisionResult;
  status: DisplayStatus;
  review?: HumanReview | undefined;
  evaluatedAt: string;
};

/** Runs the engine for every subject, comparing each one only against earlier records for duplicates. */
function evaluateAll<T extends DecisionSubject>(list: T[], policy: Policy, reviews: State["reviews"], dateOf: (s: T) => string) {
  const sorted = [...list].sort((a, b) => dateOf(a).localeCompare(dateOf(b)));
  return sorted.map((subject, i): EvaluatedSubject<T> => {
    const result = evaluateDecision(subject, policy, { budgetUsage: baselineUsage, otherSubjects: sorted.slice(0, i) });
    const review = reviews[subject.id];
    return { subject, result, review, status: displayStatus(result.outcome, review), evaluatedAt: dateOf(subject) };
  });
}

function useStoreValue() {
  const [state, dispatch] = useReducer(reducer, {
    invoices: initialInvoices,
    purchases: initialPurchases,
    policy: initialPolicy,
    reviews: {},
    humanLog: [],
    audit: initialAudit,
    clock: START,
  });

  return useMemo(() => {
    const invoices = evaluateAll(state.invoices, state.policy, state.reviews, (s) => s.issueDate).reverse();
    const purchases = evaluateAll(state.purchases, state.policy, state.reviews, (s) => s.requestedAt).reverse();
    const all: EvaluatedSubject[] = [...invoices, ...purchases];
    const byId = new Map(all.map((e) => [e.subject.id, e]));

    const agentLog: DecisionRecord[] = all.map((e) => ({
      id: `ad-${e.subject.id}`,
      subjectId: e.subject.id,
      at: e.evaluatedAt,
      actor: "agent",
      actorName: agents.find((a) => a.id === e.subject.agentId)?.name ?? "Agente",
      result: e.result,
    }));
    const decisionLog = [...state.humanLog, ...agentLog].sort((a, b) => b.at.localeCompare(a.at));

    return {
      ...state,
      evaluatedInvoices: invoices,
      evaluatedPurchases: purchases,
      all,
      byId,
      decisionLog,
      review: (subjectId: string, action: HumanAction, note?: string) => {
        const e = byId.get(subjectId);
        if (e) dispatch({ type: "review", subjectId, action, note, result: e.result });
      },
      savePolicy: (policy: Policy, summary: string) => dispatch({ type: "savePolicy", policy, summary }),
      addInvoice: (invoice: Invoice) => dispatch({ type: "addInvoice", invoice }),
      logEvent: (event: Omit<AuditEvent, "id" | "at">) => dispatch({ type: "audit", event }),
    };
  }, [state]);
}

type Store = ReturnType<typeof useStoreValue>;
// Keep a single context instance across hot reloads so provider and consumers always match.
const g = globalThis as unknown as { __tokengateCtx?: React.Context<Store | null> };
const Ctx = (g.__tokengateCtx ??= createContext<Store | null>(null));

export function TokenGateProvider({ children }: { children: ReactNode }) {
  const value = useStoreValue();
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTokenGate() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useTokenGate must be used inside TokenGateProvider");
  return v;
}

export const agentName = (id: string) => agents.find((a) => a.id === id)?.name ?? id;
