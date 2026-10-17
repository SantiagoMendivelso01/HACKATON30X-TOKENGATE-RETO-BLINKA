import {
  Ban,
  CheckCircle2,
  CircleHelp,
  Clock3,
  Minus,
  ShieldCheck,
  UserCheck,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import type { DecisionOutcome, DisplayStatus, HumanReview, RuleStatus } from "./types";

type StatusMeta = {
  label: string;
  short: string;
  icon: LucideIcon;
  tone: "success" | "destructive" | "warning" | "info" | "neutral";
};

export const statusMeta: Record<DisplayStatus, StatusMeta> = {
  authorized: {
    label: "Autorizada automáticamente",
    short: "Autorizada",
    icon: CheckCircle2,
    tone: "success",
  },
  blocked: {
    label: "Bloqueada por una política",
    short: "Bloqueada",
    icon: Ban,
    tone: "destructive",
  },
  requires_approval: {
    label: "Requiere aprobación humana",
    short: "Requiere aprobación",
    icon: UserCheck,
    tone: "warning",
  },
  needs_information: {
    label: "Pendiente de información",
    short: "Pendiente de info.",
    icon: CircleHelp,
    tone: "warning",
  },
  human_approved: {
    label: "Aprobada por Finanzas y enviada al sandbox",
    short: "Aprobada",
    icon: ShieldCheck,
    tone: "info",
  },
  human_rejected: {
    label: "Rechazada por una persona",
    short: "Rechazada",
    icon: XCircle,
    tone: "destructive",
  },
};

export const ruleMeta: Record<
  RuleStatus,
  { label: string; icon: LucideIcon; tone: StatusMeta["tone"] }
> = {
  passed: { label: "Cumple", icon: CheckCircle2, tone: "success" },
  failed: { label: "No cumple", icon: XCircle, tone: "destructive" },
  needs_review: { label: "Revisar", icon: Clock3, tone: "warning" },
  not_applicable: { label: "No aplica", icon: Minus, tone: "neutral" },
};

export const toneClasses: Record<StatusMeta["tone"], string> = {
  success: "bg-success/8 text-success border-transparent",
  destructive: "bg-destructive/8 text-destructive border-transparent",
  warning: "bg-warning/12 text-warning-foreground border-transparent dark:text-warning",
  info: "bg-primary/8 text-primary border-transparent",
  neutral: "bg-muted text-muted-foreground border-transparent",
};

/** Solid dot color per tone, for compact status pills. */
export const toneDot: Record<StatusMeta["tone"], string> = {
  success: "bg-success",
  destructive: "bg-destructive",
  warning: "bg-warning",
  info: "bg-primary",
  neutral: "bg-muted-foreground/60",
};

export function displayStatus(outcome: DecisionOutcome, review?: HumanReview): DisplayStatus {
  if (!review) return outcome;
  if (review.action === "approved") return "human_approved";
  if (review.action === "rejected") return "human_rejected";
  return "needs_information";
}

export const needsAttention = (s: DisplayStatus) =>
  s === "requires_approval" || s === "needs_information";
