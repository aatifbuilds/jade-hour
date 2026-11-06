# PRD: matcha-page (fictional brand: **jade hour**)

**Problem / why:** the owner is a PM learning to build. A saved reel showed a matcha latte building itself on scroll. This build practises scroll-driven 3D, glass and liquids, editorial layout and typography.

**What it is:** a single scroll page. A tall glass sits centre stage on a cream ground. As you scroll, the drink assembles in seven steps: empty glass, ice, milk, matcha pour, blend, foam, yuzu twist (final pour). A serif step index on the left highlights the current step, and each step has a short title and one line of copy. Clicking a step glides there.

**Must have:** live 3D glass with real see-through refraction; milk and matcha liquids that mix; ice, foam and a yuzu twist; smooth scroll (springs, no jerk, buttons glide not rush); a phone layout; a static fallback page (reduced motion or no WebGL); no third-party assets.
**Not now:** photo-real rendering, a shop or checkout, sound, accounts, anything public.

**Done when:** all seven steps read clearly on desktop and phone in Chromium and Safari's engine, lint/typecheck/tests/build pass, frame time is inside budget, and the owner has looked at it. Going public is a separate decision.
