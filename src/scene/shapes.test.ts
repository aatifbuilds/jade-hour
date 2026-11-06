import { describe, expect, it } from "vitest";
import { CAVITY_FLOOR, GLASS, GLASS_HEIGHT, LIQUID, LIQUID_FLOOR, LIQUID_MAX_Y, innerRadiusAt } from "./shapes";

describe("glass outline", () => {
  it("is finite, starts and ends on the axis, and is exactly as tall as it says", () => {
    for (const [x, y] of GLASS) {
      expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
      expect(x).toBeGreaterThanOrEqual(0);
    }
    expect(GLASS[0][0]).toBe(0);
    expect(GLASS[GLASS.length - 1][0]).toBe(0);
    expect(Math.max(...GLASS.map((p) => p[1]))).toBeCloseTo(GLASS_HEIGHT, 9);
    expect(Math.min(...GLASS.map((p) => p[1]))).toBeCloseTo(0, 9);
  });

  it("has a floor inside that sits above the bottom, which is the thick base", () => {
    expect(GLASS[GLASS.length - 1][1]).toBeCloseTo(CAVITY_FLOOR, 9);
    expect(CAVITY_FLOOR).toBeGreaterThan(0.1);
  });

  it("is a tumbler that widens a little towards the rim", () => {
    expect(innerRadiusAt(GLASS_HEIGHT)).toBeGreaterThan(innerRadiusAt(CAVITY_FLOOR));
    expect(innerRadiusAt(0)).toBeCloseTo(innerRadiusAt(CAVITY_FLOOR), 9); // clamped below the floor
  });
});

describe("liquid volume", () => {
  it("fits inside the glass at every height, with a hair of space", () => {
    for (const [x, y] of LIQUID) {
      if (y > LIQUID_FLOOR + 0.06) expect(x).toBeLessThan(innerRadiusAt(y));
      expect(y).toBeGreaterThanOrEqual(LIQUID_FLOOR - 1e-9);
      expect(y).toBeLessThanOrEqual(LIQUID_MAX_Y + 1e-9);
    }
  });

  it("starts on the axis so the floor is closed", () => {
    expect(LIQUID[0][0]).toBe(0);
  });
});
