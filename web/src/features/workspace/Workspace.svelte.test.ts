// The workspace frame against the APG Tabs and Breadcrumb tables and the legacy workspace.js and
// notice.js cases (workspace.test.js:62-110, notice.test.js:50-83), as behaviour in a real browser.
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { cleanup, render } from 'vitest-browser-svelte';
import { FOCUS_TARGETS, requestFocus } from '../../lib/ui/focus.ts';
import { expectAxeClean, withMedia } from '../../lib/ui/a11y-test-support.ts';
import '../../app/layout.css';
import Fixture from './workspace-test-support.svelte';
import { newWorld, type World } from './workspace-test-world.ts';

const MODE_NAMES = ['Anatomy', 'Functions', 'Deficits', 'Circuits', 'Tracts'];
const el = (locator: { element(): Element }) => locator.element() as HTMLElement;
const tab = (name: string) => page.getByRole('tab', { name, exact: true });
const button = (name: string) => page.getByRole('button', { name, exact: true });
const row = (id: string) => button(id);
const panel = (id: string) => document.getElementById(id) as HTMLElement;
const view = () => (panel('inspector').hidden ? 'list' : 'detail');
const focused = () => document.activeElement;
const stripShown = () =>
  document.querySelector<HTMLElement>('.workspace-selection')?.checkVisibility() ?? false;
const settle = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

interface Setup {
  world: World;
  calls: string[];
  holder: {
    workspace?: { focusInDetail(): boolean; showDetail(): void; showList(): void; back(): void };
  };
}

async function mount(
  fields: Partial<World> = {},
  extra: { slots?: 'stepper' | 'trailing' | 'both'; manyRows?: boolean } = {},
) {
  const world = $state(newWorld(fields));
  const calls: string[] = [];
  const holder: Setup['holder'] = {};
  render(Fixture, { world, calls, holder, ...extra });
  await expect.element(tab('Anatomy').or(tab('Anatomie'))).toBeVisible();
  return { world, calls, holder } satisfies Setup;
}

beforeEach(async () => {
  await page.viewport(1280, 800);
});
afterEach(() => cleanup());

