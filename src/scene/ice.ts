import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { iceHeight, ramp } from "../scroll/drink";
import { edgeOpacity } from "./glass";

/** Where each cube comes to rest on the glass floor (stacked loosely, like cubes dropped in), its size, and its tilt. */
const CUBES = [
  { x: -0.17, z: -0.08, y: 0.42, s: 0.34, r: [0.3, 0.5, 0.1] },
  { x: 0.18, z: 0.06, y: 0.41, s: 0.32, r: [-0.2, 0.9, 0.25] },
  { x: -0.02, z: 0.22, y: 0.43, s: 0.36, r: [0.1, 0.2, -0.3] },
  { x: 0.06, z: -0.14, y: 0.72, s: 0.33, r: [0.45, 0.3, 0.2] },
  { x: -0.18, z: 0.1, y: 0.74, s: 0.3, r: [-0.3, 0.7, 0.4] },
  { x: 0.14, z: 0.12, y: 1.0, s: 0.31, r: [0.2, 0.6, -0.4] },
];

export interface Ice {
  group: THREE.Group;
  update(ice: number, fillTop: number, time: number): void;
  dispose(): void;
}

/** Six frosted cubes. They drop in one after another, then float up with the drink as it rises. */
export function createIce(): Ice {
  const geo = new RoundedBoxGeometry(1, 1, 1, 4, 0.14);
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xe3f2f6, transparent: true, opacity: 1, roughness: 0.16, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.12, envMapIntensity: 1.6, depthWrite: false,
  });
  edgeOpacity(mat, 0.22, 2.0, 0.7);
  // opaque milk and matcha hide whatever is under their surface, so the ice is only drawn above it
  const surface = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  mat.clippingPlanes = [surface];
  const group = new THREE.Group();
  const meshes = CUBES.map((c) => {
    const m = new THREE.Mesh(geo, mat);
    m.scale.setScalar(c.s);
    m.renderOrder = 3;
    group.add(m);
    return m;
  });
  return {
    group,
    update(ice, fillTop, time) {
      surface.constant = -fillTop;
      CUBES.forEach((c, i) => {
        const m = meshes[i];
        const e = ramp(ice, i * 0.09, i * 0.09 + 0.5);
        m.visible = e > 0.001;
        const bob = fillTop > c.y + c.s * 0.3 ? Math.sin(time * 0.8 + i * 1.7) * 0.012 : 0;
        m.position.set(c.x, iceHeight(c.y, c.s, fillTop) + (1 - e) * 2.4 + bob, c.z);
        m.rotation.set(c.r[0] + (1 - e) * 1.3, c.r[1] + (1 - e) * 0.9, c.r[2] + (1 - e) * 0.6);
      });
    },
    dispose() { geo.dispose(); mat.dispose(); },
  };
}
