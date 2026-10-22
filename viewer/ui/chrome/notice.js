import { t } from '../../i18n/translations.js';

/**
 * The one visible notice. It sits under the mode tabs, so it shows over the list
 * and the detail alike; on a phone it moves into the sheet's grip, which is on
 * screen at every detent. The announcer speaks it, so this is not a live region.
 */
export function createNotice({ onDismiss, onReload }) {
  const node = document.getElementById('notice');
  const text = document.getElementById('notice-text');
  const reload = document.getElementById('notice-reload');
  const dismiss = document.getElementById('notice-dismiss');
  const desktopHome = document.getElementById('workspace-tabs');
  const phoneHome = document.getElementById('sheet-tabs');

  reload.addEventListener('click', onReload);
  dismiss.addEventListener('click', onDismiss);

  return {
    setShell(shell) {
      const hadFocus = node.contains(document.activeElement);
      (shell === 'sheet' ? phoneHome : desktopHome).after(node);
      if (hadFocus) dismiss.focus({ preventScroll: true });
    },

    update(state) {
      const notice = state.notice;
      node.hidden = !notice;
      if (!notice) return;
      const copy = t(state.lang, 'errors');
      if (text.textContent !== notice.text) text.textContent = notice.text;
      reload.hidden = notice.action !== 'reload';
      reload.textContent = copy.reload;
      dismiss.setAttribute('aria-label', copy.dismiss);
      dismiss.dataset.tooltip = copy.dismiss;
    },

    dispose() {
      reload.removeEventListener('click', onReload);
      dismiss.removeEventListener('click', onDismiss);
    },
  };
}
