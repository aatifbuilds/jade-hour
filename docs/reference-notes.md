# Reference notes: how a real iced matcha latte looks (study only)

Studied 6 Nov 2026 from five open-licence photos kept only in git-ignored `docs/reference/matcha/` (credits in `CREDITS.txt` there): two layered iced matcha lattes, a tall tapered matcha glass with condensation, ice cubes in a glass, a pile of yuzu. **Nothing from them ships in the page**; these notes are our own words, and they drive what we model and shade.

## Glass
- A straight tumbler, slightly tapered, with a **thick, heavy clear base** (the bottom 1 to 2 cm is solid glass that bends what you see through it).
- Walls are almost colourless. The glass reads through **a thin bright line along the rim**, a long vertical window reflection down one side, and a darker edge where the wall turns away.
- Cold glass sometimes carries tiny **condensation droplets** (an optional detail: a fine droplet normal map).

## Milk and matcha (the layers)
- Milk is an opaque warm white with a slight translucency at the edges.
- Matcha sits **on top of** the milk (poured in last), deep jade at the body and noticeably **lighter, yellower green in the foam** at the top.
- The boundary is **not a clean line**: it is feathered with wispy, marbled streaks of green reaching down into the white and white climbing into the green. Another style shows a **smooth ombre** (green fading into white over a few centimetres). Our shader should do the feathered streaks first, with `blend` (0 = layers, 1 = fully mixed) moving it toward the smooth ombre.

## Foam
- A thin layer, a centimetre or so, lighter than the drink beneath, with a fine bubbly texture and a slightly domed, uneven top. It sits just below the rim, and ice pokes through it.

## Ice
- Cubes are **irregular, not perfect**: rounded corners, milky frosted faces, clear edges that catch light, internal cracks. They sit partly submerged and lean against the glass. Our rounded boxes need small random tilts and slightly different sizes, with a frosted (rougher) transmission material.

## Yuzu
- A **pitted, bumpy peel** (a fine pebbly texture), creased lobes toward the stem, colour **yellow with green patches**, waxy rather than shiny. The garnish twist should use a pitted normal map and a yellow-to-green tint, with a soft highlight, not a hard gloss.

## Takeaways for the build
1. Glass: thick base, thin rim highlight, a tall window reflection (our strip-light studio gives this).
2. Liquids: feathered marbling at the boundary, lighter yellow-green at the foam; milk opaque, matcha slightly translucent.
3. Ice: irregular, frosted, partly submerged.
4. Yuzu: pitted peel, yellow-green.
5. Keep the cream ground (`#ecebe7`): all the photos are warm, so a flat bone background will sit well with them.
