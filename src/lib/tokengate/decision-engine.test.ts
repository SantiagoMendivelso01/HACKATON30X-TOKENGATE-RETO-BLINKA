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
