import * as THREE from "three";

/** A glowing rectangle (a light panel as seen in a mirror), `power` times brighter than white paper. */
function panel(w: number, h: number, d: number, power: number, tint: number, at: [number, number, number]): THREE.Mesh {
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(tint).multiplyScalar(power), toneMapped: false });
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(...at);
  m.lookAt(0, 0, 0);
  return m;
}

/**
 * A photo studio to reflect: a bright, soft room lit by long strip lights. Glass shows almost nothing but its reflections,
 * so what it reflects is what you see: a tall window-like strip down one side, a thin rim light on the other, a soft top.
 * Only used to make reflections (never drawn on screen).
 */
export function createStudio(): THREE.Scene {
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(14, 10, 14), new THREE.MeshBasicMaterial({ color: 0x8a8a84, side: THREE.BackSide, toneMapped: false })));
  scene.add(panel(1.2, 13, 0.1, 8, 0xfffaf0, [-4.2, 1.2, 3.4])); // tall warm window strip, front left
  scene.add(panel(0.45, 13, 0.1, 6, 0xeef4ff, [4.6, 1.2, -2.2])); // thin cool rim strip, back right
  scene.add(panel(0.7, 6, 0.1, 3, 0xffffff, [3.2, 0.8, 4.2])); // soft second strip, front right
  scene.add(panel(5, 0.1, 5, 2.4, 0xffffff, [0, 4.6, 0])); // overhead softbox
  scene.add(panel(8, 1.6, 0.1, 1.2, 0xffffff, [0, -3.2, 4])); // low fill
  return scene;
}
