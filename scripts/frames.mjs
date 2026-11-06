#!/usr/bin/env node
/* Turns the drink video into the frame sequence the page scrubs as you scroll.

   node scripts/frames.mjs --in docs/source-video/jade-hour.mp4 [--frames 260] [--out public/frames] [--safe 0.12,0.06,0.88,1] [--quality 78] [--sharpen 0.6]

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
import { centerBox, safeBox } from "../src/scroll/sequence.ts";

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

    if (name === "desktop") {
      // the backdrop colour: the average of small patches in the four corners of the first (safe) frame
      const patch = Math.max(8, Math.round(box.w * 0.03));
      const corners = [[0, 0], [box.w - patch, 0], [0, box.h - patch], [box.w - patch, box.h - patch]];
      const sums = [0, 0, 0];
      for (const [l, t] of corners) {
        const stats = await sharp(join(raw, files[0])).extract({ left: l, top: t, width: patch, height: patch }).stats();
        stats.channels.slice(0, 3).forEach((c, i) => (sums[i] += c.mean / corners.length));
      }
      bg = "#" + sums.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
    }

    if (name === "phone") {
      // the phone cut sits above a text area: sample its bottom-left patch (clear of the glass's shadow) so that area can continue it
      const patch = Math.max(8, Math.round(box.w * 0.04));
      const st = await sharp(join(raw, files[0])).extract({ left: 0, top: box.h - patch, width: patch, height: patch }).stats();
      bgBottom = "#" + st.channels.slice(0, 3).map((c) => Math.round(c.mean).toString(16).padStart(2, "0")).join("");
    }

    const dir = join(out, name);
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    let bytes = 0;
    for (let i = 0; i < files.length; i++) {
      const dest = join(dir, `${String(i + 1).padStart(4, "0")}.webp`);
      await sharp(join(raw, files[i])).webp({ quality, effort: 4 }).toFile(dest);
      bytes += statSync(dest).size;
    }
    sizes[name] = { w: box.w, h: box.h, dir: name, megabytes: Math.round(bytes / 1e5) / 10 };
    console.log(`${name}: ${files.length} frames, ${box.w}x${box.h}, ${sizes[name].megabytes} MB`);
    rmSync(raw, { recursive: true, force: true });
  }

  writeFileSync(join(out, "meta.json"), JSON.stringify({ count: frameCount, bg, bgBottom, ext: "webp", sourceSeconds: Math.round(duration * 10) / 10, desktop: sizes.desktop, phone: sizes.phone }, null, 2) + "\n");
  console.log(`wrote ${join(out, "meta.json")}; backdrop ${bg}`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
