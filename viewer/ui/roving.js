/** Where focus moves in a one-Tab-stop group for a navigation key; null for any other key. */
export function rovingStep(key, index, count) {
  if (!count) return null;
  switch (key) {
    case 'ArrowRight':
    case 'ArrowDown': return (index + 1) % count;
    case 'ArrowLeft':
    case 'ArrowUp': return (index - 1 + count) % count;
    case 'Home': return 0;
    case 'End': return count - 1;
    default: return null;
  }
}

const usable = item => !item.disabled && !item.hidden;
const pressed = item => item.getAttribute('aria-pressed') === 'true';

/** The member holding the group's Tab stop: the focused one, else the chosen one, else the first usable. */
export function tabStop(items, focused = null) {
  const choices = items.filter(usable);
  if (focused && choices.includes(focused)) return focused;
  return choices.find(pressed) ?? choices[0] ?? null;
}

/**
 * Roving tabindex over a group of buttons: one Tab stop, arrows/Home/End move,
 * Enter and Space are the buttons' own. Call `sync` after the group's buttons
 * or their pressed state change.
 */
export function bindRoving(group, { selector = 'button' } = {}) {
  const items = () => [...group.querySelectorAll(selector)];
  const active = () => group.ownerDocument?.activeElement ?? null;

  function sync() {
    const all = items();
    const stop = tabStop(all, all.includes(active()) ? active() : null);
    for (const item of all) item.tabIndex = item === stop ? 0 : -1;
  }

  const onKeyDown = event => {
    const choices = items().filter(usable);
    const next = rovingStep(event.key, choices.indexOf(event.target), choices.length);
    if (next === null || !choices.includes(event.target)) return;
    // Marked handled: the page would otherwise walk the anatomy tree on ↑ ↓.
    event.preventDefault();
    for (const item of choices) item.tabIndex = item === choices[next] ? 0 : -1;
    choices[next].focus();
  };
  const onFocusIn = () => sync();
  const onFocusOut = event => {
    if (!event.relatedTarget || !group.contains(event.relatedTarget)) sync();
  };

  group.addEventListener('keydown', onKeyDown);
  group.addEventListener('focusin', onFocusIn);
  group.addEventListener('focusout', onFocusOut);
  sync();

  return {
    sync,
    dispose() {
      group.removeEventListener('keydown', onKeyDown);
      group.removeEventListener('focusin', onFocusIn);
      group.removeEventListener('focusout', onFocusOut);
    },
  };
}
