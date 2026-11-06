import * as THREE from "three";
import { FOAM_THICKNESS } from "../scroll/drink";
import { innerRadiusAt } from "./shapes";
import { noiseNormalTexture } from "./textures";

export interface Foam {
  mesh: THREE.Mesh;
  update(foam: number, fillTop: number): void;
  dispose(): void;
}

/** A thin cap of light, fine-bubbled foam that grows on top of the drink. */
export function createFoam(sides: number, anisotropy: number): Foam {
  const geo = new THREE.CylinderGeometry(1, 1, 1, sides, 1);
  const normal = noiseNormalTexture(256, 11, [[24, 1], [48, 0.8], [96, 0.5]], 2.2, anisotropy);
  normal.repeat.set(2, 2);
  const mat = new THREE.MeshPhysicalMaterial({ color: 0xcbe09a, roughness: 0.82, normalMap: normal, normalScale: new THREE.Vector2(1, 1), envMapIntensity: 0.7 });
  const mesh = new THREE.Mesh(geo, mat);
  return {
    mesh,
    update(foam, fillTop) {
      const h = FOAM_THICKNESS * foam;
      mesh.visible = foam > 0.001;
      mesh.position.y = fillTop + h / 2 - 0.004;
      mesh.scale.set(Math.max(0.001, innerRadiusAt(fillTop) - 0.008), Math.max(0.0005, h), Math.max(0.001, innerRadiusAt(fillTop) - 0.008));
    },
    dispose() { geo.dispose(); normal.dispose(); mat.dispose(); },
  };
}
