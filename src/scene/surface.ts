/* Pure maths for the bottle's surface maps (no canvas, no three.js), so it can be unit tested.
   Maps wrap once around the bottle in x (u) and run bottom to top in y (v). Row 0 of an array is the TOP (v = 1),
   because a canvas texture is flipped when uploaded. */

/** Deterministic random numbers (mulberry32), so the finish looks identical on every load. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Smooth random blobs, `cells` of them across, repeating seamlessly in both directions. Values 0..1. */
export function valueNoise(size: number, cells: number, rand: () => number): Float32Array {
  const grid = new Float32Array(cells * cells);
  for (let i = 0; i < grid.length; i++) grid[i] = rand();
  const i0 = new Int32Array(size);
  const i1 = new Int32Array(size);
  const fr = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    const t = (i * cells) / size;
    const f0 = Math.floor(t);
    const f = t - f0;
    i0[i] = f0 % cells;
    i1[i] = (f0 + 1) % cells;
    fr[i] = f * f * (3 - 2 * f); // smoothstep, so there are no creases at the cell edges
  }
  const out = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    const ra = i0[y] * cells;
    const rb = i1[y] * cells;
    const fy = fr[y];
    for (let x = 0; x < size; x++) {
      const fx = fr[x];
      const top = grid[ra + i0[x]] * (1 - fx) + grid[ra + i1[x]] * fx;
      const bot = grid[rb + i0[x]] * (1 - fx) + grid[rb + i1[x]] * fx;
      out[y * size + x] = top * (1 - fy) + bot * fy;
    }
  }
  return out;
}

/** Several sizes of noise added together (coarse to fine), as [cells across, weight]. Result 0..1. */
export function fbm(size: number, seed: number, octaves: [number, number][]): Float32Array {
  const rand = rng(seed);
  const out = new Float32Array(size * size);
  let total = 0;
  for (const [cells, weight] of octaves) {
    const n = valueNoise(size, cells, rand);
    for (let i = 0; i < out.length; i++) out[i] += n[i] * weight;
    total += weight;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

/** Blurs a w x h array with a box of the given radius, wrapping left-right and clamping top-bottom. */
export function boxBlur(src: Float32Array, w: number, h: number, radius: number): Float32Array {
  if (radius <= 0) return src.slice();
  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  const k = 2 * radius + 1;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let d = -radius; d <= radius; d++) s += src[row + ((x + d + w * 4) % w)];
      tmp[row + x] = s / k;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let d = -radius; d <= radius; d++) s += tmp[Math.min(h - 1, Math.max(0, y + d)) * w + x];
      out[y * w + x] = s / k;
    }
  }
  return out;
}

/**
 * Turns a height map into a tangent-space normal map (RGBA bytes): flat ground is (128, 128, 255), and slopes tilt
 * the colour, which tells the lighting which way each tiny patch faces. `strength` scales how steep the slopes look.
 */
export function heightToNormal(height: Float32Array, w: number, h: number, strength: number): Uint8ClampedArray<ArrayBuffer> {
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    const yu = Math.max(0, y - 1);
    const yd = Math.min(h - 1, y + 1);
    for (let x = 0; x < w; x++) {
      const xl = (x - 1 + w) % w;
      const xr = (x + 1) % w;
      const dx = (height[y * w + xr] - height[y * w + xl]) * strength;
      const dy = (height[yd * w + x] - height[yu * w + x]) * strength; // down the canvas is down the bottle
      const nx = -dx;
      const ny = dy;
      const inv = 1 / Math.hypot(nx, ny, 1);
      const o = (y * w + x) * 4;
      out[o] = (nx * inv * 0.5 + 0.5) * 255;
      out[o + 1] = (ny * inv * 0.5 + 0.5) * 255;
      out[o + 2] = (inv * 0.5 + 0.5) * 255;
      out[o + 3] = 255;
    }
  }
  return out;
}

/** Vertical grip ridges: `count` of them around the width, present only between v = from and v = to, fading at both ends. */
export function ridgeHeight(w: number, h: number, count: number, from: number, to: number, fade: number): Float32Array {
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const v = 1 - (y + 0.5) / h;
    const edge = Math.min((v - from) / fade, (to - v) / fade);
    const gate = Math.max(0, Math.min(1, edge));
    for (let x = 0; x < w; x++) out[y * w + x] = gate * (0.5 + 0.5 * Math.cos((2 * Math.PI * count * (x + 0.5)) / w));
  }
  return out;
}

/**
 * How much ambient light reaches the body at height v (0 at the base, 1 at the neck's top edge): 1 is fully lit.
 * The crease where the foot tucks under the body and the neck that runs into the cap are darker, as in real life.
 */
export function aoAt(v: number): number {
  const step = (a: number, b: number, t: number): number => {
    const x = Math.max(0, Math.min(1, (t - a) / (b - a)));
    return x * x * (3 - 2 * x);
  };
  const foot = 0.55 + 0.45 * step(0, 0.035, v);
  const neck = 0.45 + 0.55 * (1 - step(0.955, 1, v));
  return Math.min(foot, neck);
}
