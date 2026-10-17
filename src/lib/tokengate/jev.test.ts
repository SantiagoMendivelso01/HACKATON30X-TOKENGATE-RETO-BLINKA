import { describe, expect, it } from "vitest";
import { evaluateJevLocally, buildJevState, buildJevQuestions, type JevDecisionInput } from "./jev";

describe("JEV TypeSafe Decision Engine — Reto Blinka", () => {
  it("Caso 1: Aprueba automáticamente si el proveedor es válido y monto <= 100 USD", () => {
    const input: JevDecisionInput = {
      supplier: "AWS",
      amount: 45,
      currency: "USD",
      amountUsd: 45,
      isApprovedSupplier: true,
      isNewSupplier: false,
      dailySpentUsd: 0,
      dailyApprovalThresholdUsd: 100,
      dailyLimitMaxUsd: 1000,
    };

    const res = evaluateJevLocally(input);
    expect(res.action).toBe("aprobar");
    expect(res.outcome).toBe("authorized");
    expect(res.reason).toBe("aprobado_normal");
    expect(res.explanation).toContain("Aprobado automáticamente");
    expect(res.explanation).toContain("AWS");
  });

  it("Caso 2: Pide aprobación si es una nueva compra (proveedor no conocido)", () => {
    const input: JevDecisionInput = {
      supplier: "Proveedor Desconocido SAS",
      amount: 50,
      currency: "USD",
      amountUsd: 50,
      isApprovedSupplier: false,
      isNewSupplier: true,
      dailySpentUsd: 0,
      dailyApprovalThresholdUsd: 100,
      dailyLimitMaxUsd: 1000,
    };

    const res = evaluateJevLocally(input);
    expect(res.action).toBe("escalar");
    expect(res.outcome).toBe("requires_approval");
    expect(res.reason).toBe("proveedor_nuevo");
    expect(res.explanation).toContain("Nueva compra con proveedor no conocido");
  });

  it("Caso 3: Pide aprobación si el monto es mayor a 100 USD y explica que es por el monto", () => {
    const input: JevDecisionInput = {
      supplier: "AWS",
      amount: 150,
      currency: "USD",
      amountUsd: 150,
      isApprovedSupplier: true,
      isNewSupplier: false,
      dailySpentUsd: 0,
      dailyApprovalThresholdUsd: 100,
      dailyLimitMaxUsd: 1000,
    };

    const res = evaluateJevLocally(input);
    expect(res.action).toBe("escalar");
    expect(res.outcome).toBe("requires_approval");
    expect(res.reason).toBe("monto_mayor_100_usd");
    expect(res.explanation).toContain("es mayor al gasto máximo permitido diario de 100 USD");
    expect(res.explanation).toContain("por el monto");
  });

  it("Caso 4: Frena si supera el límite financiero absoluto diario de 1,000 USD", () => {
    const input: JevDecisionInput = {
      supplier: "AWS",
      amount: 1200,
      currency: "USD",
      amountUsd: 1200,
      isApprovedSupplier: true,
      isNewSupplier: false,
      dailySpentUsd: 0,
      dailyApprovalThresholdUsd: 100,
      dailyLimitMaxUsd: 1000,
    };

    const res = evaluateJevLocally(input);
    expect(res.action).toBe("frenar");
    expect(res.outcome).toBe("blocked");
    expect(res.reason).toBe("limite_financiero_1000_usd");
    expect(res.explanation).toContain("límite financiero absoluto diario de 1000 USD");
  });

  it("Caso 5: Frena si la factura parece duplicada (mismo proveedor, número de factura e importe)", () => {
    const input: JevDecisionInput = {
      supplier: "Slack Technologies",
      amount: 80,
      currency: "USD",
      amountUsd: 80,
      isApprovedSupplier: true,
      isNewSupplier: false,
      invoiceNumber: "INV-9988",
      isDuplicate: true,
      duplicateDetails: "Factura INV-9988 ya registrada con importe 80 USD",
      dailySpentUsd: 0,
      dailyApprovalThresholdUsd: 100,
      dailyLimitMaxUsd: 1000,
    };

    const res = evaluateJevLocally(input);
    expect(res.action).toBe("frenar");
    expect(res.outcome).toBe("blocked");
    expect(res.reason).toBe("factura_duplicada");
    expect(res.explanation).toContain("parece duplicada");
  });

  it("Caso 6a: Pide información y solicita que un humano complete info si falta dato esencial (ej: falta el NIT)", () => {
    const input: JevDecisionInput = {
      supplier: "Consultor Independiente",
      amount: 70,
      currency: "USD",
      amountUsd: 70,
      isApprovedSupplier: true,
      isNewSupplier: false,
      missingFields: ["NIT / Identificación fiscal"],
      dailySpentUsd: 0,
      dailyApprovalThresholdUsd: 100,
      dailyLimitMaxUsd: 1000,
    };

    const res = evaluateJevLocally(input);
    expect(res.action).toBe("escalar");
    expect(res.outcome).toBe("needs_information");
    expect(res.reason).toBe("datos_faltantes_o_contradictorios");
    expect(res.explanation).toContain("Faltan datos esenciales");
    expect(res.explanation).toContain("humano complete la información");
  });

  it("Caso 6b: Frena si existen contradicciones materiales en datos esenciales", () => {
    const input: JevDecisionInput = {
      supplier: "Consultor Independiente",
      amount: 70,
      currency: "USD",
      amountUsd: 70,
      isApprovedSupplier: true,
      isNewSupplier: false,
      hasContradictions: true,
      contradictionDetails: "El NIT 900123456 no corresponde a la razón social registrada",
      dailySpentUsd: 0,
      dailyApprovalThresholdUsd: 100,
      dailyLimitMaxUsd: 1000,
    };

    const res = evaluateJevLocally(input);
    expect(res.action).toBe("frenar");
    expect(res.outcome).toBe("blocked");
    expect(res.reason).toBe("datos_faltantes_o_contradictorios");
    expect(res.explanation).toContain("contradicciones materiales");
  });

  it("Caso 7: Pide aprobación si el costo de un pago recurrente supera el usual en más de 20%", () => {
    const input: JevDecisionInput = {
      supplier: "Figma",
      amount: 125,
      currency: "USD",
      amountUsd: 125,
      isApprovedSupplier: true,
      isNewSupplier: false,
      isRecurring: true,
      recurringAverageUsd: 100,
      recurringVariationPct: 25, // 25% > 20%
      dailySpentUsd: 0,
      dailyApprovalThresholdUsd: 100,
      dailyLimitMaxUsd: 1000,
    };

    const res = evaluateJevLocally(input);
    expect(res.action).toBe("escalar");
    expect(res.outcome).toBe("requires_approval");
    expect(res.reason).toBe("variacion_recurrente_20");
    expect(res.explanation).toContain("más de un 20%");
  });

  it("Caso 8: Genera estado y preguntas estructuradas compatibles con JEV TypeSafe", () => {
    const input: JevDecisionInput = {
      supplier: "Datadog",
      amount: 85,
      currency: "USD",
      amountUsd: 85,
      isApprovedSupplier: true,
      isNewSupplier: false,
    };

    const state = buildJevState(input);
    expect(state).toContain("Datadog");
    expect(state).toContain("85");

    const questions = buildJevQuestions();
    expect(questions.action.type).toBe("choice");
    expect(questions.action.criteria["aprobar"]).toBeDefined();
    expect(questions.action.criteria["escalar"]).toBeDefined();
    expect(questions.action.criteria["frenar"]).toBeDefined();
  });

  it("Caso 9: Precedencia — Frena si supera límite absoluto incluso si también es un proveedor nuevo", () => {
    const input: JevDecisionInput = {
      supplier: "Proveedor Desconocido Muy Caro",
      amount: 2500,
      currency: "USD",
      amountUsd: 2500,
      isApprovedSupplier: false,
      isNewSupplier: true,
      dailySpentUsd: 0,
      dailyApprovalThresholdUsd: 100,
      dailyLimitMaxUsd: 1000,
    };

    const res = evaluateJevLocally(input);
    expect(res.action).toBe("frenar");
    expect(res.outcome).toBe("blocked");
    expect(res.reason).toBe("limite_financiero_1000_usd");
  });

  it("Caso 10: Acumulado diario — Monto individual de 40 USD pero acumulado diario llega a 120 USD (>100 USD)", () => {
    const input: JevDecisionInput = {
      supplier: "AWS",
      amount: 40,
      currency: "USD",
      amountUsd: 40,
      isApprovedSupplier: true,
      isNewSupplier: false,
      dailySpentUsd: 80, // 80 + 40 = 120 USD (> 100)
      dailyApprovalThresholdUsd: 100,
      dailyLimitMaxUsd: 1000,
    };

    const res = evaluateJevLocally(input);
    expect(res.action).toBe("escalar");
    expect(res.outcome).toBe("requires_approval");
    expect(res.reason).toBe("monto_mayor_100_usd");
    expect(res.explanation).toContain("es mayor al gasto máximo permitido diario de 100 USD");
  });

  it("Caso 11: Conversión de moneda extranjera (COP) a USD", () => {
    // 450,000 COP a tasa 4,150 COP/USD equivale a ~108.43 USD (> 100 USD)
    const input: JevDecisionInput = {
      supplier: "AWS Colombia",
      amount: 450000,
      currency: "COP",
      amountUsd: 108.43,
      isApprovedSupplier: true,
      isNewSupplier: false,
      dailySpentUsd: 0,
      dailyApprovalThresholdUsd: 100,
      dailyLimitMaxUsd: 1000,
    };

    const res = evaluateJevLocally(input);
    expect(res.action).toBe("escalar");
    expect(res.outcome).toBe("requires_approval");
    expect(res.reason).toBe("monto_mayor_100_usd");
  });
});
