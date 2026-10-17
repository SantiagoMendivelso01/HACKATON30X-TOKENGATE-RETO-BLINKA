// In-memory demo store (React context). Resets on reload. Two demo organizations can be switched.
import { createContext, useContext, useMemo, useReducer, type ReactNode } from "react";
import { runLedger, type Ledger, type LedgerState } from "./decision-engine";
import { DEFAULT_ORG, ORGS } from "./mock-data";
import { displayStatus, needsAttention } from "./status";
import { chain, verifyChain, type ChainedEvent } from "./hash";
import { formatBase, formatMoney } from "./format";
import type {
  AlertSeverity,
  AnySubject,
  AuditEvent,
  DecisionRecord,
  DecisionResult,
  DecisionSubject,
  DisplayStatus,
  HumanAction,
  HumanReview,
  Invoice,
  OrgId,
  OrgSeed,
  Policy,
  Purchase,
} from "./types";

type OrgState = {
  invoices: Invoice[];
  purchases: Purchase[];
  policy: Policy;
  reviews: Record<string, HumanReview>;
  humanLog: DecisionRecord[];
  audit: AuditEvent[];
  incomingCount: number;
  attackCount: number;
};

type State = { org: OrgId; orgs: Record<OrgId, OrgState>; clock: number; tamper: boolean };

type Action =
  | { type: "switchOrg"; org: OrgId }
  | {
      type: "review";
      subjectId: string;
      action: HumanAction;
      note?: string | undefined;
      result: DecisionResult;
    }
  | { type: "savePolicy"; policy: Policy; summary: string }
  | { type: "addInvoice"; invoice: Invoice }
  | { type: "receive" }
  | { type: "attack" }
  | { type: "clearAttacks" }
  | { type: "tamper" }
  | { type: "audit"; event: Omit<AuditEvent, "id" | "at"> };

const START = Date.parse("2026-10-17T12:00:00Z");

const initOrg = (seed: OrgSeed): OrgState => ({
  invoices: seed.invoices,
  purchases: seed.purchases,
  policy: seed.policy,
  reviews: {},
  humanLog: [],
  audit: seed.audit,
  incomingCount: 0,
  attackCount: 0,
});

const initialState = (): State => ({
  org: DEFAULT_ORG,
  orgs: { andes: initOrg(ORGS.andes), acme: initOrg(ORGS.acme) },
  clock: START,
  tamper: false,
});

const actionLabel: Record<HumanAction, string> = {
  approved: "aprobada: pago enviado al sandbox (simulado, sin movimiento de dinero)",
  rejected: "rechazada",
  info_requested: "devuelta: se solicitó más información",
};

