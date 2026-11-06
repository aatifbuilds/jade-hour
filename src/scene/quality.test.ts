import { describe, expect, it } from "vitest";
import { adaptQuality, type Quality } from "./quality";

describe("adaptive resolution", () => {
  it("draws fewer pixels when frames are slow, never below 1", () => {
    let q: Quality = { cap: 2, goodChecks: 0 };
    for (let i = 0; i < 10; i++) q = adaptQuality(q, 30, 2);
    expect(q.cap).toBe(1);
  });
  it("creeps back up only after several comfortable checks, and not past the maximum", () => {
    let q: Quality = { cap: 1, goodChecks: 0 };
    q = adaptQuality(q, 10, 2);
    q = adaptQuality(q, 10, 2);
    q = adaptQuality(q, 10, 2);
    expect(q.cap).toBe(1); // not yet
    q = adaptQuality(q, 10, 2);
    expect(q.cap).toBe(1.25);
    for (let i = 0; i < 40; i++) q = adaptQuality(q, 10, 2);
    expect(q.cap).toBe(2);
  });
  it("a borderline frame time changes nothing and resets the good streak", () => {
    const q = adaptQuality({ cap: 1.5, goodChecks: 3 }, 20, 2);
    expect(q).toEqual({ cap: 1.5, goodChecks: 0 });
  });
});
