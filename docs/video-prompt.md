# Brief for Google Flow: the jade hour drink video

Made for the owner to use in **Google Flow (Veo)**. Our own words, not the reel's. Button names in Flow change over time: look for "text to video", "start from an image / frames to video" and "extend".

## What we need
One smooth, **continuous take** (no cuts, no camera movement) of an iced matcha latte building itself in a tall glass, **about 40 seconds**, made from five clips of about 8 seconds joined end to end. The page scrubs it as you scroll, so the picture must be steady and the *only* thing that changes is the drink.

## Settings
- **Portrait 9:16**, the highest resolution available (1080p or better). **No audio** needed.
- Every clip is meant to look like the same shoot: same glass, same light, same camera, same backdrop.
- **The ribbed glass is the hardest detail to keep identical between clips** (the number or spacing of the ribs can drift). If it does, make the ribs fewer and bolder ("about 12 wide ribs"), or use a plain glass with only the flared rim and heavy base. Consistency matters more than detail.
- Keep the glass in the **middle of the frame**, about 60% of the frame's height, with empty space above it for the pours. The page crops the video to 4:5 (it trims about 15% of the height at the top and bottom), so nothing important may touch the top or bottom edge.

## The master description (paste this at the start of EVERY clip prompt)
> A locked-off, perfectly static camera, slightly above eye level, looking at a tall fluted glass tumbler of the kind specialist matcha cafés use: fine, evenly spaced vertical ribs running the full height of the glass (about 24 ribs around it), a slightly flared rim, and a thick heavy solid glass base. The ribs catch the window light as soft vertical lines, and whatever is inside shows through them gently distorted. The glass stands in the centre of the frame on a seamless pale warm-grey surface and backdrop (soft stone grey, almost no gradient). Soft diffused window light from the left, a thin cool rim light on the right edge of the glass. Realistic product photography, macro-quality detail, sharp focus on the glass, true-to-life liquids and ice, natural reflections. No people, no hands, no text, no logos, no other objects, no camera movement, no zoom, no cuts.

## The five clips (add each one after the master description)

**Clip 1: glass and ice (about 8 s).**
> The glass is empty and perfectly still for two seconds. Then six clear ice cubes of slightly different sizes fall into the glass one after another from above the frame, clinking softly, and settle leaning against each other at the bottom. Everything is still at the end.

**Clip 2: milk (about 8 s).** Start from the last frame of clip 1.
> A thin, smooth stream of cold white milk pours from above the top of the frame into the glass. The milk rises slowly through the ice until the glass is about half full, and the ice cubes lift and float. The stream stops and the milk settles perfectly still.

**Clip 3: matcha (about 8 s).** Start from the last frame of clip 2.
> A thin stream of bright jade-green matcha pours from above the top of the frame onto the white milk. The green sinks and drifts down into the milk in slow marbled tendrils and feathered streaks, with a clear green layer building at the top. The stream stops. The two colours are still visibly layered.

**Clip 4: blend (about 8 s).** Start from the last frame of clip 3.
> A long metal bar spoon descends into the glass from above the frame (no hand visible), makes one slow stir, and lifts out of frame. The green and white swirl together and soften into one creamy pale jade colour. The liquid settles perfectly still.

**Clip 5: foam, yuzu and finish (about 8 s).** Start from the last frame of clip 4.
> A light, fine-bubbled cap of pale green foam forms on top of the drink. A curl of yellow yuzu citrus peel drops from above the frame onto the foam and settles. Fine drops of condensation appear on the outside of the glass. The final two seconds are completely still.

## Negative prompt (if Flow asks for one)
> people, hands, face, text, letters, logo, watermark, extra glasses, straw, camera movement, zoom, pan, shaky camera, lens flare, bokeh background, dramatic lighting, colour grading, cartoon, illustration, 3D render, plastic, blurry, distorted glass, floating objects, cut, transition

## Tips
- **Fix the glass first.** If Flow can make a still image, generate one of the empty fluted glass on the backdrop until you love it, and use that image as the starting frame of Clip 1. Every later clip then inherits the exact same glass.
- **Chain the clips** so the glass does not change shape: for clips 2 to 5, start from the **last frame of the previous clip** ("frames to video" / "start from an image") and keep the master description exactly the same.
- Make several takes of each clip and pick the cleanest. Throw away any take where the glass shape, size or position changes, the liquid does something impossible (flows uphill, appears from nowhere), the camera moves, or something flickers.
- If a pour or stir looks wrong, regenerate just that clip; clips before and after it still join.
- Stitch the five clips in any editor (even the Photos app, QuickTime or CapCut) with **no transitions**, and export as MP4.

## Hand-over
Save the stitched video as `~/Builder-HQ/Launchpad/matcha-page/docs/source-video/jade-hour.mp4` (that folder is git-ignored) and tell me. I run:

```
npm run frames -- --in docs/source-video/jade-hour.mp4
```

which cuts it into frames, samples the backdrop colour, and turns the page into the video version. Then I tune which part of the video each scroll step shows.

Where the page uses the video, it uses only this video. If a clip is not good enough, tell me what looks wrong and I will rewrite that clip's prompt.
