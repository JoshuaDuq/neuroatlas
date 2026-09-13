import { labelOf } from '../catalog/labels.js';

const COPY = {
  en: { explore: 'Explore internal anatomy', system: 'Study a system', all: 'All internal structures',
    note: 'Select a structure, then isolate it or explore its constituent regions.' },
  fr: { explore: 'Explorer l’anatomie interne', system: 'Étudier un système', all: 'Toutes les structures internes',
    note: 'Sélectionnez une structure, puis isolez-la ou explorez ses régions constitutives.' },
};

/** A single entry into internal anatomy, followed by anatomical system filtering. */
export function createInternalAnatomy({ manifest, onExplore, onSystem }) {
  const panel = document.getElementById('internal-anatomy');
  const explore = document.getElementById('explore-internal');
  const system = document.getElementById('internal-system');
  const systemLabel = document.getElementById('internal-system-label');
  const note = document.getElementById('internal-note');
  let key = null;
  const chooseSystem = event => onSystem(event.target.value || null);
  explore.addEventListener('click', onExplore);
  system.addEventListener('change', chooseSystem);
  return {
    update(state) {
      const copy = COPY[state.lang];
      panel.hidden = state.explorer !== 'anatomy';
      explore.textContent = copy.explore;
      explore.disabled = state.status === 'switching';
      systemLabel.textContent = copy.system;
      note.textContent = copy.note;
      const nextKey = `${state.detail}:${state.lang}`;
      if (nextKey !== key) {
        key = nextKey;
        const systems = new Map();
        for (const region of manifest.regions) {
          if (region.kind !== 'structure' || region.atlas !== state.detail) continue;
          systems.set(labelOf(region, 'en').group, labelOf(region, state.lang).group);
        }
        system.replaceChildren(new Option(copy.all, ''), ...[...systems]
          .sort((a, b) => a[1].localeCompare(b[1], state.lang))
          .map(([id, name]) => new Option(name, id)));
      }
      system.value = state.internalSystem ?? '';
    },
    dispose() {
      explore.removeEventListener('click', onExplore);
      system.removeEventListener('change', chooseSystem);
    },
  };
}