function reducer(state: State, a: Action): State {
  const clock = state.clock + 60_000;
  const at = new Date(clock).toISOString();
  const seed = ORGS[state.org];
  const o = state.orgs[state.org];
  const user = seed.user.name;
  const put = (next: Partial<OrgState>): State => ({
    ...state,
    clock,
    orgs: { ...state.orgs, [state.org]: { ...o, ...next } },
  });
  const event = (e: Omit<AuditEvent, "id" | "at">, offset = 0): AuditEvent => ({
    ...e,
    id: `au-${clock}-${offset}`,
    at: new Date(clock + offset * 1000).toISOString(),
  });

  switch (a.type) {
    case "switchOrg":
      return { ...state, org: a.org };
    case "review": {
      const subject = [...o.invoices, ...o.purchases].find((s) => s.id === a.subjectId);
      const ref = subject?.reference ?? a.subjectId;
      return put({
        reviews: { ...o.reviews, [a.subjectId]: { action: a.action, by: user, at, note: a.note } },
        humanLog: [
          {
            id: `hd-${clock}`,
            subjectId: a.subjectId,
            at,
            actor: "human",
            actorName: user,
            result: a.result,
            humanAction: a.action,
            note: a.note,
          },
          ...o.humanLog,
        ],
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
    case "addInvoice":
      return put({
        invoices: [...o.invoices, { ...a.invoice, receivedAt: a.invoice.receivedAt || at }],
        audit: [
          event({
            type: "invoice_upload",
            actor: user,
            actorKind: "human",
            summary: `Factura ${a.invoice.reference} cargada`,
            reason: `${a.invoice.supplier} · ${formatMoney(a.invoice.amount)}`,
            subjectId: a.invoice.id,
          }),
          ...o.audit,
        ],
      });
    case "receive": {
      const tpl = seed.incoming[o.incomingCount % seed.incoming.length];
      if (!tpl) return state;
      const n = o.incomingCount + 1;
      const inv: Invoice = {
        ...tpl,
        id: `${state.org}-in-${n}`,
        reference: `${state.org === "andes" ? "AL" : "INV"}-2026-${2000 + n}`,
        receivedAt: at,
        issueDate: at,
      };
      return put({
        incomingCount: n,
        invoices: [...o.invoices, inv],
        audit: [
          event({
            type: "invoice_upload",
            actor: "Buzón de facturas",
            actorKind: "system",
            summary: `Correo recibido en ${seed.inbox}: ${inv.reference}`,
            reason: `${inv.supplier} · ${formatMoney(inv.amount)}`,
            subjectId: inv.id,
          }),
          ...o.audit,
        ],
      });
    }
    case "attack": {
      const traps: Invoice[] = seed.attacks.map((t, i) => ({
        ...t,
        id: `${state.org}-atk-${o.attackCount + i + 1}`,
        reference: `ATK-${String(o.attackCount + i + 1).padStart(3, "0")}`,
        receivedAt: new Date(clock + i * 1000).toISOString(),
        issueDate: at,
      }));
      return put({
        attackCount: o.attackCount + traps.length,
        invoices: [...o.invoices, ...traps],
        audit: [
          event({
            type: "attack",
            actor: "Agente atacante",
            actorKind: "system",
            summary: `Red team: ${traps.length} facturas trampa enviadas al agente`,
            reason: [...new Set(traps.map((t) => t.attack))].join(" · "),
          }),
          ...o.audit,
        ],
      });
    }
    case "clearAttacks":
      return put({ invoices: o.invoices.filter((i) => !i.attack) });
    case "tamper":
      return { ...state, tamper: !state.tamper };
    case "audit":
      return put({ audit: [event(a.event), ...o.audit] });
  }
}

export type EvaluatedSubject<T extends DecisionSubject = AnySubject> = {
  subject: T;
  result: DecisionResult;
  status: DisplayStatus;
  review?: HumanReview | undefined;
  evaluatedAt: string;
  state: LedgerState;
  baseMinor: number;
  payment?: { txn: string; rail: string; at: string } | undefined;
};

export type AlertItem = {
  severity: AlertSeverity;
  text: string;
  subjectId?: string | undefined;
  at: string;
};
export type TrailEvent = ChainedEvent<{
  at: string;
  type: AuditEvent["type"];
  summary: string;
  actor: string;
  actorKind: AuditEvent["actorKind"];
  reason?: string | undefined;
  subjectId?: string | undefined;
}>;

function ledgerFor(
  seed: OrgSeed,
  o: OrgState,
  policy: Policy = o.policy,
  reviews = o.reviews,
): Ledger<AnySubject> {
  return runLedger<AnySubject>(
    [...o.invoices, ...o.purchases],
    policy,
    {
      fx: seed.fx,
      suppliers: seed.suppliers,
      agents: seed.agents,
      baselineUsedMinor: seed.baselineUsedMinor,
    },
    reviews,
  );
}

function useStoreValue() {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);

  return useMemo(() => {
    const seed = ORGS[state.org];
    const o = state.orgs[state.org];
    const ledger = ledgerFor(seed, o);

    const evaluated: EvaluatedSubject[] = ledger.entries.map((e) => ({
      subject: e.subject,
      result: e.result,
      review: e.review,
      status: displayStatus(e.result.outcome, e.review),
      evaluatedAt: e.subject.receivedAt,
      state: e.state,
      baseMinor: e.baseMinor,
      payment: e.payment,
    }));
    const desc = [...evaluated].reverse();
    const evaluatedInvoices = desc.filter(
      (e) => e.subject.kind === "invoice",
    ) as EvaluatedSubject<Invoice>[];
    const evaluatedPurchases = desc.filter(
      (e) => e.subject.kind === "purchase",
    ) as EvaluatedSubject<Purchase>[];
    const all: EvaluatedSubject[] = desc;
    const byId = new Map(all.map((e) => [e.subject.id, e]));
    const agentName = (id: string) => seed.agents.find((a) => a.id === id)?.name ?? id;

    const agentLog: DecisionRecord[] = all.map((e) => ({
      id: `ad-${e.subject.id}`,
      subjectId: e.subject.id,
      at: e.evaluatedAt,
      actor: "agent",
      actorName: agentName(e.subject.agentId),
      result: e.result,
    }));
    const decisionLog = [...o.humanLog, ...agentLog].sort((a, b) => b.at.localeCompare(a.at));

    // Alerts raised while evaluating, plus queue age and budget level.
    const alerts: AlertItem[] = [];
    for (const e of all)
      for (const r of e.result.rules)
        if (r.alert && r.status !== "passed")
          alerts.push({ ...r.alert, subjectId: e.subject.id, at: e.evaluatedAt });
    const now = state.clock;
    for (const e of all.filter((x) => needsAttention(x.status))) {
      const d = Math.floor((now - Date.parse(e.evaluatedAt)) / 86_400_000);
      if (d >= 2)
        alerts.push({
          severity: "medium",
          text: `Lleva ${d} días esperando una decisión humana`,
          subjectId: e.subject.id,
          at: e.evaluatedAt,
        });
    }
    const pct = (ledger.availableMinor / o.policy.monthlyBudget) * 100;
    if (pct < o.policy.budgetAlertPct)
      alerts.push({
        severity: "high",
        text: `Presupuesto bajo: quedan ${formatBase(ledger.availableMinor)} (${Math.max(0, pct).toFixed(0)}% del periodo)`,
        at: new Date(now).toISOString(),
      });
    const sevOrder: Record<AlertSeverity, number> = { critical: 0, high: 1, medium: 2 };
    alerts.sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity] || b.at.localeCompare(a.at));

    // Chronological, hash-chained audit trail: human/system events + every agent decision and payment.
    const raw: Omit<TrailEvent, "prev" | "hash">[] = [
      ...o.audit.map((e) => ({
        at: e.at,
        type: e.type,
        summary: e.summary,
        actor: e.actor,
        actorKind: e.actorKind,
        reason: e.reason,
        subjectId: e.subjectId,
      })),
      ...evaluated.flatMap((e) => {
        const out: Omit<TrailEvent, "prev" | "hash">[] = [
          {
            at: e.evaluatedAt,
            type: "decision",
            actor: agentName(e.subject.agentId),
            actorKind: "agent",
            subjectId: e.subject.id,
            summary: `${e.subject.reference} · ${e.subject.supplier} · ${formatMoney(e.subject.amount)} → ${({ authorized: "autorizada", blocked: "bloqueada", requires_approval: "escalada a aprobación", needs_information: "pendiente de información" } as const)[e.result.outcome]}`,
            reason: `${e.result.explanation} (política ${e.result.policyVersion})`,
          },
        ];
        if (e.payment)
          out.push({
            at: e.payment.at,
            type: "payment",
            actor: e.payment.rail,
            actorKind: "system",
            subjectId: e.subject.id,
            summary: `Pago ${e.payment.txn} · ${formatBase(e.baseMinor)}`,
            reason: "Sandbox: no se movió dinero real.",
          });
        return out;
      }),
    ].sort((a, b) => a.at.localeCompare(b.at));
    const trail = chain(raw);
    if (state.tamper && trail.length > 6)
      trail[6] = {
        ...trail[6]!,
        summary: trail[6]!.summary.replace(/\d/, "9") + " (editado a mano)",
      };
    const brokenAt = verifyChain(trail);

    return {
      ...o,
      org: state.org,
      seed,
      ledger,
      evaluatedInvoices,
      evaluatedPurchases,
      all,
      byId,
      decisionLog,
      alerts,
      trail: trail as TrailEvent[],
      brokenAt,
      tampered: state.tamper,
      agentName,
      now: new Date(now).toISOString(),
      /** Re-runs the whole period with another policy (used by natural-language rules). */
      simulate: (policy: Policy) => {
        const l = ledgerFor(seed, o, policy);
        return l.entries
          .map((e) => ({
            subject: e.subject,
            before: byId.get(e.subject.id)!.status,
            after: displayStatus(e.result.outcome, e.review),
          }))
          .filter((d) => d.before !== d.after);
      },
      switchOrg: (org: OrgId) => dispatch({ type: "switchOrg", org }),
      review: (subjectId: string, action: HumanAction, note?: string) => {
        const e = byId.get(subjectId);
        if (e) dispatch({ type: "review", subjectId, action, note, result: e.result });
      },
      savePolicy: (policy: Policy, summary: string) =>
        dispatch({ type: "savePolicy", policy, summary }),
      addInvoice: (invoice: Invoice) => dispatch({ type: "addInvoice", invoice }),
      receiveInvoice: () => dispatch({ type: "receive" }),
      launchAttack: () => dispatch({ type: "attack" }),
      clearAttacks: () => dispatch({ type: "clearAttacks" }),
      toggleTamper: () => dispatch({ type: "tamper" }),
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

/** Agent name across every demo organization (agent ids are unique). */
export const agentName = (id: string) =>
  Object.values(ORGS)
    .flatMap((o) => o.agents)
    .find((a) => a.id === id)?.name ?? id;
