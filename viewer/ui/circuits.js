import { CIRCUIT_TEXT } from '../learning/translations.js';
import { drillChevron, scrollToTop } from './clinical.js';

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function button(text, action, value) {
  const node = element('button', text, 'button-quiet');
  node.type = 'button';
  node.dataset[action] = String(value);
  return node;
}

const SVG = 'http://www.w3.org/2000/svg';

function chevron(direction) {
  const icon = document.createElementNS(SVG, 'svg');
  icon.setAttribute('viewBox', '0 0 24 24');
  icon.setAttribute('aria-hidden', 'true');
  icon.classList.add('control-icon');
  const path = document.createElementNS(SVG, 'path');
  path.setAttribute('d', direction === 'previous' ? 'm15 6-6 6 6 6' : 'm9 6 6 6-6 6');
  icon.append(path);
  return icon;
}

/** Step and landmark commands are actions, so they take the standard button rather than link text. */
function command(text, action, value) {
  const node = button(text, action, value);
  node.className = 'circuit-command';
  return node;
}

function disclosure(title, ...children) {
  const node = element('details', null, 'circuit-disclosure');
  node.append(element('summary', title), ...children);
  return node;
}

/** Where a landmark stands in the reader's lesson: the one shown, one already seen, or one ahead. */
export function stepProgress(index, lesson) {
  if (index === lesson.step) return 'current';
  return lesson.visited.includes(index) ? 'visited' : 'upcoming';
}

/** The lesson's landmarks in order, each one a way to it. Seen and ahead differ in shape, not only in ink. */
function stepList(circuit, lesson, lang) {
  const text = CIRCUIT_TEXT[lang];
  const steps = element('ol', null, 'circuit-steps');
  circuit.steps.forEach((step, index) => {
    const row = element('li');
    const choice = button(null, 'step', index);
    const progress = stepProgress(index, lesson);
    choice.className = 'circuit-step';
    choice.dataset.progress = progress;
    if (progress === 'current') choice.setAttribute('aria-current', 'step');
    choice.append(element('span', String(index + 1), 'circuit-step-number'),
      element('span', step.name[lang], 'circuit-step-name'));
    if (progress === 'visited') choice.append(element('span', `, ${text.visited}`, 'visually-hidden'));
    row.append(choice);
    steps.append(row);
  });
  return steps;
}

/** Which way a stepper control moves, and whether there is a landmark in that direction. */
export function stepperTargets(step, total) {
  return {
    previous: step > 0 ? step - 1 : null,
    next: step < total - 1 ? step + 1 : null,
  };
}

/** The lesson's place and its landmark steps, in the detail's location bar. */
function renderStepper(group, lesson, total, text) {
  group.setAttribute('aria-label', text.landmarks);
  const targets = stepperTargets(lesson.step, total);
  const progress = element('p', null, 'circuit-progress');
  progress.append(element('span', `${text.landmark} `, 'visually-hidden'), text.stepShort(lesson.step, total));
  const controls = ['previous', 'next'].map(direction => {
    const control = button(null, 'step', targets[direction] ?? lesson.step);
    control.className = `icon-button circuit-stepper-${direction}`;
    control.dataset.stepDirection = direction;
    control.setAttribute('aria-label', text[`${direction}Landmark`]);
    control.title = text[`${direction}Landmark`];
    // A boundary has nowhere to go, so the control leaves rather than greying out.
    control.hidden = targets[direction] === null;
    control.append(chevron(direction));
    return control;
  });
  group.replaceChildren(controls[0], progress, controls[1]);
}

/**
 * Lesson controls share the app's render cycle. The landmark's own commands
 * are the region's: Focus frames it as the lesson does, Linked MRI opens its plane.
 * The landmark reads first, then the region's actions and datasheet, and the
 * lesson's background last, in `#circuit-notes` below them.
 */
