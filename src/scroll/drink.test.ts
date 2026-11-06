import { describe, expect, it } from "vitest";
import { CHAPTERS, MATCHA_TOP, MILK_TOP, chapterAt, drinkAt, iceHeight, levels, pourAmount, ramp } from "./drink";
import { LIQUID_FLOOR } from "../scene/shapes";

describe("chapters", () => {
  it("cover the whole scroll with no gaps or overlaps", () => {
    expect(CHAPTERS[0].from).toBe(0);
    expect(CHAPTERS[CHAPTERS.length - 1].to).toBe(1);
    for (let i = 1; i < CHAPTERS.length; i++) expect(CHAPTERS[i].from).toBe(CHAPTERS[i - 1].to);
  });

  it("report the right chapter, and the last one owns the very end", () => {
    expect(chapterAt(0)).toBe(0);
    expect(chapterAt(0.15)).toBe(1);
    expect(chapterAt(0.999)).toBe(CHAPTERS.length - 1);
    expect(chapterAt(1)).toBe(CHAPTERS.length - 1);
    expect(chapterAt(-1)).toBe(0);
    expect(chapterAt(2)).toBe(CHAPTERS.length - 1);
  });
});

describe("ramp", () => {
  it("is 0 before, 1 after, and eases in between with flat ends", () => {
    expect(ramp(0, 0.2, 0.4)).toBe(0);
    expect(ramp(1, 0.2, 0.4)).toBe(1);
    expect(ramp(0.3, 0.2, 0.4)).toBeCloseTo(0.5, 9);
    expect(ramp(0.2001, 0.2, 0.4)).toBeLessThan(0.0001);
  });
});

describe("drinkAt", () => {
  it("starts empty and ends complete", () => {
    expect(drinkAt(0)).toEqual({ ice: 0, milk: 0, matcha: 0, blend: 0, foam: 0, yuzu: 0 });
    expect(drinkAt(1)).toEqual({ ice: 1, milk: 1, matcha: 1, blend: 1, foam: 1, yuzu: 1 });
  });

  it("never takes an ingredient out as you scroll down", () => {
    let prev = drinkAt(0);
    for (let p = 0.005; p <= 1; p += 0.005) {
      const s = drinkAt(p);
      for (const k of Object.keys(s) as (keyof typeof s)[]) expect(s[k]).toBeGreaterThanOrEqual(prev[k] - 1e-12);
      prev = s;
    }
  });

  it("adds the ingredients in the recipe's order", () => {
    const at = (id: string): number => CHAPTERS.find((c) => c.id === id)!.to;
    expect(drinkAt(at("ice")).ice).toBe(1);
    expect(drinkAt(at("ice")).milk).toBe(0);
    expect(drinkAt(at("milk")).milk).toBe(1);
    expect(drinkAt(at("milk")).matcha).toBe(0);
    expect(drinkAt(at("matcha")).matcha).toBe(1);
    expect(drinkAt(at("matcha")).blend).toBe(0);
    expect(drinkAt(at("blend")).foam).toBe(0);
    expect(drinkAt(at("foam")).yuzu).toBe(0);
  });
});

describe("levels", () => {
  it("rise from the floor to the milk line to the top of the drink", () => {
    const empty = levels(drinkAt(0));
    expect(empty.milkTop).toBeCloseTo(LIQUID_FLOOR, 9);
    expect(empty.fillTop).toBeCloseTo(LIQUID_FLOOR, 9);
    const milk = levels(drinkAt(CHAPTERS[2].to));
    expect(milk.milkTop).toBeCloseTo(MILK_TOP, 9);
    expect(milk.fillTop).toBeCloseTo(MILK_TOP, 9);
    const done = levels(drinkAt(1));
    expect(done.fillTop).toBeCloseTo(MATCHA_TOP, 9);
  });
});

describe("pourAmount", () => {
  it("is zero at rest, full mid-pour, and eases in and out", () => {
    expect(pourAmount(0)).toBe(0);
    expect(pourAmount(1)).toBe(0);
    expect(pourAmount(0.5)).toBe(1);
    expect(pourAmount(0.05)).toBeCloseTo(0.5, 9);
    expect(pourAmount(0.95)).toBeCloseTo(0.5, 9);
  });
});

describe("iceHeight", () => {
  it("stays on the floor while the drink is shallow, then floats up with it", () => {
    expect(iceHeight(0.4, 0.34, LIQUID_FLOOR)).toBe(0.4);
    expect(iceHeight(0.4, 0.34, 0.45)).toBe(0.4);
    const mid = iceHeight(0.4, 0.34, 1.35);
    expect(mid).toBeGreaterThan(0.4);
    expect(mid).toBeLessThan(1.35);
    expect(iceHeight(0.4, 0.34, 1.85)).toBeGreaterThan(mid);
  });

  it("never rises above the rim", () => {
    expect(iceHeight(0.4, 0.34, 5)).toBeLessThanOrEqual(2.15);
  });
});
