import { t } from '../../i18n/translations.js';

/**
 * The one visible notice follows the task tabs, over the list and detail alike;
 * on a phone it moves into the sheet's grip, which is on
 * screen at every detent. The announcer speaks it, so this is not a live region.
 * It offers at most one action: a reload when only that can help, or seeing
 * through the cortex to an opened map's deep structures. `onAction` hears its name.
 */
export function createNotice({ onDismiss, onAction }) {
  const node = document.getElementById('notice');
  const text = document.getElementById('notice-text');
  const action = document.getElementById('notice-action');
  const onActionClick = () => onAction(action.dataset.action);
  const dismiss = document.getElementById('notice-dismiss');
  const desktopHome = document.getElementById('workspace-tabs');
  const phoneHome = document.getElementById('sheet-tabs');

  action.addEventListener('click', onActionClick);
  dismiss.addEventListener('click', onDismiss);

  return {
    setShell(shell) {
      const hadFocus = node.contains(document.activeElement);
      if (shell === 'sheet') phoneHome.after(node);
      else desktopHome.after(node);
      if (hadFocus) dismiss.focus({ preventScroll: true });
    },

    update(state) {
      const notice = state.notice;
      node.hidden = !notice;
      if (!notice) return;
      const copy = t(state.lang, 'errors');
      if (text.textContent !== notice.text) text.textContent = notice.text;
      action.hidden = !notice.action;
      if (notice.action) {
        const labels = { reload: copy.reload, 'see-through': t(state.lang, 'display').seeThrough };
        if (!labels[notice.action]) throw new Error(`Unknown notice action: ${notice.action}`);
        action.dataset.action = notice.action;
        action.textContent = labels[notice.action];
      }
      dismiss.setAttribute('aria-label', copy.dismiss);
      dismiss.dataset.tooltip = copy.dismiss;
    },

    dispose() {
      action.removeEventListener('click', onActionClick);
      dismiss.removeEventListener('click', onDismiss);
    },
  };
}