describe('mode tabs', () => {
  test('one tablist of five tabs; the selected one is the only Tab stop and controls the shown panel', async () => {
    await mount();
    await expect.element(page.getByRole('tablist', { name: 'Explore the atlas' })).toBeVisible();
    expect(document.querySelectorAll('[role=tablist]')).toHaveLength(1);
    for (const name of MODE_NAMES) await expect.element(tab(name)).toBeVisible();
    const selected = el(tab('Anatomy'));
    expect(selected.getAttribute('aria-selected')).toBe('true');
    expect(selected.tabIndex).toBe(0);
    expect(selected.getAttribute('aria-controls')).toBe('navigator');
    for (const name of MODE_NAMES.slice(1)) {
      const other = el(tab(name));
      expect(other.getAttribute('aria-selected')).toBe('false');
      expect(other.tabIndex).toBe(-1);
      expect(other.hasAttribute('aria-controls')).toBe(false);
    }
    // Two reused panels, each labelled by the selected tab, and no nested landmark.
    const panels = [...document.querySelectorAll<HTMLElement>('[role=tabpanel]')];
    expect(panels.map((p) => p.id)).toEqual(['navigator', 'inspector']);
    for (const p of panels) expect(p.getAttribute('aria-labelledby')).toBe(selected.id);
    expect(panels.map((p) => p.hidden)).toEqual([false, true]);
    expect(
      document.querySelectorAll('aside aside, #workspace-panel [role=complementary]'),
    ).toHaveLength(0);
  });

  test('the tabs, names and tablist follow the language', async () => {
    await mount({ lang: 'fr' });
    await expect.element(page.getByRole('tablist', { name: 'Explorer l’atlas' })).toBeVisible();
    for (const name of ['Anatomie', 'Fonctions', 'Déficits', 'Circuits', 'Faisceaux']) {
      await expect.element(tab(name)).toBeVisible();
    }
  });

  test('arrows and Home/End move focus, wrapping, without choosing a mode', async () => {
    const { calls } = await mount();
    el(tab('Anatomy')).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(focused()).toBe(el(tab('Functions')));
    await userEvent.keyboard('{End}');
    expect(focused()).toBe(el(tab('Tracts')));
    await userEvent.keyboard('{ArrowRight}');
    expect(focused()).toBe(el(tab('Anatomy')));
    await userEvent.keyboard('{ArrowLeft}');
    expect(focused()).toBe(el(tab('Tracts')));
    await userEvent.keyboard('{Home}');
    expect(focused()).toBe(el(tab('Anatomy')));
    expect(el(tab('Anatomy')).getAttribute('aria-selected')).toBe('true');
    expect(calls).toEqual([]);
  });

  test('vertical arrows are not swallowed, and arrows with a modifier are left to the platform', async () => {
    const { calls } = await mount();
    const seen: boolean[] = [];
    const listen = (event: KeyboardEvent) => seen.push(event.defaultPrevented);
    document.addEventListener('keydown', listen);
    el(tab('Anatomy')).focus();
    await userEvent.keyboard('{ArrowDown}{ArrowUp}');
    await userEvent.keyboard('{Alt>}{ArrowRight}{/Alt}');
    await userEvent.keyboard('{Shift>}{ArrowRight}{/Shift}');
    document.removeEventListener('keydown', listen);
    expect(seen.every((prevented) => !prevented)).toBe(true);
    expect(seen).toHaveLength(6);
    expect(focused()).toBe(el(tab('Anatomy')));
    expect(calls).toEqual([]);
  });

  test('Enter, Space and a click choose a tab, in the list, and focus stays on it', async () => {
    const { calls } = await mount();
    el(tab('Anatomy')).focus();
    await userEvent.keyboard('{ArrowRight}{Enter}');
    expect(calls).toEqual(['mode:functions']);
    expect(focused()).toBe(el(tab('Functions')));
    await expect.poll(() => el(tab('Functions')).getAttribute('aria-selected')).toBe('true');
    await userEvent.keyboard('{ArrowRight} ');
    expect(calls).toEqual(['mode:functions', 'mode:deficits']);
    await tab('Tracts').click();
    expect(calls.at(-1)).toBe('mode:diffusion');
    await expect.poll(() => el(tab('Tracts')).tabIndex).toBe(0);
    expect(el(tab('Deficits')).tabIndex).toBe(-1);
  });

  test('the mode already chosen does nothing in the list and acts as Back in the detail', async () => {
    const { calls } = await mount();
    await tab('Anatomy').click();
    expect(calls).toEqual([]);
    await row('left:1').click();
    await expect.poll(view).toBe('detail');
    await tab('Anatomy').click();
    await expect.poll(view).toBe('list');
    expect(calls).toContain('return');
    expect(calls).not.toContain('mode:anatomy');
  });

  test('choosing another mode from the detail returns to the list and drops the opener', async () => {
    const { calls } = await mount();
    await row('left:1').click();
    await expect.poll(view).toBe('detail');
    await tab('Functions').click();
    await expect.poll(view).toBe('list');
    expect(calls).toEqual(expect.arrayContaining(['mode:functions', 'view:list']));
    expect(calls).not.toContain('return');
    expect(focused()).toBe(el(tab('Functions')));
  });

  test('the tab in front is the registered "active tab" focus target', async () => {
    await mount({ explorer: 'deficits' });
    expect(requestFocus(FOCUS_TARGETS.activeTab)).toBe(true);
    expect(focused()).toBe(el(tab('Deficits')));
  });
});

