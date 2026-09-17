import { labelOf } from '../catalog/labels.js';
import { belongsToDetail } from '../catalog/visibility.js';
import { insideInternal } from '../state/internal-mode.js';

const COPY = {
  en: { explore: 'Internal anatomy', leave: 'Whole brain',
    system: 'System', all: 'All internal structures' },
  fr: { explore: 'Anatomie interne', leave: 'Cerveau entier',
    system: 'Système', all: 'Toutes les structures internes' },
};

/** The way into internal anatomy, and — on the same control — the way back out. */
export function createInternalAnatomy({ manifest, onToggle, onSystem }) {
  const panel = document.getElementById('internal-anatomy');
  const explore = document.getElementById('explore-internal');
  const system = document.getElementById('internal-system');
  const systemLabel = document.getElementById('internal-system-label');
  const note = document.getElementById('internal-note');
  let key = null;
  const chooseSystem = event => onSystem(event.target.value || null);
  explore.addEventListener('click', onToggle);
  system.addEventListener('change', chooseSystem);
  return {
    update(state) {
      const copy = COPY[state.lang];
      const leaving = insideInternal(state);
      const anatomy = state.explorer === 'anatomy';
      explore.hidden = !anatomy;
      panel.hidden = !anatomy || !leaving;
      explore.textContent = leaving ? copy.leave : copy.explore;
      explore.setAttribute('aria-pressed', String(leaving));
      explore.disabled = state.status === 'switching';
      systemLabel.textContent = copy.system;
      if (note) note.hidden = true;
      const nextKey = `${state.detail}:${state.lang}`;
      if (nextKey !== key) {
        key = nextKey;
        const systems = new Map();
        for (const region of manifest.regions) {
          if (region.kind !== 'structure' || !belongsToDetail(region, state.detail)) continue;
          systems.set(labelOf(region, 'en').group, labelOf(region, state.lang).group);
        }
        system.replaceChildren(new Option(copy.all, ''), ...[...systems]
          .sort((a, b) => a[1].localeCompare(b[1], state.lang))
          .map(([id, name]) => new Option(name, id)));
      }
      system.value = state.internalSystem ?? '';
    },
    dispose() {
      explore.removeEventListener('click', onToggle);
      system.removeEventListener('change', chooseSystem);
    },
  };
}
