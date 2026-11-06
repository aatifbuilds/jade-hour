import { LIQUID_FLOOR } from "../scene/shapes";

/** How far each ingredient has been added, 0 (none) to 1 (all of it). */
export interface DrinkState {
  ice: number;
  milk: number;
  matcha: number;
  blend: number; // 0 layered streaks, 1 fully mixed
  foam: number;
  yuzu: number;
}

export const MILK_TOP = 1.35; // where the milk ends
export const MATCHA_TOP = 1.85; // where the drink ends once the matcha is in
export const FOAM_THICKNESS = 0.1;

/** The scroll story: each chapter owns a stretch of scroll progress. The first is the empty glass. */
export const CHAPTERS = [
  { id: "glass", name: "Glass", from: 0, to: 0.1 },
  { id: "ice", name: "Ice", from: 0.1, to: 0.24 },
  { id: "milk", name: "Milk", from: 0.24, to: 0.4 },
  { id: "matcha", name: "Matcha", from: 0.4, to: 0.56 },
  { id: "blend", name: "Blend", from: 0.56, to: 0.68 },
  { id: "foam", name: "Foam", from: 0.68, to: 0.8 },
  { id: "yuzu", name: "Yuzu", from: 0.8, to: 0.92 },
  { id: "final", name: "Final pour", from: 0.92, to: 1 },
] as const;

const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));
const smoother = (t: number): number => t * t * t * (t * (t * 6 - 15) + 10); // ease in and out with a flat start and end

/** Progress through a stretch of the scroll, 0 before it, 1 after it, eased in between. */
export function ramp(p: number, from: number, to: number): number {
  return smoother(clamp01((p - from) / (to - from)));
}

const range = (id: string): { from: number; to: number } => {
  const c = CHAPTERS.find((x) => x.id === id);
  if (!c) throw new Error(`unknown chapter ${id}`);
  return c;
};

/** Everything the drink looks like at a given scroll progress (0..1). */
export function drinkAt(p: number): DrinkState {
  const r = (id: string): number => ramp(p, range(id).from, range(id).to);
  return { ice: r("ice"), milk: r("milk"), matcha: r("matcha"), blend: r("blend"), foam: r("foam"), yuzu: r("yuzu") };
}

/** Index of the chapter at this progress (the last one owns progress 1). */
export function chapterAt(p: number): number {
  const q = clamp01(p);
  for (let i = CHAPTERS.length - 1; i >= 0; i--) if (q >= CHAPTERS[i].from) return i;
  return 0;
}

/** Heights of the milk's top and of the whole drink's top. Both start at the floor and only go up. */
export function levels(s: DrinkState): { milkTop: number; fillTop: number } {
  const milkTop = LIQUID_FLOOR + (MILK_TOP - LIQUID_FLOOR) * s.milk;
  return { milkTop, fillTop: milkTop + (MATCHA_TOP - MILK_TOP) * s.matcha };
}

/** How much of a pour stream is visible while an ingredient is being added: 0 at rest, 1 mid-pour, fading at both ends. */
export function pourAmount(progress01: number): number {
  const up = clamp01(progress01 / 0.1);
  const down = clamp01((1 - progress01) / 0.1);
  return progress01 <= 0 || progress01 >= 1 ? 0 : Math.min(up, down);
}

const GLASS_TOP_FOR_ICE = 2.15; // an ice cube never rises above the rim

/** Height of an ice cube's centre: it rests on the floor until the drink is deep enough to float it, then rides near the surface. */
export function iceHeight(restY: number, size: number, fillTop: number): number {
  const floatY = fillTop - size * 0.3;
  return Math.max(restY, Math.min(floatY, GLASS_TOP_FOR_ICE - size * 0.5));
}
