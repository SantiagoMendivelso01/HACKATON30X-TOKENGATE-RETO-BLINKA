import { createServerFn } from "@tanstack/react-start";
import { evaluateWithJev, JevInputSchema, type JevDecisionEvaluation } from "./jev";

export const evaluateJevDecisionFn = createServerFn({ method: "POST" })
  .validator((d: unknown) => JevInputSchema.parse(d))
  .handler(async ({ data }): Promise<JevDecisionEvaluation> => {
    // La clave se lee del entorno en el servidor, jamás viaja al cliente
    const key = process.env["JEV_API_KEY"] || process.env["TYPESAFE_API_KEY"];
    return await evaluateWithJev(data, key);
  });