describe('list and detail', () => {
  test('a selection from the list drills in, moves focus to Back, and Back returns to the opener', async () => {
    const { calls, holder } = await mount();
    await row('left:2').click();
    await expect.poll(view).toBe('detail');
    expect(focused()).toBe(el(button('Back to Anatomy')));
    expect(holder.workspace!.focusInDetail()).toBe(true);
    await expect.element(page.getByRole('heading', { name: 'Region details' })).toBeVisible();
    expect(el(tab('Anatomy')).getAttribute('aria-controls')).toBe('inspector');
    await button('Back to Anatomy').click();
    await expect.poll(view).toBe('list');
    expect(calls).toEqual(expect.arrayContaining(['view:detail', 'return', 'view:list']));
    expect(focused()).toBe(el(row('left:2')));
    expect(holder.workspace!.focusInDetail()).toBe(false);
    expect(el(tab('Anatomy')).getAttribute('aria-controls')).toBe('navigator');
  });

  test('a selection made elsewhere opens the detail and moves no focus', async () => {
    const { world } = await mount();
    el(tab('Anatomy')).focus();
    world.selectedRegion = { id: 'left:1' };
    await expect.poll(view).toBe('detail');
    expect(focused()).toBe(el(tab('Anatomy')));
  });

  test('Back with focus elsewhere moves no focus', async () => {
    const { holder } = await mount();
    await row('left:1').click();
    await expect.poll(view).toBe('detail');
    el(tab('Anatomy')).focus();
    holder.workspace!.back();
    await expect.poll(view).toBe('list');
    expect(focused()).toBe(el(tab('Anatomy')));
  });

  test('the opener gone, focus falls to the selected row', async () => {
    const { world, holder } = await mount();
    const search = el(page.getByRole('textbox', { name: 'Search regions' }));
    search.focus();
    world.selectedRegion = { id: 'left:3' };
    await expect.poll(view).toBe('detail');
    search.hidden = true;
    holder.workspace!.back();
    await expect.poll(view).toBe('list');
    expect(focused()).toBe(document.querySelector('[data-row][data-selected=true]'));
  });

  test('neither opener nor selected row, focus falls to the tab in front', async () => {
    const { world, holder } = await mount();
    const search = el(page.getByRole('textbox', { name: 'Search regions' }));
    search.focus();
    world.selectedRegion = { id: 'left:3' };
    await expect.poll(view).toBe('detail');
    search.hidden = true;
    document.querySelector<HTMLElement>('[data-row][data-selected=true]')!.hidden = true;
    holder.workspace!.back();
    await expect.poll(view).toBe('list');
    expect(focused()).toBe(el(tab('Anatomy')));
  });

  test('a list that comes back shows its current item', async () => {
    const { world } = await mount({}, { manyRows: true });
    el(tab('Anatomy')).focus();
    const list = el(row('left:1')).parentElement!;
    world.selectedRegion = { id: 'left:70' };
    await expect.poll(view).toBe('detail');
    list.scrollTop = 0;
    el(button('Back to Anatomy')).click();
    await expect.poll(view).toBe('list');
    await settle();
    const within = (inner: DOMRect, outer: DOMRect) =>
      inner.top >= outer.top - 1 && inner.bottom <= outer.bottom + 1;
    const selected = document.querySelector('[data-row][data-selected=true]')!;
    expect(within(selected.getBoundingClientRect(), list.getBoundingClientRect())).toBe(true);
  });

  test('losing the context returns to the list; a detail opened ahead of its context waits', async () => {
    const { world, calls, holder } = await mount();
    world.selectedRegion = { id: 'left:1' };
    await expect.poll(view).toBe('detail');
    world.selectedRegion = null;
    await expect.poll(view).toBe('list');
    expect(calls).not.toContain('return');
    holder.workspace!.showDetail();
    await expect.poll(view).toBe('detail');
    await settle();
    expect(view()).toBe('detail');
  });

  test('tract reference data has no detail view', async () => {
    const { world, holder } = await mount({
      explorer: 'diffusion',
      anatomy: 'aomic',
      referenceAnatomy: 'bert',
    });
    holder.workspace!.showDetail();
    world.selectedRegion = { id: 'left:1' };
    await settle();
    expect(view()).toBe('list');
  });

  test("Escape-as-Back is the caller's: the workspace reports whether focus is in the detail", async () => {
    const { holder } = await mount();
    expect(holder.workspace!.focusInDetail()).toBe(false);
    await row('left:1').click();
    await expect.poll(view).toBe('detail');
    expect(holder.workspace!.focusInDetail()).toBe(true);
    el(tab('Anatomy')).focus();
    expect(holder.workspace!.focusInDetail()).toBe(false);
  });
});

