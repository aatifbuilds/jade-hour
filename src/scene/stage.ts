import * as THREE from "three";
import type { DrinkState } from "../scroll/drink";
import { createDrinkScene } from "./drinkScene";
import { createStudio } from "./studio";

export interface Stage {
  resize(): void;
  setPixelRatioCap(cap: number): void;
  maxPixelRatio: number;
  render(s: DrinkState, timeSec: number): void;
  dispose(): void;
}

/** The three.js world: renderer, studio reflections, a fixed camera and the glass. Throws if WebGL is unavailable. */
export function createStage(canvas: HTMLCanvasElement): Stage {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setClearColor(0x000000, 0); // transparent: the page's flat colour shows through
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.localClippingEnabled = true; // lets the ice be cut off at the surface of the drink

  const small = Math.min(window.innerWidth, window.innerHeight) < 700;
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(createStudio(), 0.03).texture;
  scene.environment = envTex;
  const key = new THREE.DirectionalLight(0xffffff, 1.2);
  key.position.set(-3, 5, 4);
  scene.add(key);

  const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const drink = createDrinkScene(small ? 96 : 128, anisotropy);
  scene.add(drink.root);

  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 60);
  camera.position.set(0, 2.3, 5.5);
  camera.lookAt(0, 1.1, 0);

  const maxPixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  let cap = maxPixelRatio;
  const resize = (): void => {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cap));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();

  return {
    resize,
    maxPixelRatio,
    setPixelRatioCap(next) { cap = next; resize(); },
    render(s, t) {
      drink.update(s, t);
      renderer.render(scene, camera);
    },
    dispose() {
      drink.dispose();
      envTex.dispose();
      pmrem.dispose();
      renderer.dispose();
    },
  };
}
