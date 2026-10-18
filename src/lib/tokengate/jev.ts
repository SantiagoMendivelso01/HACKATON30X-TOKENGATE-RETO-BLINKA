/**
 * Integración con JEV de TypeSafe AI para gestión de decisiones de pago.
 *
 * JEV es un modelo "System One" que devuelve decisiones estructuradas, tipadas
 * y calibradas (choice, score, noul) en 70-500ms sin alucinaciones de texto libre.
 *
 * Reglas de negocio implementadas:
 * 1. Recibe monto y proveedor.
 * 2. Si está en la lista de proveedores válidos y monto <= 100 USD/día -> APROBAR AUTOMÁTICAMENTE.
 * 3. Si es nueva compra (proveedor no conocido) -> ESCALAR A APROBACIÓN HUMANA.
 * 4. Si el monto diario es mayor a 100 USD -> ESCALAR A APROBACIÓN HUMANA (explicando que es por el monto).
 * 5. FRENAR si:
 *    a) Supera los límites financieros absolutos (> 1,000 USD diarios / por transacción o excede presupuesto).
 *    b) Factura duplicada (mismo proveedor, número e importe ya registrados o pagados).
 *    c) Datos esenciales contradictorios o materialmente inválidos.
 * 6. SOLICITAR REVISIÓN / ESCALAR si:
 *    a) Faltan datos esenciales (ej: falta NIT/identificación fiscal) para que un humano complete la info.
 *    b) Pago recurrente supera en más de un 20% el promedio usual de los últimos 3 meses.
 */

import { z } from "zod";
import type { Currency, DecisionOutcome, RuleResult } from "./types";

export type JevAction = "aprobar" | "escalar" | "frenar";

export type JevReason =
  | "aprobado_normal"
  | "monto_mayor_100_usd"
  | "proveedor_nuevo"
  | "variacion_recurrente_20"
  | "limite_financiero_1000_usd"
  | "factura_duplicada"
  | "datos_faltantes_o_contradictorios"
  | "senal_de_riesgo";

export const CurrencySchema = z.enum(["USD", "EUR", "COP", "MXN", "BRL", "ARS"]);

export const JevInputSchema = z.object({
  supplier: z.string().min(1),
  amount: z.number().positive(),
  currency: CurrencySchema,
  amountUsd: z.number().positive(),
  isApprovedSupplier: z.boolean(),
  isNewSupplier: z.boolean(),
  dailySpentUsd: z.number().optional(),
  dailyLimitMaxUsd: z.number().optional(), // Límite diario absoluto: 1000 USD
  dailyApprovalThresholdUsd: z.number().optional(), // Umbral de aprobación humana: 100 USD
  invoiceNumber: z.string().optional(),
  isDuplicate: z.boolean().optional(),
  duplicateDetails: z.string().optional(),
  missingFields: z.array(z.string()).optional(),
  hasContradictions: z.boolean().optional(),
  contradictionDetails: z.string().optional(),
  isRecurring: z.boolean().optional(),
  recurringAverageUsd: z.number().optional(),
  recurringVariationPct: z.number().optional(),
  /** Findings from the rules engine that need a person (bank account change, split payment…). */
  reviewSignals: z.array(z.string()).optional(),
});

export type JevDecisionInput = z.infer<typeof JevInputSchema>;

export type JevQuestionChoice = {
  type: "choice";
  instructions: string;
  criteria: Record<string, string>;
};

export type JevQuestionNoul = {
  type: "noul";
  instructions: string;
};

export type JevQuestionsSchema = {
  action: JevQuestionChoice;
  motivo: JevQuestionChoice;
  supera_limite_absoluto_1000: JevQuestionNoul;
  supera_umbral_diario_100: JevQuestionNoul;
  es_compra_nueva: JevQuestionNoul;
  es_duplicada: JevQuestionNoul;
  requiere_completar_datos: JevQuestionNoul;
  variacion_recurrente_excede_20: JevQuestionNoul;
};

