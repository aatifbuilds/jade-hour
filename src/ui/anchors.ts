export interface AnchorHooks {
  /** The scroll position (px) of the start of the chapter with this id, or undefined if there is no such chapter. */
  scrollYFor(id: string): number | undefined;
  /** A button jumped the scroll to a chapter: let the picture and camera glide there slowly. */
  onGlide(id: string): void;
  /** The visitor took over (wheel, touch or key): stop any glide at once. */
  onTakeover(): void;
}

/**
 * Buttons that go to a step (the top links and the step list). The browser's own smooth scroll would fly through the whole recipe in
 * about half a second, so it is not used: the scroll position jumps straight to the step and the picture glides there on a slow
 * spring instead, only the destination's words are shown, and the moment the visitor scrolls, touches or presses a key they are in
 * control again.
 */
export function setupAnchors(hooks: AnchorHooks): void {
  document.addEventListener("click", (e) => {
    const link = (e.target as Element | null)?.closest?.<HTMLAnchorElement>('a[href^="#"]');
    if (!link) return;
    const id = (link.getAttribute("href") ?? "").slice(1);
    const y = hooks.scrollYFor(id);
    if (y === undefined) return; // not one of the steps: leave the browser to handle it
    e.preventDefault();
    window.scrollTo({ top: y, behavior: "instant" });
    hooks.onGlide(id);
  });
  const takeover = (): void => hooks.onTakeover();
  window.addEventListener("wheel", takeover, { passive: true });
  window.addEventListener("touchstart", takeover, { passive: true });
  window.addEventListener("keydown", takeover);
}
