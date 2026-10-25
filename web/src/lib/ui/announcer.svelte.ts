/**
 * The page's one polite live region. It is in the initial HTML, before the app mounts
 * (decision 18 on #4); `attachAnnouncer` takes it over.
 *
 * Two timings stay distinct, as in the legacy viewer:
 * - `announce` writes at once (main.js:47, app.js:88, panels/navigator.js:192);
 * - `createDebouncedAnnouncer` waits for typing to pause, 500 ms, and says only what is new
 *   (ui/announce.js), so a screen reader does not hear a count per keystroke.
 */
const DEBOUNCE_MS = 500;

/**
 * A live region speaks when its content changes. Writing the sentence it already holds
 * changes nothing, so a repeat is cleared first and written after this gap.
 */
const REPEAT_GAP_MS = 100;

let region: HTMLElement | null = null;
let repeatTimer: ReturnType<typeof setTimeout> | undefined;

/** Uses `element` as the live region. Returns the function that releases it. */
export function attachAnnouncer(element: HTMLElement): () => void {
  region = element;
  return () => {
    clearTimeout(repeatTimer);
    if (region === element) region = null;
  };
}

/** Says `text` now. The same sentence again is cleared, then set, so it is spoken again. */
export function announce(text: string): void {
  if (!region) throw new Error('announce() called before attachAnnouncer()');
  clearTimeout(repeatTimer);
  if (region.textContent === text && text !== '') {
    const target = region;
    target.textContent = '';
    repeatTimer = setTimeout(() => {
      target.textContent = text;
    }, REPEAT_GAP_MS);
    return;
  }
  region.textContent = text;
}

/**
 * Says the latest text once calls pause for `delay` ms, and only when it differs from the
 * last sentence said. `reset` forgets that sentence (a cleared search may say its count again).
 */
export function createDebouncedAnnouncer(delay = DEBOUNCE_MS) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let said: string | null = null;
  return {
    say(text: string) {
      clearTimeout(timer);
      if (text === said) return;
      timer = setTimeout(() => {
        said = text;
        announce(text);
      }, delay);
    },
    reset() {
      clearTimeout(timer);
      said = null;
    },
    dispose() {
      clearTimeout(timer);
    },
  };
}
