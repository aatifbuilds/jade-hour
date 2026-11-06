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