export type JevApiResponse = {
  model?: string | undefined;
  answers: {
    action: {
      type: "choice";
      choice: JevAction;
      confidence: number;
      probabilities: Record<JevAction, number>;
    };
    motivo: {
      type: "choice";
      choice: JevReason;
      confidence: number;
      probabilities: Record<JevReason, number>;
    };
    supera_limite_absoluto_1000?: { type: "noul"; noul: number } | undefined;
    supera_umbral_diario_100?: { type: "noul"; noul: number } | undefined;
    es_compra_nueva?: { type: "noul"; noul: number } | undefined;
    es_duplicada?: { type: "noul"; noul: number } | undefined;
    requiere_completar_datos?: { type: "noul"; noul: number } | undefined;
    variacion_recurrente_excede_20?: { type: "noul"; noul: number } | undefined;
  };
  usage?:
    | {
        input_tokens: number;
        cost_usd: number;
        credits_remaining_usd: number;
      }
    | undefined;
};

export type JevDecisionEvaluation = {
  action: JevAction;
  outcome: DecisionOutcome;
  reason: JevReason;
  explanation: string;
  confidence: number;
  evaluator: "jev-typesafe-api" | "jev-rules-engine";
  rules: RuleResult[];
  rawState: string;
  rawQuestions: JevQuestionsSchema;
  answers?: JevApiResponse["answers"] | undefined;
};

/**
 * Genera el estado en texto plano para JEV TypeSafe.
 */
export function buildJevState(input: JevDecisionInput): string {
  const dailyLimit = input.dailyLimitMaxUsd ?? 1000;
  const threshold = input.dailyApprovalThresholdUsd ?? 100;
  const dailyTotal = (input.dailySpentUsd ?? 0) + input.amountUsd;
  const missing = input.missingFields ?? [];

  return [
    `Evaluación de pago / factura:`,
    `- Proveedor: "${input.supplier}" (${input.isApprovedSupplier ? "En lista de proveedores válidos" : "NUEVA COMPRA / Proveedor no conocido"})`,
    `- Monto de esta operación: ${input.amount} ${input.currency} (equivalente a ${input.amountUsd.toFixed(2)} USD)`,
    `- Gasto acumulado diario proyectado: ${dailyTotal.toFixed(2)} USD (Gasto diario máx permitido sin aprobación: ${threshold} USD | Límite absoluto por transacción/día: ${dailyLimit} USD)`,
    `- Control de duplicados: ${input.isDuplicate ? `ALERTA DUPLICADA: ${input.duplicateDetails ?? "Mismo proveedor, factura e importe registrado"}` : "Sin duplicados detectados"}`,
    `- Integridad de datos esenciales: ${missing.length ? `FALTAN DATOS: ${missing.join(", ")}` : "Datos completos"}${input.hasContradictions ? ` | CONTRADICCIÓN: ${input.contradictionDetails ?? "Datos contradictorios"}` : ""}`,
    `- Señales de riesgo del motor de reglas: ${input.reviewSignals?.length ? input.reviewSignals.join(" | ") : "Ninguna"}`,
    `- Naturaleza del pago: ${input.isRecurring ? `Servicio recurrente. Promedio últimos 3 meses: ${input.recurringAverageUsd?.toFixed(2) ?? "N/A"} USD. Variación actual: ${input.recurringVariationPct != null ? `${input.recurringVariationPct >= 0 ? "+" : ""}${input.recurringVariationPct.toFixed(1)}%` : "N/A"}` : "Gasto puntual / ordinario"}`,
  ].join("\n");
}

/**
 * Genera el esquema de preguntas tipadas para JEV TypeSafe.
 */
