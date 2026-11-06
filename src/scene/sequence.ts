import { type View, cameraRect } from "../scroll/camera";
import { LOADED, LOADING, NOT_LOADED, frameBlend, nearestLoaded, nextToLoad } from "../scroll/sequence";

export interface SequenceMeta {
  count: number;
  bg: string; // the video's backdrop colour, so the stage can match it with no seam
  bgBottom?: string; // the backdrop colour along the bottom edge of the phone cut, so the text area below it continues it
  ext: string;
  desktop: { w: number; h: number; dir: string };
  phone: { w: number; h: number; dir: string };
}

export interface Sequence {
  resize(): void;
  setPixelRatioCap(cap: number): void;
  maxPixelRatio: number;
  render(videoProgress: number, view: View): void; // 0..1 through the video, and where the camera looks
  loadedCount(): number;
  dispose(): void;
}

const FAILED = 3; // a frame that would not load; skipped so we never retry it forever
const PARALLEL = 4;
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
 * frame (`zoomBoost` zooms in a little more, e.g. on a phone where the glass should fill more of the screen). The picture nearest the visitor loads first and
 * the rest follow outwards; between two frames it cross-fades, so a modest frame count still scrubs smoothly; while a frame is
 * still loading it shows the nearest one that has arrived, so there is never a blank stage.
 */
export function createSequence(canvas: HTMLCanvasElement, meta: SequenceMeta, base: string, zoomBoost = 1): Sequence {
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
      const i = nextToLoad(center, state);
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

  const draw = (bmp: ImageBitmap, alpha: number, view: View): void => {
    const r = cameraRect(bmp.width, bmp.height, canvas.width, canvas.height, view.zoom * zoomBoost, view.x, view.y, MAX_MAGNIFY * (canvas.width / (canvas.clientWidth || canvas.width)));
    ctx.globalAlpha = alpha;
    ctx.drawImage(bmp, r.sx, r.sy, r.sw, r.sh, 0, 0, canvas.width, canvas.height);
  };

  return {
    maxPixelRatio,
    resize,
    setPixelRatioCap(next) {
      cap = next;
      resize();
    },
    render(p, view) {
      center = Math.round(Math.max(0, Math.min(1, p)) * (meta.count - 1));
      pump();
      const f = frameBlend(p, meta.count);
      const a = state[f.a] === LOADED ? f.a : nearestLoaded(f.a, state);
      const b = state[f.b] === LOADED ? f.b : a;
      if (a < 0) return; // nothing has arrived yet: the stage shows its background colour
      const t = b === a ? 0 : Math.round(f.t * 64) / 64; // fine steps are enough, and let us skip redrawing identical pictures
      const key = `${a}|${b}|${t}|${view.zoom.toFixed(3)}|${view.x.toFixed(3)}|${view.y.toFixed(3)}|${canvas.width}x${canvas.height}`;
      if (!dirty && key === lastKey) return;
      dirty = false;
      lastKey = key;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      draw(bitmaps[a] as ImageBitmap, 1, view);
      if (t > 0 && bitmaps[b]) draw(bitmaps[b] as ImageBitmap, t, view);
      ctx.globalAlpha = 1;
    },
    loadedCount: () => loaded,
    dispose() {
      disposed = true;
      for (const b of bitmaps) b?.close();
    },
  };
}
