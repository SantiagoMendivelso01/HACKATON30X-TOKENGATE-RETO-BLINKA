// Local, deterministic reading of free text (pasted email, chat message or dictation) into form
// fields. Used when Claude is not configured, and as a first instant guess before it answers.
import type { Currency } from "./types";

export type TextFields = {
  supplier: string | null;
  supplierTaxId: string | null;
  amount: string | null; // "1250.50"
  currency: Currency | null;
  invoiceNumber: string | null;
  bankAccount: string | null;
  dueDate: string | null; // YYYY-MM-DD
  description: string | null;
  country: string | null; // ISO-2
  contractType: "fixed" | "cap" | null;
};

const CURRENCY_WORDS: [RegExp, Currency][] = [
  [/\b(cop|pesos?\s+colombianos?)\b/i, "COP"],
  [/\b(mxn|pesos?\s+mexicanos?)\b/i, "MXN"],
  [/\b(ars|pesos?\s+argentinos?)\b/i, "ARS"],
  [/\b(brl|reales?|r\$)\b/i, "BRL"],
  [/\b(eur|euros?)\b|€/i, "EUR"],
  [/\b(usd|d[oó]lares?|us\$)\b/i, "USD"],
];

const COUNTRY_WORDS: [RegExp, string][] = [
  [/\b(colombia|colombian[oa]|bogot[aá]|medell[ií]n|nit|c[eé]dula|cc)\b/i, "CO"],
  [/\b(m[eé]xico|mexican[oa]|cdmx|rfc)\b/i, "MX"],
  [/\b(brasil|brazil|brasileñ[oa]|s[aã]o paulo|cnpj|cpf)\b/i, "BR"],
  [/\b(argentina|argentin[oa]|buenos aires|cuit)\b/i, "AR"],
  [/\b(per[uú]|peruan[oa]|lima|ruc)\b/i, "PE"],
  [/\b(chile|chilen[oa]|santiago de chile|rut)\b/i, "CL"],
  [/\b(espa[ñn]a|españ[oa]l|madrid|nif|cif)\b/i, "ES"],
  [/\b(estados unidos|ee\.?\s?uu|usa|delaware|ein)\b/i, "US"],
];

const MONTHS: Record<string, number> = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
};

/** "9.960.000" → "9960000", "1,842.37" → "1842.37", "8.100,00" → "8100.00", "2 mil" → "2000". */
export function normalizeAmount(raw: string, mil = false): string | null {
  let n = raw.replace(/\s/g, "");
  const lastSep = Math.max(n.lastIndexOf("."), n.lastIndexOf(","));
  if (lastSep >= 0) {
    const decimals = n.length - lastSep - 1;
    if (decimals === 3) n = n.replace(/[.,]/g, "");
    else n = n.slice(0, lastSep).replace(/[.,]/g, "") + "." + n.slice(lastSep + 1);
  }
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return null;
  return (mil ? v * 1000 : v).toFixed(2);
}

function findAmount(t: string): string | null {
  // Prefer a number next to a total/currency marker; else the largest number in the text.
  const near =
    t.match(
      /(?:total|monto|valor|importe|cobra|cobro|son|por|de)\s*(?:a pagar\s*)?[:\s]*(?:usd|cop|eur|mxn|brl|ars|us\$|r\$|\$|€)?\s*(\d[\d.,\s]*\d|\d)\s*(mil(?:lones)?|k)?/i,
    ) ??
    t.match(/(?:usd|cop|eur|mxn|brl|ars|us\$|r\$|\$|€)\s*(\d[\d.,]*\d|\d)\s*(mil(?:lones)?|k)?/i);
  const pick = (m: RegExpMatchArray | null) => {
    if (!m?.[1]) return null;
    const millions = m[2] && /millones/i.test(m[2]);
    const v = normalizeAmount(m[1], !!m[2] && !millions);
    return v && millions ? (Number(v) * 1_000_000).toFixed(2) : v;
  };
  const a = pick(near);
  if (a) return a;
  const all = [...t.matchAll(/\d[\d.,]*\d|\d/g)]
    .map((m) => normalizeAmount(m[0]))
    .filter((v): v is string => !!v)
    .map(Number)
    .filter((v) => v >= 10);
  return all.length ? Math.max(...all).toFixed(2) : null;
}

