import { describe, expect, it } from "vitest";
import { publicRecords } from "./public-records";
import { defaultConfig, emptyRows, stateFromRows } from "./org-state";
import type { Invoice } from "./types";
import { formatMoney } from "./format";

const invoice: Invoice = {
  id: "private-id",
  kind: "invoice",
  reference: "Juan 12345",
  supplier: "AWS",
  amount: { amountMinor: 450000, currency: "COP" },
  agentId: "agent",
  description: "Juan Pérez 3001234567",
  category: "Software",
  missingFields: [],
  receivedAt: "2026-10-18T00:00:00Z",
  channel: "email",
  issueDate: "2026-10-17",
  dueDate: "2026-11-17",
  extractionConfidence: 99,
  sender: "juan@example.com",
  supplierTaxId: "123456789",
  bankAccount: "987654321",
  rawText: "Juan Pérez 3001234567",
  invoiceNumber: "private-number",
};
describe("public records", () => {
  it("removes personal names and telephone numbers from free text", () => {
    const output = JSON.stringify(
      publicRecords({ ...emptyRows(), subjects: [invoice] }, defaultConfig()),
    );
    expect(output).not.toContain("Juan");
    expect(output).not.toContain("3001234567");
    expect(output).not.toContain("juan@example.com");
  });
  it("removes identification and bank details", () => {
    const output = JSON.stringify(
      publicRecords({ ...emptyRows(), subjects: [invoice] }, defaultConfig()),
    );
    expect(output).not.toContain("123456789");
    expect(output).not.toContain("987654321");
  });
  it("preserves amounts and merchant names", () => {
    const output = publicRecords({ ...emptyRows(), subjects: [invoice] }, defaultConfig());
    expect(output.subjects[0]?.amount).toEqual({ amountMinor: 450000, currency: "COP" });
    expect(output.subjects[0]?.supplier).toBe("AWS");
  });
  it("loads all 17 records as 16 invoices and one purchase without editing originals", () => {
    const rows = {
      ...emptyRows(),
      subjects: [
        ...Array.from({ length: 16 }, () => ({ ...invoice })),
        {
          ...invoice,
          kind: "purchase" as const,
          requestedAt: invoice.receivedAt,
          budgetLine: "Private",
        },
      ],
    };
    const result = stateFromRows(publicRecords(rows, defaultConfig()));
    expect(result.invoices).toHaveLength(16);
    expect(result.purchases).toHaveLength(1);
    expect(rows.subjects[0]?.supplierTaxId).toBe("123456789");
  });
  it("projects legacy purchases without exposing nested telephone numbers", () => {
    const legacy = {
      id: "old",
      kind: "purchase",
      amount: { amountMinor: 12300, currency: "COP" },
      reference: "private",
      receivedAt: invoice.receivedAt,
      payload: {
        telefono_empleado: "3005550000",
        opcion_elegida: { tienda_nombre: "Comercio Test" },
      },
    };
    const rows = { ...emptyRows(), subjects: [legacy] } as unknown as Parameters<
      typeof publicRecords
    >[0];
    const result = publicRecords(rows, defaultConfig());
    expect(result.subjects[0]?.supplier).toBe("Comercio Test");
    expect(result.subjects[0]?.amount.amountMinor).toBe(12300);
    expect(JSON.stringify(result)).not.toContain("3005550000");
  });
  it.each([48200, 67800])(
    "converts legacy checkout COP %i pesos to centavos without editing the source",
    (pesos) => {
      const purchase = {
        ...invoice,
        kind: "purchase" as const,
        requestedAt: invoice.receivedAt,
        budgetLine: "Compra",
        amount: { amountMinor: pesos, currency: "COP" as const },
        payload: { opcion_elegida: { tienda_nombre: "Comercio Test", precio_cop: pesos / 2 } },
      };
      const result = publicRecords({ ...emptyRows(), subjects: [purchase] }, defaultConfig());
      expect(result.subjects[0]?.amount.amountMinor).toBe(pesos * 100);
      expect(purchase.amount.amountMinor).toBe(pesos);
      const normalized = result.subjects[0];
      if (!normalized) throw new Error("Missing purchase");
      expect(formatMoney(normalized.amount)).toBe(pesos === 48200 ? "COP 48,200" : "COP 67,800");
      expect(publicRecords(result, defaultConfig()).subjects[0]?.amount.amountMinor).toBe(
        pesos * 100,
      );
    },
  );
  it("keeps native COP purchases in minor units", () => {
    const purchase = {
      ...invoice,
      kind: "purchase" as const,
      requestedAt: invoice.receivedAt,
      budgetLine: "Compra",
      amount: { amountMinor: 4820000, currency: "COP" as const },
    };
    const result = publicRecords({ ...emptyRows(), subjects: [purchase] }, defaultConfig());
    expect(result.subjects[0]?.amount.amountMinor).toBe(4820000);
  });
});
