import { describe, expect, it } from "vitest";
import { type Story, defaultStory, parseStory } from "./beats";
import { MIN_ZOOM, WIDE_VIEW, cameraPlacement, cameraRect, mixView, storyView } from "./camera";

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
      expect(v.zoom).toBeGreaterThanOrEqual(1 - 1e-9); // this story never pulls back past the frame
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
    expect(parseStory(bad({ zoom: 0.4, x: 0.5, y: 0.5 }))).toBeNull();
    expect(parseStory(bad({ zoom: 5, x: 0.5, y: 0.5 }))).toBeNull();
    expect(parseStory(bad({ zoom: 1.2, x: 2, y: 0.5 }))).toBeNull();
    expect(parseStory(bad({ zoom: "1.2", x: 0.5, y: 0.5 }))).toBeNull();
    expect(parseStory(bad(null))).toBeNull();
  });
});

describe("cameraPlacement", () => {
  it("from zoom 1 up, fills the whole view with the same part of the frame as cameraRect", () => {
    for (const z of [1, 1.3, 2]) {
      const p = cameraPlacement(974, 678, 1440, 900, z, 0.5, 0.4);
      const r = cameraRect(974, 678, 1440, 900, z, 0.5, 0.4);
      const want = { sx: r.sx, sy: r.sy, sw: r.sw, sh: r.sh, dx: 0, dy: 0, dw: 1440, dh: 900 };
      for (const k of Object.keys(want) as (keyof typeof want)[]) expect(p[k]).toBeCloseTo(want[k], 6);
    }
  });

  it("pulling back shows the whole frame, smaller, centred, with the page colour around it", () => {
    const p = cameraPlacement(974, 678, 1440, 900, 0.7, 0.5, 0.5);
    expect(p.sx).toBeCloseTo(0, 9);
    expect(p.sy).toBeCloseTo(0, 9);
    expect(p.sw).toBeCloseTo(974, 9);
    expect(p.sh).toBeCloseTo(678, 9);
    expect(p.dw).toBeLessThan(1440);
    expect(p.dh).toBeLessThan(900);
    expect(p.dx).toBeCloseTo(1440 - (p.dx + p.dw), 9); // equal margins left and right
    expect(p.dy).toBeCloseTo(900 - (p.dy + p.dh), 9); // and top and bottom
    expect(p.dw / p.dh).toBeCloseTo(974 / 678, 9); // the picture keeps its shape
  });

  it("makes the glass smaller the further it pulls back", () => {
    const a = cameraPlacement(974, 678, 1440, 900, 1, 0.5, 0.5);
    const b = cameraPlacement(974, 678, 1440, 900, 0.8, 0.5, 0.5);
    const c = cameraPlacement(974, 678, 1440, 900, 0.6, 0.5, 0.5);
    expect(b.dw / b.sw).toBeLessThan(a.dw / a.sw);
    expect(c.dw / c.sw).toBeLessThan(b.dw / b.sw);
  });

  it("always takes from inside the frame, places inside the view, and keeps one scale on both axes", () => {
    for (const [vw, vh] of [[1440, 900], [1920, 1080], [390, 523], [2560, 1080], [800, 1200]]) {
      for (const zoom of [0.3, 0.5, 0.7, 0.9, 1, 1.4, 3]) {
        for (const [fx, fy] of [[0, 0], [1, 1], [0.5, 0.5], [0.9, 0.1]]) {
          const p = cameraPlacement(974, 678, vw, vh, zoom, fx, fy, 2.6);
          expect(p.sx).toBeGreaterThanOrEqual(-1e-9);
          expect(p.sy).toBeGreaterThanOrEqual(-1e-9);
          expect(p.sx + p.sw).toBeLessThanOrEqual(974 + 1e-9);
          expect(p.sy + p.sh).toBeLessThanOrEqual(678 + 1e-9);
          expect(p.dx).toBeGreaterThanOrEqual(-1e-9);
          expect(p.dy).toBeGreaterThanOrEqual(-1e-9);
          expect(p.dx + p.dw).toBeLessThanOrEqual(vw + 1e-6);
          expect(p.dy + p.dh).toBeLessThanOrEqual(vh + 1e-6);
          expect(p.dw / p.sw).toBeCloseTo(p.dh / p.sh, 6);
        }
      }
    }
  });

  it("limits how far it pulls back", () => {
    const far = cameraPlacement(974, 678, 1440, 900, 0.01, 0.5, 0.5);
    const limit = cameraPlacement(974, 678, 1440, 900, MIN_ZOOM, 0.5, 0.5);
    expect(far).toEqual(limit);
  });
});

