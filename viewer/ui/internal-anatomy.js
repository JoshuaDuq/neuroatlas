import { labelOf } from '../catalog/labels.js';
import { belongsToDetail } from '../catalog/visibility.js';
import { t } from '../i18n/translations.js';
import { insideInternal } from '../state/internal-mode.js';
import { bindRoving } from './roving.js';

/** The list's scope: the whole brain, or one internal system with the cortex hidden. */
export function createInternalAnatomy({ manifest, onToggle, onSystem }) {
  const scope = document.getElementById('tree-scope');
  const choices = [...scope.querySelectorAll('button[data-scope]')];
  const panel = document.getElementById('internal-anatomy');
  const system = document.getElementById('internal-system');
  const systemLabel = document.getElementById('internal-system-label');
  const note = document.getElementById('internal-note');
  let key = null;
  const chooseScope = event => {
    const button = event.target.closest('button[data-scope]');
    if (button && button.getAttribute('aria-pressed') !== 'true') onToggle();
  };
  const chooseSystem = event => onSystem(event.target.value || null);
  scope.addEventListener('click', chooseScope);
  system.addEventListener('change', chooseSystem);
  const roving = bindRoving(scope);
  return {
    update(state) {
      const i18n = t(state.lang, 'navigator');
      const inside = insideInternal(state);
      scope.setAttribute('aria-label', i18n.scope);
      for (const button of choices) {
        const bySystem = button.dataset.scope === 'system';
        button.textContent = bySystem ? i18n.scopeSystem : i18n.scopeWhole;
        button.setAttribute('aria-pressed', String(bySystem === inside));
        button.disabled = state.status === 'switching';
      }
      roving.sync();
      // Search replaces the tree, and its header with it.
      panel.hidden = state.explorer !== 'anatomy' || !inside || state.query.trim().length > 0;
      systemLabel.textContent = i18n.system;
      note.textContent = i18n.cortexHiddenNote;
      const nextKey = `${state.detail}:${state.lang}`;
      if (nextKey !== key) {
        key = nextKey;
        const systems = new Map();
        for (const region of manifest.regions) {
          if (region.kind !== 'structure' || !belongsToDetail(region, state.detail)) continue;
          systems.set(labelOf(region, 'en').group, labelOf(region, state.lang).group);
        }
        system.replaceChildren(new Option(i18n.allSystems, ''), ...[...systems]
          .sort((a, b) => a[1].localeCompare(b[1], state.lang))
          .map(([id, name]) => new Option(name, id)));
      }
      system.value = state.internalSystem ?? '';
    },
    dispose() {
      scope.removeEventListener('click', chooseScope);
      system.removeEventListener('change', chooseSystem);
      roving.dispose();
    },
  };
}
