import * as THREE from "three";
import { noiseNormalTexture } from "./textures";

export interface Yuzu {
  group: THREE.Group;
  update(yuzu: number, restY: number): void;
  dispose(): void;
}

/** A curled twist of yuzu peel: a tube along a tightening spiral, yellow with a pitted, pebbly skin. */
export function createYuzu(anisotropy: number): Yuzu {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 60; i++) {
    const t = i / 60;
    const a = t * Math.PI * 4.2; // two curls
    const r = 0.05 + 0.2 * t;
    pts.push(new THREE.Vector3(Math.cos(a) * r, 0.07 * Math.sin(t * Math.PI) + t * 0.1, Math.sin(a) * r));
  }
  const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 200, 0.036, 10, false);
  const normal = noiseNormalTexture(256, 23, [[32, 1], [64, 0.9], [128, 0.6]], 3, anisotropy);
  normal.repeat.set(6, 1);
  const mat = new THREE.MeshPhysicalMaterial({ color: 0xe0c13a, roughness: 0.55, normalMap: normal, normalScale: new THREE.Vector2(1, 1), clearcoat: 0.25, clearcoatRoughness: 0.5, envMapIntensity: 0.9 });
  const mesh = new THREE.Mesh(geo, mat);
  const group = new THREE.Group();
  group.add(mesh);
  return {
    group,
    update(yuzu, restY) {
      group.visible = yuzu > 0.001;
      const k = 0.35 + 0.65 * yuzu;
      group.scale.setScalar(k);
      group.position.set(0.1, restY + (1 - yuzu) * 1.4, 0.04);
      group.rotation.set(0.12 * yuzu, (1 - yuzu) * 3.2 + 0.4, -0.1 * yuzu);
    },
    dispose() { geo.dispose(); normal.dispose(); mat.dispose(); },
  };
}
