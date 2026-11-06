import * as THREE from "three";

export interface Pour {
  mesh: THREE.Mesh;
  update(amount: number, color: THREE.ColorRepresentation, surfaceY: number, time: number): void;
  dispose(): void;
}

const SPOUT_Y = 3.6; // above the top of the picture, so the stream comes from out of frame

/** A ribbon of liquid falling from above into the glass: milk first, then matcha. */
export function createPour(): Pour {
  const geo = new THREE.CylinderGeometry(1.3, 0.75, 1, 24, 1, true);
  const mat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.1, envMapIntensity: 1.1, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  return {
    mesh,
    update(amount, color, surfaceY, time) {
      mesh.visible = amount > 0.01;
      mat.color.set(color);
      const len = Math.max(0.01, SPOUT_Y - surfaceY);
      const r = 0.03 * Math.sqrt(Math.min(1, amount)) * (1 + 0.1 * Math.sin(time * 26));
      mesh.position.set(0.04, surfaceY + len / 2, 0.02);
      mesh.scale.set(r, len, r);
    },
    dispose() { geo.dispose(); mat.dispose(); },
  };
}