export function buildJevQuestions(threshold = 100, limit = 1000): JevQuestionsSchema {
  const t = threshold.toLocaleString("en-US");
  const l = limit.toLocaleString("en-US");
  return {
    action: {
      type: "choice",
      instructions:
        "¿Cuál es la decisión financiera que debe tomar el sistema sobre esta orden de pago/factura?",
      criteria: {
        aprobar: `Aprobar automáticamente: El proveedor está en la lista de proveedores válidos, no es una compra nueva, el monto diario no supera los ${t} USD (ni sus equivalencias), no es duplicada, los datos esenciales están completos, no hay señales de riesgo y si es un servicio recurrente la variación no supera el 20%.`,
        escalar: `Escalar a aprobación humana: Requiere revisión humana obligatoria si: (1) Es una nueva compra (proveedor no conocido), o (2) El monto diario es mayor al gasto máximo permitido de ${t} USD (explicar que es por el monto), o (3) Es un pago recurrente que supera el costo usual en más del 20%, o (4) Faltan datos esenciales como el NIT y se requiere que un humano complete la información, o (5) El motor de reglas reportó señales de riesgo (cuenta bancaria distinta, posible pago partido, lectura poco confiable).`,
        frenar: `Frenar / Bloquear el pago: Detener inmediatamente la autorización automática si: (1) Supera los límites financieros absolutos (más de ${l} USD diarios o excede el presupuesto disponible del periodo), o (2) La factura parece duplicada (mismo proveedor, número de factura e importe ya existentes o pagados), o (3) Existen datos esenciales contradictorios o materialmente inválidos.`,
      },
    },
    motivo: {
      type: "choice",
      instructions: "¿Cuál es la causa o regla determinante de la decisión tomada?",
      criteria: {
        aprobado_normal: `Proveedor válido aprobado y monto diario menor o igual al límite de ${t} USD.`,
        monto_mayor_100_usd: `El monto es mayor al gasto máximo permitido diario de ${t} USD (escalar por monto).`,
        proveedor_nuevo: "Nueva compra con proveedor no conocido (escalar para aprobación humana).",
        variacion_recurrente_20:
          "El costo del pago recurrente supera el promedio habitual en más del 20% (escalar).",
        limite_financiero_1000_usd: `Supera el límite financiero absoluto de ${l} USD diarios o excede el presupuesto (frenar).`,
        factura_duplicada:
          "Factura duplicada: mismo proveedor, número de factura e importe ya pagado/registrado (frenar).",
        datos_faltantes_o_contradictorios:
          "Faltan datos esenciales (ej: falta NIT) o son contradictorios (frenar / solicitar revisión).",
        senal_de_riesgo:
          "El motor de reglas reportó una señal de riesgo que requiere revisión humana (escalar).",
      },
    },
    supera_limite_absoluto_1000: {
      type: "noul",
      instructions: `¿El importe excede el límite financiero absoluto de ${l} USD por transacción/día o el presupuesto?`,
    },
    supera_umbral_diario_100: {
      type: "noul",
      instructions: `¿El monto excede el gasto máximo permitido diario de ${t} USD (o equivalencias)?`,
    },
    es_compra_nueva: {
      type: "noul",
      instructions:
        "¿Es una compra nueva o con un proveedor que no está en la lista de proveedores válidos?",
    },
    es_duplicada: {
      type: "noul",
      instructions:
        "¿El mismo proveedor, número de factura e importe ya constan en una factura previa?",
    },
    requiere_completar_datos: {
      type: "noul",
      instructions:
        "¿Faltan datos esenciales (como NIT, concepto, moneda) o existen contradicciones materiales?",
    },
    variacion_recurrente_excede_20: {
      type: "noul",
      instructions:
        "¿Es un servicio recurrente cuyo importe supera en más del 20% el promedio de los últimos 3 meses?",
    },
  };
}

/**
 * Evaluación determinista de respaldo alineada 100% con las reglas especificadas por el usuario.
 */
