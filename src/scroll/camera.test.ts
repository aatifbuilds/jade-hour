import { describe, expect, it } from "vitest";
import { type Story, defaultStory, parseStory } from "./beats";
import { WIDE_VIEW, cameraRect, storyView } from "./camera";

describe("cameraRect", () => {
  it("at zoom 1 is a plain cover fit: the whole frame on one axis, centred trim on the other", () => {
    const r = cameraRect(974, 678, 1440, 900, 1, 0.5, 0.5);
    expect(r.sw).toBeCloseTo(974, 6); // the view is wider than the frame is, so the full width shows
    expect(r.sh).toBeCloseTo((900 * 974) / 1440, 6);
    expect(r.sx).toBeCloseTo(0, 6);
    expect(r.sy).toBeCloseTo((678 - r.sh) / 2, 6);
  });

  it("keeps the view's shape and shows less as it zooms in", () => {
    const a = cameraRect(974, 678, 1440, 900, 1, 0.5, 0.5);
    const b = cameraRect(974, 678, 1440, 900, 1.5, 0.5, 0.5);
    expect(b.sw / b.sh).toBeCloseTo(1440 / 900, 9);
    expect(b.sw).toBeCloseTo(a.sw / 1.5, 6);
    expect(b.sh).toBeCloseTo(a.sh / 1.5, 6);
  });

  it("centres on the focus point", () => {
    const r = cameraRect(974, 678, 1000, 800, 2, 0.5, 0.4);
    expect(r.sx + r.sw / 2).toBeCloseTo(487, 6);
    expect(r.sy + r.sh / 2).toBeCloseTo(0.4 * 678, 6);
  });

  it("never shows outside the frame, whatever the zoom, focus or view shape", () => {
    for (const [vw, vh] of [[1440, 900], [1920, 1080], [390, 523], [2560, 1080], [800, 1200]]) {
      for (const zoom of [1, 1.2, 1.5, 2, 3]) {
        for (const [fx, fy] of [[0, 0], [1, 1], [0.5, 0.5], [0, 1], [0.9, 0.1], [-0.5, 1.5]]) {
          const r = cameraRect(974, 678, vw, vh, zoom, fx, fy);
          expect(r.sx).toBeGreaterThanOrEqual(-1e-9);
          expect(r.sy).toBeGreaterThanOrEqual(-1e-9);
          expect(r.sx + r.sw).toBeLessThanOrEqual(974 + 1e-9);
          expect(r.sy + r.sh).toBeLessThanOrEqual(678 + 1e-9);
        }
      }
    }
  });

  it("stops zooming when the picture would be magnified more than allowed, but never below the plain cover fit", () => {
    const free = cameraRect(974, 678, 1920, 1080, 1.4, 0.5, 0.5);
    const capped = cameraRect(974, 678, 1920, 1080, 1.4, 0.5, 0.5, 2.6);
    expect(capped.sw).toBeGreaterThan(free.sw); // shows more of the frame
    expect(1920 / capped.sw).toBeLessThanOrEqual(2.6 + 1e-9); // and stays within the limit
    const tiny = cameraRect(974, 678, 1920, 1080, 1.4, 0.5, 0.5, 0.5); // a limit below the cover fit still covers the view
    expect(tiny).toEqual(cameraRect(974, 678, 1920, 1080, 1, 0.5, 0.5));
    const small = cameraRect(974, 678, 1440, 900, 1.4, 0.5, 0.5, 2.6); // 1440 wide is under the limit, so nothing changes
    expect(small).toEqual(cameraRect(974, 678, 1440, 900, 1.4, 0.5, 0.5));
  });

  it("treats zoom below 1 as 1, since less than the whole frame cannot cover the view", () => {
    expect(cameraRect(974, 678, 1440, 900, 0.5, 0.5, 0.5)).toEqual(cameraRect(974, 678, 1440, 900, 1, 0.5, 0.5));
  });
});

describe("storyView", () => {
  const story: Story = {
    chapters: [
      { id: "glass", scroll: 0, video: 0, view: { zoom: 1, x: 0.5, y: 0.5 } },
      { id: "ice", scroll: 0.2, video: 0.2, view: { zoom: 1.3, x: 0.5, y: 0.6 } },
      { id: "foam", scroll: 0.6, video: 0.6, view: { zoom: 1.5, x: 0.5, y: 0.3 } },
      { id: "final", scroll: 0.9, video: 0.9, view: { zoom: 1, x: 0.5, y: 0.5 } },
    ],
  };

  it("lands exactly on each chapter's view at its start", () => {
    for (const c of story.chapters) {
      const v = storyView(c.scroll, story);
      expect(v.zoom).toBeCloseTo(c.view!.zoom, 9);
      expect(v.x).toBeCloseTo(c.view!.x, 9);
      expect(v.y).toBeCloseTo(c.view!.y, 9);
    }
  });

  it("holds the last view to the end", () => {
    expect(storyView(1, story).zoom).toBeCloseTo(1, 9);
  });

  it("zooms in and out smoothly without overshooting the views it passes between", () => {
    let last = storyView(0, story).zoom;
    for (let p = 0; p <= 1; p += 0.002) {
      const v = storyView(p, story);
      expect(v.zoom).toBeGreaterThanOrEqual(1 - 1e-9);
      expect(v.zoom).toBeLessThanOrEqual(1.5 + 1e-9);
      expect(Math.abs(v.zoom - last)).toBeLessThan(0.02); // no sudden jump from one step to the next
      last = v.zoom;
    }
  });

  it("uses the whole frame for chapters without a view", () => {
    const v = storyView(0.4, defaultStory());
    expect(v).toEqual(WIDE_VIEW);
  });
});

describe("parseStory with views", () => {
  const good = { chapters: [{ id: "a", scroll: 0, video: 0, view: { zoom: 1, x: 0.5, y: 0.5 } }, { id: "b", scroll: 0.5, video: 0.5, view: { zoom: 1.4, x: 0.5, y: 0.3 } }] };

  it("accepts valid views and keeps them", () => {
    expect(parseStory(good)?.chapters[1].view).toEqual({ zoom: 1.4, x: 0.5, y: 0.3 });
  });

  it("still accepts chapters without a view", () => {
    expect(parseStory({ chapters: [{ id: "a", scroll: 0, video: 0 }, { id: "b", scroll: 0.5, video: 0.5 }] })).not.toBeNull();
  });

  it("rejects out-of-range or malformed views", () => {
    const bad = (view: unknown): unknown => ({ chapters: [{ id: "a", scroll: 0, video: 0 }, { id: "b", scroll: 0.5, video: 0.5, view }] });
    expect(parseStory(bad({ zoom: 0.5, x: 0.5, y: 0.5 }))).toBeNull();
    expect(parseStory(bad({ zoom: 5, x: 0.5, y: 0.5 }))).toBeNull();
    expect(parseStory(bad({ zoom: 1.2, x: 2, y: 0.5 }))).toBeNull();
    expect(parseStory(bad({ zoom: "1.2", x: 0.5, y: 0.5 }))).toBeNull();
    expect(parseStory(bad(null))).toBeNull();
  });
});
