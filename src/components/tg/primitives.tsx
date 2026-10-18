import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Bot,
  FileText,
  FlaskConical,
  Image,
  Info,
  Mail,
  MessageSquare,
  Upload,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ruleMeta, statusMeta, toneClasses, toneDot } from "@/lib/tokengate/status";
import { moneyParts } from "@/lib/tokengate/format";
import type { Channel, DisplayStatus, Money as MoneyT, RuleStatus } from "@/lib/tokengate/types";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function StatusBadge({
  status,
  full = false,
  className,
}: {
  status: DisplayStatus;
  full?: boolean;
  className?: string;
}) {
  const m = statusMeta[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium",
        toneClasses[m.tone],
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", toneDot[m.tone])} aria-hidden />
      {full ? m.label : m.short}
    </span>
  );
}

export function RuleBadge({ status }: { status: RuleStatus }) {
  const m = ruleMeta[status];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        toneClasses[m.tone],
      )}
    >
      <m.icon className="h-3.5 w-3.5" aria-hidden />
      {m.label}
    </span>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
  eyebrow,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="display text-3xl sm:text-[34px]">{title}</h1>
        {subtitle && <p className="mt-2 max-w-2xl text-[15px] text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && (
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center [&>*]:w-full sm:[&>*]:w-auto [&>*:last-child:nth-child(odd)]:col-span-2">
          {actions}
        </div>
      )}
    </div>
  );
}

export function Panel({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={cn("rounded-2xl border border-border/70 bg-surface shadow-soft", className)}
    >
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 border-b border-border/70 px-5 py-4">
          <div className="min-w-0">
            {title && <h2 className="text-[15px] font-medium tracking-tight">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

export function Term({ children, hint }: { children: ReactNode; hint: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded underline decoration-dotted underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {children}
          <Info className="h-3 w-3 text-muted-foreground" aria-hidden />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{hint}</TooltipContent>
    </Tooltip>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  text,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="mt-3 text-sm font-medium">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{text}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function NoMoneyNotice({ className }: { className?: string }) {
  return (
    <p
      className={cn(
        "flex items-start gap-2 rounded-md border border-dashed border-border bg-muted/60 px-3 py-2 text-xs text-muted-foreground",
        className,
      )}
    >
      <FlaskConical className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
      Prototipo: los pagos van a un sandbox simulado. El agente pagador no mueve dinero real.
    </p>
  );
}

/** Counts from the previous value (0 on first render) up to `target`, easing out. */
function useCountUp(target: number, enabled = true, ms = 800): number {
  const [v, setV] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    if (!enabled) return;
    const start = from.current;
    from.current = target;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return setV(target);
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      setV(start + (target - start) * (1 - (1 - p) ** 3));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, enabled, ms]);
  return enabled ? v : target;
}

/** A whole number that counts up when it appears or changes. */
export function CountUp({ value, suffix = "" }: { value: number; suffix?: string }) {
  return (
    <span className="tabular">
      {Math.round(useCountUp(value))}
      {suffix}
    </span>
  );
}

/** Blinka-style amount: small currency code, whole number, muted cents. */
export function Money({
  value,
  className,
  animate = false,
}: {
  value: MoneyT;
  className?: string;
  /** Count up to the amount when it appears or changes. */
  animate?: boolean;
}) {
  const shown = useCountUp(value.amountMinor, animate);
  const p = moneyParts({ ...value, amountMinor: Math.round(shown) });
  return (
    <span className={cn("money whitespace-nowrap tabular", className)}>
      <span className="cur">{p.cur}</span>
      {p.whole}
      {p.cents && <span className="cents">.{p.cents}</span>}
    </span>
  );
}

const channelIcon: Record<Channel, LucideIcon> = {
  email: Mail,
  pdf: FileText,
  chat: MessageSquare,
  image: Image,
  agent: Bot,
  upload: Upload,
};
const channelName: Record<Channel, string> = {
  email: "Correo",
  pdf: "PDF",
  chat: "Chat",
  image: "Imagen",
  agent: "Solicitud del agente",
  upload: "Carga manual",
};

/** Square channel icon like Blinka transaction rows. */
export function ChannelIcon({ channel }: { channel: Channel }) {
  const Icon = channelIcon[channel];
  return (
    <span
      title={channelName[channel]}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-primary/8 text-primary"
    >
      <Icon className="h-[18px] w-[18px]" aria-label={channelName[channel]} />
    </span>
  );
}
export const channelText = (c: Channel) => channelName[c];
