import { useState } from "react";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Cpu,
  FileCode,
  Play,
  RotateCcw,
  ShieldAlert,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Panel } from "@/components/tg/primitives";
import {
  evaluateJevLocally,
  type JevDecisionEvaluation,
  type JevDecisionInput,
} from "@/lib/tokengate/jev";
import { evaluateJevDecisionFn } from "@/lib/tokengate/jev.functions";
import { cn } from "@/lib/utils";

const PRESETS: { label: string; description: string; input: JevDecisionInput }[] = [
  {
    label: "Proveedor válido ($45 USD)",
    description:
      "Proveedor en lista de válidos y monto <= 100 USD -> Debe aprobar automáticamente.",
    input: {
      supplier: "AWS",
      amount: 45,
      currency: "USD",
      amountUsd: 45,
      isApprovedSupplier: true,
      isNewSupplier: false,
      dailySpentUsd: 0,
      dailyApprovalThresholdUsd: 100,
      dailyLimitMaxUsd: 1000,
      isRecurring: false,
    },
  },
  {
    label: "Proveedor nuevo ($50 USD)",
    description: "Nueva compra (proveedor no conocido) -> Debe escalar a aprobación humana.",
    input: {
      supplier: "SaaS Desconocido LLC",
      amount: 50,
      currency: "USD",
      amountUsd: 50,
      isApprovedSupplier: false,
      isNewSupplier: true,
      dailySpentUsd: 0,
      dailyApprovalThresholdUsd: 100,
      dailyLimitMaxUsd: 1000,
      isRecurring: false,
    },
  },
  {
    label: "Monto > 100 USD ($150 USD)",
    description:
      "Supera el gasto diario de 100 USD -> Debe escalar y explicar que es por el monto.",
    input: {
      supplier: "AWS",
      amount: 150,
      currency: "USD",
      amountUsd: 150,
      isApprovedSupplier: true,
      isNewSupplier: false,
      dailySpentUsd: 0,
      dailyApprovalThresholdUsd: 100,
      dailyLimitMaxUsd: 1000,
      isRecurring: false,
    },
  },
  {
    label: "Supera límite ($1,200 USD)",
    description: "Excede el límite financiero absoluto de 1,000 USD -> Debe frenar inmediatamente.",
    input: {
      supplier: "AWS",
      amount: 1200,
      currency: "USD",
      amountUsd: 1200,
      isApprovedSupplier: true,
      isNewSupplier: false,
      dailySpentUsd: 0,
      dailyApprovalThresholdUsd: 100,
      dailyLimitMaxUsd: 1000,
      isRecurring: false,
    },
  },
  {
    label: "Factura duplicada",
    description:
      "Mismo proveedor, número e importe ya registrados -> Debe frenar mientras se comprueba.",
    input: {
      supplier: "Linear",
      amount: 96,
      currency: "USD",
      amountUsd: 96,
      isApprovedSupplier: true,
      isNewSupplier: false,
      invoiceNumber: "INV-2026-089",
      isDuplicate: true,
      duplicateDetails: "Factura INV-2026-089 por 96 USD ya figura registrada",
      dailySpentUsd: 0,
      dailyApprovalThresholdUsd: 100,
      dailyLimitMaxUsd: 1000,
      isRecurring: false,
    },
  },
  {
    label: "Falta NIT (Dato esencial)",
    description:
      "Falta identificación fiscal -> Solicitar revisión para que un humano complete info.",
    input: {
      supplier: "Diseñador Freelance",
      amount: 80,
      currency: "USD",
      amountUsd: 80,
      isApprovedSupplier: true,
      isNewSupplier: false,
      missingFields: ["NIT / Identificación fiscal"],
      dailySpentUsd: 0,
      dailyApprovalThresholdUsd: 100,
      dailyLimitMaxUsd: 1000,
      isRecurring: false,
    },
  },
  {
    label: "Recurrente variación +25%",
    description: "Supera en más del 20% el promedio usual de 3 meses -> Pedir aprobación humana.",
    input: {
      supplier: "Figma",
      amount: 125,
      currency: "USD",
      amountUsd: 125,
      isApprovedSupplier: true,
      isNewSupplier: false,
      isRecurring: true,
      recurringAverageUsd: 100,
      recurringVariationPct: 25,
      dailySpentUsd: 0,
      dailyApprovalThresholdUsd: 100,
      dailyLimitMaxUsd: 1000,
    },
  },
];