describe('location bar', () => {
  test('a breadcrumb: Back to the mode, then the group of a region read from Anatomy', async () => {
    await mount({
      selectedRegion: { id: 'left:2' },
      selection: { kind: 'region', label: 'x', clearable: true },
    });
    const path = page.getByRole('navigation', { name: 'Breadcrumb' });
    await expect.element(path).toBeVisible();
    expect(path.element().querySelectorAll('ol > li')).toHaveLength(2);
    await expect.element(button('Back to Anatomy')).toHaveTextContent('Anatomy');
    const crumb = button('Frontal, show in the list');
    await expect.element(crumb).toHaveTextContent('Frontal');
    expect(el(crumb).getAttribute('aria-current')).toBe('location');
    expect(el(crumb).dataset.tooltip).toBe('Frontal, show in the list');
  });

  test('the group crumb moves focus once, to the row, though the old opener is still on screen', async () => {
    const { world } = await mount();
    await row('left:1').click();
    await expect.poll(view).toBe('detail');
    // Picked on the canvas meanwhile: the opener (row 1) is on screen, the selection is row 3.
    world.selectedRegion = { id: 'left:3' };
    await settle();
    const crumb = el(button('Frontal, show in the list'));
    const seen: Element[] = [];
    const record = (event: FocusEvent) => seen.push(event.target as Element);
    document.addEventListener('focusin', record);
    await button('Frontal, show in the list').click();
    await expect.poll(view).toBe('list');
    await expect.poll(() => focused()).toBe(el(row('left:3')));
    await settle();
    document.removeEventListener('focusin', record);
    expect(seen.filter((target) => target !== crumb)).toEqual([el(row('left:3'))]);
  });

  test('the group crumb in Anatomy locates the row, returns, and focuses it', async () => {
    const { calls } = await mount({ selectedRegion: { id: 'left:2' } });
    await expect.poll(view).toBe('detail');
    await button('Frontal, show in the list').click();
    await expect.poll(view).toBe('list');
    expect(calls).toEqual(expect.arrayContaining(['locate', 'return']));
    await expect.poll(() => focused()).toBe(el(row('left:2')));
  });

  test("in another mode the place is a crumb that goes Back, and the group is Anatomy's alone", async () => {
    const { calls } = await mount({
      explorer: 'circuits',
      selectedRegion: { id: 'left:2' },
      place: 'Motor pathway',
    });
    await expect.poll(view).toBe('detail');
    await expect.element(button('Back to Circuits')).toBeVisible();
    await button('Motor pathway, show in the list').click();
    await expect.poll(view).toBe('list');
    expect(calls).toContain('return');
    expect(calls).not.toContain('locate');
  });

  test('a mode with no place has Back alone; the slots hold the stepper and the restore action', async () => {
    await mount({ explorer: 'deficits', selectedRegion: { id: 'left:2' } }, { slots: 'both' });
    await expect.element(button('Back to Deficits')).toBeVisible();
    expect(document.querySelectorAll('.detail-path li')).toHaveLength(1);
    await expect.element(page.getByRole('group', { name: 'Steps' })).toBeVisible();
    await expect.element(button('Restore previous view')).toBeVisible();
  });

  test('French names', async () => {
    await mount({ lang: 'fr', selectedRegion: { id: 'left:2' } });
    await expect.element(page.getByRole('navigation', { name: 'Fil d’Ariane' })).toBeVisible();
    await expect.element(button('Retour : Anatomie')).toBeVisible();
    await expect.element(button('Frontal, afficher dans la liste')).toBeVisible();
  });
});

