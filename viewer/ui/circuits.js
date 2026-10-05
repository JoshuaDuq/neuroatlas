import { CIRCUIT_TEXT } from '../learning/translations.js';

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

function disclosure(title, ...children) {
  const node = element('details', null, 'circuit-disclosure');
  node.append(element('summary', title), ...children);
  return node;
}

function question(circuit, lesson, lang) {
  const text = CIRCUIT_TEXT[lang];
  const fieldset = element('fieldset', null, 'circuit-question');
  fieldset.append(element('legend', text.question), element('p', circuit.question.prompt[lang]));
  const answers = element('div', null, 'circuit-answers');
  circuit.question.options.forEach((option, index) => {
    const choice = button(option[lang], 'answer', index);
    choice.setAttribute('aria-pressed', String(index === lesson.answer));
    answers.append(choice);
  });
  const feedback = element('p', null, 'circuit-feedback');
  feedback.setAttribute('role', 'status');
  fieldset.append(answers, feedback);
  return fieldset;
}

/** Lesson controls share the app's render cycle and existing mobile region panel. */
export function createCircuitExplorer({ catalog, onCircuit, onStep, onMri, onAnswer, onDeficit }) {
  const browser = document.getElementById('circuit-browser');
  const introduction = document.getElementById('circuit-introduction');
  const list = document.getElementById('circuit-list');
  const landmarks = document.getElementById('circuit-landmarks');
  const profile = document.getElementById('circuit-profile');
  const actionStatus = document.getElementById('circuit-action-status');
  let state;
  let listKey;
  let profileKey;
  let opening = false;
  let actionError = null;

  function updateActions() {
    for (const container of [browser, profile]) {
      container.setAttribute('aria-busy', String(opening));
      for (const control of container.querySelectorAll('button')) {
        control.disabled = opening || control.dataset.boundary === 'true';
      }
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
      choice.append(element('span', circuit.name[lang]),
        element('span', `${circuit.steps.length} ${text.landmarks.toLowerCase()}`, 'circuit-count'));
      return choice;
    }));
    landmarks.replaceChildren();
    if (!lesson.circuit) return;
    const circuit = catalog.get(lesson.circuit);
    landmarks.append(element('h3', text.landmarks, 'section-label'));
    const steps = element('ol', null, 'circuit-steps');
    circuit.steps.forEach((step, index) => {
      const row = element('li');
      const choice = button(null, 'step', index);
      choice.className = 'circuit-step';
      if (index === lesson.step) choice.setAttribute('aria-current', 'step');
      choice.append(element('span', String(index + 1), 'circuit-step-number'),
        element('span', step.name[lang]));
      row.append(choice);
      steps.append(row);
    });
    landmarks.append(steps);
  }

  function renderProfile() {
    const { lesson, lang } = state;
    const text = CIRCUIT_TEXT[lang];
    const circuit = lesson.circuit ? catalog.get(lesson.circuit) : null;
    const heading = element('h2', circuit ? circuit.name[lang] : text.heading, 'panel-heading');
    heading.id = 'circuit-heading';
    profile.replaceChildren(heading);
    const body = element('div', null, 'panel-body circuit-content');
    if (!circuit) {
      body.append(element('p', text.choose));
      profile.append(body);
      return;
    }
    const step = circuit.steps[lesson.step];
    const title = element('h3', step.name[lang], 'circuit-title');
    title.id = 'circuit-title';
    title.tabIndex = -1;
    body.append(title,
      element('p', text.step(lesson.step, circuit.steps.length), 'circuit-progress'),
      element('p', step.role[lang], 'circuit-role'),
      element('p', step.explanation[lang]));
    const navigation = element('div', null, 'circuit-navigation');
    const previous = button(text.previous, 'step', lesson.step - 1);
    previous.dataset.boundary = String(lesson.step === 0);
    const next = button(text.next, 'step', lesson.step + 1);
    next.dataset.boundary = String(lesson.step === circuit.steps.length - 1);
    navigation.append(previous, next);
    const actions = element('div', null, 'circuit-actions');
    actions.append(button(text.anatomy, 'step', lesson.step), button(text.mri, 'mri', 'open'));
    const exploring = state.selectedRegion?.id !== step.region;
    if (exploring) body.append(element('p', text.otherSelection, 'circuit-note'));
    body.append(navigation, actions, element('p', text.mriNote, 'circuit-note'),
      disclosure(text.connections, element('p', circuit.summary[lang]),
        element('p', circuit.route[lang], 'circuit-route'),
        element('p', circuit.scope[lang]), element('p', text.schematic, 'circuit-note')),
      disclosure(text.mapping, element('p', step.mapping[lang])),
      disclosure(text.clinical, element('p', circuit.clinical[lang]),
        button(text.clinicalLink, 'deficit', circuit.deficit), element('p', text.clinicalNote, 'circuit-note')));
    if (lesson.step === circuit.steps.length - 1) body.append(question(circuit, lesson, lang));
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
    body.append(sources);
    profile.append(body);
  }

  function updateQuestion() {
    const feedback = profile.querySelector('.circuit-feedback');
    if (!feedback) return;
    const { lesson, lang } = state;
    const circuit = catalog.get(lesson.circuit);
    for (const choice of profile.querySelectorAll('[data-answer]')) {
      choice.setAttribute('aria-pressed', String(Number(choice.dataset.answer) === lesson.answer));
    }
    const text = CIRCUIT_TEXT[lang];
    const message = lesson.answer === null ? ''
      : `${lesson.answer === circuit.question.correct ? text.correct : text.incorrect} ${circuit.question.explanation[lang]}`;
    if (feedback.textContent !== message) feedback.textContent = message;
  }

  async function act(event) {
    const target = event.target.closest('button');
    if (!target || target.disabled || opening) return;
    if (target.dataset.answer !== undefined) {
      onAnswer(Number(target.dataset.answer));
      profile.querySelector(`[data-answer="${target.dataset.answer}"]`).focus();
      return;
    }
    if (target.dataset.deficit) return onDeficit(target.dataset.deficit);
    const action = target.dataset.circuit ? () => onCircuit(target.dataset.circuit)
      : target.dataset.step !== undefined ? () => onStep(Number(target.dataset.step))
        : target.dataset.mri ? onMri : null;
    if (!action) return;
    opening = true;
    actionError = null;
    updateActions();
    try {
      await action();
      if (!target.dataset.mri && state.explorer === 'circuits') {
        const focusTarget = document.getElementById('circuit-title');
        profile.scrollIntoView({ block: 'start' });
        focusTarget.focus({ preventScroll: true });
      }
    } catch (error) {
      actionError = error;
      console.error(error);
    } finally {
      opening = false;
      updateActions();
      if (actionError && state.explorer === 'circuits') actionStatus.scrollIntoView({ block: 'nearest' });
    }
  }

  function onKey(event) {
    if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
    const controls = [...browser.querySelectorAll('button:not(:disabled)')];
    const index = controls.indexOf(document.activeElement);
    if (index < 0) return;
    event.preventDefault();
    controls[index + (event.key === 'ArrowDown' ? 1 : -1)]?.focus();
  }

  browser.addEventListener('click', act);
  profile.addEventListener('click', act);
  browser.addEventListener('keydown', onKey);
  return {
    update(snapshot) {
      state = snapshot;
      browser.hidden = state.explorer !== 'circuits';
      profile.hidden = browser.hidden;
      actionStatus.hidden = browser.hidden;
      introduction.textContent = CIRCUIT_TEXT[state.lang].introduction;
      list.setAttribute('aria-label', CIRCUIT_TEXT[state.lang].heading);
      const key = `${state.lang}|${state.lesson.circuit}|${state.lesson.step}`;
      if (key !== listKey) { listKey = key; renderList(); }
      const nextProfileKey = `${key}|${state.selectedRegion?.id}`;
      if (nextProfileKey !== profileKey) { profileKey = nextProfileKey; renderProfile(); }
      updateQuestion();
      if (!browser.hidden) updateActions();
    },
    focus() { list.querySelector('button').focus(); },
    dispose() {
      browser.removeEventListener('click', act);
      profile.removeEventListener('click', act);
      browser.removeEventListener('keydown', onKey);
    },
  };
}
