import { describe, expect, it } from "vitest";
import { interpretRules } from "./nl-rules";
import { ORG } from "./org";

describe("reglas dictadas en español", () => {
  it("entiende varias reglas en una sola frase", () => {
    const { changes, next, unread } = interpretRules(
      "Pide permiso por encima de 2.000 dólares y frena a los proveedores nuevos. El presupuesto del mes es de 80 mil dólares",
      ORG.policy,
    );
    expect(unread).toEqual([]);
    expect(changes.map((c) => c.field).sort()).toEqual(
      ["approvalThreshold", "monthlyBudget", "newSupplierAction"].sort(),
    );
    expect(next.approvalThreshold).toBe(200_000);
    expect(next.monthlyBudget).toBe(8_000_000);
    expect(next.newSupplierAction).toBe("block");
  });

  it("convierte montos en pesos colombianos a USD", () => {
    const { next } = interpretRules(
      "Nunca pagues más de 41.500.000 pesos colombianos en una factura",
      ORG.policy,
    );
    expect(next.transactionLimit).toBe(1_000_000);
  });

  it("avisa lo que no entendió", () => {
    const { changes, unread } = interpretRules("Haz algo bonito", ORG.policy);
    expect(changes).toEqual([]);
    expect(unread).toEqual(["Haz algo bonito"]);
  });
});
