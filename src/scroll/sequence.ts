/* Pure maths for the scroll-scrubbed video: which frames to show, in what order to download them, and how to fit them. */

export interface FrameBlend {
  a: number; // the frame at or just before the position
  b: number; // the frame just after it (the same as a at the very end)
  t: number; // how far from a towards b, 0..1: the cross-fade amount
}

/** For progress p (0..1) through a sequence of `count` frames, the two neighbouring frames and the mix between them. */
export function frameBlend(p: number, count: number): FrameBlend {
  if (count <= 1) return { a: 0, b: 0, t: 0 };
  const pos = Math.max(0, Math.min(1, p)) * (count - 1);
  const a = Math.min(count - 1, Math.floor(pos));
  return { a, b: Math.min(count - 1, a + 1), t: a === count - 1 ? 0 : pos - a };
}

export const NOT_LOADED = 0;
export const LOADING = 1;
export const LOADED = 2;

/** The frame to download next: the nearest one to `center` that is not loaded or loading (the one ahead wins a tie). -1 when all are done. */
export function nextToLoad(center: number, state: ArrayLike<number>): number {
  const n = state.length;
  const c = Math.max(0, Math.min(n - 1, Math.round(center)));
  for (let d = 0; d < n; d++) {
    if (c + d < n && state[c + d] === NOT_LOADED) return c + d;
    if (d > 0 && c - d >= 0 && state[c - d] === NOT_LOADED) return c - d;
  }
  return -1;
}

/** The loaded frame nearest to `index` (the earlier one wins a tie, so the picture does not jump ahead). -1 when nothing is loaded yet. */
export function nearestLoaded(index: number, state: ArrayLike<number>): number {
  const n = state.length;
  const c = Math.max(0, Math.min(n - 1, Math.round(index)));
  for (let d = 0; d < n; d++) {
    if (c - d >= 0 && state[c - d] === LOADED) return c - d;
    if (d > 0 && c + d < n && state[c + d] === LOADED) return c + d;
  }
  return -1;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Where to draw a src-sized picture so it fills a dst-sized box, centred and cropped, like CSS `object-fit: cover`. */
export function coverRect(srcW: number, srcH: number, dstW: number, dstH: number): Rect {
  const s = Math.max(dstW / srcW, dstH / srcH);
  const w = srcW * s;
  const h = srcH * s;
  return { x: (dstW - w) / 2, y: (dstH - h) / 2, w, h };
}

const even = (n: number): number => Math.max(2, Math.floor(n / 2) * 2); // a size: at least 2
const evenOffset = (n: number): number => Math.max(0, Math.floor(n / 2) * 2); // a position: may be 0

/**
 * The biggest box of the given aspect ratio that fits in a src-sized video, for cutting frames. `cropY` says where the box sits
 * vertically when the video is taller than it needs to be (0 top, 0.5 middle, 1 bottom). All sizes are even (video codecs need that).
 */
export function cropBox(srcW: number, srcH: number, aspectW: number, aspectH: number, cropY = 0.5): Rect {
  const target = aspectW / aspectH;
  let w = srcW;
  let h = srcH;
  if (srcW / srcH > target) w = even(srcH * target);
  else h = even(srcW / target);
  w = Math.min(even(w), even(srcW));
  h = Math.min(even(h), even(srcH));
  const x = evenOffset((srcW - w) / 2);
  const y = evenOffset((srcH - h) * Math.max(0, Math.min(1, cropY)));
  return { x: Math.min(x, srcW - w), y: Math.min(y, srcH - h), w, h };
}
