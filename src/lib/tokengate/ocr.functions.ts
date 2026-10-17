// Invoice OCR (Claude Haiku 4.5). The API key is read server-side only.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  fileName: z.string().max(200),
  mimeType: z.string().regex(/^(application\/pdf|image\/(png|jpeg|webp))$/),
  base64: z.string().min(1).max(14_000_000), // ~10 MB file
});

export type OcrInvoice = {
  invoiceNumber: string | null;
  supplier: string | null;
  supplierTaxId: string | null;
  amount: string | null; // decimal string, e.g. "1250.50"
  currency: string | null;
  dueDate: string | null; // YYYY-MM-DD
  description: string | null;
};

const nullableString = { type: ["string", "null"] };
const schema = {
  type: "object",
  additionalProperties: false,
  required: ["invoiceNumber", "supplier", "supplierTaxId", "amount", "currency", "dueDate", "description"],
  properties: {
    invoiceNumber: { ...nullableString, description: "Número o identificador de la factura" },
    supplier: { ...nullableString, description: "Nombre del proveedor que emite la factura" },
    supplierTaxId: { ...nullableString, description: "NIF, CIF, NIT, VAT o identificador fiscal del proveedor" },
    amount: { ...nullableString, description: "Importe total a pagar, solo dígitos y punto decimal, ej. 1250.50" },
    currency: { ...nullableString, description: "Código ISO 4217 de la moneda, ej. COP, USD o EUR" },
    dueDate: { ...nullableString, description: "Fecha de vencimiento en formato YYYY-MM-DD" },
    description: { ...nullableString, description: "Resumen breve del concepto facturado" },
  },
};

export const extractInvoice = createServerFn({ method: "POST" })
  .validator((d: unknown) => Input.parse(d))
  .handler(async ({ data }): Promise<{ ok: true; invoice: OcrInvoice } | { ok: false; error: string }> => {
    const key = process.env["ANTHROPIC_API_KEY"];
    if (!key) return { ok: false, error: "El OCR no está configurado todavía." };

    const source = { type: "base64", media_type: data.mimeType, data: data.base64 };
    const fileBlock = data.mimeType === "application/pdf" ? { type: "document", source } : { type: "image", source };

    // Claude Haiku 4.5: cheapest Claude with vision + PDF support; a forced tool call returns structured JSON.
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 1024,
        tools: [{ name: "record_invoice", description: "Registra los datos extraídos de la factura", input_schema: schema }],
        tool_choice: { type: "tool", name: "record_invoice" },
        messages: [{
          role: "user",
          content: [fileBlock, { type: "text", text: "Extrae los datos de esta factura. Usa null si un dato no aparece." }],
        }],
      }),
    });

    if (!res.ok) {
      const msg =
        res.status === 401 ? "La clave de Claude no es válida."
        : res.status === 429 ? "Claude está limitando las peticiones. Inténtalo en un minuto."
        : res.status === 413 || res.status === 400 ? "No se pudo leer el archivo. Prueba con un PDF o imagen más pequeño."
        : "El servicio de OCR no respondió. Inténtalo de nuevo.";
      console.error("Claude OCR error", res.status, (await res.text()).slice(0, 300));
      return { ok: false, error: msg };
    }

    const json = (await res.json()) as { content?: { type: string; input?: unknown }[] };
    try {
      const parsed = (json.content?.find((c) => c.type === "tool_use")?.input ?? {}) as Partial<OcrInvoice>;
      const pick = (k: keyof OcrInvoice) => (typeof parsed[k] === "string" && parsed[k] ? (parsed[k] as string).trim() : null);
      return {
        ok: true,
        invoice: {
          invoiceNumber: pick("invoiceNumber"),
          supplier: pick("supplier"),
          supplierTaxId: pick("supplierTaxId"),
          amount: pick("amount"),
          currency: pick("currency")?.toUpperCase() ?? null,
          dueDate: pick("dueDate"),
          description: pick("description"),
        },
      };
    } catch {
      return { ok: false, error: "No se pudieron interpretar los datos de la factura." };
    }
  });
