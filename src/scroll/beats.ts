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

/** One chapter of the story as the video tells it: where it starts on the page (0..1) and where it starts in the video (0..1). */
export interface StoryChapter {
  id: string;
  scroll: number;
  video: number;
}
export interface Story {
  chapters: StoryChapter[];
}

/** The full eight-chapter story with the video paced like the scroll (used by the 3D drink, and until the video is tuned). */
export function defaultStory(): Story {
  return { chapters: CHAPTERS.map((c, i) => ({ id: c.id, scroll: c.from, video: VIDEO_AT_BOUNDARY[i] })) };
}

/** Reads and checks a story file (frames/story.json). Returns null if it is missing or malformed, so the caller can fall back. */
export function parseStory(raw: unknown): Story | null {
  const list = (raw as { chapters?: unknown } | null)?.chapters;
  if (!Array.isArray(list) || list.length < 2) return null;
  const chapters: StoryChapter[] = [];
  for (const c of list) {
    const { id, scroll, video } = (c ?? {}) as Partial<StoryChapter>;
    if (typeof id !== "string" || typeof scroll !== "number" || typeof video !== "number") return null;
    chapters.push({ id, scroll, video });
  }
  if (chapters[0].scroll !== 0 || chapters[0].video !== 0) return null;
  for (let i = 1; i < chapters.length; i++) {
    if (!(chapters[i].scroll > chapters[i - 1].scroll) || chapters[i].scroll >= 1) return null;
    if (chapters[i].video < chapters[i - 1].video || chapters[i].video > 1) return null;
  }
  return { chapters };
}

/** Each chapter's stretch of scroll: from its start to the next chapter's start (the last runs to 1). */
export function storyRanges(story: Story): { id: string; from: number; to: number }[] {
  return story.chapters.map((c, i) => ({ id: c.id, from: c.scroll, to: i + 1 < story.chapters.length ? story.chapters[i + 1].scroll : 1 }));
}

/** Share of the video (0..1) to show at a scroll progress (0..1), for a given story. */
export function storyVideoProgress(p: number, story: Story): number {
  return monotoneCubic([...story.chapters.map((c) => c.scroll), 1], [...story.chapters.map((c) => c.video), 1])(p);
}
