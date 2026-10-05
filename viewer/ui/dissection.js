import { t } from '../i18n/translations.js';

/** Controls for reversible anatomical visibility changes. */
export function createDissectionControls({ onUndo, onRestore }) {
  const panel = document.getElementById('dissection-controls');
  const heading = document.getElementById('dissection-heading');
  const hint = document.getElementById('dissection-hint');
  const status = document.getElementById('dissection-status');
  const undo = document.getElementById('dissection-undo');
  const restore = document.getElementById('dissection-restore');
  // Eyes appear on hover with a fine pointer (components.css), so the hint says so.
  const pointer = globalThis.matchMedia?.('(hover: hover) and (pointer: fine)');
  const listeners = [[undo, onUndo], [restore, onRestore]];
  for (const [element, handler] of listeners) element.addEventListener('click', handler);

  return {
    update(state) {
      panel.hidden = state.explorer !== 'anatomy';
      const i18n = t(state.lang, 'dissection');
      heading.textContent = i18n.heading;
      hint.textContent = pointer?.matches ? i18n.hintPointer : i18n.hint;
      undo.textContent = i18n.undo;
      restore.textContent = i18n.restoreAll;
      status.textContent = i18n.hiddenCount(state.hiddenRegions.size);
      const focused = document.activeElement;
      undo.disabled = !state.dissectionCanUndo;
      restore.disabled = state.hiddenRegions.size === 0;
      // A command that just disabled itself would strand focus on the document.
      if ((focused === undo || focused === restore) && focused.disabled) {
        const next = [undo, restore].find(button => !button.disabled)
          ?? document.querySelector('#tree [tabindex="0"]');
        next?.focus();
      }
    },
    dispose() {
      for (const [element, handler] of listeners) element.removeEventListener('click', handler);
    },
  };
}
