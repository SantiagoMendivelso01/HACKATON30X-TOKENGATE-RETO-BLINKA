import { AlertCircle, AlertTriangle, Info } from "lucide-react";
import type { AlertSeverity } from "@/lib/tokengate/types";

// Severidad con los mismos tonos de los estados: rojo ladrillo, ocre y pizarra.
export const sevMeta: Record<
  AlertSeverity,
  { label: string; icon: typeof Info; text: string; bar: string }
> = {
  critical: {
    label: "Crítica",
    icon: AlertTriangle,
    text: "text-destructive",
    bar: "bg-destructive",
  },
  high: {
    label: "Alta",
    icon: AlertCircle,
    text: "text-warning-foreground dark:text-warning",
    bar: "bg-warning",
  },
  medium: { label: "Media", icon: Info, text: "text-muted-foreground", bar: "bg-chart-5" },
};
