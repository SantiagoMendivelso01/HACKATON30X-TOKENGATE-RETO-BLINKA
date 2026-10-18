import { describe, expect, it } from "vitest";
import { parseToMinor } from "./format";
import { chain, verifyChain } from "./hash";

describe("money input", () => {
  it("parses decimal input without floating point", () => {
    expect(parseToMinor("1.250,50")).toBe(125050);
    expect(parseToMinor("1,250.50")).toBe(125050);
    expect(parseToMinor("0.1")).toBe(10);
    expect(parseToMinor("abc")).toBeNull();
  });
});

describe("audit chain", () => {
  it("detects an edited event", () => {
    const events = chain([
      { at: "1", type: "decision", summary: "a" },
      { at: "2", type: "decision", summary: "b" },
    ]);
    expect(verifyChain(events)).toBe(-1);
    events[0] = { ...events[0]!, summary: "edited" };
    expect(verifyChain(events)).toBe(0);
  });
});

describe("currency conversion (USD, EUR, COP)", () => {
  it("converts COP, EUR, and USD accurately using FX rates", async () => {
    const { toBaseMinor, convertMinor, formatBase } = await import("./format");
    const fx = { USD: 1, COP: 4150, EUR: 0.92, MXN: 18.2 };

    // 415,000 COP (41,500,000 minor) at 4,150 COP/USD => exactly 100.00 USD (10,000 minor)
    expect(toBaseMinor({ amountMinor: 41_500_000, currency: "COP" }, fx)).toBe(10_000);

    // 43,900 COP (4,390,000 minor) at 4,150 COP/USD => 10.58 USD (1,058 minor), NOT 11 USD
    const comcelUsd = toBaseMinor({ amountMinor: 4_389_998, currency: "COP" }, fx);
    expect(comcelUsd).toBe(1058);
    expect(formatBase(comcelUsd)).toBe("USD 10.58");

    // 92.00 EUR (9,200 minor) at 0.92 EUR/USD => 100.00 USD (10,000 minor)
    expect(toBaseMinor({ amountMinor: 9_200, currency: "EUR" }, fx)).toBe(10_000);

    // Cross conversion: 100.00 USD (10,000 minor) => 92.00 EUR (9,200 minor) and 415,000 COP (41,500,000 minor)
    expect(convertMinor(10_000, "USD", "EUR", fx)).toBe(9_200);
    expect(convertMinor(10_000, "USD", "COP", fx)).toBe(41_500_000);
  });
});
