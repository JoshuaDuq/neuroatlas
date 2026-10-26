/**
 * Arrow-key walking through a group of buttons (circuits.js:304-314): ArrowDown and ArrowUp move
 * focus to the next or previous button and stop at the ends. Not a composite widget: every button
 * stays a Tab stop and no other key is handled. Keys with Alt, Ctrl, Meta or Shift held are left
 * alone (deviations/u6-list-nav-modifier-keys.md).
 */
export function neighbourKeys(root: HTMLElement): () => void {
  const onkeydown = (event: KeyboardEvent) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const buttons = [...root.querySelectorAll<HTMLElement>('button')];
    const index = buttons.indexOf(event.target as HTMLElement);
    if (index < 0) return;
    // Handled: the page would otherwise scroll or walk the anatomy tree on ↑ ↓.
    event.preventDefault();
    buttons[index + (event.key === 'ArrowDown' ? 1 : -1)]?.focus();
  };
  root.addEventListener('keydown', onkeydown);
  return () => root.removeEventListener('keydown', onkeydown);
}
