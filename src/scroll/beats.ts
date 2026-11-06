import { CHAPTERS } from "./drink";

/**
 * Maps page scroll progress to progress through the video. An AI video does not pace its steps evenly (the ice may take two
 * seconds and the pour six), but each chapter owns a fixed stretch of scroll, so this says where in the video every chapter
 * begins. The map is a smooth, monotone curve through those points, so scrubbing never runs backwards or lurches at a boundary.
 *
 * VIDEO_AT_BOUNDARY has one entry per chapter start plus a final one for the very end: the share of the video (0..1) that is
 * on screen at that moment. It starts as "same as the scroll" and is tuned once the real video exists.
 */
export const VIDEO_AT_BOUNDARY: number[] = [0, 0.1, 0.24, 0.4, 0.56, 0.68, 0.8, 0.92, 1];

/** A smooth curve through the points that never overshoots them and holds flat where they are equal (Fritsch-Carlson). */
export function monotoneCubic(xs: number[], ys: number[]): (x: number) => number {
  const n = xs.length;
  if (n < 2 || ys.length !== n) throw new Error("need at least two matching points");
  const d: number[] = [];
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  const m: number[] = new Array<number>(n);
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
    } else {
      const a = m[i] / d[i];
      const b = m[i + 1] / d[i];
      const s = a * a + b * b;
      if (s > 9) {
        const t = 3 / Math.sqrt(s);
        m[i] = t * a * d[i];
        m[i + 1] = t * b * d[i];
      }
    }
  }
  return (x) => {
    const q = Math.max(xs[0], Math.min(xs[n - 1], x));
    let i = 0;
    while (i < n - 2 && q > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i];
    const t = (q - xs[i]) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}

/** The scroll progress at which each chapter starts, plus 1 for the end. */
export function chapterBoundaries(): number[] {
  return [...CHAPTERS.map((c) => c.from), 1];
}

/** Share of the video (0..1) to show at a scroll progress (0..1). */
export function videoProgressAt(p: number, marks: number[] = VIDEO_AT_BOUNDARY): number {
  return monotoneCubic(chapterBoundaries(), marks)(p);
}
