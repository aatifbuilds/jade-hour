export interface SpringState {
  x: number; // current value
  v: number; // current speed
}

/**
 * One step of a critically damped spring: the value glides to `target` as fast as it can without overshooting, and keeps its
 * speed if the target moves (so changing direction mid-flight is smooth). `omega` is the stiffness: higher is snappier.
 * This is the exact solution of the spring equation, so it behaves the same at any frame rate.
 */
export function stepSpring(s: SpringState, target: number, omega: number, dt: number): SpringState {
  const d = s.x - target;
  const e = Math.exp(-omega * dt);
  const k = s.v + omega * d;
  return { x: target + (d + k * dt) * e, v: (s.v - omega * k * dt) * e };
}

/** Spring speeds in radians per second: a response of about 0.4 s to settle normally, about 1.5 s for the calm glide after a button click. */
export const OMEGA = { normal: 10, glide: 4.2 } as const;
const EASE_BACK_MS = 500;

/**
 * The spring speed at time `now` (ms): the slow glide speed until `glideUntil`, then eased back up to the normal speed over half a second
 * rather than switching abruptly. With `glideUntil` at 0 (no glide) it is simply the normal speed.
 */
export function springOmega(now: number, glideUntil: number): number {
  if (glideUntil <= 0) return OMEGA.normal; // no glide at all
  if (now < glideUntil) return OMEGA.glide;
  const k = Math.max(0, Math.min(1, (now - glideUntil) / EASE_BACK_MS));
  return OMEGA.glide + (OMEGA.normal - OMEGA.glide) * k;
}
