# jade hour

A scroll-driven page for **jade hour, a fictional iced matcha latte café**. It is a design practice build: you scroll, and a glass is filled in front of you, step by step (ice, milk, matcha, a stir, foam, a twist of yuzu), while the camera moves in and out.

jade hour is not a real business. Nothing here is for sale. **The drink video is AI-generated** (Google Veo), from prompts written for this project.

Live: https://aatifbuilds.github.io/jade-hour/

## Run it

```bash
npm install
npm run dev        # dev server
npm run lint       # ESLint
npm run typecheck  # TypeScript
npm test           # unit tests (Vitest)
npm run build      # production build in dist/
```

## How it works

- **The picture** is a video played as a sequence of frames on a canvas that you scrub with the scroll. `scripts/frames.mjs` (`npm run frames -- --in <video>`) cuts the video into WebP frames (a desktop cut and a phone cut, with the watermark corner and edges left out) and samples the backdrop colour. The player loads the frames nearest you first, cross-fades between them, and keeps only a window of frames in memory.
- **The camera** zooms and pulls back through a view per step (`public/frames/story.json`); it can zoom out past the picture because the margin is painted from the picture's corner colours and its edges are baked soft. Pure, unit-tested maths in `src/scroll/`.
- **Scrolling and buttons** (ported from an earlier Apple-inspired build): a critically damped spring smooths the scroll; a click on a step jumps the scroll and the picture glides there slowly; any wheel, touch or key hands control straight back; a step cannot flicker at a boundary.
- **Fallback:** if the frames are missing, a live 3D glass (three.js, drawn in code) is shown instead.
- **Phones:** the picture runs across the top 62% of the screen with the step's words below.

Design notes and the build log are in [`docs/`](docs).

## Credits

Built with [three.js](https://threejs.org), [Vite](https://vite.dev) and the Young Serif and Source Serif 4 typefaces. See [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).
