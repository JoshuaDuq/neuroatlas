// Scroll helpers moved out of viewer/ui/panels/clinical.js:9-15 and 76-95 so the evidence panels share them.

/** An opened profile starts at its top, not wherever the list or the last profile was scrolled. */
export function scrollToTop(node: Element): void {
  for (let parent = node.parentElement; parent; parent = parent.parentElement) {
    if (/(auto|scroll)/.test(getComputedStyle(parent).overflowY)) parent.scrollTop = 0;
  }
}

/** A region opened from a profile is detailed below the profile: brought into view, its name takes focus. */
export function showOpenedRegion(regionName: HTMLElement | null): void {
  if (!regionName || regionName.hidden) return;
  regionName.tabIndex = -1;
  regionName.scrollIntoView({ block: 'start' });
  regionName.focus({ preventScroll: true });
}
