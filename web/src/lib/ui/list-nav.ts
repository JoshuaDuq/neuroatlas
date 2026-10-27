export interface ListNavOptions {
  /** The search field above the list. */
  field: HTMLInputElement;
  /** Selects the list's rows: the buttons Up and Down walk through. */
  rows: string;
}

/**
 * Arrow-key navigation between a search field and the list of buttons below it
 * (panels/functions.js:339-377, panels/clinical.js:407-440). Not a composite widget: each row
 * stays a Tab stop and focus itself moves.
 * - Down or Enter in the field moves to the first row;
 * - Up and Down move between rows, and stop at the last one;
 * - Up from the first row returns to the field.
 * Keys with Alt, Ctrl, Meta or Shift held, and keys pressed during IME composition, are left
 * alone (deviations/u6-list-nav-modifier-keys.md).
 */
export function listNav(list: HTMLElement, options: ListNavOptions) {
  let { field, rows } = options;
  const buttons = () => [...list.querySelectorAll<HTMLElement>(rows)];
  const plain = (event: KeyboardEvent) =>
    !event.isComposing && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey;

  const onFieldKeyDown = (event: KeyboardEvent) => {
    if (!plain(event) || (event.key !== 'ArrowDown' && event.key !== 'Enter')) return;
    const first = buttons()[0];
    if (!first) return;
    event.preventDefault();
    first.focus();
  };

  const onListKeyDown = (event: KeyboardEvent) => {
    if (!plain(event) || (event.key !== 'ArrowDown' && event.key !== 'ArrowUp')) return;
    const all = buttons();
    const index = all.indexOf(event.target as HTMLElement);
    if (index < 0) return;
    // Marked handled: the page would otherwise scroll or walk the anatomy tree on ↑ ↓.
    event.preventDefault();
    if (event.key === 'ArrowUp' && index === 0) field.focus();
    else all[index + (event.key === 'ArrowDown' ? 1 : -1)]?.focus();
  };

  field.addEventListener('keydown', onFieldKeyDown);
  list.addEventListener('keydown', onListKeyDown);
  return {
    update(next: ListNavOptions) {
      field.removeEventListener('keydown', onFieldKeyDown);
      ({ field, rows } = next);
      field.addEventListener('keydown', onFieldKeyDown);
    },
    destroy() {
      field.removeEventListener('keydown', onFieldKeyDown);
      list.removeEventListener('keydown', onListKeyDown);
    },
  };
}