describe('selection strip', () => {
  const region = {
    kind: 'region',
    label: 'Precentral gyrus',
    side: 'L',
    sideWord: 'left',
    clearable: true,
  } as const;

  test('shown only where the list in front does not show the selection', async () => {
    const { world } = await mount({ selection: region, selectedRegion: { id: 'left:1' } });
    await expect.poll(view).toBe('detail');
    expect(stripShown()).toBe(false);
    world.explorer = 'deficits';
    await settle();
    el(button('Back to Deficits')).click();
    await expect.poll(view).toBe('list');
    await expect.element(page.getByRole('button', { name: /^Inspect/ })).toBeVisible();
    world.explorer = 'anatomy';
    await expect.poll(stripShown).toBe(false);
  });

  test('its name carries the side as a word, and contains the visible text (WCAG 2.5.3)', async () => {
    await mount({ explorer: 'deficits', selection: region, selectedRegion: { id: 'left:1' } });
    await tab('Deficits').click();
    const strip = page.getByRole('button', { name: 'Inspect Precentral gyrus, left' });
    await expect.element(strip).toBeVisible();
    expect(el(strip).textContent).toContain('Precentral gyrus');
    expect(el(strip).textContent).toContain('L');
  });

  test('French name', async () => {
    await mount({
      lang: 'fr',
      explorer: 'deficits',
      selection: { ...region, side: 'G', sideWord: 'gauche' },
      selectedRegion: { id: 'left:1' },
    });
    await tab('Déficits').click();
    await expect
      .element(page.getByRole('button', { name: 'Examiner Precentral gyrus, gauche' }))
      .toBeVisible();
  });

  test('clicking it opens the detail and focuses Back; Back returns focus to it', async () => {
    const { world } = await mount({ explorer: 'deficits', selection: region });
    world.selectedRegion = { id: 'left:1' };
    await tab('Deficits').click();
    await expect.poll(view).toBe('list');
    const strip = page.getByRole('button', { name: /^Inspect/ });
    await strip.click();
    await expect.poll(view).toBe('detail');
    expect(focused()).toBe(el(button('Back to Deficits')));
    await button('Back to Deficits').click();
    await expect.poll(view).toBe('list');
    expect(focused()).toBe(el(strip));
  });

  test('clear removes the context and, losing focus with it, hands it to the tab in front', async () => {
    const { world, calls } = await mount({ explorer: 'deficits', selection: region });
    world.selectedRegion = { id: 'left:1' };
    await tab('Deficits').click();
    await expect.poll(view).toBe('list');
    await button('Clear selection').click();
    expect(calls).toContain('clear');
    await expect.poll(stripShown).toBe(false);
    expect(focused()).toBe(el(tab('Deficits')));
  });

  test('a lesson is not clearable, and the phone sheet shows its own strip, not this one', async () => {
    const { world } = await mount({
      explorer: 'anatomy',
      selection: { ...region, clearable: false },
      selectedRegion: null,
    });
    world.selection = { ...region, kind: 'function', clearable: false };
    await expect.element(page.getByRole('button', { name: /^Inspect/ })).toBeVisible();
    expect(document.querySelector('.selection-clear')).toBeNull();
    world.shell = 'sheet';
    await expect.poll(stripShown).toBe(false);
  });
});

describe('notice', () => {
  test('text, one action and a dismiss, after the tablist and before the panels; not a live region', async () => {
    const { calls } = await mount({ notice: { text: 'Planum was updated.', action: 'reload' } });
    await expect.element(page.getByText('Planum was updated.')).toBeVisible();
    const notice = document.querySelector('.notice')!;
    expect(notice.hasAttribute('aria-live')).toBe(false);
    expect(notice.querySelector('[role=alert], [role=status], [aria-live]')).toBeNull();
    const order = [...document.querySelectorAll('[role=tablist], .notice, [role=tabpanel]')];
    expect(
      order.map(
        (n) => n.getAttribute('role') ?? (n.classList.contains('notice') ? 'notice' : n.className),
      ),
    ).toEqual(['tablist', 'notice', 'tabpanel', 'tabpanel']);
    await button('Reload').click();
    expect(calls).toEqual(['action:reload']);
    expect(el(button('Dismiss')).dataset.tooltip).toBe('Dismiss');
  });

  test('the see-through action and French labels', async () => {
    const { calls } = await mount({
      lang: 'fr',
      notice: { text: 'Amygdale.', action: 'see-through' },
    });
    await button('Voir à travers le cortex').click();
    expect(calls).toEqual(['action:see-through']);
    await expect.element(button('Fermer')).toBeVisible();
  });

  test('without an action there is no action button', async () => {
    await mount({ notice: { text: 'Nothing to do.' } });
    await expect.element(page.getByText('Nothing to do.')).toBeVisible();
    expect(document.querySelectorAll('.notice button')).toHaveLength(1);
  });

  test('dismiss clears it and hands focus to the tab in front', async () => {
    const { calls } = await mount({ notice: { text: 'Planum was updated.', action: 'reload' } });
    await button('Dismiss').click();
    expect(calls).toEqual(['dismiss']);
    await expect.poll(() => document.querySelector('.notice')).toBeNull();
    expect(focused()).toBe(el(tab('Anatomy')));
  });

  test('a shell change keeps focus where it was inside the notice', async () => {
    const { world } = await mount({ notice: { text: 'Planum was updated.', action: 'reload' } });
    el(button('Reload')).focus();
    world.shell = 'sheet';
    await settle();
    expect(focused()).toBe(el(button('Reload')));
    world.shell = 'rails';
    await settle();
    expect(focused()).toBe(el(button('Reload')));
  });
});

