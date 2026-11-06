import * as THREE from "three";
import { CAVITY_FLOOR, GLASS } from "./shapes";

/** A solid of revolution from an outline. */
export function lathe(outline: [number, number][], segments: number): THREE.LatheGeometry {
  return new THREE.LatheGeometry(outline.map(([x, y]) => new THREE.Vector2(x, y)), segments);
}

/** Makes a transparent material see-through face-on and more solid towards its edges, like real glass or ice (a fresnel opacity). */
export function edgeOpacity(mat: THREE.MeshPhysicalMaterial, base: number, power: number, gain: number): void {
  const prior = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, renderer) => {
    prior.call(mat, shader, renderer);
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <opaque_fragment>",
      `diffuseColor.a = clamp(${base.toFixed(3)} + pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewPosition))), ${power.toFixed(2)}) * ${gain.toFixed(3)}, 0.0, 1.0);
       #include <opaque_fragment>`,
    );
  };
}

export interface Glass {
  mesh: THREE.Mesh;
  dispose(): void;
}

/**
 * The tumbler. Real glass is nearly invisible face-on and bright at its edges, so instead of costly refraction this is a
 * see-through material whose opacity grows towards the edges (a fresnel), with sharp reflections of the studio lights and a
 * slightly more solid, faintly green thick base. It is cheap, works the same on every phone, and lets the ice show through.
 */
export function createGlass(sides: number): Glass {
  const geo = lathe(GLASS, sides);
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, metalness: 0, roughness: 0.04, ior: 1.5, specularIntensity: 1, envMapIntensity: 1.25,
    clearcoat: 1, clearcoatRoughness: 0.03, transparent: true, opacity: 1, side: THREE.DoubleSide, depthWrite: false,
  });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uFloor = { value: CAVITY_FLOOR };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying float vGlassY;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvGlassY = position.y;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying float vGlassY;\nuniform float uFloor;")
      .replace(
        "#include <alphamap_fragment>",
        `#include <alphamap_fragment>
         float fres = pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewPosition))), 2.8);
         float a = 0.03 + fres * 0.95;
         if (vGlassY < uFloor) { a = max(a, 0.42); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.80, 0.90, 0.86), 0.55); }
         diffuseColor.a = clamp(a, 0.0, 1.0);`,
      );
  };
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 4; // after the drink and the ice, so it draws over them
  return { mesh, dispose: () => { geo.dispose(); mat.dispose(); } };
}
