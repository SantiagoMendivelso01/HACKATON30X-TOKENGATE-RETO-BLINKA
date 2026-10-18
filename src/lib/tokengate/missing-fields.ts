import type { AnySubject } from "./types";

export type FieldKey = "supplierTaxId" | "bankAccount" | "dueDate" | "invoiceNumber" | "other";
export type FieldSpec = {
  key: FieldKey;
  input: "text" | "date";
  placeholder: string;
  validate: (v: string) => string | null;
};

const required = (v: string) => (v.trim() ? null : "Campo obligatorio");

/** Maps a missing-field label (Spanish, free text) to the subject field it completes. */
export function specFor(label: string): FieldSpec {
  const l = label.toLowerCase();
  if (/nit|fiscal|identificaci|rut|nif/.test(l))
    return {
      key: "supplierTaxId",
      input: "text",
      placeholder: "900123456-7",
      validate: (v) =>
        required(v) ??
        (/^[0-9A-Za-z][0-9A-Za-z.\- ]{4,19}$/.test(v.trim()) ? null : "NIT no válido"),
    };
  if (/cuenta|banc|iban/.test(l))
    return {
      key: "bankAccount",
      input: "text",
      placeholder: "Número de cuenta",
      validate: (v) =>
        required(v) ?? (/^[0-9A-Za-z\- ]{6,34}$/.test(v.trim()) ? null : "Cuenta no válida"),
    };
  if (/venc|fecha/.test(l))
    return {
      key: "dueDate",
      input: "date",
      placeholder: "",
      validate: (v) => required(v) ?? (Number.isNaN(Date.parse(v)) ? "Fecha no válida" : null),
    };
  if (/n[uú]mero de factura|factura n/.test(l))
    return { key: "invoiceNumber", input: "text", placeholder: "FV-0001", validate: required };
  return {
    key: "other",
    input: "text",
    placeholder: "Escribe el dato",
    validate: (v) => required(v) ?? (v.trim().length > 200 ? "Máximo 200 caracteres" : null),
  };
}

export function currentValue(s: AnySubject, label: string): string {
  const k = specFor(label).key;
  if (k === "other") return "";
  const v = (s as Record<string, unknown>)[k];
  return typeof v === "string" ? v : "";
}

/** Applies values (by label) to the subject and removes the completed labels from missingFields. */
export function completeSubject(s: AnySubject, values: Record<string, string>): AnySubject {
  const next = { ...s } as AnySubject & Record<string, unknown>;
  const extra: string[] = [];
  const done = new Set<string>();
  for (const label of s.missingFields) {
    const raw = values[label]?.trim();
    if (!raw || specFor(label).validate(raw)) continue;
    const { key } = specFor(label);
    if (key === "other") extra.push(`${label}: ${raw}`);
    else if (key !== "dueDate" || s.kind === "invoice") next[key] = raw;
    done.add(label);
  }
  next.missingFields = s.missingFields.filter((l) => !done.has(l));
  if (extra.length) next.description = `${s.description} · ${extra.join(" · ")}`;
  return next;
}
