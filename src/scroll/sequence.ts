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

/**
 * The frame to download next: the nearest one to `center` that is not loaded or loading (the one ahead wins a tie), looking no further
 * than `radius` frames away. -1 when there is nothing left to fetch in that range.
 */
export function nextToLoad(center: number, state: ArrayLike<number>, radius = Infinity): number {
  const n = state.length;
  const c = Math.max(0, Math.min(n - 1, Math.round(center)));
  const reach = Math.min(n - 1, radius);
  for (let d = 0; d <= reach; d++) {
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
 * vertically when the video is taller than it needs to be (0 top, 0.5 middle, 1 bottom). `zoom` (0.5 to 1) shrinks the box to
 * that share of the biggest one, to cut in on the subject or trim an unwanted edge. All sizes are even (video codecs need that).
 */
export function cropBox(srcW: number, srcH: number, aspectW: number, aspectH: number, cropY = 0.5, zoom = 1): Rect {
  const target = aspectW / aspectH;
  let w = srcW;
  let h = srcH;
  if (srcW / srcH > target) w = even(srcH * target);
  else h = even(srcW / target);
  const z = Math.max(0.5, Math.min(1, zoom));
  w = Math.min(even(w * z), even(srcW));
  h = Math.min(even(h * z), even(srcH));
  const x = evenOffset((srcW - w) / 2);
  const y = evenOffset((srcH - h) * Math.max(0, Math.min(1, cropY)));
  return { x: Math.min(x, srcW - w), y: Math.min(y, srcH - h), w, h };
}

/** Fractions of a frame (0..1): the region to keep. */
export interface Region {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * The part of the frame that is safe to show: a box centred on the subject that leaves out the edges where an AI video tool puts its
 * watermark and where stray things (a hand, a spoon handle) enter. Sizes and positions are even, as video codecs need.
 */
export function safeBox(srcW: number, srcH: number, r: Region): Rect {
  const x = evenOffset(srcW * r.left);
  const y = evenOffset(srcH * r.top);
  const w = even(srcW * r.right - x);
  const h = even(srcH * r.bottom - y);
  return { x, y, w: Math.min(w, even(srcW - x)), h: Math.min(h, even(srcH - y)) };
}

/** The biggest box of aspect aspectW:aspectH that fits inside `box`, centred in it (for the narrower phone cut). */
export function centerBox(box: Rect, aspectW: number, aspectH: number): Rect {
  const target = aspectW / aspectH;
  let w = box.w;
  let h = box.h;
  if (box.w / box.h > target) w = even(box.h * target);
  else h = even(box.w / target);
  w = Math.min(w, box.w);
  h = Math.min(h, box.h);
  return { x: box.x + evenOffset((box.w - w) / 2), y: box.y + evenOffset((box.h - h) / 2), w, h };
}

/**
 * How opaque a frame is at pixel (x, y) of a w x h picture when its edges fade out over `feather` pixels (0 at the very edge, 1 from
 * `feather` pixels in), with a smooth ramp. Frames are saved with this fade so that, when the camera pulls back past the edge of the
 * picture, the picture melts into the page colour instead of ending in a visible rectangle.
 */
export function edgeAlpha(x: number, y: number, w: number, h: number, feather: number): number {
  if (feather <= 0) return 1;
  const d = Math.min(x + 0.5, w - x - 0.5, y + 0.5, h - y - 0.5);
  const t = Math.max(0, Math.min(1, d / feather));
  return t * t * (3 - 2 * t);
}

/** Which loaded frames to let go of so that no more than `keep` stay in memory: the ones farthest from `center` (decoded pictures are big). */
export function framesToEvict(center: number, state: ArrayLike<number>, keep: number): number[] {
  const loaded: number[] = [];
  for (let i = 0; i < state.length; i++) if (state[i] === LOADED) loaded.push(i);
  if (loaded.length <= keep) return [];
  loaded.sort((a, b) => Math.abs(b - center) - Math.abs(a - center) || b - a);
  return loaded.slice(0, loaded.length - keep);
}
