import { describe, expect, it } from "vitest";
import { completeSubject, specFor } from "./missing-fields";
import { apply, emptyRows, stateFromRows } from "./org-state";
import type { Invoice } from "./types";

const inv: Invoice = {
  id: "x1",
  kind: "invoice",
  reference: "INV-x1",
  supplier: "Proveedor",
  amount: { amountMinor: 100_000, currency: "COP" },
  agentId: "agent",
  description: "Servicio",
  category: "Servicios",
  missingFields: ["NIT / Identificación fiscal"],
  receivedAt: "2026-10-01T00:00:00.000Z",
  channel: "upload",
  issueDate: "2026-10-01T00:00:00.000Z",
  dueDate: "2026-10-30T00:00:00Z",
  extractionConfidence: 100,
};

describe("completar datos faltantes", () => {
  it("el NIT se mapea al ID fiscal y se valida", () => {
    expect(specFor("NIT / Identificación fiscal").key).toBe("supplierTaxId");
    expect(specFor("NIT").validate("ab")).not.toBeNull();
    expect(specFor("NIT").validate("900123456-7")).toBeNull();
  });

  it("completar el NIT elimina el faltante", () => {
    const out = completeSubject(inv, { "NIT / Identificación fiscal": "900123456-7" });
    expect(out.supplierTaxId).toBe("900123456-7");
    expect(out.missingFields).toEqual([]);
  });

  it("un valor inválido no elimina el faltante", () => {
    const out = completeSubject(inv, { "NIT / Identificación fiscal": "x" });
    expect(out.missingFields).toEqual(["NIT / Identificación fiscal"]);
  });

  it("la acción actualiza la factura guardada", () => {
    const s0 = apply(stateFromRows(emptyRows()), { type: "addInvoice", invoice: inv }).next;
    const { next, writes } = apply(s0, {
      type: "completeFields",
      subjectId: "x1",
      values: { "NIT / Identificación fiscal": "900123456-7" },
    });
    expect(next.invoices[0]!.missingFields).toEqual([]);
    expect(writes.subjects[0]!.supplierTaxId).toBe("900123456-7");
  });
});
