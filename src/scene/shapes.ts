import { filletProfile, type Corner } from "./profile";

/* The glass and the drink's volumes. Scene units: the tumbler is 2.2 tall and about 1 wide, standing on y = 0.
   x is the radius from the axis, y the height. */
export const GLASS_HEIGHT = 2.2;
export const CAVITY_FLOOR = 0.24; // the thick glass base is 0.24 tall (about 1.6 cm at real size)
export const LIQUID_FLOOR = CAVITY_FLOOR + 0.005;
const WALL_BOTTOM_R = 0.385; // inner radius at the floor
const WALL_TOP_R = 0.455; // inner radius at the rim: the glass is a slightly tapered tumbler
export const LIQUID_MAX_Y = 2.0;

/** One continuous outline of the glass's solid: up the outside, over the rim, down the inside to the floor. */
const GLASS_CORNERS: Corner[] = [
  { x: 0, y: 0 },
  { x: 0.42, y: 0, r: 0.05 },
  { x: 0.487, y: GLASS_HEIGHT, r: 0.012 },
  { x: WALL_TOP_R, y: GLASS_HEIGHT, r: 0.012 },
  { x: WALL_BOTTOM_R, y: CAVITY_FLOOR, r: 0.06 },
  { x: 0, y: CAVITY_FLOOR },
];

export const GLASS = filletProfile(GLASS_CORNERS, 10);

/** Radius of the glass's inside wall at height y (a straight taper). */
export function innerRadiusAt(y: number): number {
  const t = (y - CAVITY_FLOOR) / (GLASS_HEIGHT - CAVITY_FLOOR);
  return WALL_BOTTOM_R + (WALL_TOP_R - WALL_BOTTOM_R) * Math.max(0, Math.min(1, t));
}

const GAP = 0.004; // the drink stops a hair short of the glass so the two surfaces never fight
/** The volume the drink can fill, from the floor up to its highest level. A shader hides everything above the current level. */
export const LIQUID = filletProfile(
  [
    { x: 0, y: LIQUID_FLOOR },
    { x: innerRadiusAt(LIQUID_FLOOR) - GAP, y: LIQUID_FLOOR, r: 0.055 },
    { x: innerRadiusAt(LIQUID_MAX_Y) - GAP, y: LIQUID_MAX_Y },
  ],
  8,
);
