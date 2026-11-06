# Project: matcha-page (a fictional matcha latte that builds itself as you scroll; a design practice build)

## Goal
Learn web design and 3D by building a scroll-driven page where a matcha latte is assembled ingredient by ingredient
(inspired by a saved reel, ref 10, kept in Launchpad/reel-goblin/data/references/, analysis only). Live 3D in code
(three.js), our own art. Reuses the engine built for Launchpad/bottle-page (RILL).

## Hard rules
- **Private for now.** Never push to GitHub or publish anything without the owner's explicit OK (the owner said "public later", they will say when).
- **No third-party assets.** The reel's frames, video, text and artwork are never copied into `src/` or `public/`. Reference stills live only in git-ignored `docs/reference/`. All copy, art and brand names are original and fictional.
- **Free tools only:** three.js, Motion, Vite, Vitest, ESLint (MIT). Fonts self-hosted through `@fontsource/*` (no external requests).
- Secrets go in `.env.local` only (there are none). `.env*` stays in `.gitignore`.
- Add `.playwright-cli/`, `.taste-skill/`, `.impeccable/` to `.gitignore` (done).

## Layout
- `src/scene/` glass, drink, ice, pour, foam, yuzu, studio lights (three.js)
- `src/scroll/` pure scroll-to-camera and drink-state maths (unit tested)
- `src/ui/` index, text overlays, anchors. `src/styles/` tokens and layout CSS
- `docs/` PRD.md, plan.md, design.md, direction-sheet.md, reference/ (git-ignored)

## Commands
`npm run dev` · `npm run lint` · `npm run typecheck` · `npm test` · `npm run build` · `npm run preview`
Before saying "done": run lint, typecheck, test and build, and report what passed.

## Skills and order
design-taste-frontend then ui-ux-pro-max (direction), animate and apple-design (build), animation-performance,
impeccable and emil-design-eng (polish), break-ui and mobile-native (stress test), playwright-cli (look).
Never imitate `/review-animations`: tell the owner to run it.
