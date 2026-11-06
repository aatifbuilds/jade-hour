import * as THREE from "three";
import { type DrinkState, FOAM_THICKNESS, levels, pourAmount } from "../scroll/drink";
import { createFoam } from "./foam";
import { createGlass } from "./glass";
import { createIce } from "./ice";
import { createLiquid } from "./liquid";
import { createPour } from "./pour";
import { createYuzu } from "./yuzu";

export interface DrinkScene {
  root: THREE.Group;
  update(s: DrinkState, time: number): void;
  dispose(): void;
}

const MILK = 0xf6f2e8;
const MATCHA = 0x6c9f3a;

/** The glass and everything that goes in it, driven by one DrinkState. */
export function createDrinkScene(sides: number, anisotropy: number): DrinkScene {
  const glass = createGlass(sides);
  const liquid = createLiquid(sides);
  const ice = createIce();
  const foam = createFoam(sides, anisotropy);
  const yuzu = createYuzu(anisotropy);
  const pour = createPour();
  const root = new THREE.Group();
  root.add(liquid.group, ice.group, foam.mesh, yuzu.group, pour.mesh, glass.mesh);
  return {
    root,
    update(s, time) {
      const { milkTop, fillTop } = levels(s);
      liquid.update({ fillTop, milkTop, matcha: s.matcha, blend: s.blend });
      ice.update(s.ice, fillTop, time);
      foam.update(s.foam, fillTop);
      yuzu.update(s.yuzu, fillTop + FOAM_THICKNESS * s.foam - 0.03);
      const milkPour = pourAmount(s.milk);
      const matchaPour = pourAmount(s.matcha);
      pour.update(Math.max(milkPour, matchaPour), matchaPour > milkPour ? MATCHA : MILK, fillTop, time);
    },
    dispose() {
      glass.dispose(); liquid.dispose(); ice.dispose(); foam.dispose(); yuzu.dispose(); pour.dispose();
    },
  };
}
