import type { Currency, FxTable, Money } from "./types";

/** Currencies shown without cents (amounts are still stored in minor units). */
export const NO_CENTS: Currency[] = ["COP", "ARS"];

const intF = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/** Formats integer minor units with an explicit currency code, e.g. "USD 1,240.00" or "COP 9,960,000". */
export function formatMoney(m: Money, opts: { compact?: boolean } = {}): string {
  const sign = m.amountMinor < 0 ? "-" : "";
  const abs = Math.abs(m.amountMinor);
  const whole = intF.format(Math.trunc(abs / 100));
  const cents = String(abs % 100).padStart(2, "0");
  if (opts.compact || NO_CENTS.includes(m.currency))
    return `${sign}${m.currency} ${intF.format(Math.round(abs / 100))}`;
  return `${sign}${m.currency} ${whole}.${cents}`;
}

/** Parts for the Blinka-style big number: small currency code, whole part, muted cents. */
export function moneyParts(m: Money): { cur: string; whole: string; cents: string | null } {
  const abs = Math.abs(m.amountMinor);
  const sign = m.amountMinor < 0 ? "-" : "";
  if (NO_CENTS.includes(m.currency))
    return { cur: m.currency, whole: sign + intF.format(Math.round(abs / 100)), cents: null };
  return {
    cur: m.currency,
    whole: sign + intF.format(Math.trunc(abs / 100)),
    cents: String(abs % 100).padStart(2, "0"),
  };
}

export const formatCompact = (minor: number) => {
  const v = minor / 100;
  return v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}K` : String(Math.round(v));
};

/** Converts money to base-currency (USD) minor units with the org FX table (units per USD). */
export function toBaseMinor(m: Money, fx: FxTable): number {
  return Math.round(m.amountMinor / (fx[m.currency] ?? 1));
}

export const formatBase = (minor: number) =>
  formatMoney({ amountMinor: Math.round(minor), currency: "USD" }, { compact: true });

/** Parses a user-entered decimal string ("1.250,50", "1,250.50" or "1250.50") into minor units without floats. */
export function parseToMinor(input: string): number | null {
  const s = input.trim().replace(/\s/g, "");
  if (!s) return null;
  let normalized = s;
  if (s.includes(",") && s.includes(".")) {
    // The last separator is the decimal one.
    normalized =
      s.lastIndexOf(",") > s.lastIndexOf(".")
        ? s.replace(/\./g, "").replace(",", ".")
        : s.replace(/,/g, "");
  } else if (s.includes(",")) {
    normalized =
      /,\d{3}$/.test(s) && !/,\d{1,2}$/.test(s)
        ? s.replace(/,/g, "")
        : s.replace(/\./g, "").replace(",", ".");
  } else if (/\.\d{3}$/.test(s) && (s.match(/\./g) ?? []).length >= 1 && !/\.\d{1,2}$/.test(s)) {
    normalized = s.replace(/\./g, "");
  }
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(normalized);
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
}

export function minorToInput(minor: number): string {
  return `${Math.trunc(minor / 100)}${minor % 100 ? "." + String(minor % 100).padStart(2, "0") : ""}`;
}

const dateF = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const dateTimeF = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

export const formatDate = (iso: string) => dateF.format(new Date(iso)).replace(".", "");
export const formatDateTime = (iso: string) =>
  `${dateTimeF.format(new Date(iso)).replace(".", "")} UTC`;
export const daysBetween = (a: string, b: string) =>
  Math.abs(Date.parse(a) - Date.parse(b)) / 86_400_000;
