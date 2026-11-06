import * as THREE from "three";
import { lathe } from "./glass";
import { LIQUID, LIQUID_FLOOR, innerRadiusAt } from "./shapes";

export interface LiquidParams {
  fillTop: number; // height of the drink's surface
  milkTop: number; // height where milk ends and matcha begins
  matcha: number; // 0..1 how much matcha has been poured (so the green is hidden until it arrives)
  blend: number; // 0 layered streaks, 1 fully mixed
}

export interface Liquid {
  group: THREE.Group;
  update(p: LiquidParams): void;
  dispose(): void;
}

const MILK = new THREE.Color(0xf6f2e8);
const MATCHA_DEEP = new THREE.Color(0x3c7a2a);
const MATCHA_TOP = new THREE.Color(0x9cc04a);
const JADE_LIGHT = new THREE.Color(0xa6cf6e);
const JADE_DEEP = new THREE.Color(0x5f9b3c);

const NOISE = /* glsl */ `
float hash31(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vnoise(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash31(i), hash31(i + vec3(1,0,0)), f.x), mix(hash31(i + vec3(0,1,0)), hash31(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash31(i + vec3(0,0,1)), hash31(i + vec3(1,0,1)), f.x), mix(hash31(i + vec3(0,1,1)), hash31(i + vec3(1,1,1)), f.x), f.y), f.z);
}`;

/**
 * The drink: one body of liquid that a shader cuts off at the current level and colours as milk below and matcha above a
 * feathered, marbled boundary (as in a real layered latte); `blend` pulls the streaks together into a soft jade.
 * A flat disc sits on the surface and takes the surface colour.
 */
export function createLiquid(sides: number): Liquid {
  const geo = lathe(LIQUID, sides);
  const u = {
    uFill: { value: LIQUID_FLOOR }, uMilkTop: { value: LIQUID_FLOOR }, uBlend: { value: 0 }, uMatcha: { value: 0 },
    uMilk: { value: MILK }, uDeep: { value: MATCHA_DEEP }, uTop: { value: MATCHA_TOP }, uJadeLight: { value: JADE_LIGHT }, uJadeDeep: { value: JADE_DEEP },
  };
  const mat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.62, metalness: 0, clearcoat: 0, envMapIntensity: 0.55, side: THREE.DoubleSide });
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vPos;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvPos = position;");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
         varying vec3 vPos;
         uniform float uFill, uMilkTop, uBlend, uMatcha;
         uniform vec3 uMilk, uDeep, uTop, uJadeLight, uJadeDeep;
         ${NOISE}`,
      )
      .replace("#include <clipping_planes_fragment>", "#include <clipping_planes_fragment>\nif (vPos.y > uFill) discard;")
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
         {
           // a feathered, marbled boundary: the coordinates are warped by noise, then stretched tall so matcha hangs down in streaks
           vec3 q = vPos * vec3(2.6, 1.3, 2.6);
           vec3 warp = vec3(vnoise(q * 1.7 + 3.1), vnoise(q * 1.7 + 7.7), vnoise(q * 1.7 + 11.3)) - 0.5;
           vec3 r = vPos + warp * 0.55;
           float n1 = vnoise(vec3(r.x * 3.0, r.y * 1.4, r.z * 3.0));
           float n2 = vnoise(vec3(r.x * 8.0, r.y * 0.7, r.z * 8.0));
           float n3 = vnoise(vec3(r.x * 15.0, r.y * 2.4, r.z * 15.0));
           float edge = uMilkTop + (n1 - 0.5) * 0.34 + (n2 - 0.5) * 0.26 + (n3 - 0.5) * 0.08 - uBlend * 0.4;
           float w = 0.03 + 0.24 * uBlend;
           float t = smoothstep(edge - w, edge + w, vPos.y) * smoothstep(0.0, 0.06, uMatcha);
           float depth = clamp((uFill - vPos.y) / 0.32, 0.0, 1.0); // deeper under the surface = darker green
           vec3 green = mix(uTop, uDeep, depth);
           vec3 col = mix(uMilk, green, t);
           float h = clamp((vPos.y - ${LIQUID_FLOOR.toFixed(3)}) / max(uFill - ${LIQUID_FLOOR.toFixed(3)}, 0.01), 0.0, 1.0);
           vec3 jade = mix(uJadeDeep, uJadeLight, 1.0 - h * 0.7) + (n1 - 0.5) * 0.08;
           float mixAmt = smoothstep(0.0, 1.0, uBlend) * smoothstep(0.0, 0.06, uMatcha);
           diffuseColor.rgb = mix(col, jade, mixAmt);
         }`,
      );
  };
  const body = new THREE.Mesh(geo, mat);

  const topGeo = new THREE.CircleGeometry(1, sides);
  topGeo.rotateX(-Math.PI / 2);
  const topMat = new THREE.MeshPhysicalMaterial({ color: MILK, roughness: 0.6, clearcoat: 0, envMapIntensity: 0.55 });
  const top = new THREE.Mesh(topGeo, topMat);

  const group = new THREE.Group();
  group.add(body, top);
  const tmp = new THREE.Color();

  return {
    group,
    update(p) {
      u.uFill.value = p.fillTop;
      u.uMilkTop.value = p.milkTop;
      u.uBlend.value = p.blend;
      u.uMatcha.value = p.matcha;
      top.position.y = p.fillTop;
      top.scale.setScalar(Math.max(0.001, innerRadiusAt(p.fillTop) - 0.004));
      // the surface: milk white, turning bright green as matcha arrives, then jade as it is mixed
      const green = tmp.copy(MATCHA_TOP).lerp(JADE_LIGHT, p.blend);
      topMat.color.copy(MILK).lerp(green, Math.min(1, p.matcha * 3));
      group.visible = p.fillTop > LIQUID_FLOOR + 0.002;
    },
    dispose() { geo.dispose(); topGeo.dispose(); mat.dispose(); topMat.dispose(); },
  };
}