describe('sizes and media', () => {
  test('targets: tabs, strip and Back are 44 px; the icon buttons clear 24 px', async () => {
    await mount({
      explorer: 'deficits',
      selection: {
        kind: 'region',
        label: 'Precentral gyrus',
        side: 'L',
        sideWord: 'left',
        clearable: true,
      },
      selectedRegion: { id: 'left:1' },
      notice: { text: 'A notice.', action: 'reload' },
    });
    await tab('Deficits').click();
    await expect.element(page.getByRole('button', { name: /^Inspect/ })).toBeVisible();
    const height = (locator: { element(): Element }) => el(locator).getBoundingClientRect().height;
    for (const name of MODE_NAMES) expect(height(tab(name))).toBeGreaterThanOrEqual(44);
    expect(height(page.getByRole('button', { name: /^Inspect/ }))).toBeGreaterThanOrEqual(44);
    for (const name of ['Clear selection', 'Dismiss']) {
      const box = el(button(name)).getBoundingClientRect();
      expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(24);
    }
  });

  test('forced colours underline the selected tab in a system colour', async () => {
    await mount();
    await withMedia([{ name: 'forced-colors', value: 'active' }], () => {
      expect(getComputedStyle(el(tab('Anatomy'))).borderBottomStyle).toBe('solid');
      expect(getComputedStyle(el(tab('Functions'))).borderBottomStyle).not.toBe('solid');
    });
  });

  test('French at 320 px: the tabs scroll inside their bar and nothing overflows the panel', async () => {
    await mount({ lang: 'fr' });
    await page.viewport(320, 700);
    const bar = document.querySelector<HTMLElement>('[role=tablist]')!;
    expect(bar.scrollWidth).toBeGreaterThan(bar.clientWidth);
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(320);
    expectContained();
  });
});

/** Nothing the workspace draws leaves the panel, and no text is cut off vertically. */
function expectContained() {
  // On a phone the panel is display: contents (no box); the viewport is then the bound.
  const own = panel('workspace-panel').getBoundingClientRect();
  const panelBox = own.width ? own : { left: 0, right: document.documentElement.clientWidth };
  const parts = panel('workspace-panel').querySelectorAll<HTMLElement>(
    '[role=tablist], .notice, .workspace-selection-row, .detail-location',
  );
  for (const part of parts) {
    if (!part.checkVisibility()) continue;
    const box = part.getBoundingClientRect();
    expect(box.right, part.className).toBeLessThanOrEqual(panelBox.right + 1);
    expect(box.left, part.className).toBeGreaterThanOrEqual(panelBox.left - 1);
  }
  const text = panel('workspace-panel').querySelectorAll<HTMLElement>(
    '[role=tab], .notice-text, .notice-action, .workspace-selection, .detail-back, .detail-crumb',
  );
  for (const node of text) {
    if (!node.checkVisibility()) continue;
    expect(node.scrollHeight, node.className || node.textContent!).toBeLessThanOrEqual(
      node.clientHeight + 1,
    );
  }
}

