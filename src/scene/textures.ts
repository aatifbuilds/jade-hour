import * as THREE from "three";
import { fbm, heightToNormal } from "./surface";

/**
 * A repeating normal map made from layers of noise: tiny bumps that make light catch a surface the way a real one does.
 * `octaves` are [cells across, weight]; more cells means finer bumps. `strength` is how steep they look.
 */
export function noiseNormalTexture(size: number, seed: number, octaves: [number, number][], strength: number, anisotropy = 4): THREE.CanvasTexture {
  const height = fbm(size, seed, octaves);
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("2D canvas is not available");
  ctx.putImageData(new ImageData(heightToNormal(height, size, size, strength), size, size), 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = anisotropy;
  t.colorSpace = THREE.NoColorSpace; // data, not colour
  return t;
}
