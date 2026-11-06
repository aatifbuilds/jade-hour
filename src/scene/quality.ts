/**
 * Adaptive resolution: if frames run slow, draw fewer pixels; if they run comfortably fast for a while, creep back up.
 * Pure function so the rule can be tested. `emaMs` is a smoothed frame time in milliseconds.
 */
export interface Quality { cap: number; goodChecks: number }

export function adaptQuality(q: Quality, emaMs: number, maxCap: number): Quality {
  if (emaMs > 22) return { cap: Math.max(1, q.cap - 0.25), goodChecks: 0 }; // slower than about 45 fps: draw fewer pixels
  if (emaMs < 18.5) {
    const goodChecks = q.goodChecks + 1;
    if (goodChecks >= 4 && q.cap < maxCap) return { cap: Math.min(maxCap, q.cap + 0.25), goodChecks: 0 };
    return { cap: q.cap, goodChecks };
  }
  return { cap: q.cap, goodChecks: 0 };
}
