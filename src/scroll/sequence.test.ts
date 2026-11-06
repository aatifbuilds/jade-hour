import { describe, expect, it } from "vitest";
import { LOADED, LOADING, NOT_LOADED, coverRect, cropBox, frameBlend, nearestLoaded, nextToLoad } from "./sequence";

describe("frameBlend", () => {
  it("lands exactly on a frame at the ends and at whole positions", () => {
    expect(frameBlend(0, 100)).toEqual({ a: 0, b: 1, t: 0 });
    expect(frameBlend(1, 100)).toEqual({ a: 99, b: 99, t: 0 });
    const b = frameBlend(50 / 99, 100);
    expect(b.a).toBe(50);
    expect(b.t).toBeCloseTo(0, 9);
  });

  it("mixes two neighbouring frames in between", () => {
    const b = frameBlend(0.5, 11); // position 5 of 0..10
    expect(b).toEqual({ a: 5, b: 6, t: 0 });
    const c = frameBlend(0.55, 11); // position 5.5
    expect(c.a).toBe(5);
    expect(c.b).toBe(6);
    expect(c.t).toBeCloseTo(0.5, 9);
  });

  it("clamps out-of-range progress and copes with tiny sequences", () => {
    expect(frameBlend(-3, 10).a).toBe(0);
    expect(frameBlend(7, 10)).toEqual({ a: 9, b: 9, t: 0 });
    expect(frameBlend(0.5, 1)).toEqual({ a: 0, b: 0, t: 0 });
    expect(frameBlend(0.5, 0)).toEqual({ a: 0, b: 0, t: 0 });
  });

  it("moves steadily: the position never goes backwards as progress rises", () => {
    let last = -1;
    for (let p = 0; p <= 1; p += 0.001) {
      const f = frameBlend(p, 180);
      const pos = f.a + f.t;
      expect(pos).toBeGreaterThanOrEqual(last - 1e-9);
      last = pos;
    }
  });
});

describe("nextToLoad", () => {
  const mk = (n: number, fill = NOT_LOADED): number[] => new Array<number>(n).fill(fill);

  it("starts at the frame the visitor is on", () => {
    expect(nextToLoad(7, mk(20))).toBe(7);
  });

  it("then spreads outwards, preferring the frame ahead on a tie", () => {
    const s = mk(20);
    const order: number[] = [];
    for (let i = 0; i < 6; i++) {
      const k = nextToLoad(7, s);
      order.push(k);
      s[k] = LOADED;
    }
    expect(order).toEqual([7, 8, 6, 9, 5, 10]);
  });

  it("skips frames already loaded or loading, and reports when there is nothing left", () => {
    const s = mk(5);
    s[2] = LOADING;
    s[3] = LOADED;
    expect(nextToLoad(2, s)).toBe(1);
    expect(nextToLoad(0, mk(5, LOADED))).toBe(-1);
  });

  it("handles a centre outside the range", () => {
    expect(nextToLoad(-5, mk(10))).toBe(0);
    expect(nextToLoad(99, mk(10))).toBe(9);
  });
});

describe("nearestLoaded", () => {
  it("finds the closest loaded frame, preferring the earlier one on a tie", () => {
    const s = new Array<number>(10).fill(NOT_LOADED);
    expect(nearestLoaded(5, s)).toBe(-1);
    s[2] = LOADED;
    s[8] = LOADED;
    expect(nearestLoaded(5, s)).toBe(2); // 3 away either side: the earlier wins
    expect(nearestLoaded(7, s)).toBe(8);
    s[5] = LOADED;
    expect(nearestLoaded(5, s)).toBe(5);
  });
});

describe("coverRect", () => {
  it("fills the box and centres the overflow", () => {
    const r = coverRect(1080, 1350, 600, 900); // taller box than the picture: fit the height, crop the sides
    expect(r.h).toBeCloseTo(900, 9);
    expect(r.w).toBeCloseTo(720, 9);
    expect(r.x).toBeCloseTo(-60, 9);
    expect(r.y).toBeCloseTo(0, 9);
  });

  it("crops top and bottom for a wider box", () => {
    const r = coverRect(1000, 1000, 500, 300);
    expect(r.w).toBeCloseTo(500, 9);
    expect(r.h).toBeCloseTo(500, 9);
    expect(r.y).toBeCloseTo(-100, 9);
  });

  it("always covers the whole box", () => {
    for (const [dw, dh] of [[300, 900], [900, 300], [640, 860], [390, 470]]) {
      const r = coverRect(1080, 1350, dw, dh);
      expect(r.x).toBeLessThanOrEqual(1e-9);
      expect(r.y).toBeLessThanOrEqual(1e-9);
      expect(r.x + r.w).toBeGreaterThanOrEqual(dw - 1e-9);
      expect(r.y + r.h).toBeGreaterThanOrEqual(dh - 1e-9);
    }
  });
});

describe("cropBox", () => {
  it("cuts a tall phone video down to 4:5, keeping the full width", () => {
    const r = cropBox(1080, 1920, 4, 5);
    expect(r.w).toBe(1080);
    expect(r.h).toBe(1350);
    expect(r.x).toBe(0);
    expect(r.y).toBe(284); // centred is 285, rounded down to an even number as video codecs need
  });

  it("can sit the box higher or lower", () => {
    expect(cropBox(1080, 1920, 4, 5, 0).y).toBe(0);
    expect(cropBox(1080, 1920, 4, 5, 1).y).toBe(570);
    expect(cropBox(1080, 1920, 4, 5, 0.5).y % 2).toBe(0);
  });

  it("cuts a wide video to 4:5 by width", () => {
    const r = cropBox(1920, 1080, 4, 5);
    expect(r.h).toBe(1080);
    expect(r.w).toBe(864);
    expect(r.x).toBe(528);
  });

  it("can zoom in by shrinking the box, keeping its shape and anchoring it where asked", () => {
    const full = cropBox(1280, 720, 4, 5, 1);
    const z = cropBox(1280, 720, 4, 5, 1, 0.94);
    expect(z.w).toBeLessThan(full.w);
    expect(z.h).toBeLessThan(full.h);
    expect(z.w / z.h).toBeCloseTo(0.8, 1);
    expect(z.y + z.h).toBe(720); // anchored to the bottom, so the trimmed strip comes off the top
    expect(z.y).toBeGreaterThan(30);
    expect(z.w % 2).toBe(0);
    expect(z.h % 2).toBe(0);
    expect(cropBox(1280, 720, 4, 5, 1, 7)).toEqual(full); // zoom is limited to 1
  });

  it("always gives even sizes that stay inside the video", () => {
    for (const [w, h] of [[1081, 1921], [1280, 720], [720, 1280], [1000, 1001]]) {
      const r = cropBox(w, h, 4, 5);
      expect(r.w % 2).toBe(0);
      expect(r.h % 2).toBe(0);
      expect(r.x + r.w).toBeLessThanOrEqual(w);
      expect(r.y + r.h).toBeLessThanOrEqual(h);
      expect(r.w / r.h).toBeCloseTo(0.8, 1);
    }
  });
});
