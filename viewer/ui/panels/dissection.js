import { t } from '../../i18n/translations.js';

/**
 * Controls for reversible anatomical visibility changes: one line at the explorer's foot,
 * there only while something is hidden. Its count is spoken through the page's announcer,
 * so `update` returns the sentence when the count has changed, and null otherwise.
 */
export function createDissectionControls({ onUndo, onRestore }) {
  const panel = document.getElementById('dissection-controls');
  const heading = document.getElementById('dissection-heading');
  const status = document.getElementById('dissection-status');
  const undo = document.getElementById('dissection-undo');
  const restore = document.getElementById('dissection-restore');
  const listeners = [[undo, onUndo], [restore, onRestore]];
  for (const [element, handler] of listeners) element.addEventListener('click', handler);
  let counted = null;
  let said = null;

  return {
    update(state) {
      const hidden = state.hiddenRegions.size;
      const focused = document.activeElement;
      panel.hidden = state.explorer !== 'anatomy' || hidden === 0;
      const i18n = t(state.lang, 'dissection');
      heading.textContent = i18n.heading;
      undo.textContent = i18n.undo;
      restore.textContent = i18n.restoreAll;
      status.textContent = i18n.hiddenCount(hidden);
      undo.disabled = !state.dissectionCanUndo;
      restore.disabled = hidden === 0;
      // A command that just disabled or removed itself would strand focus on the document.
      if ((focused === undo || focused === restore) && (focused.disabled || panel.hidden)) {
        const next = panel.hidden ? null : [undo, restore].find(button => !button.disabled);
        (next ?? document.querySelector('#tree [tabindex="0"]'))?.focus();
      }
      // One action can render more than once, so a count changed in this task is said by every render in it.
      if (counted !== null && counted !== hidden) {
        said = status.textContent;
        queueMicrotask(() => { said = null; });
      }
      counted = hidden;
      return said;
    },
    dispose() {
      for (const [element, handler] of listeners) element.removeEventListener('click', handler);
    },
  };
}
