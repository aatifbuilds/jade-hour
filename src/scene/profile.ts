/** One corner of an outline: x is the radius from the bottle's axis, y the height. `r` rounds that corner (scene units). */
export interface Corner {
  x: number;
  y: number;
  r?: number;
}

type Pt = [number, number];

/**
 * Turns an outline made of straight edges into a smooth one by rounding every corner that has a radius `r`
 * with a circular arc (a "fillet"). The arc touches both edges without a kink, so lighting runs smoothly across it
 * and a thin highlight line appears along the rounded edge, as on a real machined part.
 * The first and last points are kept exactly. A radius too big for its edges is shrunk to fit, so corners never overlap.
 * `steps` is how many segments each arc gets for a 90 degree turn (smaller turns get proportionally fewer).
 */
export function filletProfile(corners: Corner[], steps = 8): Pt[] {
  const out: Pt[] = [];
  const n = corners.length;
  for (let i = 0; i < n; i++) {
    const c = corners[i];
    if (i === 0 || i === n - 1 || !c.r || c.r <= 0) {
      out.push([c.x, c.y]);
      continue;
    }
    const p0 = corners[i - 1];
    const p2 = corners[i + 1];
    const len0 = Math.hypot(p0.x - c.x, p0.y - c.y);
    const len1 = Math.hypot(p2.x - c.x, p2.y - c.y);
    if (len0 === 0 || len1 === 0) {
      out.push([c.x, c.y]);
      continue;
    }
    const d0: Pt = [(p0.x - c.x) / len0, (p0.y - c.y) / len0];
    const d1: Pt = [(p2.x - c.x) / len1, (p2.y - c.y) / len1];
    const cos = Math.max(-1, Math.min(1, d0[0] * d1[0] + d0[1] * d1[1]));
    const theta = Math.acos(cos); // the angle between the two edges at the corner
    if (theta < 1e-4 || Math.PI - theta < 1e-4) {
      out.push([c.x, c.y]); // a straight line (or a fold back on itself): nothing to round
      continue;
    }
    const half = Math.tan(theta / 2);
    // each edge can give up at most half its length, so neighbouring fillets never overlap
    const tMax = Math.min(len0, len1) / 2;
    const t = Math.min(c.r / half, tMax);
    const r = t * half;
    const t0: Pt = [c.x + d0[0] * t, c.y + d0[1] * t];
    const t1: Pt = [c.x + d1[0] * t, c.y + d1[1] * t];
    const bis: Pt = [d0[0] + d1[0], d0[1] + d1[1]];
    const bl = Math.hypot(bis[0], bis[1]);
    const dist = r / Math.sin(theta / 2);
    const ctr: Pt = [c.x + (bis[0] / bl) * dist, c.y + (bis[1] / bl) * dist];
    const a0 = Math.atan2(t0[1] - ctr[1], t0[0] - ctr[0]);
    let sweep = Math.atan2(t1[1] - ctr[1], t1[0] - ctr[0]) - a0;
    while (sweep > Math.PI) sweep -= 2 * Math.PI;
    while (sweep < -Math.PI) sweep += 2 * Math.PI;
    const segs = Math.max(2, Math.ceil((Math.abs(sweep) / (Math.PI / 2)) * steps));
    for (let k = 0; k <= segs; k++) {
      const a = a0 + (sweep * k) / segs;
      out.push([ctr[0] + r * Math.cos(a), ctr[1] + r * Math.sin(a)]);
    }
  }
  return out;
}
