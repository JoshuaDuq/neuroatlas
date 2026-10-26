// The Circuits tab in Chromium, against the real S3 controller over the fake engine: the list and its
// keys, opening a lesson, the stepper and its focus hand-offs, the landmark and the way back, the
// notes, the related circuits, the busy and failure states, the linked MRI entry, and the
// accessibility checks of decision record #58. The pure rules are circuits-view.test.ts.
import { flushSync } from 'svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { cdp, page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { t } from '../../lib/core/i18n/index.ts';
import { currentItem } from '../../lib/core/workspace.ts';
import { expectAxeClean, withMedia } from '../../lib/ui/a11y-test-support.ts';
import '../../app/layout.css';
import { createWorld, deferred, manifest, type World } from './circuits-test-world.ts';
import Fixture from './circuits-test-support.svelte';

let world: World;

function mount(lang: 'en' | 'fr' = 'en', explorer = true) {
  world = createWorld();
  if (explorer) world.session.setExplorer('circuits');
  world.session.setLang(lang);
  document.documentElement.lang = lang;
  return render(Fixture, { world });
}

beforeEach(async () => {
  await page.viewport(1280, 800);
});
afterEach(() => {
  document.documentElement.lang = 'en';
});

const rowOf = (id: string) => document.querySelector<HTMLElement>(`[data-circuit="${id}"]`)!;
const rows = () => [...document.querySelectorAll<HTMLElement>('[data-circuit]')];
const title = () => document.querySelector<HTMLElement>('[data-circuit-title]')!;
const control = (direction: 'previous' | 'next') =>
  document.querySelector<HTMLElement>(`[data-step-direction="${direction}"]`)!;
const stepRows = () => [...document.querySelectorAll<HTMLElement>('.circuit-step')];
const status = () => document.querySelector<HTMLElement>('.circuit-status')!;
const announcer = () => document.getElementById('announcer')!;
const progress = () => document.querySelector('.circuit-stepper .progress')!.textContent;
const summary = (name: string) =>
  [...document.querySelectorAll<HTMLElement>('summary')].find((s) => s.textContent === name)!;
const returnButton = () =>
  document.querySelector<HTMLButtonElement>('.circuit-return button') ?? null;

/** Opens a circuit's lesson and waits until its first landmark has the focus. */
async function open(id: string) {
  await userEvent.click(rowOf(id));
  await expect.poll(() => world.lesson.state.circuit).toBe(id);
  await expect.poll(() => document.activeElement).toBe(title());
}

/** A region the lesson's first landmark is not: the reader wanders off. */
async function wander() {
  const landmark = world.circuits.get(world.lesson.state.circuit!).steps[0]!.region;
  const other = manifest.regions.find((r) => r.id !== landmark && r.kind === 'structure')!;
  await world.commands.openRegion(other.id, () => true);
  flushSync();
}

/** The normal form WCAG 2.5.3 compares in: no case, no punctuation, one space. */
const words = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** The text a person sees on a control: its content without the visually hidden parts. */
const visibleText = (element: HTMLElement) =>
  [...element.childNodes]
    .filter((node) => !(node instanceof HTMLElement && node.matches('.visually-hidden')))
    .map((node) => node.textContent)
    .join(' ');

/** What a screen reader names the control: its content without what is hidden from it. */
function accessibleName(element: HTMLElement) {
  const copy = element.cloneNode(true) as HTMLElement;
  for (const hidden of copy.querySelectorAll('[aria-hidden="true"]')) hidden.remove();
  return copy.textContent!;
}

