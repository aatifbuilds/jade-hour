import { type Placement, type View, cameraPlacement } from "../scroll/camera";
import { LOADED, LOADING, NOT_LOADED, frameBlend, framesToEvict, nearestLoaded, nextToLoad } from "../scroll/sequence";

export interface SequenceMeta {
  count: number;
  bg: string; // the video's backdrop colour, so the stage can match it with no seam
  bgBottom?: string; // the backdrop colour along the bottom edge of the phone cut, so the text area below it continues it
  ext: string;
  desktop: SequenceVariant;
  phone: SequenceVariant;
}

export interface SequenceVariant {
  w: number;
  h: number;
  dir: string;
  corners?: { tl: string; tr: string; bl: string; br: string }; // the backdrop colour at the four corners of the picture
}

export interface Sequence {
  resize(): void;
  setPixelRatioCap(cap: number): void;
  maxPixelRatio: number;
  /** Draw the picture at a position (0..1) through the video, with the camera at `view`. With `dissolve` (0..1) the new picture fades in over the snapshot taken earlier. */
  render(videoProgress: number, view: View, dissolve?: number): void;
  /** Freeze what is on screen now, for a dissolve to start from. */
  snapshot(): void;
  /** Are the frames around this position decoded (so a dissolve to it will not show a stale picture)? */
  isReady(videoProgress: number): boolean;
  loadedCount(): number;
  dispose(): void;
}

const FAILED = 3; // a frame that would not load; skipped so we never retry it forever
const PARALLEL = 4;
const WINDOW = 30; // frames are fetched this far either side of the visitor; decoded pictures are big, so only this many stay in memory
const MAX_MAGNIFY = 2.6; // screen pixels per picture pixel: beyond this a 720p source looks too soft

/** Reads and checks public/frames/meta.json. Returns null if the frames have not been made (so the page uses the 3D drink). */
export async function loadSequenceMeta(base: string): Promise<SequenceMeta | null> {
  try {
    const res = await fetch(`${base}frames/meta.json`, { cache: "no-cache" });
    if (!res.ok) return null;
    const m = (await res.json()) as Partial<SequenceMeta>;
    const okSize = (s: unknown): boolean => !!s && typeof (s as { w: unknown }).w === "number" && typeof (s as { dir: unknown }).dir === "string";
    if (typeof m.count !== "number" || m.count < 2 || typeof m.bg !== "string" || typeof m.ext !== "string" || !okSize(m.desktop) || !okSize(m.phone)) return null;
    return m as SequenceMeta;
  } catch {
    return null; // not JSON (a dev server answers a missing file with the page itself), or the network failed
  }
}

/**
 * Plays the video as a sequence of pictures on a canvas, driven by scroll, through a camera that can zoom in and look at part of the
 * frame (`minZoom` keeps it from pulling back too far, e.g. on a phone where the glass would become tiny). The picture nearest the visitor loads first and
 * the rest follow outwards; between two frames it cross-fades, so a modest frame count still scrubs smoothly; while a frame is
 * still loading it shows the nearest one that has arrived, so there is never a blank stage.
 */