export function evaluateJevLocally(input: JevDecisionInput): JevDecisionEvaluation {
  const dailyLimit = input.dailyLimitMaxUsd ?? 1000;
  const threshold = input.dailyApprovalThresholdUsd ?? 100;
  const dailyTotal = (input.dailySpentUsd ?? 0) + input.amountUsd;
  const missing = input.missingFields ?? [];
  const rules: RuleResult[] = [];

  // 1. Control de límites financieros absolutos (1000 USD)
  const exceeds1000 = input.amountUsd > dailyLimit || dailyTotal > dailyLimit;
  rules.push({
    ruleId: "within_transaction_limit",
    label: `Límite financiero absoluto diario (${dailyLimit.toLocaleString("en-US")} USD)`,
    status: exceeds1000 ? "failed" : "passed",
    rule: `Límite diario absoluto: ${dailyLimit} USD`,
    explanation: exceeds1000
      ? `Supera los límites financieros: ${input.amountUsd.toFixed(2)} USD excede el límite financiero diario absoluto de ${dailyLimit} USD (o acumulado ${dailyTotal.toFixed(2)} USD).`
      : `El importe de ${input.amountUsd.toFixed(2)} USD no excede el límite financiero diario absoluto de ${dailyLimit} USD.`,
    ifChanged: `Se habría seguido evaluando con un importe diario acumulado menor o igual a ${dailyLimit} USD.`,
    alert: exceeds1000
      ? {
          severity: "critical",
          text: `Supera el límite financiero absoluto de ${dailyLimit.toLocaleString("en-US")} USD`,
        }
      : undefined,
  });

  // 2. Control de facturas duplicadas
  const isDup = Boolean(input.isDuplicate);
  rules.push({
    ruleId: "duplicate_check",
    label: "Control de duplicados",
    status: isDup ? "failed" : "passed",
    rule: "Mismo proveedor, número de factura e importe ya registrados = frenar",
    explanation: isDup
      ? `La factura parece duplicada: el mismo proveedor, número de factura e importe ya aparecen en una factura registrada o pagada. Decisión: frenar la autorización automática mientras se comprueba el duplicado.`
      : "No se identificaron duplicados de factura, proveedor ni importe.",
    ifChanged:
      "No se autoriza automáticamente ninguna factura con datos coincidentes a un pago previo.",
    alert: isDup ? { severity: "critical", text: "Factura potencialmente duplicada" } : undefined,
  });

  // 3. Contradicciones materiales
  const hasContradiction = Boolean(input.hasContradictions);
  if (hasContradiction) {
    rules.push({
      ruleId: "required_information",
      label: "Consistencia de datos esenciales",
      status: "failed",
      rule: "Sin contradicciones en datos fiscales o del proveedor",
      explanation: `Existen datos esenciales contradictorios (${input.contradictionDetails ?? "Discrepancia material"}). Decisión: frenar hasta que se resuelva.`,
      alert: { severity: "critical", text: "Contradicción material en datos de factura" },
    });
  }

  // 4. Datos faltantes (ej: falta el NIT)
  const hasMissing = missing.length > 0;
  rules.push({
    ruleId: "required_information",
    label: "Datos esenciales completos (NIT, concepto, moneda, vencimiento)",
    status: hasMissing ? "needs_review" : "passed",
    rule: "Faltan datos esenciales → solicitar que un humano complete la info faltante",
    explanation: hasMissing
      ? `Faltan datos esenciales: ${missing.join(", ")}. No se puede determinar con certeza quién cobra o cómo pagar. Decisión: solicitar revisión y que un humano complete la info faltante.`
      : "Todos los datos esenciales (NIT, proveedor, moneda, concepto) están presentes.",
    alert: hasMissing
      ? { severity: "medium", text: `Faltan datos esenciales: ${missing.join(", ")}` }
      : undefined,
  });

  // 5. Variación en pago recurrente (> 20%)
  const isRec = Boolean(input.isRecurring);
  const varPct = input.recurringVariationPct ?? 0;
  const recExceeds20 = isRec && varPct > 20;
  if (isRec) {
    rules.push({
      ruleId: "contract_match",
      label: "Variación de pago recurrente (máx 20%)",
      status: recExceeds20 ? "needs_review" : "passed",
      rule: "Servicio recurrente con incremento superior al 20% → pedir aprobación humana",
      explanation: recExceeds20
        ? `Es un pago recurrente pero con una variación significativa (+${varPct.toFixed(1)}% vs promedio 3 meses: ${input.recurringAverageUsd?.toFixed(2) ?? "N/A"} USD). Decisión: pedir aprobación humana antes de pagar.`
        : `Servicio recurrente dentro de la variación normal (+${varPct.toFixed(1)}%, no supera el 20%).`,
      alert: recExceeds20
        ? { severity: "high", text: "Variación recurrente superior al 20%" }
        : undefined,
    });
  }

  // 6. Proveedor autorizado / nueva compra
  const isNew = !input.isApprovedSupplier || input.isNewSupplier;
  rules.push({
    ruleId: "supplier_authorized",
    label: "Proveedor válido en lista autorizada",
    status: isNew ? "needs_review" : "passed",
    rule: "Proveedor en lista de válidos = aprobación automática; nueva compra = pedir aprobación",
    explanation: isNew
      ? `Es una nueva compra con proveedor no conocido ("${input.supplier}"). No está en la lista de proveedores válidos. Decisión: pedir aprobación humana.`
      : `El proveedor "${input.supplier}" está registrado en la lista de proveedores válidos.`,
    alert: isNew ? { severity: "high", text: "Nueva compra / Proveedor no conocido" } : undefined,
  });

  // 7. Señales de riesgo que el motor de reglas reporta para revisión humana
  const signals = input.reviewSignals ?? [];
  if (signals.length) {
    rules.push({
      ruleId: "bank_account",
      label: "Señales de riesgo del motor de reglas",
      status: "needs_review",
      rule: "Cualquier señal de riesgo → pedir aprobación humana",
      explanation: signals.join(" "),
      alert: { severity: "high", text: "Señal de riesgo para revisión humana" },
    });
  }

  // 8. Gasto máximo permitido diario sin aprobación humana
  const exceeds100 = input.amountUsd > threshold || dailyTotal > threshold;
  rules.push({
    ruleId: "human_approval_threshold",
    label: `Gasto máximo permitido diario (${threshold.toLocaleString("en-US")} USD)`,
    status: exceeds100 ? "needs_review" : "passed",
    rule: `Gasto máximo diario permitido sin aprobación humana: ${threshold} USD`,
    explanation: exceeds100
      ? `El monto (${input.amountUsd.toFixed(2)} USD, acumulado diario: ${dailyTotal.toFixed(2)} USD) es mayor al gasto máximo permitido diario de ${threshold} USD. Decisión: pedir aprobación humana explicándole que es por el monto.`
      : `El monto (${input.amountUsd.toFixed(2)} USD) está dentro del gasto diario permitido sin intervención de ${threshold} USD.`,
    ifChanged: `Se habría aprobado automáticamente si el monto fuera de ${threshold} USD o menos.`,
    alert: exceeds100
      ? {
          severity: "medium",
          text: `Supera el umbral diario de ${threshold.toLocaleString("en-US")} USD`,
        }
      : undefined,
  });

  // Precedencia de resolución:
  // FRENAR si supera límites absolutos (1000 USD), duplicado o contradicciones
  if (exceeds1000 || isDup || hasContradiction) {
    const reason: JevReason = exceeds1000
      ? "limite_financiero_1000_usd"
      : isDup
        ? "factura_duplicada"
        : "datos_faltantes_o_contradictorios";
    const explanation = exceeds1000
      ? `Frenado por política financiera: El monto de ${input.amountUsd.toFixed(2)} USD supera el límite financiero absoluto diario de ${dailyLimit} USD (o acumulado diario de ${dailyTotal.toFixed(2)} USD).`
      : isDup
        ? `Frenado por seguridad: La factura parece duplicada (mismo proveedor, número e importe ya registrados). Se frena la autorización automática mientras se comprueba el duplicado.`
        : `Frenado por seguridad: Existen contradicciones materiales en los datos esenciales de la factura.${input.contradictionDetails ? ` ${input.contradictionDetails}` : ""}`;

    return {
      action: "frenar",
      outcome: "blocked",
      reason,
      explanation,
      confidence: 0.99,
      evaluator: "jev-rules-engine",
      rules,
      rawState: buildJevState(input),
      rawQuestions: buildJevQuestions(threshold, dailyLimit),
    };
  }

  // ESCALAR / PEDIR INFORMACIÓN
  if (hasMissing) {
    return {
      action: "escalar",
      outcome: "needs_information",
      reason: "datos_faltantes_o_contradictorios",
      explanation: `Faltan datos esenciales (${missing.join(", ")}). Decisión: solicitar revisión para que un humano complete la información faltante.`,
      confidence: 0.95,
      evaluator: "jev-rules-engine",
      rules,
      rawState: buildJevState(input),
      rawQuestions: buildJevQuestions(threshold, dailyLimit),
    };
  }

  if (signals.length) {
    return {
      action: "escalar",
      outcome: "requires_approval",
      reason: "senal_de_riesgo",
      explanation: `Escalado a decisión humana: hay señales de riesgo que una persona debe revisar. ${signals.join(" ")}`,
      confidence: 0.95,
      evaluator: "jev-rules-engine",
      rules,
      rawState: buildJevState(input),
      rawQuestions: buildJevQuestions(threshold, dailyLimit),
    };
  }

  if (recExceeds20) {
    return {
      action: "escalar",
      outcome: "requires_approval",
      reason: "variacion_recurrente_20",
      explanation: `Escalado a decisión humana: El costo del servicio recurrente supera el promedio habitual de los últimos 3 meses en más de un 20% (+${varPct.toFixed(1)}%).`,
      confidence: 0.94,
      evaluator: "jev-rules-engine",
      rules,
      rawState: buildJevState(input),
      rawQuestions: buildJevQuestions(threshold, dailyLimit),
    };
  }

  if (isNew) {
    return {
      action: "escalar",
      outcome: "requires_approval",
      reason: "proveedor_nuevo",
      explanation: `Escalado a decisión humana: Nueva compra con proveedor no conocido ("${input.supplier}"). Se requiere aprobación de Finanzas.`,
      confidence: 0.96,
      evaluator: "jev-rules-engine",
      rules,
      rawState: buildJevState(input),
      rawQuestions: buildJevQuestions(threshold, dailyLimit),
    };
  }

  if (exceeds100) {
    return {
      action: "escalar",
      outcome: "requires_approval",
      reason: "monto_mayor_100_usd",
      explanation: `Escalado a decisión humana: El monto (${input.amountUsd.toFixed(2)} USD) es mayor al gasto máximo permitido diario de ${threshold} USD. Requiere aprobación humana por el monto.`,
      confidence: 0.98,
      evaluator: "jev-rules-engine",
      rules,
      rawState: buildJevState(input),
      rawQuestions: buildJevQuestions(threshold, dailyLimit),
    };
  }

  // APROBACIÓN AUTOMÁTICA
  return {
    action: "aprobar",
    outcome: "authorized",
    reason: "aprobado_normal",
    explanation: `Aprobado automáticamente: El proveedor "${input.supplier}" está en la lista de proveedores válidos y el importe (${input.amountUsd.toFixed(2)} USD) no supera el gasto diario de ${threshold} USD.`,
    confidence: 0.99,
    evaluator: "jev-rules-engine",
    rules,
    rawState: buildJevState(input),
    rawQuestions: buildJevQuestions(threshold, dailyLimit),
  };
}

