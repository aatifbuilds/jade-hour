import { describe, expect, it } from "vitest";
import { type SpringState, stepSpring } from "./spring";

const run = (s: SpringState, target: number, omega: number, seconds: number, dt = 1 / 60): SpringState => {
  let cur = s;
  const steps = Math.round(seconds / dt); // count the steps, so rounding in the clock cannot add an extra one
  for (let i = 0; i < steps; i++) cur = stepSpring(cur, target, omega, dt);
  return cur;
};

describe("stepSpring", () => {
  it("does nothing when already at the target and at rest", () => {
    expect(stepSpring({ x: 0.4, v: 0 }, 0.4, 9, 0.016)).toEqual({ x: 0.4, v: 0 });
  });

  it("does not move at all when no time passes", () => {
    expect(stepSpring({ x: 0, v: 0 }, 1, 9, 0)).toEqual({ x: 0, v: 0 });
  });

  it("glides to the target without ever overshooting it", () => {
    let s: SpringState = { x: 0, v: 0 };
    for (let i = 0; i < 600; i++) {
      s = stepSpring(s, 1, 9, 1 / 60);
      expect(s.x).toBeLessThanOrEqual(1 + 1e-9);
      expect(s.x).toBeGreaterThanOrEqual(0);
    }
    expect(s.x).toBeCloseTo(1, 6);
    expect(Math.abs(s.v)).toBeLessThan(1e-6);
  });

  it("moves forward on every step while it is behind", () => {
    let s: SpringState = { x: 0, v: 0 };
    for (let i = 0; i < 120; i++) {
      const next = stepSpring(s, 1, 9, 1 / 60);
      expect(next.x).toBeGreaterThan(s.x);
      s = next;
    }
  });

  it("gives the same result at any frame rate", () => {
    const a = run({ x: 0, v: 0 }, 1, 9, 0.5, 1 / 30);
    const b = run({ x: 0, v: 0 }, 1, 9, 0.5, 1 / 240);
    expect(a.x).toBeCloseTo(b.x, 6);
  });

  it("is stiffer with a higher omega", () => {
    const slow = run({ x: 0, v: 0 }, 1, 4, 0.4);
    const fast = run({ x: 0, v: 0 }, 1, 12, 0.4);
    expect(fast.x).toBeGreaterThan(slow.x);
  });

  it("keeps its speed when the target moves, so a change of direction is smooth", () => {
    const moving = run({ x: 0, v: 0 }, 1, 9, 0.2);
    expect(moving.v).toBeGreaterThan(0);
    const next = stepSpring(moving, 0, 9, 1 / 60);
    expect(next.x).toBeGreaterThan(moving.x - 0.02); // still carries on a little before turning back
  });
});