export function JevPanel() {
  const [form, setForm] = useState<JevDecisionInput>(PRESETS[0]!.input);
  const [evaluating, setEvaluating] = useState(false);
  const [activePresetIndex, setActivePresetIndex] = useState<number | null>(0);
  const [result, setResult] = useState<JevDecisionEvaluation>(() =>
    evaluateJevLocally(PRESETS[0]!.input),
  );

  const runEvaluation = async (inputToRun: JevDecisionInput = form) => {
    setEvaluating(true);
    try {
      // Intentar vía server function (que usa JEV_API_KEY desde .env.local de forma segura)
      const res = await evaluateJevDecisionFn({ data: inputToRun });
      setResult(res);
    } catch {
      // Fallback local instantáneo si el servidor no está corriendo
      const fallback = evaluateJevLocally(inputToRun);
      setResult(fallback);
    } finally {
      setEvaluating(false);
    }
  };

  const selectPreset = (index: number) => {
    setActivePresetIndex(index);
    const p = PRESETS[index]!.input;
    setForm(p);
    void runEvaluation(p);
  };

  return (
    <Panel
      className="border-primary/30 shadow-sm"
      title={
        <div className="flex flex-wrap items-center gap-2">
          <Cpu className="h-5 w-5 text-primary" />
          <span className="font-semibold">Motor JEV de TypeSafe AI</span>
          <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
            System One · 70–500ms
          </Badge>
          <Badge variant="secondary" className="text-xs">
            API Key Segura (.env.local)
          </Badge>
        </div>
      }
      description="Calibra decisiones de pago en tiempo real devolviendo valores tipados y calibrados (aprobar, escalar, frenar) sin riesgo de alucinación."
    >
      {/* Selector de Presets de Prueba */}
      <div className="mb-5 space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Casos de prueba predefinidos (Reto Blinka):
        </Label>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p, idx) => (
            <Button
              key={p.label}
              type="button"
              variant={activePresetIndex === idx ? "default" : "outline"}
              size="sm"
              onClick={() => selectPreset(idx)}
              className="text-xs"
            >
              {p.label}
            </Button>
          ))}
        </div>
        {activePresetIndex !== null && (
          <p className="text-xs text-muted-foreground italic">
            {PRESETS[activePresetIndex]?.description}
          </p>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Formulario de Parámetros */}
        <div className="space-y-4 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <span className="text-sm font-semibold">Parámetros de la transacción</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => selectPreset(0)}
              className="h-7 text-xs text-muted-foreground"
            >
              <RotateCcw className="mr-1 h-3.5 w-3.5" />
              Restablecer
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Proveedor</Label>
              <Input
                value={form.supplier}
                onChange={(e) => {
                  setActivePresetIndex(null);
                  setForm({ ...form, supplier: e.target.value });
                }}
                className="mt-1 h-9 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Monto (USD)</Label>
              <Input
                type="number"
                value={form.amountUsd}
                onChange={(e) => {
                  setActivePresetIndex(null);
                  const v = parseFloat(e.target.value) || 0;
                  setForm({ ...form, amount: v, amountUsd: v });
                }}
                className="mt-1 h-9 text-sm"
              />
            </div>
          </div>

          <div className="space-y-2.5 pt-1 text-xs">
            <div className="flex items-center justify-between">
              <Label htmlFor="sw-approved" className="text-xs cursor-pointer">
                ¿Proveedor en lista de aprobados?
              </Label>
              <Switch
                id="sw-approved"
                checked={form.isApprovedSupplier}
                onCheckedChange={(c) => {
                  setActivePresetIndex(null);
                  setForm({ ...form, isApprovedSupplier: c, isNewSupplier: !c });
                }}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="sw-dup" className="text-xs cursor-pointer">
                ¿Factura duplicada detectada?
              </Label>
              <Switch
                id="sw-dup"
                checked={Boolean(form.isDuplicate)}
                onCheckedChange={(c) => {
                  setActivePresetIndex(null);
                  setForm({
                    ...form,
                    isDuplicate: c,
                    duplicateDetails: c
                      ? "Factura e importe ya registrados previamente"
                      : undefined,
                  });
                }}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="sw-nit" className="text-xs cursor-pointer">
                ¿Falta NIT o dato esencial?
              </Label>
              <Switch
                id="sw-nit"
                checked={Boolean(form.missingFields && form.missingFields.length > 0)}
                onCheckedChange={(c) => {
                  setActivePresetIndex(null);
                  setForm({
                    ...form,
                    missingFields: c ? ["NIT / Identificación fiscal"] : [],
                  });
                }}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="sw-rec" className="text-xs cursor-pointer">
                ¿Servicio recurrente con variación &gt; 20%?
              </Label>
              <Switch
                id="sw-rec"
                checked={Boolean(form.isRecurring && (form.recurringVariationPct ?? 0) > 20)}
                onCheckedChange={(c) => {
                  setActivePresetIndex(null);
                  setForm({
                    ...form,
                    isRecurring: c,
                    recurringAverageUsd: c ? 100 : undefined,
                    recurringVariationPct: c ? 25 : undefined,
                  });
                }}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="sw-contra" className="text-xs cursor-pointer">
                ¿Contradicción material en datos?
              </Label>
              <Switch
                id="sw-contra"
                checked={Boolean(form.hasContradictions)}
                onCheckedChange={(c) => {
                  setActivePresetIndex(null);
                  setForm({
                    ...form,
                    hasContradictions: c,
                    contradictionDetails: c ? "Discrepancia fiscal material" : undefined,
                  });
                }}
              />
            </div>
          </div>

          <Button
            type="button"
            onClick={() => void runEvaluation(form)}
            disabled={evaluating}
            className="w-full"
          >
            {evaluating ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                Evaluando con JEV...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Play className="h-4 w-4" />
                Evaluar Decisión con JEV
              </span>
            )}
          </Button>
        </div>

        {/* Resultado de la Decisión */}
        <div className="flex flex-col justify-between rounded-xl border border-border bg-card p-4">
          <div>
            <div className="flex items-center justify-between border-b border-border pb-2">
              <span className="text-sm font-semibold">Decisión calibrada por JEV</span>
              <Badge
                variant="outline"
                className={cn(
                  "font-mono text-xs",
                  result.evaluator === "jev-typesafe-api"
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400",
                )}
              >
                {result.evaluator === "jev-typesafe-api" ? "JEV Live API" : "Motor de Reglas JEV"}
              </Badge>
            </div>

            <div className="my-4 flex items-center gap-3">
              {result.action === "aprobar" ? (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-7 w-7" />
                </div>
              ) : result.action === "frenar" ? (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
                  <ShieldAlert className="h-7 w-7" />
                </div>
              ) : (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="h-7 w-7" />
                </div>
              )}

              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "text-xl font-bold uppercase tracking-wide",
                      result.action === "aprobar"
                        ? "text-emerald-600 dark:text-emerald-400"
                        : result.action === "frenar"
                          ? "text-rose-600 dark:text-rose-400"
                          : "text-amber-600 dark:text-amber-400",
                    )}
                  >
                    {result.action === "aprobar"
                      ? "Aprobar Automáticamente"
                      : result.action === "frenar"
                        ? "Frenar / Bloquear Pago"
                        : "Escalar a Decisión Humana"}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  Confianza: {(result.confidence * 100).toFixed(1)}% · Motivo:{" "}
                  <code className="rounded bg-muted px-1 py-0.5 font-mono">{result.reason}</code>
                </span>
              </div>
            </div>

            {/* Explicación */}
            <div className="rounded-lg bg-muted/50 p-3 text-sm leading-relaxed text-foreground">
              <span className="font-semibold">Explicación: </span>
              {result.explanation}
            </div>

            {/* Reglas Evaluadas */}
            <div className="mt-4 space-y-1.5">
              <span className="text-xs font-semibold text-muted-foreground">Reglas evaluadas:</span>
              <ul className="divide-y divide-border/60 rounded-md border border-border text-xs">
                {result.rules.map((r) => (
                  <li key={r.ruleId} className="flex items-center justify-between px-3 py-2">
                    <span className="truncate pr-2">{r.label}</span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px]",
                        r.status === "passed"
                          ? "border-emerald-500/40 text-emerald-600"
                          : r.status === "failed"
                            ? "border-rose-500/40 text-rose-600"
                            : "border-amber-500/40 text-amber-600",
                      )}
                    >
                      {r.status === "passed"
                        ? "Pasa"
                        : r.status === "failed"
                          ? "Falla (Frenar)"
                          : "Revisar (Escalar)"}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Inspección de Payload para JEV */}
          <div className="mt-4 pt-3 border-t border-border">
            <Tabs defaultValue="state" className="w-full">
              <TabsList className="grid h-8 w-full grid-cols-2 text-xs">
                <TabsTrigger value="state" className="text-xs">
                  <Bot className="mr-1 h-3.5 w-3.5" />
                  State (Input para Jev)
                </TabsTrigger>
                <TabsTrigger value="questions" className="text-xs">
                  <FileCode className="mr-1 h-3.5 w-3.5" />
                  Preguntas tipadas
                </TabsTrigger>
              </TabsList>
              <TabsContent value="state">
                <pre className="max-h-36 overflow-auto rounded bg-muted/80 p-2 text-[11px] font-mono leading-tight whitespace-pre-wrap">
                  {result.rawState}
                </pre>
              </TabsContent>
              <TabsContent value="questions">
                <pre className="max-h-36 overflow-auto rounded bg-muted/80 p-2 text-[11px] font-mono leading-tight">
                  {JSON.stringify(result.rawQuestions, null, 2)}
                </pre>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </Panel>
  );
}
