#!/usr/bin/env node
/* Turns the drink video into the frame sequence the page scrubs as you scroll.

   node scripts/frames.mjs --in docs/source-video/jade-hour.mp4 [--frames 260] [--out public/frames] [--safe 0.12,0.06,0.88,1] [--quality 78] [--sharpen 0.6] [--feather 0.12]

   It keeps only the SAFE region of every frame (default: x 12% to 88%, y 6% to the bottom, centred on the glass), which leaves out the
   corner where the video tool stamps its watermark and the top edge where a hand or a spoon handle can enter. It writes two cuts as WebP
   at their native size, with no enlarging: `desktop` (the whole safe region) and `phone` (a centred 3:4 box of it). It samples --frames
   frames evenly whatever the video's length, applies a light sharpen, and writes meta.json including the backdrop colour sampled from the
   corners of the safe region, so the page can match it exactly. Needs ffmpeg and ffprobe on the PATH. */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import sharp from "sharp";
import { centerBox, edgeAlpha, safeBox } from "../src/scroll/sequence.ts";

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : fallback;
};
if (args.includes("--help") || !opt("in")) {
  console.log("usage: node scripts/frames.mjs --in <video> [--frames 260] [--out public/frames] [--safe 0.12,0.06,0.88,1] [--quality 78] [--sharpen 0.6]");
  process.exit(opt("in") ? 0 : 1);
}

const input = resolve(opt("in"));
const out = resolve(opt("out", "public/frames"));
const count = Number(opt("frames", "260"));
const quality = Number(opt("quality", "78"));
const sharpen = Number(opt("sharpen", "0.6"));
const featherFrac = Number(opt("feather", "0.12")); // the soft edge, as a share of the picture's shorter side (0 for none)
const [left, top, right, bottom] = opt("safe", "0.12,0.06,0.88,1").split(",").map(Number);

const run = (cmd, a) => execFileSync(cmd, a, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const tmp = mkdtempSync(join(tmpdir(), "jade-frames-"));

try {
  const duration = Number(run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", input]).trim());
  if (!(duration > 0)) throw new Error("could not read the video's length");

  // the real picture size after any rotation the file asks for: decode one frame and measure it
  const probe = join(tmp, "probe.png");
  run("ffmpeg", ["-v", "error", "-y", "-i", input, "-frames:v", "1", probe]);
  const m0 = await sharp(probe).metadata();
  const safe = safeBox(m0.width, m0.height, { left, top, right, bottom });
  const boxes = { desktop: safe, phone: centerBox(safe, 3, 4) };
  console.log(`video ${m0.width}x${m0.height}, ${duration.toFixed(1)} s; safe region ${safe.w}x${safe.h} at (${safe.x}, ${safe.y}); sampling ${count} frames`);

  const sizes = {};
  let frameCount = 0;
  let bg = "#ffffff";
  let bgBottom = "#ffffff";
  for (const [name, box] of Object.entries(boxes)) {
    const raw = join(tmp, name);
    mkdirSync(raw);
    const sharpenFilter = sharpen > 0 ? `,unsharp=5:5:${sharpen}:5:5:0` : "";
    run("ffmpeg", ["-v", "error", "-y", "-i", input, "-vf", `fps=${count / duration},crop=${box.w}:${box.h}:${box.x}:${box.y}${sharpenFilter}`, "-start_number", "1", join(raw, "%04d.png")]);
    const files = readdirSync(raw).filter((f) => f.endsWith(".png")).sort();
    if (files.length < 2) throw new Error("the video produced fewer than 2 frames");
    frameCount = files.length;

    // Backdrop colours, sampled from the first frame. (sharp's stats() ignores extract(), so cut each patch out to its own image first.)
    const first = join(raw, files[0]);
    const patchSize = Math.max(8, Math.round(box.w * 0.03));
    const meanAt = async (l, t) => {
      const buf = await sharp(first).extract({ left: l, top: t, width: patchSize, height: patchSize }).toBuffer();
      const st = await sharp(buf).stats();
      return st.channels.slice(0, 3).map((c) => c.mean);
    };
    const hex = (rgb) => "#" + rgb.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
    const L = 0, T = 0, R = box.w - patchSize, B = box.h - patchSize, CX = Math.round((box.w - patchSize) / 2), CY = Math.round((box.h - patchSize) / 2);
    const tl = await meanAt(L, T), tr = await meanAt(R, T), bl = await meanAt(L, B), br = await meanAt(R, B);
    const edges = [tl, tr, bl, br, await meanAt(CX, T), await meanAt(CX, B), await meanAt(L, CY), await meanAt(R, CY)];
    const avg = [0, 1, 2].map((i) => edges.reduce((a, c) => a + c[i], 0) / edges.length);
    const corners = { tl: hex(tl), tr: hex(tr), bl: hex(bl), br: hex(br) };
    if (name === "desktop") bg = hex(avg);
    if (name === "phone") bgBottom = hex(await meanAt(L, B)); // bottom-left, clear of the glass's shadow: the text area below the phone picture continues this colour

    const dir = join(out, name);
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    let bytes = 0;
    // the soft edge: an alpha mask the same for every frame, so the picture melts into the page colour when the camera pulls back
    const feather = Math.round(featherFrac * Math.min(box.w, box.h));
    const mask = Buffer.alloc(box.w * box.h);
    for (let y = 0; y < box.h; y++) for (let x = 0; x < box.w; x++) mask[y * box.w + x] = Math.round(255 * edgeAlpha(x, y, box.w, box.h, feather));
    for (let i = 0; i < files.length; i++) {
      const dest = join(dir, `${String(i + 1).padStart(4, "0")}.webp`);
      const rgb = await sharp(join(raw, files[i])).removeAlpha().toBuffer();
      await sharp(rgb).joinChannel(mask, { raw: { width: box.w, height: box.h, channels: 1 } }).webp({ quality, alphaQuality: 85, effort: 4 }).toFile(dest);
      bytes += statSync(dest).size;
    }
    sizes[name] = { w: box.w, h: box.h, dir: name, corners, megabytes: Math.round(bytes / 1e5) / 10 };
    console.log(`${name}: ${files.length} frames, ${box.w}x${box.h}, ${sizes[name].megabytes} MB`);
    rmSync(raw, { recursive: true, force: true });
  }

  writeFileSync(join(out, "meta.json"), JSON.stringify({ count: frameCount, bg, bgBottom, ext: "webp", sourceSeconds: Math.round(duration * 10) / 10, desktop: sizes.desktop, phone: sizes.phone }, null, 2) + "\n");
  console.log(`wrote ${join(out, "meta.json")}; backdrop ${bg}`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
