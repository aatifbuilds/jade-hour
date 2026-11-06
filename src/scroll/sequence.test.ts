import { describe, expect, it } from "vitest";
import { LOADED, LOADING, NOT_LOADED, centerBox, coverRect, cropBox, frameBlend, dissolveAlpha, edgeAlpha, framesToEvict, nearestLoaded, nextToLoad, safeBox, shouldDissolve } from "./sequence";

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

  it("never looks further than the radius, and says so when nothing is left within it", () => {
    const s = mk(30);
    expect(nextToLoad(15, s, 2)).toBe(15);
    for (const i of [15, 16, 14, 17, 13]) s[i] = LOADED; // the whole range within 2 of 15 is done
    expect(nextToLoad(15, s, 2)).toBe(-1);
    expect(nextToLoad(15, s)).toBe(18); // without a limit it carries on outwards
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

describe("safeBox", () => {
  const region = { left: 0.12, top: 0.06, right: 0.88, bottom: 1 };

  it("keeps the middle of the frame and leaves out the watermark corner and the top edge", () => {
    const b = safeBox(1280, 720, region);
    expect(b.x).toBeGreaterThanOrEqual(0.12 * 1280 - 2);
    expect(b.x + b.w).toBeLessThanOrEqual(0.88 * 1280 + 2);
    expect(b.y).toBeGreaterThanOrEqual(0.06 * 720 - 2);
    expect(b.y + b.h).toBeLessThanOrEqual(720);
    // the sparkle mark sits at about x 88-97%, y 77-97%: none of it is inside the box
    expect(b.x + b.w).toBeLessThan(0.88 * 1280 + 3);
  });

  it("is symmetric about the middle for a symmetric region, so the glass stays centred", () => {
    const b = safeBox(1280, 720, region);
    expect(b.x + b.w / 2).toBeCloseTo(640, -1);
  });

  it("gives even sizes inside the frame", () => {
    for (const [w, h] of [[1280, 720], [1281, 721], [1920, 1080], [3840, 2160]]) {
      const b = safeBox(w, h, region);
      expect(b.w % 2).toBe(0);
      expect(b.h % 2).toBe(0);
      expect(b.x % 2).toBe(0);
      expect(b.y % 2).toBe(0);
      expect(b.x + b.w).toBeLessThanOrEqual(w);
      expect(b.y + b.h).toBeLessThanOrEqual(h);
    }
  });
});

describe("centerBox", () => {
  it("cuts the biggest 3:4 box out of a wider one, centred", () => {
    const safe = { x: 154, y: 44, w: 972, h: 676 };
    const p = centerBox(safe, 3, 4);
    expect(p.h).toBe(676);
    expect(p.w).toBe(506);
    expect(p.x + p.w / 2).toBeCloseTo(safe.x + safe.w / 2, -1);
    expect(p.y).toBe(44);
  });

  it("stays inside the box and keeps its shape for any box", () => {
    for (const box of [{ x: 0, y: 0, w: 500, h: 1000 }, { x: 10, y: 20, w: 800, h: 600 }, { x: 0, y: 0, w: 600, h: 800 }]) {
      const p = centerBox(box, 3, 4);
      expect(p.x).toBeGreaterThanOrEqual(box.x);
      expect(p.y).toBeGreaterThanOrEqual(box.y);
      expect(p.x + p.w).toBeLessThanOrEqual(box.x + box.w);
      expect(p.y + p.h).toBeLessThanOrEqual(box.y + box.h);
      expect(p.w / p.h).toBeCloseTo(0.75, 1);
    }
  });
});

describe("edgeAlpha", () => {
  it("is nearly clear at the very edge and fully opaque from the feather width inwards", () => {
    expect(edgeAlpha(0, 300, 974, 678, 60)).toBeLessThan(0.01);
    expect(edgeAlpha(973, 300, 974, 678, 60)).toBeLessThan(0.01);
    expect(edgeAlpha(300, 0, 974, 678, 60)).toBeLessThan(0.01);
    expect(edgeAlpha(300, 677, 974, 678, 60)).toBeLessThan(0.01);
    expect(edgeAlpha(60, 300, 974, 678, 60)).toBe(1);
    expect(edgeAlpha(487, 339, 974, 678, 60)).toBe(1);
  });

  it("rises steadily from the edge to the inside and is the same on all four sides", () => {
    let last = -1;
    for (let x = 0; x <= 60; x++) {
      const a = edgeAlpha(x, 300, 974, 678, 60);
      expect(a).toBeGreaterThanOrEqual(last - 1e-12);
      last = a;
    }
    expect(edgeAlpha(20, 300, 974, 678, 60)).toBeCloseTo(edgeAlpha(953, 300, 974, 678, 60), 12);
    expect(edgeAlpha(300, 20, 974, 678, 60)).toBeCloseTo(edgeAlpha(300, 657, 974, 678, 60), 12);
    expect(edgeAlpha(20, 20, 974, 678, 60)).toBeCloseTo(edgeAlpha(20, 300, 974, 678, 60), 12); // a corner is as faded as the nearest edge
  });

  it("does nothing when there is no feather", () => {
    expect(edgeAlpha(0, 0, 10, 10, 0)).toBe(1);
  });
});

describe("framesToEvict", () => {
  it("lets go of nothing while within the limit", () => {
    const s = new Array<number>(10).fill(LOADED);
    expect(framesToEvict(5, s, 10)).toEqual([]);
    expect(framesToEvict(5, s, 12)).toEqual([]);
  });

  it("lets go of the farthest frames first, down to the limit", () => {
    const s = new Array<number>(10).fill(LOADED);
    expect(framesToEvict(5, s, 7).sort((a, b) => a - b)).toEqual([0, 1, 9]); // 0 and 1 and 9 are farthest from 5
    expect(framesToEvict(0, s, 3).sort((a, b) => a - b)).toEqual([3, 4, 5, 6, 7, 8, 9]);
  });

  it("only counts frames that are really loaded and never evicts ones that are not", () => {
    const s = new Array<number>(8).fill(NOT_LOADED);
    s[0] = LOADED;
    s[7] = LOADED;
    s[4] = LOADING;
    expect(framesToEvict(0, s, 1)).toEqual([7]);
  });
});

describe("shouldDissolve", () => {
  it("dissolves for a jump of more than a step and scrubs for a hop of about one step or less", () => {
    expect(shouldDissolve(0.08, 0.87)).toBe(true); // Steps to Letter
    expect(shouldDissolve(0.87, 0.08)).toBe(true); // and back
    expect(shouldDissolve(0.08, 0.21)).toBe(false); // one step on
    expect(shouldDissolve(0.5, 0.5)).toBe(false);
    expect(shouldDissolve(0.1, 0.3)).toBe(false); // exactly the limit still scrubs
    expect(shouldDissolve(0.1, 0.31)).toBe(true);
  });

  it("takes the limit as a parameter", () => {
    expect(shouldDissolve(0, 0.1, 0.05)).toBe(true);
    expect(shouldDissolve(0, 0.1, 0.5)).toBe(false);
  });
});

describe("dissolveAlpha", () => {
  it("runs from nothing to everything with a gentle start and end", () => {
    expect(dissolveAlpha(0, 800)).toBe(0);
    expect(dissolveAlpha(800, 800)).toBe(1);
    expect(dissolveAlpha(400, 800)).toBeCloseTo(0.5, 9);
    expect(dissolveAlpha(40, 800)).toBeLessThan(0.01); // slow to start
    expect(dissolveAlpha(760, 800)).toBeGreaterThan(0.99); // slow to finish
  });

  it("never goes outside 0..1 or backwards", () => {
    let last = -1;
    for (let t = -100; t <= 1000; t += 10) {
      const a = dissolveAlpha(t, 800);
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThanOrEqual(1);
      expect(a).toBeGreaterThanOrEqual(last - 1e-12);
      last = a;
    }
    expect(dissolveAlpha(5, 0)).toBe(1);
  });
});
