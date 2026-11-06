# Direction sheet: matcha-page (Phase 1, for the owner's approval)

Dealt with `design-taste-frontend` (seed 1004672085, 6 Nov 2026, sector physical-product, tone editorial). Three directions were dealt (sentence-as-layout, split-stage, name-as-monument). **Chosen: split-stage**: half the screen never moves, so the live 3D glass stays pinned while a calm column of steps scrolls beside it. The other two compete with the glass for attention.

## The idea
On this page, **the drink's own build order (ice, milk, matcha, blend, foam, yuzu, final pour)** becomes **the scroll itself and the step list in the reading column**: the recipe is the navigation, and the glass is always in view while you read it.
Competitor test: a matcha café's page that lists "our drinks" fails this sentence; only a page whose scroll *is* the recipe passes.
**The one live thing:** scroll (or tap a step) and the glass is built or unbuilt in front of you, in both directions.

## Name: **jade hour** (chosen by the owner, 6 Nov 2026; fictional, not trademark-checked, for a practice build only). Options that were offered:
1. **jade hour** (recommended): the afternoon hour for a green drink. Nine characters, fits the monument-size wordmark on one line.
2. **seven pours**: counts the steps (ice, milk, matcha, blend, foam, yuzu, final pour).
3. **still green**: the colour of the drink after it settles.

## Look
- **Type:** Young Serif (display, one heavy round cut) over Source Serif 4 (text). Both self-hosted with `@fontsource` (installed). Display tracking -0.02em, leading 0.95; the name -0.04em, lowercase, up to clamp 9rem. Body 18-21px, leading 1.55. Five sizes at most.
- **Colour (olive on bone):** `--bg #ecebe7` · `--surface #e1dfd9` · `--ink #38450f` · `--muted #5d683a` · field `#38450f` with bone text for the footer. The drink supplies the only other colours (matcha green `#8fae4a`, milk `#f4f1e8`, yuzu yellow), as light and liquid, never as UI colour or text.
  Contrast checked: ink on bone 8.7:1, muted on bone 5.0:1, ink on surface 7.8:1, muted on surface 4.5:1 (all pass AA for text); matcha green is graphic-only (1.9:1, so never text).
- **Layout (desktop):** two columns, 47% / 53%. Left: the pinned stage, inset 20px, a flat `--surface` field with the live 3D glass centred. Right: the scrolling column in one 46ch measure. Name huge at the top, one supporting sentence, then the steps. One button shape (square), one pair of margins.
- **Phone:** the stage becomes a 58svh panel at the top that stays pinned behind the first sections; the step list becomes a compact "step name" line on the stage; the nav collapses to a menu word plus the Order button (the mock's overflowing nav row is a mock flaw).
- **The reading column changes from section to section** (a list, a large figure, a letter, a full-colour olive panel) and one section breaks the split and runs full width, so it never feels like the same split repeated.

## Sections (our content, the dealt blueprints as geometry)
1. **Hero:** the name, one sentence ("An iced matcha latte, built in front of you, one pour at a time."), one action (Order, a placeholder, no checkout).
2. **How it comes together (itinerary on a slip):** the seven steps printed as a paper slip with dotted leaders and a time per step; the active step in full ink, the others in muted ink (all readable). No step numbers (house rule); order is shown by position.
3. **Showcase (square plate):** the finished glass as the plate, with three variants as plain text tabs (classic, oat, extra yuzu).
4. **Letter (founder's letter):** short first-person note from the fictional café.
5. **Closing (full-bleed):** the finished glass large, one closing line, one button.
6. **Footer (photo half, menu half):** a close crop of the glass on one half, the menu set large on the other half, the name returning small.

## Pictures
**Decided by the owner (6 Nov 2026):** online pictures are for **reference and inspiration only**. The page itself ships **no found or third-party pictures**: the hero object is the live 3D glass (our own art), and the rest is type, flat colour and our own drawings. This is a deliberate exception to the design skill's "four or more real pictures" floor; the inspector will flag it and we accept that.
Reference photos (iced matcha lattes, ice in glass, yuzu) are kept only in git-ignored `docs/reference/matcha/` with their credits; what they taught us is in `docs/reference-notes.md`. The dealt "Architecture" photographs are not used.

## Motion
The signature move: the big name scales down a few percent as the first screen leaves (under 8% travel, scroll-linked). Everything else is the glass itself responding to scroll (RILL's pose springs), with small staggered entrances for the column and press/hover feedback on controls; transform and opacity only; reduced motion keeps content and drops travel.

## Files in this phase
`docs/mock/mock.html` (a static mock, drawing standing in for the 3D glass; screenshots in `.playwright-cli/shots/`, git-ignored), fonts installed, `.taste-skill/direction.json` (git-ignored).