export function createSequence(canvas: HTMLCanvasElement, meta: SequenceMeta, base: string, minZoom = 0, topShift = 0): Sequence {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas is not available");
  const variant = window.innerWidth <= 700 ? meta.phone : meta.desktop;
  const state = new Uint8Array(meta.count).fill(NOT_LOADED);
  const bitmaps: (ImageBitmap | undefined)[] = new Array<ImageBitmap | undefined>(meta.count);
  const url = (i: number): string => `${base}frames/${variant.dir}/${String(i + 1).padStart(4, "0")}.${meta.ext}`;
  const maxPixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  let cap = maxPixelRatio;
  let center = 0;
  let inflight = 0;
  let loaded = 0;
  let disposed = false;
  let dirty = true;
  let lastKey = "";

  const pump = (): void => {
    while (!disposed && inflight < PARALLEL) {
      const i = nextToLoad(center, state, WINDOW);
      if (i < 0) return;
      state[i] = LOADING;
      inflight++;
      fetch(url(i))
        .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(`frame ${i + 1}: ${r.status}`))))
        .then((b) => createImageBitmap(b))
        .then((bmp) => {
          if (disposed) return bmp.close();
          bitmaps[i] = bmp;
          state[i] = LOADED;
          loaded++;
          for (const j of framesToEvict(center, state, 2 * WINDOW + 1)) {
            bitmaps[j]?.close();
            bitmaps[j] = undefined;
            state[j] = NOT_LOADED;
            loaded--;
          }
          dirty = true; // a better picture may be available for what is on screen
        })
        .catch(() => {
          state[i] = FAILED;
        })
        .finally(() => {
          inflight--;
          pump();
        });
    }
  };

  const resize = (): void => {
    const dpr = Math.min(window.devicePixelRatio || 1, cap);
    canvas.width = Math.max(1, Math.round((canvas.clientWidth || 1) * dpr));
    canvas.height = Math.max(1, Math.round((canvas.clientHeight || 1) * dpr));
    dirty = true;
  };
  resize();
  pump();

  // The backdrop is a soft lighting gradient (light on one side, darker on the other), so when the camera pulls back past the picture the
  // margin is painted from the picture's four corner colours (blended smoothly across), and the picture's soft edge melts into it.
  const corners = variant.corners;
  const swatch = document.createElement("canvas");
  swatch.width = 2;
  swatch.height = 2;
  if (corners) {
    const sctx = swatch.getContext("2d");
    [[corners.tl, 0, 0], [corners.tr, 1, 0], [corners.bl, 0, 1], [corners.br, 1, 1]].forEach(([c, x, y]) => {
      if (sctx) {
        sctx.fillStyle = c as string;
        sctx.fillRect(x as number, y as number, 1, 1);
      }
    });
  }
  type Ctx = CanvasRenderingContext2D;
  const paintBackdrop = (c: Ctx, frameLeft: number, frameTop: number, frameW: number, frameH: number): void => {
    c.globalAlpha = 1;
    c.fillStyle = meta.bg;
    c.fillRect(0, 0, canvas.width, canvas.height);
    if (!corners) return;
    c.imageSmoothingEnabled = true;
    c.imageSmoothingQuality = "high";
    // each swatch pixel is as big as the picture, centred on a corner, so the colours blend across exactly the picture's area and beyond
    c.drawImage(swatch, frameLeft - frameW / 2, frameTop - frameH / 2, frameW * 2, frameH * 2);
  };

  // `topShift` moves the shot's top edge up the frame, which sits the glass lower on screen (a phone has a logo row to clear)
  const topOf = (view: View): number | undefined => (view.top === undefined ? undefined : Math.max(0, view.top - topShift));
  const placement = (bmp: ImageBitmap, view: View): Placement =>
    cameraPlacement(bmp.width, bmp.height, canvas.width, canvas.height, Math.max(view.zoom, minZoom), view.x, view.y, MAX_MAGNIFY * (canvas.width / (canvas.clientWidth || canvas.width)), topOf(view));
  const drawBmp = (c: Ctx, bmp: ImageBitmap, alpha: number, view: View): void => {
    const p = placement(bmp, view);
    c.globalAlpha = alpha;
    c.drawImage(bmp, p.sx, p.sy, p.sw, p.sh, p.dx, p.dy, p.dw, p.dh);
  };

  /** Which two frames to show for a position and how much to mix them, using the nearest loaded ones while the right ones are still arriving. */
  const frameChoice = (p: number): { a: number; b: number; t: number } | null => {
    const f = frameBlend(p, meta.count);
    const a = state[f.a] === LOADED ? f.a : nearestLoaded(f.a, state);
    const b = state[f.b] === LOADED ? f.b : a;
    if (a < 0) return null; // nothing has arrived yet: the stage shows its background colour
    return { a, b, t: b === a ? 0 : Math.round(f.t * 64) / 64 }; // fine steps are enough, and let us skip redrawing identical pictures
  };

  /** Paint the picture for a position onto a canvas (clearing it first). False if no frame has arrived yet. */
  const paintPicture = (c: Ctx, p: number, view: View): boolean => {
    const ch = frameChoice(p);
    if (!ch) return false;
    c.clearRect(0, 0, canvas.width, canvas.height);
    const bmpA = bitmaps[ch.a] as ImageBitmap;
    const pl = placement(bmpA, view);
    if (pl.dw < canvas.width - 0.5 || pl.dh < canvas.height - 0.5) {
      const sc = pl.dw / pl.sw; // screen pixels per picture pixel
      paintBackdrop(c, pl.dx - pl.sx * sc, pl.dy - pl.sy * sc, bmpA.width * sc, bmpA.height * sc);
    }
    drawBmp(c, bmpA, 1, view);
    if (ch.t > 0 && bitmaps[ch.b]) drawBmp(c, bitmaps[ch.b] as ImageBitmap, ch.t, view);
    c.globalAlpha = 1;
    return true;
  };

  // Two hidden canvases for a dissolve: the frozen "before" picture, and the new picture drawn on its own so it can be faded in whole.
  let snap: HTMLCanvasElement | undefined;
  let layer: HTMLCanvasElement | undefined;
  const sized = (c: HTMLCanvasElement | undefined): HTMLCanvasElement => {
    const out = c ?? document.createElement("canvas");
    if (out.width !== canvas.width || out.height !== canvas.height) {
      out.width = canvas.width;
      out.height = canvas.height;
    }
    return out;
  };

  return {
    maxPixelRatio,
    resize,
    setPixelRatioCap(next) {
      cap = next;
      resize();
    },
    snapshot() {
      snap = sized(snap);
      const sc = snap.getContext("2d");
      sc?.clearRect(0, 0, snap.width, snap.height);
      sc?.drawImage(canvas, 0, 0);
    },
    isReady(vp) {
      const f = frameBlend(vp, meta.count);
      return state[f.a] === LOADED && state[f.b] === LOADED;
    },
    render(p, view, dissolve) {
      center = Math.round(Math.max(0, Math.min(1, p)) * (meta.count - 1));
      pump(); // the loader follows the new position, so only the frames around the destination are fetched
      if (dissolve !== undefined && dissolve < 1 && snap) {
        ctx.globalAlpha = 1;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(snap, 0, 0); // the picture as it was when the button was pressed
        if (dissolve > 0) {
          layer = sized(layer);
          const lc = layer.getContext("2d");
          if (lc && paintPicture(lc, p, view)) {
            ctx.globalAlpha = dissolve;
            ctx.drawImage(layer, 0, 0);
            ctx.globalAlpha = 1;
          }
        }
        lastKey = ""; // when the dissolve is over, redraw normally
        dirty = true;
        return;
      }
      const ch = frameChoice(p);
      if (!ch) return;
      const key = `${ch.a}|${ch.b}|${ch.t}|${view.zoom.toFixed(3)}|${view.x.toFixed(3)}|${view.y.toFixed(3)}|${(topOf(view) ?? -1).toFixed(3)}|${canvas.width}x${canvas.height}`;
      if (!dirty && key === lastKey) return;
      dirty = false;
      lastKey = key;
      paintPicture(ctx, p, view);
    },
    loadedCount: () => loaded,
    dispose() {
      disposed = true;
      for (const b of bitmaps) b?.close();
    },
  };
}
