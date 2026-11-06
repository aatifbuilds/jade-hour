import "@fontsource/young-serif/400.css";
import "@fontsource-variable/source-serif-4/index.css";
import "./styles/tokens.css";
import "./styles/layout.css";
import { createStage } from "./scene/stage";
import { adaptQuality, type Quality } from "./scene/quality";
import { createSequence, loadSequenceMeta } from "./scene/sequence";
import { defaultStory, parseStory, storyChapterAt, storyRanges, storyVideoProgress, type Story } from "./scroll/beats";
import { storyView } from "./scroll/camera";
import { createStepIndex } from "./ui/stepIndex";
import { drinkAt } from "./scroll/drink";
import { stepSpring } from "./scroll/spring";
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
    const seq = createSequence(canvas, seqMeta, base, phone ? 0.9 : 0); // on a phone the glass never gets smaller than a screen's worth
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
// the list of steps (everything after the opening glass); clicking one jumps the scroll there and the spring glides the picture
const stepIndex = createStepIndex(document.getElementById("index")!, ranges.filter((r) => r.id !== "glass").map((r) => ({ id: r.id, label: COPY[r.id].label })), (id) => {
  const r = ranges.find((x) => x.id === id);
  if (r) window.scrollTo({ top: scrollYFor(r.from + 0.0005), behavior: "instant" });
});
let activeId = "";
function showActive(p: number): void {
  const id = story.chapters[storyChapterAt(p, story)].id;
  if (id === activeId) return;
  activeId = id;
  document.body.classList.toggle("is-story", id !== "glass");
  stepIndex.setActive(id);
  for (const [k, el] of copyItems) {
    el.classList.toggle("is-active", k === id);
    el.setAttribute("aria-hidden", k === id ? "false" : "true");
  }
}

const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));
const rawProgress = (): number => clamp01((window.scrollY - storyEl.offsetTop) / scrollTravel());

// the scroll position is smoothed by a critically damped spring: quick flicks glide instead of jerking, and nothing overshoots
let spring = { x: rawProgress(), v: 0 };
let frameMs = 16.7;
let quality: Quality = { cap: drawer.maxPixelRatio, goodChecks: 0 };
let frames = 0;
let last = performance.now();

function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  frameMs += ((now - last) - frameMs) * 0.05;
  last = now;
  spring = stepSpring(spring, rawProgress(), 9, dt);
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
      get frameMs() { return frameMs; },
      get pixelRatioCap() { return quality.cap; },
    },
  });
}
