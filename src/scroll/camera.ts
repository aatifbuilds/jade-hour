import { monotoneCubic } from "./beats";
import type { Story } from "./beats";

/** Where the camera looks: how far in (1 = the whole frame), and the point of the frame it is centred on (0..1 across and down). */
export interface View {
  zoom: number;
  x: number;
  y: number;
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
 * so the edge of the picture can never show.
 */
export function cameraRect(frameW: number, frameH: number, viewW: number, viewH: number, zoom: number, fx: number, fy: number): SrcRect {
  const cover = Math.max(viewW / frameW, viewH / frameH);
  const scale = cover * Math.max(1, zoom);
  const sw = viewW / scale;
  const sh = viewH / scale;
  const sx = Math.max(0, Math.min(frameW - sw, fx * frameW - sw / 2));
  const sy = Math.max(0, Math.min(frameH - sh, fy * frameH - sh / 2));
  return { sx, sy, sw, sh };
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
  return { zoom: at((v) => v.zoom), x: at((v) => v.x), y: at((v) => v.y) };
}
