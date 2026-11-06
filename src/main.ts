import "@fontsource/young-serif/400.css";
import "@fontsource-variable/source-serif-4/index.css";
import "./styles/tokens.css";
import "./styles/layout.css";
import { createStage } from "./scene/stage";
import { adaptQuality, type Quality } from "./scene/quality";
import { createSequence, loadSequenceMeta } from "./scene/sequence";
import { chapterWithHysteresis, defaultStory, parseStory, storyRanges, storyVideoProgress, type Story } from "./scroll/beats";
import { storyView } from "./scroll/camera";
import { setupAnchors } from "./ui/anchors";
import { createStepIndex } from "./ui/stepIndex";
import { drinkAt } from "./scroll/drink";
import { springOmega, stepSpring } from "./scroll/spring";
import { COPY } from "./ui/copy";

const STORY_SCREENS = 9; // the chapters fill 9 screens of scrolling (see .chapter in layout.css)

const canvas = document.getElementById("stage") as HTMLCanvasElement;
const base = import.meta.env.BASE_URL;

// the video (if it has been made) says which chapters it tells and where each begins; otherwise the full recipe is used
const seqMeta = await loadSequenceMeta(base);
async function loadStory(): Promise<Story> {
  if (!seqMeta) return defaultStory();
  try {
    const res = await fetch(`${base}frames/story.json`, { cache: "no-cache" });
    const parsed = res.ok ? parseStory(await res.json()) : null;
    if (parsed && parsed.chapters.every((c) => COPY[c.id])) return parsed;
  } catch {
    /* no story file: use the full recipe */
  }
  return defaultStory();
}
const story = await loadStory();

// build the page from the same story that drives the picture, so the two can never disagree: an empty block per chapter gives the
// scroll its length (and a place for links to land), and a fixed layer holds each chapter's words, shown one at a time
const storyEl = document.getElementById("story")!;
const copyEl = document.getElementById("copy")!;
const copyItems = new Map<string, HTMLElement>();
for (const c of storyRanges(story)) {
  const copy = COPY[c.id];
  const block = document.createElement("section");
  block.className = "chapter";
  block.id = c.id;
  block.style.setProperty("--span", String(c.to - c.from));
  storyEl.append(block);
  const item = document.createElement("article");
  item.className = c.id === "glass" ? "copy__item copy__item--hero" : "copy__item";
  item.setAttribute("aria-hidden", "true");
  item.innerHTML = c.id === "glass" ? `<h1>jade<br />hour</h1><p class="lead">${copy.line}</p>` : `<h2>${copy.title}</h2><p>${copy.line}</p>`;
  copyEl.append(item);
  copyItems.set(c.id, item);
}

/** What the page draws into the stage: the video frames if they have been made, otherwise the live 3D drink. */
interface Drawer {
  resize(): void;
  setPixelRatioCap(cap: number): void;
  maxPixelRatio: number;
  draw(scrollProgress: number, timeSec: number): void;
}
function makeDrawer(): Drawer {
  if (seqMeta) {
    const phone = window.innerWidth <= 700;
    // the whole page takes the video's backdrop colour: no box, no seam (on a phone, the colour along the picture's bottom edge, which the text area continues)
    document.documentElement.style.setProperty("--bg", phone && seqMeta.bgBottom ? seqMeta.bgBottom : seqMeta.bg);
    const seq = createSequence(canvas, seqMeta, base, phone ? 0.9 : 0, phone ? 0.05 : 0); // on a phone the glass never gets smaller than a screen's worth
    return { resize: seq.resize, setPixelRatioCap: seq.setPixelRatioCap, maxPixelRatio: seq.maxPixelRatio, draw: (p) => seq.render(storyVideoProgress(p, story), storyView(p, story)) };
  }
  const stage = createStage(canvas);
  return { resize: stage.resize, setPixelRatioCap: stage.setPixelRatioCap, maxPixelRatio: stage.maxPixelRatio, draw: (p, t) => stage.render(drinkAt(p), t) };
}
const drawer = makeDrawer();
new ResizeObserver(() => drawer.resize()).observe(canvas);

const scrollTravel = (): number => (storyEl.offsetHeight / (STORY_SCREENS + 1)) * STORY_SCREENS;
const scrollYFor = (p: number): number => storyEl.offsetTop + p * scrollTravel();
const ranges = storyRanges(story);
// the list of steps (everything after the opening glass): plain links, handled by the shared button handler below
const stepIndex = createStepIndex(document.getElementById("index")!, ranges.filter((r) => r.id !== "glass").map((r) => ({ id: r.id, label: COPY[r.id].label })));

// Which step is showing. It follows the scroll position, but only changes to a neighbouring step once the scroll is clearly past the edge
// (so it cannot flicker at a boundary); a click on a step switches at once and shows only that step, never the ones it glides past.
let activeIdx = -1;
function applyActive(idx: number): void {
  activeIdx = idx;
  const id = story.chapters[idx].id;
  document.body.classList.toggle("is-story", id !== "glass");
  stepIndex.setActive(id);
  for (const [k, el] of copyItems) {
    el.classList.toggle("is-active", k === id);
    el.setAttribute("aria-hidden", k === id ? "false" : "true");
  }
}
function showActive(p: number): void {
  const next = chapterWithHysteresis(p, activeIdx, story);
  if (next !== activeIdx) applyActive(next);
}

// Buttons jump the scroll to the step and the picture glides there slowly; any wheel, touch or key hands control straight back.
const GLIDE_MS = 1600;
let glideUntil = 0;
setupAnchors({
  scrollYFor: (id) => {
    const r = ranges.find((x) => x.id === id);
    return r ? scrollYFor(r.from + (r.from > 0 ? 0.0005 : 0)) : undefined;
  },
  onGlide: (id) => {
    glideUntil = performance.now() + GLIDE_MS;
    const idx = story.chapters.findIndex((c) => c.id === id);
    if (idx >= 0 && idx !== activeIdx) applyActive(idx);
  },
  onTakeover: () => {
    glideUntil = 0;
  },
});

const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));
const rawProgress = (): number => clamp01((window.scrollY - storyEl.offsetTop) / scrollTravel());

// The scroll position is smoothed by a critically damped spring: quick flicks glide instead of jerking, and nothing overshoots. After a
// button click the spring is slower (a calm glide), then eases back to normal speed.
let spring = { x: rawProgress(), v: 0 };
let frameMs = 16.7;
let quality: Quality = { cap: drawer.maxPixelRatio, goodChecks: 0 };
let frames = 0;
let last = performance.now();

function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  frameMs += ((now - last) - frameMs) * 0.05;
  last = now;
  spring = stepSpring(spring, rawProgress(), springOmega(now, glideUntil), dt);
  if (++frames % 30 === 0) {
    const next = adaptQuality(quality, frameMs, drawer.maxPixelRatio);
    if (next.cap !== quality.cap) drawer.setPixelRatioCap(next.cap);
    quality = next;
  }
  drawer.draw(clamp01(spring.x), now / 1000);
  showActive(rawProgress());
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

if (import.meta.env.DEV) {
  // test hook, stripped from production builds: jump to a scroll progress and read the state
  Object.assign(window, {
    __story: {
      set(p: number) { spring = { x: p, v: 0 }; window.scrollTo(0, scrollYFor(p)); },
      get progress() { return spring.x; },
      get raw() { return rawProgress(); },
      get activeIndex() { return activeIdx; },
      get gliding() { return performance.now() < glideUntil; },
      get activeStep() { return story.chapters[activeIdx]?.id; },
      get frameMs() { return frameMs; },
      get pixelRatioCap() { return quality.cap; },
    },
  });
}
