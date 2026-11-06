#!/usr/bin/env node
/* Turns the drink video into the frame sequence the page scrubs as you scroll.

   node scripts/frames.mjs --in docs/source-video/jade-hour.mp4 [--frames 180] [--out public/frames] [--crop-y 0.5] [--quality 78]

   It cuts a 4:5 box out of the video (the stage is portrait), samples `--frames` frames evenly whatever the video's length,
   writes them as WebP at two sizes (desktop and phone), and writes meta.json, including the backdrop colour sampled from the
   frame's corners so the page can match it exactly and show no seam. Needs ffmpeg and ffprobe on the PATH. */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import sharp from "sharp";
import { cropBox } from "../src/scroll/sequence.ts";

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : fallback;
};
if (args.includes("--help") || !opt("in")) {
  console.log("usage: node scripts/frames.mjs --in <video> [--frames 180] [--out public/frames] [--crop-y 0.5] [--quality 78]");
  process.exit(opt("in") ? 0 : 1);
}

const input = resolve(opt("in"));
const out = resolve(opt("out", "public/frames"));
const count = Number(opt("frames", "180"));
const cropY = Number(opt("crop-y", "0.5"));
const quality = Number(opt("quality", "78"));
const ASPECT = [4, 5];
const VARIANTS = [
  { name: "desktop", width: 1080 },
  { name: "phone", width: 720 },
];

const run = (cmd, a) => execFileSync(cmd, a, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const tmp = mkdtempSync(join(tmpdir(), "jade-frames-"));

try {
  const duration = Number(run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", input]).trim());
  if (!(duration > 0)) throw new Error("could not read the video's length");

  // the real picture size after any rotation the file asks for: decode one frame and measure it
  const probe = join(tmp, "probe.png");
  run("ffmpeg", ["-v", "error", "-y", "-i", input, "-frames:v", "1", probe]);
  const meta0 = await sharp(probe).metadata();
  const box = cropBox(meta0.width, meta0.height, ASPECT[0], ASPECT[1], cropY);
  console.log(`video ${meta0.width}x${meta0.height}, ${duration.toFixed(1)} s; cutting a ${box.w}x${box.h} box at y=${box.y}; sampling ${count} frames`);

  const raw = join(tmp, "raw");
  mkdirSync(raw);
  run("ffmpeg", ["-v", "error", "-y", "-i", input, "-vf", `fps=${count / duration},crop=${box.w}:${box.h}:${box.x}:${box.y}`, "-start_number", "1", join(raw, "%04d.png")]);
  const files = readdirSync(raw).filter((f) => f.endsWith(".png")).sort();
  if (files.length < 2) throw new Error("the video produced fewer than 2 frames");

  // the backdrop colour: the average of small patches in the four corners of the first frame
  const first = join(raw, files[0]);
  const patch = Math.max(8, Math.round(box.w * 0.04));
  const corners = [[0, 0], [box.w - patch, 0], [0, box.h - patch], [box.w - patch, box.h - patch]];
  const sums = [0, 0, 0];
  for (const [left, top] of corners) {
    const stats = await sharp(first).extract({ left, top, width: patch, height: patch }).stats();
    stats.channels.slice(0, 3).forEach((c, i) => (sums[i] += c.mean / corners.length));
  }
  const bg = "#" + sums.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");

  const sizes = {};
  for (const v of VARIANTS) {
    const dir = join(out, v.name);
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    const height = Math.round((v.width * ASPECT[1]) / ASPECT[0]);
    let bytes = 0;
    for (let i = 0; i < files.length; i++) {
      const dest = join(dir, `${String(i + 1).padStart(4, "0")}.webp`);
      await sharp(join(raw, files[i])).resize(v.width, height).webp({ quality, effort: 4 }).toFile(dest);
      bytes += statSync(dest).size;
    }
    sizes[v.name] = { w: v.width, h: height, dir: v.name, megabytes: Math.round(bytes / 1e5) / 10 };
    console.log(`${v.name}: ${files.length} frames, ${v.width}x${height}, ${sizes[v.name].megabytes} MB`);
  }

  writeFileSync(join(out, "meta.json"), JSON.stringify({ count: files.length, aspect: ASPECT, bg, ext: "webp", sourceSeconds: Math.round(duration * 10) / 10, desktop: sizes.desktop, phone: sizes.phone }, null, 2) + "\n");
  console.log(`wrote ${join(out, "meta.json")}; backdrop ${bg}`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
