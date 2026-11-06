# Plan: matcha-page (approved 6 Nov 2026)

- **Phase 0 setup:** toolchain, rules, docs. DONE when lint, typecheck, test and build pass on the placeholder.
- **Phase 1 direction (DONE 6 Nov 2026, name: jade hour; online pictures are reference only, nothing third-party ships):** design-taste-frontend then ui-ux-pro-max. Editorial café look: cream ground, high-contrast serif, soft greens, step index at the left. 3 fictional brand names for the owner to pick. Output: docs/direction-sheet.md.
- **Phase 2 glass and drink in 3D (owner gate):** filleted tumbler with transmission, liquid shader (milk/matcha bands, `blend`), rounded ice cubes, pour stream, foam, yuzu twist, strip-light studio.
- **Phase 3 scroll story:** copy and adapt the RILL engine (timeline, springs, chapters, anchors, overlays, quality, static fallback). Drink channels: ice, milk, matcha, blend, foam, yuzu. Seven chapters, a left step index (compact counter on phones).
- **Phase 4 polish and stress test:** impeccable, emil-design-eng, break-ui, mobile-native, animation-performance; the owner runs /review-animations.
- **Public:** only on the owner's explicit OK.

## Change of method (6 Nov 2026): realistic drink from a scroll-scrubbed video
Owner: the 3D drink "looks like a kid drew it" next to the reference reel. Live 3D cannot match AI-generated video realism. **Decision: scroll-scrubbed video made by the owner in Google Flow/Veo** (same method as the reel). The 3D drink stays as an automatic fallback (no frames present, reduced motion, load failure).
- **Step 1 (no video needed):** `docs/video-prompt.md` (our original brief for Flow), `scripts/frames.mjs` (video to WebP frames via ffmpeg + `meta.json` with the sampled backdrop colour), pure maths with tests (`src/scroll/sequence.ts`: frame blend, nearest-first loading, cover fit; `src/scroll/beats.ts`: scroll-to-video-time map per chapter), the player `src/scene/sequence.ts`, `main.ts` picks player or 3D. Proven end to end with a synthetic test video that is deleted afterwards.
- **Step 2 (real video arrives):** run frames.mjs, tune beats, match colours, check the phone crop, revise the prompt if a segment drifts.
- **Step 3:** RILL scroll engine, step index, phone layout, static fallback, polish, stress test.

## Full-bleed stage and scroll zoom (7 Nov 2026): DONE
Frames cut to the safe region; camera maths with views in `story.json`; full-bleed layout with the hero name, a step list and a fixed text layer. 96 tests. NEXT: loading state, reduced-motion still, polish and stress test, then the owner decides about going public.

## Published (7 Nov 2026)
Public repo `aatifbuilds/jade-hour`; live at https://aatifbuilds.github.io/jade-hour/ (GitHub Pages via Actions, noindex). Footage disclosed as AI-generated on the page and in the README. NEXT: loading state, reduced-motion fallback, polish pass.
