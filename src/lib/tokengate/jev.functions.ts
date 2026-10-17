import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { evaluateWithJev, type JevDecisionInput, type JevDecisionEvaluation } from "./jev";

const CurrencySchema = z.enum(["USD", "EUR", "COP", "MXN", "BRL", "ARS"]);

const JevInputSchema = z.object({
  supplier: z.string().min(1),
  amount: z.number().positive(),
  currency: CurrencySchema,
  amountUsd: z.number().positive(),
  isApprovedSupplier: z.boolean(),
  isNewSupplier: z.boolean(),
  dailySpentUsd: z.number().optional(),
  dailyLimitMaxUsd: z.number().optional(),
  dailyApprovalThresholdUsd: z.number().optional(),
  invoiceNumber: z.string().optional(),
  isDuplicate: z.boolean().optional(),
  duplicateDetails: z.string().optional(),
  missingFields: z.array(z.string()).optional(),
  hasContradictions: z.boolean().optional(),
  contradictionDetails: z.string().optional(),
  isRecurring: z.boolean().optional(),
  recurringAverageUsd: z.number().optional(),
  recurringVariationPct: z.number().optional(),
});

export const evaluateJevDecisionFn = createServerFn({ method: "POST" })
  .validator((d: unknown): JevDecisionInput => JevInputSchema.parse(d))
  .handler(async ({ data }): Promise<JevDecisionEvaluation> => {
    // La clave se lee del entorno en el servidor, jamás viaja al cliente
    const key = process.env["JEV_API_KEY"] || process.env["TYPESAFE_API_KEY"];
    return await evaluateWithJev(data, key);
  });