function findDue(t: string, now = new Date()): string | null {
  const iso = t.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (iso) return iso[0];
  const dmy = t.match(/\b(\d{1,2})[/-](\d{1,2})[/-](20\d{2})\b/);
  if (dmy) return `${dmy[3]}-${dmy[2]!.padStart(2, "0")}-${dmy[1]!.padStart(2, "0")}`;
  const named = t.match(
    /\b(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)(?:\s+de\s+(20\d{2}))?/i,
  );
  if (named) {
    const y = named[3] ? Number(named[3]) : now.getFullYear();
    const m = MONTHS[named[2]!.toLowerCase()]!;
    return `${y}-${String(m).padStart(2, "0")}-${named[1]!.padStart(2, "0")}`;
  }
  const inDays = t.match(/\b(?:en|vence en|a)\s+(\d{1,3})\s+d[ií]as\b/i);
  if (inDays)
    return new Date(now.getTime() + Number(inDays[1]) * 86_400_000).toISOString().slice(0, 10);
  return null;
}

export function readTextLocally(text: string, now = new Date()): TextFields {
  const t = text.replace(/\s+/g, " ").trim();
  const currency = CURRENCY_WORDS.find(([rx]) => rx.test(t))?.[1] ?? (/\$/.test(t) ? "USD" : null);
  const tax =
    t.match(
      /\b(NIT|RFC|CUIT|CNPJ|CPF|EIN|RUC|RUT|NIF|CIF|VAT|CC|c[eé]dula)[\s.:#]*([A-Z0-9][\dA-Z.\-/]{4,})/i,
    ) ?? null;
  const bank = t.match(
    /\b(Bancolombia|Davivienda|BBVA(?:\s+\w+)?|Banco\s+\w+|Ita[uú]|Nequi|Wise(?:\s+USD)?|Chase|JPMorgan(?:\s+Chase)?|Interbank|BCP|Santander|Citi(?:bank)?|Bank of America|Silicon Valley Bank|Nubank)\b[^\d*]{0,20}(\*{0,4}\s?\d{4,})/i,
  );
  const number = t.match(
    /\b(?:factura|invoice|cuenta de cobro|n[°ºo.]+|#)\s*(?:n[°ºo.]*\s*)?([A-Z]{1,6}-?[A-Z0-9]*-?\d{2,}[A-Z0-9-]*)/i,
  );
  const supplier =
    t.match(
      /\b(?:proveedor|de parte de|emisor|contratista|se llama|nombre)[:\s]+([A-ZÁÉÍÓÚÑ][\w&.,áéíóúñ ]{2,60}?)(?=[,.;]| con | que | cobra|$)/i,
    )?.[1] ??
    t.match(
      /^([A-ZÁÉÍÓÚÑ][\w&.áéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ&][\w&.áéíóúñ]+){0,5}(?:\s+(?:S\.A\.S\.|S\.A\.|LLC|Inc\.|Ltda\.|S\.A\.C\.))?)/,
    )?.[1] ??
    null;
  const desc =
    t.match(/\b(?:por|concepto|servicio de|servicios de)[:\s]+([^.,;]{4,80})/i)?.[1] ?? null;
  return {
    supplier: supplier?.trim() ?? null,
    supplierTaxId: tax ? `${tax[1]!.toUpperCase().replace(/C[EÉ]DULA/i, "CC")} ${tax[2]}` : null,
    amount: findAmount(t),
    currency,
    invoiceNumber: number?.[1] ?? null,
    bankAccount: bank ? `${bank[1]} ****${bank[2]!.replace(/\D/g, "").slice(-4)}` : null,
    dueDate: findDue(t, now),
    description: desc?.trim() ?? null,
    country: COUNTRY_WORDS.find(([rx]) => rx.test(t))?.[1] ?? null,
    contractType: /\b(tope|m[aá]ximo|hasta)\b/i.test(t)
      ? "cap"
      : /\b(fijo|mensual|al mes|retainer)\b/i.test(t)
        ? "fixed"
        : null,
  };
}