describe('the list', () => {
  test('is a labelled group of rows named with the landmark count, the count and chevron hidden', async () => {
    mount();
    const group = page.getByRole('group', { name: 'Guided learning', exact: true });
    await expect.element(group).toBeVisible();
    const buttons = group.element().querySelectorAll('ul > li > button');
    expect(buttons.length).toBe(world.circuits.all.length);
    const vision = rowOf('vision');
    expect(vision.querySelector('.group-count')!.getAttribute('aria-hidden')).toBe('true');
    expect(vision.querySelector('.chevron')!.getAttribute('aria-hidden')).toBe('true');
    await expect
      .element(page.getByRole('button', { name: 'Visual pathway , 4 landmarks' }))
      .toBeVisible();
    const landmarks = world.circuits.all.reduce((sum, c) => sum + c.steps.length, 0);
    expect(document.querySelector('.scope-note')!.textContent!.trim()).toBe(
      `${world.circuits.all.length} guided circuits · ${landmarks} landmarks`,
    );
  });

  test('is French in French', async () => {
    mount('fr');
    await expect.element(page.getByRole('group', { name: 'Apprentissage guidé' })).toBeVisible();
    await expect
      .element(page.getByRole('button', { name: 'Voie visuelle , 4 repères' }))
      .toBeVisible();
    expect(document.querySelector('.scope-note')!.textContent).toContain('parcours guidés');
  });

  test('a row names what it shows, in order (WCAG 2.5.3)', () => {
    mount();
    for (const row of rows()) {
      expect(words(accessibleName(row))).toContain(words(visibleText(row)));
    }
  });

  test('is hidden outside the Circuits tab', () => {
    mount('en', false);
    expect(document.querySelector<HTMLElement>('.browser')!.checkVisibility()).toBe(false);
  });

  test('every row is a Tab stop, and ArrowDown and ArrowUp walk them without wrapping', async () => {
    mount();
    const [first, second] = rows();
    first!.focus();
    await userEvent.tab();
    expect(document.activeElement).toBe(second);
    await userEvent.keyboard('{ArrowUp}');
    expect(document.activeElement).toBe(first);
    await userEvent.keyboard('{ArrowUp}');
    expect(document.activeElement).toBe(first);
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    expect(document.activeElement).toBe(rows()[2]);
    rows().at(-1)!.focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(rows().at(-1));
  });

  test('keys with a modifier are left to the browser', async () => {
    mount();
    rows()[0]!.focus();
    await userEvent.keyboard('{Shift>}{ArrowDown}{/Shift}');
    expect(document.activeElement).toBe(rows()[0]);
    const event = new KeyboardEvent('keydown', {
      key: 'ArrowDown',
      altKey: true,
      bubbles: true,
      cancelable: true,
    });
    rows()[0]!.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  test('focusFirst, the / key, puts focus on the first circuit', () => {
    mount();
    world.explorer.focusFirst();
    expect(document.activeElement).toBe(rows()[0]);
  });
});

describe('opening a lesson', () => {
  test('marks the circuit open, shows its first landmark and puts the title in focus', async () => {
    mount();
    expect(currentItem()).toBeNull();
    await open('vision');
    const vision = world.circuits.get('vision');
    expect(rowOf('vision').getAttribute('aria-current')).toBe('true');
    expect(rowOf('vision').hasAttribute('aria-pressed')).toBe(false);
    expect(rows().filter((r) => r.hasAttribute('aria-current'))).toHaveLength(1);
    expect(title().tagName).toBe('H3');
    expect(title().tabIndex).toBe(-1);
    expect(title().textContent).toBe(vision.steps[0]!.name.en);
    expect(document.querySelector('.circuit-profile h2')!.textContent).toBe(vision.name.en);
    expect(document.querySelector('.circuit-role')!.textContent).toBe(vision.steps[0]!.role.en);
    expect(progress()).toBe('Landmark 1 of 4');
    expect(currentItem()).toBe(rowOf('vision'));
  });

  test('a landmark on its own region names its side and group and offers no way back', async () => {
    mount();
    await open('vision');
    expect(world.explorer.landmarkSelected).toBe(true);
    const context = document.querySelector('.circuit-context')!;
    expect(context.querySelectorAll('dt')).toHaveLength(2);
    expect(context.querySelectorAll('dd')[1]!.textContent).not.toBe('');
    expect(returnButton()).toBeNull();
  });

  test('the reader leaving the landmark is told so, and Return brings the landmark back', async () => {
    mount();
    await open('vision');
    // Past the first landmark, so Return must go to the current one, not the first.
    await userEvent.click(control('next'));
    await expect.poll(() => world.lesson.state.step).toBe(1);
    await wander();
    expect(world.explorer.landmarkSelected).toBe(false);
    expect(document.querySelector('.circuit-context')).toBeNull();
    expect(document.querySelector('.circuit-note')!.textContent).toContain(
      'You are exploring another region.',
    );
    returnButton()!.focus();
    await userEvent.keyboard('{Enter}');
    await expect.poll(() => world.explorer.landmarkSelected).toBe(true);
    expect(world.lesson.state.step).toBe(1);
    expect(world.view.current.selectedRegion?.id).toBe(
      world.circuits.get('vision').steps[1]!.region,
    );
    expect(returnButton()).toBeNull();
    await expect.poll(() => document.activeElement).toBe(title());
  });

  test('is French in French', async () => {
    mount('fr');
    await open('vision');
    expect(title().textContent).toBe(world.circuits.get('vision').steps[0]!.name.fr);
    expect(progress()).toBe('Repère 1 sur 4');
    expect(document.querySelector('[role="group"][aria-label="Repères"]')).not.toBeNull();
  });

  test('opening another circuit replaces the lesson', async () => {
    mount();
    await open('vision');
    await open('memory');
    expect(rowOf('vision').hasAttribute('aria-current')).toBe(false);
    expect(progress()).toBe('Landmark 1 of 5');
  });
});

describe('the stepper', () => {
  test('is a labelled group of Previous, the place and Next; the ends leave rather than grey out', async () => {
    mount();
    await open('vision');
    const group = document.querySelector('.circuit-stepper')!;
    expect(group.getAttribute('role')).toBe('group');
    expect(group.getAttribute('aria-label')).toBe('Landmarks');
    expect(control('previous').hidden).toBe(true);
    expect(control('next').hidden).toBe(false);
    expect(control('next').getAttribute('aria-label')).toBe('Next landmark');
    expect(control('next').dataset.tooltip).toBe('Next landmark');
    expect(control('previous').getAttribute('aria-label')).toBe('Previous landmark');
  });

  test('Next moves one landmark on and keeps focus on Next; at the end focus goes to Previous', async () => {
    mount();
    await open('hearing');
    const steps = world.circuits.get('hearing').steps;
    control('next').focus();
    await userEvent.keyboard('{Enter}');
    await expect.poll(() => title().textContent).toBe(steps[1]!.name.en);
    expect(document.activeElement).toBe(control('next'));
    expect(progress()).toBe('Landmark 2 of 3');
    await userEvent.keyboard('{Enter}');
    await expect.poll(() => title().textContent).toBe(steps[2]!.name.en);
    expect(control('next').hidden).toBe(true);
    expect(document.activeElement).toBe(control('previous'));
    await userEvent.keyboard('{Enter}');
    await expect.poll(() => title().textContent).toBe(steps[1]!.name.en);
    expect(document.activeElement).toBe(control('previous'));
  });

  test('the view follows: the profile is back at its top and the landmark region is selected', async () => {
    mount();
    await open('hearing');
    const detail = document.querySelector<HTMLElement>('.detail')!;
    detail.style.cssText = 'height: 120px; overflow-y: auto';
    detail.scrollTop = 40;
    await userEvent.click(control('next'));
    await expect.poll(() => world.lesson.state.step).toBe(1);
    expect(detail.scrollTop).toBe(0);
    expect(world.view.current.selectedRegion?.id).toBe(
      world.circuits.get('hearing').steps[1]!.region,
    );
  });
});

describe('the landmark sequence', () => {
  test('lists every landmark in order, the current one aria-current="step", the seen ones named as seen', async () => {
    mount();
    await open('hearing');
    const list = document.querySelector('ol')!;
    expect(list.getAttribute('role')).toBe('list');
    expect(list.getAttribute('aria-labelledby')).toBe(
      document.querySelector('.landmarks-heading')!.id,
    );
    expect(stepRows().map((r) => r.dataset.progress)).toEqual(['current', 'upcoming', 'upcoming']);
    expect(stepRows().filter((r) => r.hasAttribute('aria-current'))).toEqual([stepRows()[0]]);
    expect(stepRows()[0]!.getAttribute('aria-current')).toBe('step');
    expect(stepRows()[0]!.querySelector('.circuit-step-number')!.textContent).toBe('1');
    await userEvent.click(control('next'));
    await expect
      .poll(() => stepRows().map((r) => r.dataset.progress))
      .toEqual(['visited', 'current', 'upcoming']);
    expect(stepRows()[0]!.textContent).toMatch(/, seen$/);
    expect(stepRows()[1]!.textContent).not.toMatch(/seen/);
    expect(stepRows()[0]!.hasAttribute('aria-current')).toBe(false);
  });

  test('a landmark row opens that landmark and the title takes focus', async () => {
    mount();
    await open('hearing');
    stepRows()[2]!.focus();
    await userEvent.keyboard('{Enter}');
    await expect.poll(() => world.lesson.state.step).toBe(2);
    await expect.poll(() => document.activeElement).toBe(title());
    expect(title().textContent).toBe(world.circuits.get('hearing').steps[2]!.name.en);
  });

  test('ArrowDown and ArrowUp walk the landmarks only, no further', async () => {
    mount();
    await open('hearing');
    stepRows()[0]!.focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(stepRows()[1]);
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    expect(document.activeElement).toBe(stepRows()[2]);
    stepRows()[0]!.focus();
    await userEvent.keyboard('{ArrowUp}');
    expect(document.activeElement).toBe(stepRows()[0]);
  });

  test('the notes are the sequence and four disclosures, with one command: Open deficit evidence', async () => {
    mount();
    await open('hearing');
    const notes = document.querySelector('.circuit-notes')!;
    expect([...notes.querySelectorAll('summary')].map((s) => s.textContent)).toEqual([
      'Connections and scope',
      'What this atlas shows',
      'Clinical context',
      'Sources',
    ]);
    const commands = [...notes.querySelectorAll('button')].filter((b) => !b.closest('ol'));
    expect(commands.map((b) => b.textContent!.trim())).toEqual(['Open deficit evidence']);
  });

  test('Open deficit evidence goes to the circuit’s deficit through X2’s entry point', async () => {
    mount();
    await open('hearing');
    await userEvent.click(summary('Clinical context'));
    await userEvent.click(page.getByRole('button', { name: 'Open deficit evidence' }));
    expect(world.openDeficit).toHaveBeenCalledExactlyOnceWith('word-deafness');
  });

  test('sources are links that open in a new tab, with the date the content was checked', async () => {
    mount();
    await open('hearing');
    await userEvent.click(summary('Sources'));
    const circuit = world.circuits.get('hearing');
    const links = [...document.querySelectorAll<HTMLAnchorElement>('.source a')];
    expect(links.map((a) => a.href)).toEqual(
      circuit.references.map((id) => world.explorer.reference(id).url),
    );
    for (const link of links) {
      expect(link.target).toBe('_blank');
      expect(link.rel).toBe('noreferrer');
    }
    expect(document.body.textContent).toContain(`Content checked: ${world.explorer.revised}`);
  });

  test('a note the reader opened stays open as the lesson moves on, and closes with the next lesson', async () => {
    mount();
    await open('hearing');
    await userEvent.click(summary('Sources'));
    expect(summary('Sources').parentElement!.hasAttribute('open')).toBe(true);
    await userEvent.click(control('next'));
    await expect.poll(() => world.lesson.state.step).toBe(1);
    expect(summary('Sources').parentElement!.hasAttribute('open')).toBe(true);
    await userEvent.click(rowOf('vision'));
    await expect.poll(() => world.lesson.state.circuit).toBe('vision');
    expect(summary('Sources').parentElement!.hasAttribute('open')).toBe(false);
  });
});

describe('related circuits', () => {
  test('outside the Circuits tab, a landmark’s region links to the circuits it is in; a row opens that lesson there', async () => {
    mount();
    await open('vision');
    expect(document.querySelector('.related')).toBeNull();
    world.session.setExplorer('anatomy');
    flushSync();
    const link = page.getByRole('button', { name: 'Visual pathway 1 of 4 , Landmark' });
    await expect.element(link).toBeVisible();
    expect(document.querySelector('.related h3')!.textContent).toBe('In guided circuits');
    // Label in name: what is seen, in order, begins the name (WCAG 2.5.3).
    const row = document.querySelector<HTMLElement>('[data-landmark-circuit="vision"]')!;
    expect(words(accessibleName(row)).startsWith(words(visibleText(row)))).toBe(true);
    await userEvent.click(link);
    await expect.poll(() => world.session.state.explorer).toBe('circuits');
    await expect.poll(() => document.activeElement).toBe(title());
    expect(document.querySelector('.related')).toBeNull();
  });

  test('a row opens the lesson at its own landmark, not the first', async () => {
    mount();
    const memory = world.circuits.get('memory');
    const last = memory.steps.length - 1;
    world.session.setExplorer('anatomy');
    await world.commands.openRegion(memory.steps[last]!.region, () => true);
    flushSync();
    const row = document.querySelector<HTMLElement>(
      `[data-landmark-circuit="memory"][data-landmark-step="${last}"]`,
    )!;
    await userEvent.click(row);
    await expect.poll(() => world.lesson.state).toMatchObject({ circuit: 'memory', step: last });
    await expect.poll(() => title().textContent).toBe(memory.steps[last]!.name.en);
  });

  test('a region in no circuit has none', async () => {
    mount();
    world.session.setExplorer('anatomy');
    const free = manifest.regions.find(
      (r) =>
        r.kind === 'structure' &&
        !world.circuits.all.some((c) => c.steps.some((s) => s.region === r.id)),
    )!;
    await world.commands.openRegion(free.id, () => true);
    flushSync();
    expect(document.querySelector('.related')).toBeNull();
  });
});

describe('a run in flight', () => {
  test('the status line says so, every control refuses and keeps focus, and a second press does nothing', async () => {
    mount();
    await open('hearing');
    await userEvent.click(summary('Clinical context'));
    const gate = deferred();
    world.hold.open = () => gate.promise;
    const opened = vi.spyOn(world.excursions, 'openLessonStep');
    control('next').focus();
    await userEvent.keyboard('{Enter}');
    expect(status().textContent).toBe('Opening landmark…');
    expect(world.explorer.busy).toBe(true);
    const buttons = [
      ...document.querySelectorAll<HTMLButtonElement>('button:not([hidden])'),
    ].filter((b) => b.checkVisibility());
    expect(buttons.length).toBeGreaterThan(6);
    for (const button of buttons) {
      expect(button.getAttribute('aria-disabled'), button.outerHTML).toBe('true');
      expect(button.disabled).toBe(false);
    }
    expect(document.activeElement).toBe(control('next'));
    await userEvent.keyboard('{Enter}');
    stepRows()[0]!.click();
    rowOf('vision').click();
    document.querySelector<HTMLElement>('.command')!.click();
    expect(opened).toHaveBeenCalledTimes(1);
    expect(world.openDeficit).not.toHaveBeenCalled();
    expect(document.querySelector('.circuit-profile')!.getAttribute('aria-busy')).toBe('true');
    gate.resolve();
    await expect.poll(() => world.explorer.busy).toBe(false);
    expect(status().textContent).toBe('');
    expect(world.lesson.state.step).toBe(1);
    world.hold.open = null;
  });

  test('related rows turn the reader away too while a run is in flight', async () => {
    mount();
    await open('vision');
    // The Linked MRI run leaves the tab as it is, so the rows can be looked at while it is in flight.
    const gate = deferred();
    world.mri.openPreparedPlane.mockImplementationOnce(() => gate.promise);
    const run = world.explorer.openMri();
    world.session.setExplorer('anatomy');
    flushSync();
    const row = document.querySelector('[data-landmark-circuit="vision"]')!;
    expect(row.getAttribute('aria-disabled')).toBe('true');
    gate.resolve();
    await run;
    expect(row.getAttribute('aria-disabled')).toBeNull();
  });

  test('a busy stepper control has no hover fill', async () => {
    mount();
    await open('hearing');
    const gate = deferred();
    world.hold.open = () => gate.promise;
    await userEvent.click(control('next'));
    await userEvent.hover(control('next'));
    expect(getComputedStyle(control('next')).backgroundColor).toBe('rgba(0, 0, 0, 0)');
    gate.resolve();
    await expect.poll(() => world.explorer.busy).toBe(false);
    world.hold.open = null;
  });

  test('an opening overtaken by a newer scene command does nothing and does not throw', async () => {
    mount();
    const gate = deferred();
    world.hold.open = () => gate.promise;
    const opening = world.explorer.openCircuit('vision');
    // A newer command begins: S3's openCircuit gives up without starting the lesson.
    world.commands.begin();
    gate.resolve();
    expect(await opening).toBe(true);
    expect(world.lesson.state.circuit).toBeNull();
    expect(world.explorer.busy).toBe(false);
    world.hold.open = null;
  });

  test('a failure is scrolled into view', async () => {
    mount();
    await open('hearing');
    const detail = document.querySelector<HTMLElement>('.detail')!;
    detail.style.cssText = 'height: 120px; overflow-y: auto';
    expect(status().getBoundingClientRect().top).toBeGreaterThan(
      detail.getBoundingClientRect().bottom,
    );
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    world.hold.open = () => Promise.reject(new Error('geometry'));
    await userEvent.click(control('next'));
    await expect
      .poll(() => status().getBoundingClientRect().bottom)
      .toBeLessThanOrEqual(detail.getBoundingClientRect().bottom);
    error.mockRestore();
    world.hold.open = null;
  });

  test('a failure says the landmark could not be shown, keeps focus where it was and a newer deploy offers a reload', async () => {
    mount();
    await open('hearing');
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    world.hold.open = () =>
      Promise.reject(Object.assign(new Error('moved'), { code: 'asset-updated' }));
    control('next').focus();
    await userEvent.keyboard('{Enter}');
    await expect.poll(() => status().textContent).toBe(t('en', 'errors').updated);
    expect(status().dataset.error).toBe('true');
    expect(error).toHaveBeenCalled();
    expect(world.session.state.notice?.action).toBe('reload');
    expect(document.activeElement).toBe(control('next'));
    expect(world.lesson.state.step).toBe(0);
    // The next run clears it.
    world.hold.open = null;
    await userEvent.keyboard('{Enter}');
    await expect.poll(() => world.lesson.state.step).toBe(1);
    expect(status().textContent).toBe('');
    expect(status().dataset.error).toBe('false');
    error.mockRestore();
  });

  test('a plain failure names the landmark', async () => {
    mount();
    await open('hearing');
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    world.hold.open = () => Promise.reject(new Error('geometry'));
    await userEvent.click(control('next'));
    await expect.poll(() => status().textContent).toBe('Could not show this landmark.');
    error.mockRestore();
    world.hold.open = null;
  });

  test('the status line is in the page, empty and taking no room, before it has anything to say', () => {
    mount();
    const line = status();
    expect(line.getAttribute('role')).toBe('status');
    expect(line.textContent).toBe('');
    expect(line.hidden).toBe(false);
    expect(line.getBoundingClientRect().height).toBe(0);
  });

  test('a language switch replaces the line instead of rewriting it, so the failure is not said again', async () => {
    mount();
    await open('hearing');
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    world.hold.open = () => Promise.reject(new Error('geometry'));
    await userEvent.click(control('next'));
    await expect.poll(() => status().textContent).toBe('Could not show this landmark.');
    const before = status();
    world.session.setLang('fr');
    flushSync();
    expect(before.isConnected).toBe(false);
    expect(status().textContent).toBe(t('fr', 'errors').operations.landmark);
    error.mockRestore();
    world.hold.open = null;
  });
});

describe('what the screen reader hears of a step', () => {
  test('a landmark on the region already selected is said, as its place and name', async () => {
    mount();
    await open('hearing');
    expect(announcer().textContent).toBe('');
    stepRows()[0]!.click();
    const first = world.circuits.get('hearing').steps[0]!;
    await expect.poll(() => announcer().textContent).toBe(`Landmark 1 of 3: ${first.name.en}`);
  });

  test('a landmark on another region is left to the selection sentence, which the view says', async () => {
    mount();
    await open('hearing');
    stepRows()[1]!.click();
    await expect.poll(() => world.lesson.state.step).toBe(1);
    await expect.poll(() => document.activeElement).toBe(title());
    expect(announcer().textContent).toBe('');
  });

  test('is French in French', async () => {
    mount('fr');
    await open('hearing');
    stepRows()[0]!.click();
    const first = world.circuits.get('hearing').steps[0]!;
    await expect
      .poll(() => announcer().textContent)
      .toBe(`Repère 1 sur 3 : ${first.name.fr}`.replace(' :', ':'));
  });
});

describe('the linked MRI', () => {
  test('a landmark’s Linked MRI opens the lesson’s prepared plane through the panel’s entry point', async () => {
    mount();
    await open('hearing');
    const step = world.circuits.get('hearing').steps[0]!;
    world.excursions.openLinkedMri({ atRegion: true });
    await expect.poll(() => world.mri.openPreparedPlane.mock.calls.length).toBe(1);
    expect(world.mri.openPreparedPlane.mock.calls[0]![0]).toBe(step.plane);
    await expect.poll(() => world.explorer.busy).toBe(false);
  });

  test('says it is opening, refuses a second run, and the controls refuse too', async () => {
    mount();
    await open('hearing');
    const gate = deferred();
    world.mri.openPreparedPlane.mockImplementationOnce(() => gate.promise);
    const first = world.explorer.openMri();
    await expect.poll(() => status().textContent).toBe('Opening landmark…');
    expect(control('next').getAttribute('aria-disabled')).toBe('true');
    expect(await world.explorer.openMri()).toBe(false);
    gate.resolve();
    expect(await first).toBe(true);
    expect(status().textContent).toBe('');
  });

  test('a failure says the linked MRI could not be opened', async () => {
    mount();
    await open('hearing');
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    world.mri.openPreparedPlane.mockRejectedValueOnce(new Error('volume'));
    expect(await world.explorer.openMri()).toBe(false);
    expect(status().textContent).toBe('Could not open the linked MRI.');
    expect(status().dataset.error).toBe('true');
    error.mockRestore();
  });
});

describe('accessibility', () => {
  test.each(['en', 'fr'] as const)(
    'axe: the list, an open lesson, another region, a run in flight and a failure; both themes, 1280 and 390 px, %s',
    async (lang) => {
      mount(lang);
      await expectAxeClean();
      await open('hearing');
      await userEvent.click(summary(t(lang, 'circuits').evidence));
      await expectAxeClean();
      await wander();
      await expectAxeClean();
      const gate = deferred();
      world.hold.open = () => gate.promise;
      control('next').focus();
      await userEvent.keyboard('{Enter}');
      await expectAxeClean();
      const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      gate.reject(new Error('geometry'));
      await expect.poll(() => status().dataset.error).toBe('true');
      await expectAxeClean();
      error.mockRestore();
      world.hold.open = null;
    },
    120_000,
  );

  test('forced colours keep the open circuit, the progress shapes and the focus ring visible; more contrast stays clean', async () => {
    mount();
    await open('hearing');
    await userEvent.click(control('next'));
    await expect.poll(() => world.lesson.state.step).toBe(1);
    await withMedia([{ name: 'forced-colors', value: 'active' }], async () => {
      expect(getComputedStyle(rowOf('hearing')).outlineStyle).toBe('solid');
      const [seen, current, ahead] = stepRows().map((r) =>
        r.querySelector<HTMLElement>('.circuit-step-number')!,
      );
      for (const number of [seen!, current!, ahead!]) {
        expect(getComputedStyle(number).forcedColorAdjust).toBe('none');
      }
      // Seen is a filled disc, ahead a ring: told apart without colour names.
      expect(getComputedStyle(seen!).backgroundColor).not.toBe(
        getComputedStyle(ahead!).backgroundColor,
      );
      // Reached by keyboard, so the focus ring is the one a keyboard reader sees.
      control('previous').focus();
      await userEvent.tab();
      expect(document.activeElement).toBe(control('next'));
      expect(getComputedStyle(control('next')).outlineStyle).toBe('solid');
    });
    await withMedia([{ name: 'prefers-contrast', value: 'more' }], async () => {
      await expectAxeClean();
    });
  });

  test('targets: 44 px with a coarse pointer, asserted with touch emulation', async () => {
    const session = cdp();
    await session.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
    await page.viewport(390, 844);
    try {
      mount();
      expect(matchMedia('(pointer: coarse)').matches).toBe(true);
      const check = (selector: string) => {
        const targets = [...document.querySelectorAll<HTMLElement>(selector)].filter((e) =>
          e.checkVisibility(),
        );
        expect(targets.length, selector).toBeGreaterThan(0);
        for (const target of targets) {
          expect(target.getBoundingClientRect().height, target.outerHTML).toBeGreaterThanOrEqual(
            44,
          );
        }
      };
      check('.circuit-choice');
      await open('hearing');
      world.session.setExplorer('anatomy');
      flushSync();
      check('.circuit-link');
      world.session.setExplorer('circuits');
      flushSync();
      await userEvent.click(summary('Clinical context'));
      await wander();
      check('.circuit-step');
      check('summary');
      check('.command');
      check('.circuit-return button');
      check('.circuit-stepper .icon-button');
      const stepper = control('next').getBoundingClientRect();
      expect(stepper.width).toBeGreaterThanOrEqual(44);
    } finally {
      await session.send('Emulation.setTouchEmulationEnabled', { enabled: false });
      await page.viewport(1280, 800);
    }
  });

  test('200 % text with the WCAG 1.4.12 spacing: names wrap, nothing is clipped or overflows', async () => {
    mount('fr');
    await open('cerebellar');
    for (const name of ['Connexions et portée', 'Contexte clinique', 'Sources']) {
      await userEvent.click(summary(name));
    }
    await wander();
    const style = document.head.appendChild(document.createElement('style'));
    style.textContent = `html { font-size: 200%; }
      * { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; }
      p { margin-bottom: 2em !important; }`;
    await page.viewport(320, 700);
    try {
      for (const element of document.querySelectorAll<HTMLElement>(
        'button, summary, h2, h3, p, dd',
      )) {
        if (!element.checkVisibility() || element.closest('.visually-hidden')) continue;
        expect(element.scrollWidth, element.outerHTML).toBeLessThanOrEqual(element.clientWidth + 1);
        // A name that grows is taller, never cut: no fixed height on any control.
        if (element.matches('button, summary')) {
          expect(element.scrollHeight, element.outerHTML).toBeLessThanOrEqual(
            element.clientHeight + 1,
          );
        }
      }
      const root = document.documentElement;
      expect(root.scrollWidth).toBeLessThanOrEqual(root.clientWidth + 1);
      // The count stays still in the stepper: its grid is three fixed-width columns.
      const group = document.querySelector('.circuit-stepper')!;
      expect(group.scrollWidth).toBeLessThanOrEqual(group.clientWidth + 1);
    } finally {
      style.remove();
      await page.viewport(1280, 800);
    }
  });
});
