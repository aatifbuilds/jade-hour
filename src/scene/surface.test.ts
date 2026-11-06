import { describe, expect, it } from "vitest";
import { aoAt, boxBlur, fbm, heightToNormal, ridgeHeight, rng, valueNoise } from "./surface";

describe("rng", () => {
  it("repeats for the same seed and stays inside 0..1", () => {
    const a = rng(7);
    const b = rng(7);
    for (let i = 0; i < 50; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("valueNoise and fbm", () => {
  it("has the right size, stays inside 0..1 and wraps without a seam", () => {
    const size = 64;
    const n = valueNoise(size, 4, rng(1));
    expect(n.length).toBe(size * size);
    let worst = 0;
    for (const v of n) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) worst = Math.max(worst, Math.abs(n[y * size + x] - n[y * size + ((x + 1) % size)]));
    }
    expect(worst).toBeLessThan(0.12); // the pair across the wrap is no jumpier than any other pair
    for (let y = 0; y < size; y++) {
      expect(Math.abs(n[y * size + size - 1] - n[y * size])).toBeLessThan(0.12);
    }
  });

  it("fbm is a weighted mix, normalised to 0..1, and repeatable", () => {
    const a = fbm(32, 3, [[4, 1], [8, 0.5]]);
    const b = fbm(32, 3, [[4, 1], [8, 0.5]]);
    expect(Array.from(a)).toEqual(Array.from(b));
    for (const v of a) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});

describe("boxBlur", () => {
  it("keeps a flat field flat", () => {
    const out = boxBlur(new Float32Array(16 * 16).fill(0.4), 16, 16, 2);
    for (const v of out) expect(v).toBeCloseTo(0.4, 6);
  });

  it("spreads a dot without losing any of it (away from the top and bottom edges)", () => {
    const w = 21;
    const src = new Float32Array(w * w);
    src[10 * w + 10] = 1;
    const out = boxBlur(src, w, w, 2);
    expect(out.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
    expect(out[10 * w + 10]).toBeCloseTo(1 / 25, 6);
  });

  it("wraps left to right, as the surface wraps round the bottle", () => {
    const w = 16;
    const src = new Float32Array(w * 3);
    src[1 * w + 0] = 1;
    const out = boxBlur(src, w, 3, 1);
    expect(out[1 * w + (w - 1)]).toBeGreaterThan(0);
  });

  it("with radius 0 returns a copy", () => {
    const src = Float32Array.from([1, 2, 3, 4]);
    const out = boxBlur(src, 2, 2, 0);
    expect(Array.from(out)).toEqual([1, 2, 3, 4]);
    expect(out).not.toBe(src);
  });
});

describe("heightToNormal", () => {
  const px = (a: Uint8ClampedArray, w: number, x: number, y: number): number[] => Array.from(a.slice((y * w + x) * 4, (y * w + x) * 4 + 4));

  it("makes flat ground the usual flat-blue (128, 128, 255)", () => {
    const n = heightToNormal(new Float32Array(8 * 8).fill(0.3), 8, 8, 4);
    expect(px(n, 8, 3, 3)).toEqual([128, 128, 255, 255]);
  });

  it("tilts the red channel on a slope rising to the right, and leaves green alone", () => {
    const w = 8;
    const h = new Float32Array(w * w);
    for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) h[y * w + x] = x * 0.05;
    const [r, g, b] = px(heightToNormal(h, w, w, 3), w, 4, 4);
    expect(r).toBeLessThan(128); // the surface faces left, away from the rise
    expect(g).toBe(128);
    expect(b).toBeLessThan(255);
  });

  it("tilts the green channel on a slope that falls down the canvas", () => {
    const w = 8;
    const h = new Float32Array(w * w);
    for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) h[y * w + x] = y * 0.05;
    const [r, g] = px(heightToNormal(h, w, w, 3), w, 4, 4);
    expect(r).toBe(128);
    expect(g).toBeGreaterThan(128);
  });

  it("makes unit-length normals", () => {
    const w = 8;
    const h = fbm(w, 5, [[2, 1]]);
    const n = heightToNormal(h, w, w, 6);
    for (let i = 0; i < w * w; i++) {
      const x = (n[i * 4] / 255) * 2 - 1;
      const y = (n[i * 4 + 1] / 255) * 2 - 1;
      const z = (n[i * 4 + 2] / 255) * 2 - 1;
      expect(Math.hypot(x, y, z)).toBeGreaterThan(0.97);
      expect(Math.hypot(x, y, z)).toBeLessThan(1.03);
    }
  });
});

describe("ridgeHeight", () => {
  it("has the asked number of ridges across the middle and none outside its band", () => {
    const w = 256;
    const h = 64;
    const r = ridgeHeight(w, h, 16, 0.25, 0.75, 0.1);
    const mid = Array.from(r.slice(32 * w, 33 * w));
    let peaks = 0;
    for (let x = 0; x < w; x++) if (mid[x] > mid[(x + w - 1) % w] && mid[x] >= mid[(x + 1) % w]) peaks++;
    expect(peaks).toBe(16);
    for (let x = 0; x < w; x++) {
      expect(r[0 * w + x]).toBe(0); // the very top row is v ~ 1, outside the band
      expect(r[(h - 1) * w + x]).toBe(0);
    }
  });
});

describe("aoAt", () => {
  it("is fully lit on the open wall and darker in the creases", () => {
    expect(aoAt(0.5)).toBe(1);
    expect(aoAt(0)).toBeLessThan(0.6);
    expect(aoAt(1)).toBeLessThan(0.5);
  });

  it("gets darker steadily towards each end and stays inside 0..1", () => {
    for (let v = 0.0; v < 0.035; v += 0.005) expect(aoAt(v + 0.005)).toBeGreaterThanOrEqual(aoAt(v) - 1e-9);
    for (let v = 0.955; v < 1; v += 0.005) expect(aoAt(v + 0.005)).toBeLessThanOrEqual(aoAt(v) + 1e-9);
    for (let v = 0; v <= 1; v += 0.01) {
      expect(aoAt(v)).toBeGreaterThanOrEqual(0);
      expect(aoAt(v)).toBeLessThanOrEqual(1);
    }
  });
});
