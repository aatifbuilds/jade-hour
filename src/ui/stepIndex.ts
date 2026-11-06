export interface StepIndex {
  setActive(id: string): void;
}

/**
 * The vertical list of steps down the left side. The current step is in full ink, the others softer; clicking one asks the page to go
 * there (the page's shared button handler does that: these are plain `#step` links). It is a real list of real links (so it works with the keyboard and a screen reader), and the current step is marked with
 * `aria-current`. Steps are named, not numbered.
 */
export function createStepIndex(root: HTMLElement, steps: { id: string; label: string }[]): StepIndex {
  const ul = document.createElement("ul");
  const links = new Map<string, HTMLAnchorElement>();
  for (const s of steps) {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = `#${s.id}`;
    a.textContent = s.label;
    li.append(a);
    ul.append(li);
    links.set(s.id, a);
  }
  root.append(ul);
  let current = "";
  return {
    setActive(id) {
      if (id === current) return;
      current = id;
      for (const [k, a] of links) {
        if (k === id) a.setAttribute("aria-current", "step");
        else a.removeAttribute("aria-current");
      }
    },
  };
}
