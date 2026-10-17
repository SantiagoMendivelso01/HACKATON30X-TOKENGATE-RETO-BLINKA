import type { Money } from "./types";

const intF = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0, useGrouping: "always" } as unknown as Intl.NumberFormatOptions);

/** Formats integer minor units with an explicit currency code, e.g. "USD 1.240,00". */
export function formatMoney(m: Money, opts: { compact?: boolean } = {}): string {
  const sign = m.amountMinor < 0 ? "-" : "";
  const abs = Math.abs(m.amountMinor);
  const whole = intF.format(Math.trunc(abs / 100));
  const cents = String(abs % 100).padStart(2, "0");
  // COP (peso colombiano) se muestra sin centavos cuando no tiene parte decimal.
  if (m.currency === "COP" && abs % 100 === 0) return `${sign}${m.currency} ${intF.format(abs / 100)}`;
  return `${sign}${m.currency} ${opts.compact ? whole : `${whole},${cents}`}`;
}

/** Parses a user-entered decimal string ("1.250,50" or "1250.50") into minor units without floats. */
export function parseToMinor(input: string): number | null {
  const s = input.trim().replace(/\s/g, "");
  if (!s) return null;
  const normalized = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(normalized);
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
}

export function minorToInput(minor: number): string {
  return `${Math.trunc(minor / 100)}${minor % 100 ? "," + String(minor % 100).padStart(2, "0") : ""}`;
}

const dateF = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const dateTimeF = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

export const formatDate = (iso: string) => dateF.format(new Date(iso)).replace(".", "");
export const formatDateTime = (iso: string) => `${dateTimeF.format(new Date(iso)).replace(".", "")} UTC`;