/**
 * Consulta a JEV de TypeSafe AI mediante HTTP y mapea la respuesta calibrada.
 * Si la red o la clave no están disponibles, realiza evaluación local determinista idéntica.
 */
export async function evaluateWithJev(
  input: JevDecisionInput,
  apiKey?: string,
): Promise<JevDecisionEvaluation> {
  const key =
    apiKey ||
    (typeof process !== "undefined" && process.env
      ? process.env["JEV_API_KEY"] || process.env["TYPESAFE_API_KEY"]
      : undefined);

  const localFallback = evaluateJevLocally(input);

  if (!key) {
    return localFallback;
  }

  const state = buildJevState(input);
  const threshold = input.dailyApprovalThresholdUsd ?? 100;
  const limit = input.dailyLimitMaxUsd ?? 1000;
  const questions = buildJevQuestions(threshold, limit);

  try {
    const res = await fetch("https://api.typesafe.ai/v1/systemone", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "jev-latest",
        state,
        questions,
      }),
    });

    if (!res.ok) {
      console.warn(`JEV API respondió con status ${res.status}. Usando motor determinista.`);
      return localFallback;
    }

    const data = (await res.json()) as JevApiResponse;
    const actionChoice = data.answers?.action?.choice || localFallback.action;
    const reasonChoice = data.answers?.motivo?.choice || localFallback.reason;
    const confidence = data.answers?.action?.confidence ?? 0.95;

    let outcome: DecisionOutcome = "requires_approval";
    if (actionChoice === "aprobar") outcome = "authorized";
    else if (actionChoice === "frenar") outcome = "blocked";
    else if (actionChoice === "escalar" && reasonChoice === "datos_faltantes_o_contradictorios") {
      outcome = "needs_information";
    }

    // Usar la explicación adecuada según el motivo calibrado por Jev
    let explanation = localFallback.explanation;
    if (actionChoice === "aprobar") {
      explanation = `Aprobado automáticamente por JEV: El proveedor "${input.supplier}" es válido y el monto (${input.amountUsd.toFixed(2)} USD) no supera los ${threshold.toLocaleString("en-US")} USD diarios.`;
    } else if (actionChoice === "frenar") {
      if (reasonChoice === "limite_financiero_1000_usd") {
        explanation = `Frenado por JEV: Supera el límite financiero absoluto de ${limit.toLocaleString("en-US")} USD diarios o el presupuesto disponible.`;
      } else if (reasonChoice === "factura_duplicada") {
        explanation = `Frenado por JEV: La factura parece duplicada (mismo proveedor, número e importe ya registrados). Se frena la autorización automática.`;
      } else {
        explanation = `Frenado por JEV: Datos esenciales contradictorios o materialmente inválidos.`;
      }
    } else if (actionChoice === "escalar") {
      if (reasonChoice === "monto_mayor_100_usd") {
        explanation = `Escalado a decisión humana por JEV: El monto (${input.amountUsd.toFixed(2)} USD) es mayor al gasto máximo permitido diario de ${threshold.toLocaleString("en-US")} USD. Se requiere aprobación humana por el monto.`;
      } else if (reasonChoice === "proveedor_nuevo") {
        explanation = `Escalado a decisión humana por JEV: Nueva compra con proveedor no conocido ("${input.supplier}").`;
      } else if (reasonChoice === "variacion_recurrente_20") {
        explanation = `Escalado a decisión humana por JEV: Pago recurrente supera en más de un 20% el promedio usual.`;
      } else if (reasonChoice === "datos_faltantes_o_contradictorios") {
        explanation = `Escalado a decisión humana por JEV: Faltan datos esenciales (${(input.missingFields ?? []).join(", ")}) y se requiere que un humano complete la información.`;
      } else if (reasonChoice === "senal_de_riesgo") {
        explanation = `Escalado a decisión humana por JEV: hay señales de riesgo. ${(input.reviewSignals ?? []).join(" ")}`;
      }
    }

    return {
      action: actionChoice,
      outcome,
      reason: reasonChoice,
      explanation,
      confidence,
      evaluator: "jev-typesafe-api",
      rules: localFallback.rules,
      rawState: state,
      rawQuestions: questions,
      answers: data.answers,
    };
  } catch (err) {
    console.warn("Error conectando con JEV API:", err);
    return localFallback;
  }
}
