/**
 * Named focus requests, replacing the legacy `getElementById(...).focus()` calls across panels
 * (app.js:539-546, 706-713, 725; panels/clinical.js:24; panels/dissection.js:30-33). An owner
 * registers how to find its element; anyone else asks for it by name.
 */
export const FOCUS_TARGETS = {
  dissectionUndo: 'dissection-undo',
  regionTitle: 'region-title',
  treeStop: 'tree-stop',
  activeTab: 'active-tab',
} as const;

type FocusTargetName = (typeof FOCUS_TARGETS)[keyof typeof FOCUS_TARGETS];

type Resolver = () => HTMLElement | null;

const targets = new Map<FocusTargetName, Resolver>();

/**
 * Registers `resolve` for `name`. It runs at request time, so a target that is rendered later,
 * or replaced, is still found. Returns the function that unregisters it.
 */
export function registerFocusTarget(name: FocusTargetName, resolve: Resolver): () => void {
  if (targets.has(name)) throw new Error(`Focus target already registered: ${name}`);
  targets.set(name, resolve);
  return () => {
    if (targets.get(name) === resolve) targets.delete(name);
  };
}

/** Whether focus could land on `element` now: in the document, shown, enabled, not inert. */
function focusable(element: HTMLElement | null): element is HTMLElement {
  return (
    element !== null &&
    element.isConnected &&
    element.checkVisibility() &&
    !(element as HTMLButtonElement).disabled &&
    !element.closest('[inert]')
  );
}

/**
 * Moves focus to the element registered as `name`, else to `fallback`'s. Returns whether focus
 * was placed, so the caller can tell a hand-off that landed from one that did not.
 */
export function requestFocus(
  name: FocusTargetName,
  { fallback, ...options }: FocusOptions & { fallback?: FocusTargetName } = {},
): boolean {
  for (const candidate of fallback === undefined ? [name] : [name, fallback]) {
    // An owner that is not mounted has no target: skip it, as for a resolver that finds nothing.
    const element = targets.get(candidate)?.() ?? null;
    if (!focusable(element)) continue;
    element.focus(options);
    if (element.ownerDocument.activeElement === element) return true;
  }
  return false;
}

/**
 * A control that hid or disabled itself leaves focus on the page. If focus is stranded like
 * that, `name` takes it (app.js:548-554: the tab in front, which is on screen in both shells).
 */
export function rescueFocus(
  name: FocusTargetName,
  options?: FocusOptions & { fallback?: FocusTargetName },
): boolean {
  const current = document.activeElement;
  if (current && current !== document.body && focusable(current as HTMLElement)) return false;
  return requestFocus(name, options);
}

/**
 * Records the element that has focus now, as the invoker of a dialog or popover. The returned
 * function gives focus back to it, unless it has gone: then it returns false and leaves focus alone.
 */
export function captureInvoker(): () => boolean {
  const invoker = document.activeElement as HTMLElement | null;
  // Nothing had focus, so there is no opener to return to.
  if (!invoker || invoker === document.body) return () => false;
  return () => {
    if (!focusable(invoker)) return false;
    invoker.focus();
    return invoker.ownerDocument.activeElement === invoker;
  };
}
