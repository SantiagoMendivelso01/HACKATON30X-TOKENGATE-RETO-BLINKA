// Store (React context). State lives in Supabase when the server has its keys (db.functions.ts);
// each action is saved first and only shows once the database confirms it. Without keys it
// runs in memory and resets on reload.
import {
  createContext,
  useContext,
  useMemo,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { runLedger, type Ledger, type LedgerState } from "./decision-engine";
import { ORG } from "./org";
import { displayStatus, needsAttention } from "./status";
import { chain, verifyChain, type ChainedEvent } from "./hash";
import { formatBase, formatMoney } from "./format";
import {
  apply,
  stateFromRows,
  type Action,
  type OrgState,
  type Rows,
  type State,
} from "./org-state";
import { saveWrites, type StorageMode } from "./db.functions";
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
  OrgSeed,
  Policy,
  Purchase,
} from "./types";

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

function useStoreValue(rows: Rows, mode: StorageMode) {
  const [state, setState] = useState<State>(() => stateFromRows(rows));
  const latest = useRef(state);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const save = useServerFn(saveWrites);

  /** Saves what the action adds and only then shows it. Actions run one at a time, in order. */
  const dispatch = useCallback(
    (action: Action): Promise<boolean> => {
      const run = async () => {
        const { next, writes } = apply(latest.current, action);
        if (mode === "supabase") {
          try {
            const res = await save({ data: writes });
            if (!res.ok) {
              toast.error(res.error);
              return false;
            }
          } catch {
            toast.error("No hay conexión con el servidor. No se aplicó ningún cambio.");
            return false;
          }
        }
        latest.current = next;
        setState(next);
        return true;
      };
      const p = queue.current.then(run, run);
      queue.current = p.catch(() => undefined);
      return p;
    },
    [mode, save],
  );

  return useMemo(() => {
    const o = state;
    const seed: OrgSeed = {
      id: ORG.id,
      ...o.config,
      policy: o.policy,
    };
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
    const agentName = (id: string) =>
      seed.agents.find((a) => a.id === id)?.name || "Agente pagador";

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
    const brokenAt = verifyChain(trail);

    return {
      ...o,
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
      /** Where actions are saved. */
      mode,
      // Each action resolves to true once saved, or false (with an error toast) if nothing changed.
      review: async (subjectId: string, action: HumanAction, note?: string) => {
        const e = byId.get(subjectId);
        return e ? dispatch({ type: "review", subjectId, action, note, result: e.result }) : false;
      },
      savePolicy: (policy: Policy, summary: string) =>
        dispatch({ type: "savePolicy", policy, summary }),
      saveConfig: (config: OrgState["config"], summary: string) =>
        dispatch({ type: "saveConfig", config, summary }),
      addInvoice: (invoice: Invoice) => dispatch({ type: "addInvoice", invoice }),
      addPurchase: (purchase: Purchase) => dispatch({ type: "addPurchase", purchase }),
      logEvent: (event: Omit<AuditEvent, "id" | "at">) => dispatch({ type: "audit", event }),
      /** Approver fills the missing fields; the subject is re-evaluated by the engine. */
      completeFields: (subjectId: string, values: Record<string, string>, note?: string) =>
        dispatch({ type: "completeFields", subjectId, values, note }),
    };
  }, [state, mode, dispatch]);
}

type Store = ReturnType<typeof useStoreValue>;
// Keep a single context instance across hot reloads so provider and consumers always match.
const g = globalThis as unknown as { __tokengateCtx?: React.Context<Store | null> };
const Ctx = (g.__tokengateCtx ??= createContext<Store | null>(null));

export function TokenGateProvider({
  rows,
  mode,
  children,
}: {
  /** What the database already has (from the /app loader). */
  rows: Rows;
  mode: StorageMode;
  children: ReactNode;
}) {
  const value = useStoreValue(rows, mode);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTokenGate() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useTokenGate must be used inside TokenGateProvider");
  return v;
}

/** Agent name for components outside the provider. */
export const agentName = (id: string) =>
  ORG.agents.find((a) => a.id === id)?.name || "Agente pagador";
