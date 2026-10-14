import { describe, expect, it } from "vitest";
import { computeBackoffMs } from "./backoff";

describe("computeBackoffMs", () => {
  const max = () => 0.999999;

  it("crece exponencialmente", () => {
    const values = [1, 2, 3, 4].map((a) => computeBackoffMs(a, { baseMs: 1000, random: max }));
    expect(values).toEqual([999, 1999, 3999, 7999]);
  });

  it("respeta el tope", () => {
    expect(computeBackoffMs(30, { baseMs: 1000, maxMs: 10_000, random: max })).toBe(9999);
  });

  it("aplica jitter entre 0 y el máximo del intento", () => {
    expect(computeBackoffMs(3, { baseMs: 1000, random: () => 0 })).toBe(0);
    expect(computeBackoffMs(3, { baseMs: 1000, random: () => 0.5 })).toBe(2000);
  });
});
