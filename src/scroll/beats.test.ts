import { describe, expect, it } from "vitest";
import { VIDEO_AT_BOUNDARY, chapterBoundaries, defaultStory, monotoneCubic, parseStory, storyRanges, storyVideoProgress, videoProgressAt } from "./beats";
import { CHAPTERS } from "./drink";

describe("monotoneCubic", () => {
  const f = monotoneCubic([0, 1, 2, 4], [0, 1, 1.5, 4]);

  it("passes through every point", () => {
    expect(f(0)).toBeCloseTo(0, 9);
    expect(f(1)).toBeCloseTo(1, 9);
    expect(f(2)).toBeCloseTo(1.5, 9);
    expect(f(4)).toBeCloseTo(4, 9);
  });

  it("never goes backwards or beyond its points", () => {
    let last = -Infinity;
    for (let x = 0; x <= 4; x += 0.01) {
      const y = f(x);
      expect(y).toBeGreaterThanOrEqual(last - 1e-9);
      expect(y).toBeGreaterThanOrEqual(0 - 1e-9);
      expect(y).toBeLessThanOrEqual(4 + 1e-9);
      last = y;
    }
  });

  it("holds perfectly flat between two equal points", () => {
    const g = monotoneCubic([0, 1, 2, 3], [0, 1, 1, 2]);
    for (let x = 1; x <= 2; x += 0.05) expect(g(x)).toBeCloseTo(1, 9);
  });

  it("clamps outside its range", () => {
    expect(f(-5)).toBeCloseTo(0, 9);
    expect(f(99)).toBeCloseTo(4, 9);
  });

  it("rejects bad input", () => {
    expect(() => monotoneCubic([0], [0])).toThrow();
    expect(() => monotoneCubic([0, 1], [0])).toThrow();
  });
});

describe("video beats", () => {
  it("has one mark for each chapter start plus the end, rising from 0 to 1", () => {
    expect(VIDEO_AT_BOUNDARY.length).toBe(CHAPTERS.length + 1);
    expect(VIDEO_AT_BOUNDARY[0]).toBe(0);
    expect(VIDEO_AT_BOUNDARY[VIDEO_AT_BOUNDARY.length - 1]).toBe(1);
    for (let i = 1; i < VIDEO_AT_BOUNDARY.length; i++) expect(VIDEO_AT_BOUNDARY[i]).toBeGreaterThanOrEqual(VIDEO_AT_BOUNDARY[i - 1]);
  });

  it("starts at the first frame and ends on the last", () => {
    expect(videoProgressAt(0)).toBeCloseTo(0, 9);
    expect(videoProgressAt(1)).toBeCloseTo(1, 9);
  });

  it("puts each chapter's start exactly on its mark", () => {
    const b = chapterBoundaries();
    b.forEach((p, i) => expect(videoProgressAt(p)).toBeCloseTo(VIDEO_AT_BOUNDARY[i], 9));
  });

  it("with uneven marks, still never runs backwards and stays inside the video", () => {
    const marks = [0, 0.05, 0.3, 0.45, 0.7, 0.75, 0.9, 0.95, 1];
    let last = 0;
    for (let p = 0; p <= 1; p += 0.002) {
      const v = videoProgressAt(p, marks);
      expect(v).toBeGreaterThanOrEqual(last - 1e-9);
      expect(v).toBeLessThanOrEqual(1 + 1e-9);
      last = v;
    }
  });
});

describe("story", () => {
  const five = { chapters: [{ id: "glass", scroll: 0, video: 0 }, { id: "ice", scroll: 0.1, video: 0.08 }, { id: "milk", scroll: 0.34, video: 0.36 }, { id: "matcha", scroll: 0.54, video: 0.54 }, { id: "final", scroll: 0.84, video: 0.84 }] };

  it("the default story matches the eight chapters and the old beat marks", () => {
    const d = defaultStory();
    expect(d.chapters.map((c) => c.id)).toEqual(CHAPTERS.map((c) => c.id));
    d.chapters.forEach((c, i) => {
      expect(c.scroll).toBe(CHAPTERS[i].from);
      expect(c.video).toBe(VIDEO_AT_BOUNDARY[i]);
    });
    expect(storyVideoProgress(0.37, d)).toBeCloseTo(videoProgressAt(0.37), 12);
  });

  it("accepts a good story and gives each chapter its stretch of scroll up to the next one", () => {
    expect(parseStory(five)).toEqual(five);
    const r = storyRanges(five);
    expect(r[0]).toEqual({ id: "glass", from: 0, to: 0.1 });
    expect(r[4]).toEqual({ id: "final", from: 0.84, to: 1 });
    for (let i = 1; i < r.length; i++) expect(r[i].from).toBe(r[i - 1].to);
  });

  it("rejects stories that are missing, too short, or out of order", () => {
    expect(parseStory(null)).toBeNull();
    expect(parseStory({})).toBeNull();
    expect(parseStory({ chapters: [{ id: "a", scroll: 0, video: 0 }] })).toBeNull();
    expect(parseStory({ chapters: [{ id: "a", scroll: 0.1, video: 0 }, { id: "b", scroll: 0.5, video: 0.5 }] })).toBeNull(); // must start at 0
    expect(parseStory({ chapters: [{ id: "a", scroll: 0, video: 0 }, { id: "b", scroll: 0.5, video: 0.5 }, { id: "c", scroll: 0.4, video: 0.6 }] })).toBeNull(); // scroll going back
    expect(parseStory({ chapters: [{ id: "a", scroll: 0, video: 0 }, { id: "b", scroll: 0.5, video: 0.6 }, { id: "c", scroll: 0.7, video: 0.4 }] })).toBeNull(); // video going back
    expect(parseStory({ chapters: [{ id: "a", scroll: 0, video: 0 }, { id: "b", scroll: 1, video: 0.5 }] })).toBeNull(); // a chapter that starts at the very end
    expect(parseStory({ chapters: [{ id: "a", scroll: 0, video: 0 }, { id: "b", scroll: "0.5", video: 0.5 }] })).toBeNull();
  });

  it("scrubs the video from its first frame to its last, never backwards, landing each chapter on its mark", () => {
    expect(storyVideoProgress(0, five)).toBeCloseTo(0, 9);
    expect(storyVideoProgress(1, five)).toBeCloseTo(1, 9);
    five.chapters.forEach((c) => expect(storyVideoProgress(c.scroll, five)).toBeCloseTo(c.video, 9));
    let last = 0;
    for (let p = 0; p <= 1; p += 0.002) {
      const v = storyVideoProgress(p, five);
      expect(v).toBeGreaterThanOrEqual(last - 1e-9);
      last = v;
    }
  });
});
