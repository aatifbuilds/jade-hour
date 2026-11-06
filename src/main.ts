import "@fontsource/young-serif/400.css";
import "@fontsource-variable/source-serif-4/index.css";
import "./styles/tokens.css";
import "./styles/layout.css";
import { createStage } from "./scene/stage";
import { adaptQuality, type Quality } from "./scene/quality";
import { CHAPTERS, drinkAt } from "./scroll/drink";
import { COPY } from "./ui/copy";

const STORY_SCREENS = 9; // the chapters fill 9 screens of scrolling (see .chapter in layout.css)

// build the chapter text blocks from the same list that drives the drink, so the two can never disagree
const story = document.getElementById("story")!;
for (const c of CHAPTERS) {
  const copy = COPY[c.id];
  const sec = document.createElement("section");
  sec.className = "chapter";
  sec.id = c.id;
  sec.style.setProperty("--span", String(c.to - c.from));
  const head = c.id === "glass" ? `<h1>${copy.title}</h1>` : `<h2>${copy.title}</h2>`;
  sec.innerHTML = `<div class="chapter__text">${head}<p class="${c.id === "glass" ? "lead" : ""}">${copy.line}</p></div>`;
  story.append(sec);
}

const canvas = document.getElementById("stage") as HTMLCanvasElement;
const stage = createStage(canvas);
new ResizeObserver(() => stage.resize()).observe(canvas);

const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));
const rawProgress = (): number => clamp01((window.scrollY - story.offsetTop) / ((story.offsetHeight / (STORY_SCREENS + 1)) * STORY_SCREENS));

let progress = rawProgress(); // smoothed: eases towards the real scroll position so quick flicks do not jerk the drink
let target = progress;
let frameMs = 16.7;
let quality: Quality = { cap: stage.maxPixelRatio, goodChecks: 0 };
let frames = 0;
let last = performance.now();

function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  frameMs += ((now - last) - frameMs) * 0.05;
  last = now;
  target = rawProgress();
  progress += (target - progress) * (1 - Math.exp(-dt * 9));
  if (++frames % 30 === 0) {
    const next = adaptQuality(quality, frameMs, stage.maxPixelRatio);
    if (next.cap !== quality.cap) stage.setPixelRatioCap(next.cap);
    quality = next;
  }
  stage.render(drinkAt(progress), now / 1000);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

if (import.meta.env.DEV) {
  // test hook, stripped from production builds: jump to a scroll progress and read the state
  Object.assign(window, {
    __story: {
      set(p: number) { target = p; progress = p; window.scrollTo(0, story.offsetTop + p * (story.offsetHeight / (STORY_SCREENS + 1)) * STORY_SCREENS); },
      get progress() { return progress; },
      get frameMs() { return frameMs; },
      get pixelRatioCap() { return quality.cap; },
    },
  });
}
