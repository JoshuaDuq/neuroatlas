import { labelOf } from '../catalog/labels.js';
import { belongsToDetail } from '../catalog/visibility.js';
import { insideInternal } from '../state/internal-mode.js';

const COPY = {
  en: { explore: 'Explore internal anatomy', leave: 'Show the whole brain',
    system: 'Study a system', all: 'All internal structures',
    outside: 'Hides the cortex so you can look at the structures beneath it.',
    inside: 'Select a structure, then isolate it or explore its constituent regions.' },
  fr: { explore: 'Explorer l’anatomie interne', leave: 'Revenir au cerveau entier',
    system: 'Étudier un système', all: 'Toutes les structures internes',
    outside: 'Masque le cortex pour observer les structures sous-jacentes.',
    inside: 'Sélectionnez une structure, puis isolez-la ou explorez ses régions constitutives.' },
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
      panel.hidden = state.explorer !== 'anatomy';
      explore.textContent = leaving ? copy.leave : copy.explore;
      // Inside, the exit is the one control the reader must be able to find
      // again, but it has no reason to compete with the anatomy for attention.
      explore.classList.toggle('button-primary', !leaving);
      explore.setAttribute('aria-pressed', String(leaving));
      explore.disabled = state.status === 'switching';
      systemLabel.textContent = copy.system;
      note.textContent = leaving ? copy.inside : copy.outside;
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
