import "@fontsource/young-serif/400.css";
import "@fontsource-variable/source-serif-4/index.css";
import "./styles/tokens.css";
import "./styles/layout.css";
import { createStage } from "./scene/stage";
import { adaptQuality, type Quality } from "./scene/quality";
import { createSequence, loadSequenceMeta } from "./scene/sequence";
import { defaultStory, parseStory, storyRanges, storyVideoProgress, type Story } from "./scroll/beats";
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

// build the chapter text blocks from the same story that drives the picture, so the two can never disagree
const storyEl = document.getElementById("story")!;
for (const c of storyRanges(story)) {
  const copy = COPY[c.id];
  const sec = document.createElement("section");
  sec.className = "chapter";
  sec.id = c.id;
  sec.style.setProperty("--span", String(c.to - c.from));
  const head = c.id === "glass" ? `<h1>${copy.title}</h1>` : `<h2>${copy.title}</h2>`;
  sec.innerHTML = `<div class="chapter__text">${head}<p class="${c.id === "glass" ? "lead" : ""}">${copy.line}</p></div>`;
  storyEl.append(sec);
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
    canvas.style.background = seqMeta.bg; // match the video's backdrop exactly: no seam
    const seq = createSequence(canvas, seqMeta, base);
    return { resize: seq.resize, setPixelRatioCap: seq.setPixelRatioCap, maxPixelRatio: seq.maxPixelRatio, draw: (p) => seq.render(storyVideoProgress(p, story)) };
  }
  const stage = createStage(canvas);
  return { resize: stage.resize, setPixelRatioCap: stage.setPixelRatioCap, maxPixelRatio: stage.maxPixelRatio, draw: (p, t) => stage.render(drinkAt(p), t) };
}
const drawer = makeDrawer();
new ResizeObserver(() => drawer.resize()).observe(canvas);

const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));
const rawProgress = (): number => clamp01((window.scrollY - storyEl.offsetTop) / ((storyEl.offsetHeight / (STORY_SCREENS + 1)) * STORY_SCREENS));

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
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

if (import.meta.env.DEV) {
  // test hook, stripped from production builds: jump to a scroll progress and read the state
  Object.assign(window, {
    __story: {
      set(p: number) { spring = { x: p, v: 0 }; window.scrollTo(0, storyEl.offsetTop + p * (storyEl.offsetHeight / (STORY_SCREENS + 1)) * STORY_SCREENS); },
      get progress() { return spring.x; },
      get frameMs() { return frameMs; },
      get pixelRatioCap() { return quality.cap; },
    },
  });
}
