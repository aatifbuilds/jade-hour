import { monotoneCubic } from "./beats";
import type { Story } from "./beats";

/** Where the camera looks: how far in (1 = the whole frame), and the point of the frame it is centred on (0..1 across and down). */
export interface View {
  zoom: number;
  x: number;
  y: number;
  /** If set, the top edge of the shot sits at this point of the frame (0 top, 1 bottom) instead of centring on `y`, so zooming in only ever loses the bottom. */
  top?: number;
}

export const WIDE_VIEW: View = { zoom: 1, x: 0.5, y: 0.5 };

/** The part of a frame to draw (in the frame's own pixels). */
export interface SrcRect {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

/**
 * Which part of a frame fills a view of viewW x viewH. At zoom 1 it is `object-fit: cover` (the whole frame, trimmed on one axis);
 * more zoom shows less of the frame, magnified, centred on the focus point (fx, fy). The part is always pushed back inside the frame,
 * so the edge of the picture can never show. `maxScale` caps how much the picture may be magnified (view pixels per frame pixel): a
 * small source zoomed too far turns soft, so on a big screen the zoom stops short rather than blur.
 */
export function cameraRect(frameW: number, frameH: number, viewW: number, viewH: number, zoom: number, fx: number, fy: number, maxScale = Infinity): SrcRect {
  const cover = Math.max(viewW / frameW, viewH / frameH);
  const scale = cover * Math.max(1, Math.min(zoom, maxScale / cover));
  const sw = viewW / scale;
  const sh = viewH / scale;
  const sx = Math.max(0, Math.min(frameW - sw, fx * frameW - sw / 2));
  const sy = Math.max(0, Math.min(frameH - sh, fy * frameH - sh / 2));
  return { sx, sy, sw, sh };
}

/** How far the camera may pull back (below 1, the picture no longer covers the view and the page colour shows around it). */
export const MIN_ZOOM = 0.5;

/** Where to take a piece of the frame from and where to put it in the view. */
export interface Placement {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  dx: number;
  dy: number;
  dw: number;
  dh: number;
}

/**
 * Like cameraRect, but the camera may also pull back past the edge of the frame (zoom below 1): the frame is then shown smaller, centred,
 * with the page colour around it (its soft edges melt into that colour). From zoom 1 up it behaves like cameraRect and fills the view.
 * With `top` set, the shot's top edge is held at that point of the frame (when the shot is shorter than the frame), whatever the zoom.
 */
export function cameraPlacement(frameW: number, frameH: number, viewW: number, viewH: number, zoom: number, fx: number, fy: number, maxScale = Infinity, top?: number): Placement {
  const cover = Math.max(viewW / frameW, viewH / frameH);
  const z = zoom >= 1 ? Math.max(1, Math.min(zoom, maxScale / cover)) : Math.max(MIN_ZOOM, zoom);
  const scale = cover * z;
  const vw = viewW / scale; // how much of the frame, in frame pixels, the view spans
  const vh = viewH / scale;
  const start = (frame: number, span: number, f: number): number => (span >= frame ? (frame - span) / 2 : Math.max(0, Math.min(frame - span, f * frame - span / 2)));
  const x0 = start(frameW, vw, fx);
  const y0 = top !== undefined && vh < frameH ? Math.max(0, Math.min(frameH - vh, top * frameH)) : start(frameH, vh, fy);
  const ix0 = Math.max(0, x0);
  const iy0 = Math.max(0, y0);
  const ix1 = Math.min(frameW, x0 + vw);
  const iy1 = Math.min(frameH, y0 + vh);
  return { sx: ix0, sy: iy0, sw: ix1 - ix0, sh: iy1 - iy0, dx: (ix0 - x0) * scale, dy: (iy0 - y0) * scale, dw: (ix1 - ix0) * scale, dh: (iy1 - iy0) * scale };
}

/** A view part-way between two views (t 0 gives a, 1 gives b): used to glide the camera straight from one step's view to another's. */
export function mixView(a: View, b: View, t: number): View {
  const k = Math.max(0, Math.min(1, t));
  const mix = (x: number, y: number): number => x + (y - x) * k;
  const view: View = { zoom: mix(a.zoom, b.zoom), x: mix(a.x, b.x), y: mix(a.y, b.y) };
  if (a.top !== undefined && b.top !== undefined) view.top = mix(a.top, b.top);
  else if (b.top !== undefined) view.top = b.top;
  return view;
}

const viewOf = (c: { view?: View }): View => c.view ?? WIDE_VIEW;

/** The camera at a scroll progress: a smooth path through each chapter's view, easing in and out at every one. */
export function storyView(p: number, story: Story): View {
  const xs = [...story.chapters.map((c) => c.scroll), 1];
  const at = (pick: (v: View) => number): number => {
    const ys = [...story.chapters.map((c) => pick(viewOf(c)))];
    ys.push(ys[ys.length - 1]); // the last view holds to the end
    return monotoneCubic(xs, ys)(p);
  };
  const anyTop = story.chapters.some((c) => c.view?.top !== undefined);
  return { zoom: at((v) => v.zoom), x: at((v) => v.x), y: at((v) => v.y), ...(anyTop ? { top: at((v) => v.top ?? 0) } : {}) };
}
