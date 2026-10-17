import type { ReactNode } from "react";
import { FlaskConical, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { ruleMeta, statusMeta, toneClasses } from "@/lib/tokengate/status";
import type { DisplayStatus, RuleStatus } from "@/lib/tokengate/types";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function StatusBadge({ status, full = false, className }: { status: DisplayStatus; full?: boolean; className?: string }) {
  const m = statusMeta[status];
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded border px-1.5 py-0.5 text-xs font-medium", toneClasses[m.tone], className)}>
      <m.icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {full ? m.label : m.short}
    </span>
  );
}

export function RuleBadge({ status }: { status: RuleStatus }) {
  const m = ruleMeta[status];
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1 rounded border px-1.5 py-0.5 text-xs font-medium", toneClasses[m.tone])}>
      <m.icon className="h-3.5 w-3.5" aria-hidden />
      {m.label}
    </span>
  );
}

export function SimBadge({ children = "Datos simulados" }: { children?: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded border border-dashed border-border px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
      <FlaskConical className="h-3 w-3" aria-hidden />
      {children}
    </span>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center [&>*]:w-full sm:[&>*]:w-auto [&>*:last-child:nth-child(odd)]:col-span-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, description, action, children, className, bodyClassName }: { title?: ReactNode; description?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; bodyClassName?: string }) {
  return (
    <section className={cn("rounded-lg border border-border bg-surface shadow-soft", className)}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={cn("p-4", bodyClassName)}>{children}</div>
    </section>
  );
}

export function Term({ children, hint }: { children: ReactNode; hint: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="inline-flex items-center gap-1 rounded underline decoration-dotted underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {children}
          <Info className="h-3 w-3 text-muted-foreground" aria-hidden />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{hint}</TooltipContent>
    </Tooltip>
  );
}

export function EmptyState({ icon: Icon, title, text, action }: { icon: React.ComponentType<{ className?: string }>; title: string; text: string; action?: ReactNode }) {
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
    <p className={cn("flex items-start gap-2 rounded-md border border-dashed border-border bg-muted/60 px-3 py-2 text-xs text-muted-foreground", className)}>
      <FlaskConical className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
      Prototipo: las autorizaciones son simuladas. TokenGate no ejecuta pagos ni mueve dinero real.
    </p>
  );
}