export function createCircuitExplorer({ catalog, onCircuit, onStep, onLandmark, onMri, onDeficit }) {
  const browser = document.getElementById('circuit-browser');
  const introduction = document.getElementById('circuit-introduction');
  const list = document.getElementById('circuit-list');
  const landmarks = document.getElementById('circuit-landmarks');
  const profile = document.getElementById('circuit-profile');
  const stepperGroup = document.getElementById('circuit-stepper');
  const notes = document.getElementById('circuit-notes');
  const actionStatus = document.getElementById('circuit-action-status');
  const related = document.getElementById('circuit-region');
  let state;
  let listKey;
  let profileKey;
  let relatedKey;
  let opening = false;
  let actionError = null;

  function updateActions() {
    for (const container of [browser, profile, stepperGroup, notes]) {
      container.setAttribute('aria-busy', String(opening));
      for (const control of container.querySelectorAll('button')) control.disabled = opening;
    }
    actionStatus.textContent = opening ? CIRCUIT_TEXT[state.lang].loading : actionError?.message ?? '';
    actionStatus.hidden = state.explorer !== 'circuits' || (!opening && !actionError);
    actionStatus.dataset.error = String(Boolean(actionError));
  }

  function renderList() {
    const { lesson, lang } = state;
    const text = CIRCUIT_TEXT[lang];
    list.replaceChildren(...catalog.all.map(circuit => {
      const choice = button(null, 'circuit', circuit.id);
      choice.className = 'circuit-choice';
      choice.setAttribute('aria-pressed', String(circuit.id === lesson.circuit));
      const label = element('span', null, 'circuit-choice-text');
      label.append(element('span', circuit.name[lang]),
        element('span', `${circuit.steps.length} ${text.landmarks.toLowerCase()}`, 'circuit-count'));
      choice.append(label, drillChevron());
      return choice;
    }));
    landmarks.replaceChildren();
    if (!lesson.circuit) return;
    const heading = element('h3', text.landmarks, 'section-label');
    heading.id = 'circuit-landmarks-heading';
    const steps = stepList(catalog.get(lesson.circuit), lesson, lang);
    steps.setAttribute('aria-labelledby', heading.id);
    landmarks.append(heading, steps);
  }

  function renderProfile() {
    const { lesson, lang } = state;
    const text = CIRCUIT_TEXT[lang];
    delete profile.dataset.landmarkSelected;
    if (!lesson.circuit) {
      for (const node of [profile, stepperGroup, notes]) node.replaceChildren();
      return;
    }
    const circuit = catalog.get(lesson.circuit);
    renderStepper(stepperGroup, lesson, circuit.steps.length, text);
    // The location bar names the circuit on screen; the heading keeps it in the outline.
    const heading = element('h2', circuit.name[lang], 'visually-hidden');
    heading.id = 'circuit-heading';
    // The whole sequence, in the lesson itself rather than only in the list it was opened from.
    const sequence = stepList(circuit, lesson, lang);
    sequence.classList.add('circuit-sequence');
    sequence.setAttribute('aria-label', text.landmarks);
    const body = element('div', null, 'panel-body circuit-content');
    const step = circuit.steps[lesson.step];
    const title = element('h3', step.name[lang], 'circuit-title');
    title.id = 'circuit-title';
    title.tabIndex = -1;
    body.append(title,
      element('p', step.role[lang], 'circuit-role'),
      element('p', step.explanation[lang]));
    const exploring = state.selectedRegion?.id !== step.region;
    profile.dataset.landmarkSelected = String(!exploring);
    if (exploring) {
      const note = element('p', `${text.otherSelection} `, 'circuit-note circuit-return');
      note.append(button(text.returnToLandmark, 'step', lesson.step));
      body.append(note);
    }
    profile.replaceChildren(heading, sequence, body);

    const foot = [
      disclosure(text.connections, element('p', circuit.summary[lang]),
        element('p', circuit.route[lang], 'circuit-route'),
        element('p', circuit.scope[lang]), element('p', text.schematic, 'circuit-note')),
      disclosure(text.mapping, element('p', step.mapping[lang]), element('p', text.mriNote, 'circuit-note')),
      disclosure(text.clinical, element('p', circuit.clinical[lang]),
        command(text.clinicalLink, 'deficit', circuit.deficit), element('p', text.clinicalNote, 'circuit-note')),
    ];
    const sources = disclosure(text.evidence);
    for (const id of circuit.references) {
      const reference = catalog.reference(id);
      const link = element('a', reference.title);
      link.href = reference.url;
      link.target = '_blank';
      link.rel = 'noreferrer';
      const citation = element('p', null, 'circuit-source');
      citation.append(link, element('span', reference.citation, 'circuit-note'));
      sources.append(citation);
    }
    sources.append(element('p', `${text.revised}: ${catalog.revised}`, 'circuit-note'));
    foot.push(sources);
    notes.replaceChildren(...foot);
  }

  /** Outside a lesson, a region that is a landmark links to that step of each tour. */
  function renderRelated() {
    const { lang } = state;
    const id = state.selectedRegion?.id;
    const links = id && state.explorer !== 'circuits'
      ? catalog.all.flatMap(circuit => circuit.steps
        .map((step, index) => ({ circuit, step, index }))
        .filter(({ step }) => step.region === id))
      : [];
    related.hidden = links.length === 0;
    related.replaceChildren();
    if (!links.length) return;
    const text = CIRCUIT_TEXT[lang];
    const body = element('div', null, 'panel-body clinical-regions');
    for (const { circuit, index } of links) {
      const link = element('button', null, 'clinical-region-link');
      link.append(element('span', `${circuit.name[lang]} · ${text.step(index, circuit.steps.length)}`),
        drillChevron());
      link.type = 'button';
      link.dataset.landmarkCircuit = circuit.id;
      link.dataset.landmarkStep = String(index);
      body.append(link);
    }
    related.append(element('h2', text.inCircuits, 'section-label'), body);
  }

  async function run(action) {
    if (opening) return false;
    opening = true;
    actionError = null;
    updateActions();
    try {
      await action();
      return true;
    } catch (error) {
      actionError = error;
      console.error(error);
      return false;
    } finally {
      opening = false;
      updateActions();
      if (actionError && state.explorer === 'circuits') actionStatus.scrollIntoView({ block: 'nearest' });
    }
  }

  /** A new landmark starts at the top; the stepper keeps focus so it can be pressed again. */
  function settle(direction) {
    if (state.explorer !== 'circuits') return;
    scrollToTop(profile);
    const control = direction
      && (stepperGroup.querySelector(`[data-step-direction="${direction}"]:not([hidden])`)
        ?? stepperGroup.querySelector('[data-step-direction]:not([hidden])'));
    (control ?? document.getElementById('circuit-title'))?.focus({ preventScroll: true });
  }

  async function act(event) {
    const target = event.target.closest('button');
    if (!target || target.disabled || opening) return;
    if (target.dataset.deficit) return onDeficit(target.dataset.deficit);
    const action = target.dataset.landmarkCircuit
      ? () => onLandmark(target.dataset.landmarkCircuit, Number(target.dataset.landmarkStep))
      : target.dataset.circuit ? () => onCircuit(target.dataset.circuit)
        : target.dataset.step !== undefined ? () => onStep(Number(target.dataset.step)) : null;
    if (!action) return;
    const direction = target.dataset.stepDirection;
    if (await run(action)) settle(direction);
  }

  /** Arrows walk the list, or the lesson's own landmarks. */
  function onKey(event) {
    if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
    const scope = event.currentTarget === browser ? browser : event.target.closest('.circuit-sequence');
    if (!scope) return;
    const controls = [...scope.querySelectorAll('button:not(:disabled)')];
    const index = controls.indexOf(document.activeElement);
    if (index < 0) return;
    event.preventDefault();
    controls[index + (event.key === 'ArrowDown' ? 1 : -1)]?.focus();
  }

  const surfaces = [browser, profile, stepperGroup, notes, related];
  for (const surface of surfaces) surface.addEventListener('click', act);
  browser.addEventListener('keydown', onKey);
  profile.addEventListener('keydown', onKey);
  return {
    update(snapshot) {
      state = snapshot;
      browser.hidden = state.explorer !== 'circuits';
      profile.hidden = browser.hidden || !state.lesson.circuit;
      stepperGroup.hidden = profile.hidden;
      notes.hidden = profile.hidden;
      actionStatus.hidden = browser.hidden;
      introduction.textContent = CIRCUIT_TEXT[state.lang].introduction;
      list.setAttribute('aria-label', CIRCUIT_TEXT[state.lang].heading);
      const key = `${state.lang}|${state.lesson.circuit}|${state.lesson.step}`;
      if (key !== listKey) { listKey = key; renderList(); }
      const nextProfileKey = `${key}|${state.selectedRegion?.id}`;
      if (nextProfileKey !== profileKey) { profileKey = nextProfileKey; renderProfile(); }
      const nextRelatedKey = `${state.lang}|${state.explorer}|${state.selectedRegion?.id}`;
      if (nextRelatedKey !== relatedKey) { relatedKey = nextRelatedKey; renderRelated(); }
      if (!browser.hidden) updateActions();
    },
    /** The landmark's Linked MRI: the lesson's prepared plane, with the same progress and errors. */
    openMri: () => run(onMri),
    focus() { list.querySelector('button').focus(); },
    dispose() {
      for (const surface of surfaces) surface.removeEventListener('click', act);
      browser.removeEventListener('keydown', onKey);
      profile.removeEventListener('keydown', onKey);
    },
  };
}