const TEXT_SPACING = `* { line-height: 1.5 !important; letter-spacing: 0.12em !important;
  word-spacing: 0.16em !important; } p { margin-bottom: 2em !important; }`;

describe('large text and spacing', () => {
  const busy = {
    selection: {
      kind: 'region',
      label: 'Gyrus précentral',
      side: 'G',
      sideWord: 'gauche',
      clearable: true,
    },
    selectedRegion: { id: 'left:2' },
    notice: { text: 'Planum a été mis à jour.', action: 'reload' },
  } as const;

  afterEach(() => {
    document.documentElement.style.fontSize = '';
    document.getElementById('text-spacing')?.remove();
  });

  for (const width of [1280, 320]) {
    test(`200 % text at ${width} px, in French, with an X3 stepper: contained, no overlap in the bar`, async () => {
      document.documentElement.style.fontSize = '200%';
      await page.viewport(width, 800);
      await mount(
        { lang: 'fr', explorer: 'circuits', place: 'Voie motrice', ...busy },
        { slots: 'stepper' },
      );
      await expect.poll(view).toBe('detail');
      expectContained();
      const crumb = el(
        page.getByRole('button', { name: /afficher dans la liste/ }),
      ).getBoundingClientRect();
      const step = el(page.getByRole('button', { name: 'Précédent' })).getBoundingClientRect();
      expect(crumb.right).toBeLessThanOrEqual(step.left + 1);
      await page.getByRole('button', { name: 'Retour : Circuits' }).click();
      await expect.poll(view).toBe('list');
      expectContained();
    });
  }

  test('the 1.4.12 text-spacing override cuts nothing off', async () => {
    await page.viewport(1280, 800);
    await mount({
      explorer: 'deficits',
      ...busy,
      lang: 'en',
      notice: { text: 'Updated.', action: 'reload' },
    });
    const style = document.head.appendChild(document.createElement('style'));
    style.id = 'text-spacing';
    style.textContent = TEXT_SPACING;
    await tab('Deficits').click();
    await expect.element(page.getByRole('button', { name: /^Inspect/ })).toBeVisible();
    expectContained();
  });

  test('contrast: more and reduced motion stay accessible', async () => {
    await mount({
      explorer: 'deficits',
      ...busy,
      lang: 'en',
      notice: { text: 'Updated.', action: 'reload' },
    });
    await tab('Deficits').click();
    await withMedia(
      [
        { name: 'prefers-contrast', value: 'more' },
        { name: 'prefers-reduced-motion', value: 'reduce' },
      ],
      () => expectAxeClean(),
    );
  });
});

describe('panel layout', () => {
  test('the phone layout wins: #workspace-panel is display: contents at 390 px, a flex column on desktop', async () => {
    await mount();
    await page.viewport(1280, 800);
    expect(getComputedStyle(panel('workspace-panel')).display).toBe('flex');
    await page.viewport(390, 844);
    expect(getComputedStyle(panel('workspace-panel')).display).toBe('contents');
  });
});

describe('axe', () => {
  test('list, with a notice and the strip, in light and dark, desktop and 390 px', async () => {
    await mount({
      explorer: 'deficits',
      selection: {
        kind: 'region',
        label: 'Precentral gyrus',
        side: 'L',
        sideWord: 'left',
        clearable: true,
      },
      selectedRegion: { id: 'left:1' },
      notice: { text: 'Planum was updated.', action: 'reload' },
    });
    await tab('Deficits').click();
    await expect.element(page.getByRole('button', { name: /^Inspect/ })).toBeVisible();
    await expectAxeClean();
  });

  test('detail with the location bar and its slots', async () => {
    await mount({ selectedRegion: { id: 'left:2' } }, { slots: 'stepper' });
    await expect.poll(view).toBe('detail');
    await expectAxeClean();
  });

  test('French detail', async () => {
    await mount({
      lang: 'fr',
      explorer: 'circuits',
      selectedRegion: { id: 'left:2' },
      place: 'Voie motrice',
    });
    await expect.poll(view).toBe('detail');
    await expectAxeClean();
  });
});