describe("top anchor", () => {
  it("holds the top edge of the shot at the asked point of the frame, so zooming in only loses the bottom", () => {
    for (const z of [1, 1.2, 1.4, 1.8]) {
      const p = cameraPlacement(974, 678, 1440, 900, z, 0.5, 0.9, Infinity, 0.05);
      expect(p.sy).toBeCloseTo(0.05 * 678, 6);
    }
    const a = cameraPlacement(974, 678, 1440, 900, 1.2, 0.5, 0.5, Infinity, 0.05);
    const b = cameraPlacement(974, 678, 1440, 900, 1.6, 0.5, 0.5, Infinity, 0.05);
    expect(a.sy).toBeCloseTo(b.sy, 9);
    expect(b.sy + b.sh).toBeLessThan(a.sy + a.sh); // the more it zooms, the less of the bottom it shows
  });

  it("never shows outside the frame, whatever the anchor", () => {
    for (const top of [0, 0.05, 0.5, 0.95, 1]) {
      for (const z of [1, 1.4, 2.5]) {
        const p = cameraPlacement(974, 678, 1440, 900, z, 0.5, 0.5, Infinity, top);
        expect(p.sy).toBeGreaterThanOrEqual(-1e-9);
        expect(p.sy + p.sh).toBeLessThanOrEqual(678 + 1e-9);
      }
    }
  });

  it("has no effect when the shot already shows the whole height", () => {
    const withTop = cameraPlacement(974, 678, 1440, 900, 0.7, 0.5, 0.5, Infinity, 0.3);
    const without = cameraPlacement(974, 678, 1440, 900, 0.7, 0.5, 0.5);
    expect(withTop).toEqual(without);
  });

  it("is carried through the story and validated", () => {
    const st = { chapters: [{ id: "a", scroll: 0, video: 0, view: { zoom: 1, x: 0.5, y: 0.5 } }, { id: "b", scroll: 0.5, video: 0.5, view: { zoom: 1.3, x: 0.5, y: 0.5, top: 0.04 } }] };
    expect(storyView(0.5, st).top).toBeCloseTo(0.04, 9);
    expect(storyView(0.25, st).top).toBeGreaterThan(0);
    expect(storyView(0.25, defaultStory()).top).toBeUndefined();
    expect(parseStory(st)?.chapters[1].view?.top).toBe(0.04);
    expect(parseStory({ chapters: [st.chapters[0], { ...st.chapters[1], view: { zoom: 1.3, x: 0.5, y: 0.5, top: 2 } }] })).toBeNull();
  });
});

describe("mixView", () => {
  const a = { zoom: 1, x: 0.4, y: 0.5, top: 0.04 };
  const b = { zoom: 1.4, x: 0.6, y: 0.3, top: 0.0 };

  it("gives the first view at 0 and the second at 1, and the middle half way", () => {
    expect(mixView(a, b, 0)).toEqual(a);
    expect(mixView(a, b, 1)).toEqual(b);
    const m = mixView(a, b, 0.5);
    expect(m.zoom).toBeCloseTo(1.2, 9);
    expect(m.x).toBeCloseTo(0.5, 9);
    expect(m.y).toBeCloseTo(0.4, 9);
    expect(m.top).toBeCloseTo(0.02, 9);
  });

  it("goes straight from one to the other: it never leaves the range between them", () => {
    for (let t = 0; t <= 1; t += 0.05) {
      const m = mixView(a, b, t);
      expect(m.zoom).toBeGreaterThanOrEqual(1 - 1e-9);
      expect(m.zoom).toBeLessThanOrEqual(1.4 + 1e-9);
    }
  });

  it("clamps t, and copes with a missing top anchor", () => {
    expect(mixView(a, b, -3)).toEqual(a);
    expect(mixView(a, b, 9)).toEqual(b);
    expect(mixView({ zoom: 1, x: 0.5, y: 0.5 }, b, 0.5).top).toBe(0); // takes the one that exists
    expect(mixView(a, { zoom: 1, x: 0.5, y: 0.5 }, 0.5).top).toBeUndefined();
  });
});
