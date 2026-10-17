import { AlertTriangle, Circle, Diamond } from "lucide-react";
import type { AlertSeverity } from "@/lib/tokengate/types";

export const sevMeta: Record<
  AlertSeverity,
  { label: string; icon: typeof Circle; text: string; bar: string }
> = {
  critical: {
    label: "Crítica",
    icon: AlertTriangle,
    text: "text-destructive",
    bar: "bg-destructive",
  },
  high: {
    label: "Alta",
    icon: Circle,
    text: "text-[oklch(0.58_0.16_45)]",
    bar: "bg-[oklch(0.62_0.16_45)]",
  },
  medium: { label: "Media", icon: Diamond, text: "text-warning-foreground", bar: "bg-warning" },
};
