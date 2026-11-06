import { describe, expect, it } from "vitest";
import { filletProfile } from "./profile";

/** The turning angle (degrees) at each interior point of a polyline. */
function turns(pts: [number, number][]): number[] {
  const out: number[] = [];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = Math.atan2(pts[i][1] - pts[i - 1][1], pts[i][0] - pts[i - 1][0]);
    const b = Math.atan2(pts[i + 1][1] - pts[i][1], pts[i + 1][0] - pts[i][0]);
    let d = ((b - a) * 180) / Math.PI;
    while (d > 180) d -= 360;
    while (d < -180) d += 360;
    out.push(Math.abs(d));
  }
  return out;
}

describe("filletProfile", () => {
  it("leaves corners without a radius untouched", () => {
    const pts = filletProfile([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }]);
    expect(pts).toEqual([[0, 0], [1, 0], [1, 1]]);
  });

  it("keeps the first and last points exactly", () => {
    const pts = filletProfile([{ x: 0.2, y: 0 }, { x: 1, y: 0, r: 0.3 }, { x: 1, y: 2 }]);
    expect(pts[0]).toEqual([0.2, 0]);
    expect(pts[pts.length - 1]).toEqual([1, 2]);
  });

  it("rounds a right angle with a true circle of the asked radius", () => {
    const r = 0.25;
    const pts = filletProfile([{ x: 0, y: 0 }, { x: 2, y: 0, r }, { x: 2, y: 2 }]);
    // the arc's centre for this corner is (2 - r, r); every arc point sits r away from it
    const arc = pts.slice(1, -1);
    expect(arc.length).toBeGreaterThan(4);
    for (const [x, y] of arc) expect(Math.hypot(x - (2 - r), y - r)).toBeCloseTo(r, 9);
    // it starts and ends on the two edges, where they touch the circle
    expect(arc[0][1]).toBeCloseTo(0, 9);
    expect(arc[0][0]).toBeCloseTo(2 - r, 9);
    expect(arc[arc.length - 1][0]).toBeCloseTo(2, 9);
    expect(arc[arc.length - 1][1]).toBeCloseTo(r, 9);
  });

  it("spreads the turn so no step bends sharply", () => {
    const pts = filletProfile([{ x: 0, y: 0 }, { x: 2, y: 0, r: 0.3 }, { x: 2, y: 2 }], 12);
    // a 90 degree corner with 12 steps bends about 7.5 degrees per step; the join with each straight edge half of that
    expect(Math.max(...turns(pts))).toBeLessThan(8);
  });

  it("shrinks a radius that is too big for its edges and stays finite", () => {
    const pts = filletProfile([{ x: 0, y: 0 }, { x: 0.2, y: 0, r: 5 }, { x: 0.2, y: 0.2 }]);
    for (const [x, y] of pts) {
      expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
      expect(x).toBeGreaterThanOrEqual(-1e-9);
      expect(x).toBeLessThanOrEqual(0.2 + 1e-9);
      expect(y).toBeGreaterThanOrEqual(-1e-9);
      expect(y).toBeLessThanOrEqual(0.2 + 1e-9);
    }
  });

  it("does not try to round a straight run", () => {
    const pts = filletProfile([{ x: 0, y: 0 }, { x: 1, y: 1, r: 0.2 }, { x: 2, y: 2 }]);
    expect(pts).toEqual([[0, 0], [1, 1], [2, 2]]);
  });

  it("keeps the overall height of a rising outline", () => {
    const pts = filletProfile([
      { x: 0.3, y: 0 }, { x: 0.3, y: 1, r: 0.2 }, { x: 0.15, y: 1.4, r: 0.1 }, { x: 0.15, y: 2 },
    ]);
    const ys = pts.map((p) => p[1]);
    expect(Math.min(...ys)).toBe(0);
    expect(Math.max(...ys)).toBe(2);
  });
});
