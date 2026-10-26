// The masthead region as the app mounts it, over the fake engine: the data bar in its slot, the settings the
// reader chooses, the skip link, Full screen and Save image, and the Shortcuts and Provenance dialogs.
import '../../styles/index.css';
import { flushSync } from 'svelte';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { tractCatalog } from '../../lib/core/diffusion/catalogs.ts';
import { domainName } from '../../lib/core/catalog/neuropsych-domains.ts';
import { t } from '../../lib/core/i18n/index.ts';
import { ASSET_BASE } from '../../../build/site.ts';
import * as snapshot from '../../features/snapshot/snapshot.ts';
import { createShell, expectAxeCleanFitted } from './shell-test-support.ts';

vi.mock('../../lib/core/assets/published-anatomy.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/core/assets/published-anatomy.ts')>()),
  loadAnatomies: async () => ({ default: 'cdmd', anatomies: [{ id: 'cdmd' }] }),
}));
// The real saver, watched: that the masthead reaches it with the stage is the rule under test.
vi.mock('../../features/snapshot/snapshot.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../features/snapshot/snapshot.ts')>();
  return { ...actual, saveSnapshot: vi.fn(async () => {}) };
});

const shell = createShell();
afterEach(() => shell.close());

const press = (key: string) =>
  document.body.dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
  );
const button = (name: string) => page.getByRole('button', { name, exact: true });
const dialogNamed = (name: string) =>
  [...document.querySelectorAll('dialog')].find(
    (dialog) => dialog.querySelector('h2')?.textContent === name,
  )!;

describe('what the masthead region holds', () => {
  test('the one banner is #masthead; the data bar sits between the brand and the buttons', async () => {
    await shell.open();
    expect(document.querySelectorAll('header#masthead')).toHaveLength(1);
    const header = document.querySelector('header#masthead')!;
    expect(page.getByRole('banner').elements()).toEqual([header]);
    const names = [...header.querySelectorAll<HTMLElement>('a, h1, select, button')]
      .filter((element) => element.checkVisibility())
      .map(
        (element) =>
          element.getAttribute('aria-label') ??
          (element instanceof HTMLSelectElement
            ? element.labels?.[0]?.textContent
            : element.textContent!.trim()),
      );
    expect(names.slice(0, 3)).toEqual(['Skip to model', 'Planum', 'Atlas']);
    expect(names.slice(-2)).toEqual(['Save image (PNG)', 'More settings']);
    // One subject is published, so there is no Subject field.
    expect(names).toContain('Colour');
    expect(names).toContain('Internal anatomy');
    expect(names).not.toContain('Subject');
  });

  test('before the engine the masthead is there without a data bar, and Save image waits', async () => {
    await shell.open({ start: false });
    expect(document.querySelectorAll('header#masthead')).toHaveLength(1);
    expect(document.querySelector('.data-bar')).toBeNull();
    await expect.element(button('Save image (PNG)')).toBeDisabled();
    await expect.element(button('More settings')).toBeEnabled();
  });

  test('passes axe in both themes at desktop and phone width, once the data bar has refitted', async () => {
    await shell.open();
    await expectAxeCleanFitted();
  });
});

describe('skip to model', () => {
  test('focuses the canvas with a visible ring and leaves the link alone', async () => {
    await shell.open();
    await userEvent.tab();
    expect(document.activeElement!.textContent).toBe('Skip to model');
    await userEvent.keyboard('{Enter}');
    expect(document.activeElement).toBe(shell.engine.canvas);
    expect(document.activeElement!.matches(':focus-visible')).toBe(true);
    // The link is not followed: the address does not become #viewport.
    expect(location.hash).not.toBe('#viewport');
  });

  test('shows the ring when the link was activated with no key behind it', async () => {
    await shell.open();
    await userEvent.click(page.getByRole('heading', { name: 'Planum' }));
    document.querySelector<HTMLElement>('.skip-link')!.click();
    expect(document.activeElement).toBe(shell.engine.canvas);
    expect(document.activeElement!.matches(':focus-visible')).toBe(true);
  });

  test('focuses the stage while there is no canvas', async () => {
    await shell.open({ start: false });
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    expect(document.activeElement).toBe(document.getElementById('viewport'));
  });

  test('focuses the stage when the canvas cannot take focus', async () => {
    await shell.open();
    shell.engine.canvas.tabIndex = -1;
    shell.engine.canvas.hidden = true;
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    expect(document.activeElement).toBe(document.getElementById('viewport'));
  });
});

describe('the settings the reader chooses', () => {
  test('Français re-labels the regions, sets the page language and is remembered', async () => {
    await shell.open();
    await userEvent.click(button('More settings'));
    await userEvent.click(page.getByRole('radio', { name: 'Français' }));
    expect(document.documentElement.lang).toBe('fr');
    expect(localStorage.getItem('planum-lang')).toBe('fr');
    await expect
      .element(page.getByRole('complementary', { name: t('fr', 'workspace').panelAria }))
      .toBeInTheDocument();
    expect(document.getElementById('colophon')!.textContent).toContain(
      t('fr', 'footer').statementAlone,
    );
    await expect.element(button(t('fr', 'viewport').snapshot)).toBeInTheDocument();
  });

  test('a link’s language is followed and never remembered', async () => {
    await shell.open({ hash: '#lang=fr' });
    expect(document.documentElement.lang).toBe('fr');
    expect(localStorage.getItem('planum-lang')).toBeNull();
  });

  test('a theme sets the page theme, repaints the scene once and is remembered', async () => {
    await shell.open();
    await userEvent.click(button('More settings'));
    await userEvent.click(page.getByRole('radio', { name: 'Dark' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('planum.theme')).toBe('dark');
    await userEvent.click(button('More settings'));
    await expect.element(page.getByRole('radio', { name: 'Dark' })).toBeChecked();
    const themed = shell.engine.calls.filter(
      ({ method, args }) => method === 'applyTheme' && args[0] === 'dark',
    );
    expect(themed).toHaveLength(1);
  });

  test('single keys off turn the stage keys off and set the page attribute', async () => {
    await shell.open();
    expect(document.documentElement.dataset.singleKeys).toBe('on');
    press('1');
    expect(shell.app.session.state.view).toBe('left');
    await userEvent.click(button('More settings'));
    await userEvent.click(page.getByRole('radio', { name: 'Off' }));
    expect(document.documentElement.dataset.singleKeys).toBe('off');
    expect(localStorage.getItem('planum.single-key-shortcuts')).toBe('off');
    press('2');
    expect(shell.app.session.state.view).toBe('left');
  });
});

describe('Full screen and Save image', () => {
  test('both wait for the anatomy: enabled when ready or switching, not otherwise', async () => {
    vi.spyOn(document, 'fullscreenEnabled', 'get').mockReturnValue(true);
    await shell.open({ start: false });
    const enabled = () =>
      ['Full screen', 'Save image (PNG)'].map(
        (name) => !(button(name).element() as HTMLButtonElement).disabled,
      );
    expect(enabled()).toEqual([false, false]);
    for (const [status, expected] of [
      ['ready', true],
      ['switching', true],
      ['context-lost', false],
      ['error', false],
    ] as const) {
      shell.app.session.setStatus(status);
      flushSync();
      expect(enabled()).toEqual([expected, expected]);
    }
  });

  test('Save image saves the stage’s picture', async () => {
    await shell.open();
    await userEvent.click(button('Save image (PNG)'));
    expect(snapshot.saveSnapshot).toHaveBeenCalledTimes(1);
    const [stage] = vi.mocked(snapshot.saveSnapshot).mock.calls[0]!;
    expect(stage.host).toBe(document.getElementById('viewport'));
    expect(stage.engine).toBe(shell.engine);
  });

  test('Full screen asks the stage for full screen, and the labels follow the stage', async () => {
    vi.spyOn(document, 'fullscreenEnabled', 'get').mockReturnValue(true);
    await shell.open();
    const stage = document.getElementById('viewport')!;
    stage.requestFullscreen = vi.fn(async () => {});
    await userEvent.click(button('Full screen'));
    expect(stage.requestFullscreen).toHaveBeenCalledTimes(1);

    vi.spyOn(document, 'fullscreenElement', 'get').mockReturnValue(stage);
    document.dispatchEvent(new Event('fullscreenchange'));
    await expect
      .element(page.getByRole('button', { name: 'Exit full screen' }).first())
      .toBeInTheDocument();
    expect(document.querySelector('.fullscreen-button')!.getAttribute('aria-label')).toBe(
      'Exit full screen',
    );
  });
});

describe('the data bar', () => {
  test('Colour lifts the paint, then chooses the colouring', async () => {
    await shell.open();
    const { world } = shell.app;
    expect(world!.view.current.paintLifted).toBe(false);
    await userEvent.selectOptions(page.getByRole('combobox', { name: 'Colour' }), 'mri');
    await vi.waitFor(() => expect(world!.view.current.surfaceColor).toBe('mri'));
    expect(world!.view.current.paintLifted).toBe(true);
  });

  test('Atlas runs the atlas choice, lifting the paint too', async () => {
    await shell.open();
    const { world } = shell.app;
    await userEvent.selectOptions(page.getByRole('combobox', { name: 'Atlas' }), 'hcp-mmp');
    await vi.waitFor(() => expect(world!.view.current.atlas).toBe('hcp-mmp'));
    expect(world!.view.current.paintLifted).toBe(true);
  });

  test('Internal anatomy chooses the detail level', async () => {
    await shell.open();
    const { world } = shell.app;
    const other = world!.engine.model.manifest.detail_levels.find(
      ({ id }) => id !== world!.view.current.detail,
    )!;
    await userEvent.selectOptions(
      page.getByRole('combobox', { name: 'Internal anatomy' }),
      other.id,
    );
    await vi.waitFor(() => expect(world!.view.current.detail).toBe(other.id));
  });

  test('the data popover and the settings panel are never open together', async () => {
    await shell.open();
    await page.viewport(390, 844);
    const summary = page.getByRole('button', { name: /^Atlas and display settings/ });
    await expect.element(summary).toBeVisible();
    await userEvent.click(summary);
    await expect.element(summary).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(button('More settings'));
    await expect.element(summary).toHaveAttribute('aria-expanded', 'false');
    await expect.element(button('More settings')).toHaveAttribute('aria-expanded', 'true');
    // A click with no pointer press or focus move before it, so only the shared state can close the panel.
    (summary.element() as HTMLElement).click();
    await expect.element(button('More settings')).toHaveAttribute('aria-expanded', 'false');
    await expect.element(summary).toHaveAttribute('aria-expanded', 'true');
  });

  test('the tract reference replaces the subject: its name alone, and no fields', async () => {
    await shell.open({ tractAnatomy: 'reference-subject' });
    shell.app.world!.excursions.chooseExplorer('diffusion');
    flushSync();
    const bar = document.querySelector<HTMLElement>('.data-bar')!;
    expect(bar.hasAttribute('data-reference')).toBe(true);
    expect(bar.textContent).toContain(tractCatalog('reference-subject').name.en);
    expect(page.getByRole('combobox', { name: 'Atlas' }).elements()).toHaveLength(0);
  });
});

describe('the dialogs', () => {
  test('Keyboard shortcuts opens from the menu and returns focus to More settings', async () => {
    await shell.open();
    await userEvent.click(button('More settings'));
    await userEvent.click(page.getByRole('button', { name: /Keyboard shortcuts/ }));
    const dialog = dialogNamed('Keyboard shortcuts');
    await vi.waitFor(() => expect(dialog.open).toBe(true));
    expect(shell.app.ports.shortcutsOpen()).toBe(true);
    expect(dialog.parentElement).toBe(shell.target);
    await userEvent.keyboard('{Escape}');
    await vi.waitFor(() => expect(dialog.open).toBe(false));
    expect(document.activeElement).toBe(button('More settings').element());
    expect(shell.app.ports.shortcutsOpen()).toBe(false);
  });

  test('the menu item opens it with the entry animation for a pointer and without it for the keyboard', async () => {
    await shell.open();
    const dialog = dialogNamed('Keyboard shortcuts');
    const item = page.getByRole('button', { name: /Keyboard shortcuts/ });
    await userEvent.click(button('More settings'));
    await userEvent.click(item);
    await vi.waitFor(() => expect(dialog.open).toBe(true));
    expect(dialog.hasAttribute('data-instant')).toBe(false);
    await userEvent.keyboard('{Escape}');
    await vi.waitFor(() => expect(dialog.open).toBe(false));

    button('More settings').element().focus();
    await userEvent.keyboard('{Enter}');
    await expect.element(item).toBeVisible();
    item.element().focus();
    await userEvent.keyboard('{Enter}');
    await vi.waitFor(() => expect(dialog.open).toBe(true));
    expect(dialog.hasAttribute('data-instant')).toBe(true);
  });

  test('its note follows the single-keys switch', async () => {
    await shell.open();
    await userEvent.click(button('More settings'));
    await userEvent.click(page.getByRole('radio', { name: 'Off' }));
    shell.app.ports.toggleShortcuts({ instant: true });
    flushSync();
    expect(dialogNamed('Keyboard shortcuts').textContent).toContain(
      t('en', 'shortcuts').singleKeysNote(false),
    );
  });

  test('it is in the reader’s language', async () => {
    await shell.open();
    shell.app.chooseLanguage('fr');
    shell.app.ports.toggleShortcuts({ instant: true });
    flushSync();
    expect(dialogNamed(t('fr', 'shortcuts').title).open).toBe(true);
  });

  test('when the control that opened a dialog has gone, focus returns to More settings', async () => {
    await shell.open();
    const opener = page.getByRole('button', { name: 'Provenance' }).element() as HTMLElement;
    for (const [title, open] of [
      ['Provenance', () => userEvent.keyboard('{Enter}')],
      ['Keyboard shortcuts', async () => press('?')],
    ] as const) {
      opener.focus();
      await open();
      const dialog = dialogNamed(title);
      await vi.waitFor(() => expect(dialog.open).toBe(true));
      // A phone hides the status bar, and the opener with it.
      await page.viewport(390, 844);
      await userEvent.keyboard('{Escape}');
      await vi.waitFor(() => expect(dialog.open).toBe(false));
      expect(document.activeElement).toBe(button('More settings').element());
      await page.viewport(1280, 800);
    }
  });

  test('? opens it and ? closes it, with no animation', async () => {
    await shell.open();
    press('?');
    flushSync();
    const dialog = dialogNamed('Keyboard shortcuts');
    expect(dialog.open).toBe(true);
    expect(dialog.hasAttribute('data-instant')).toBe(true);
    press('?');
    flushSync();
    expect(dialog.open).toBe(false);
  });

  test('Provenance waits for the manifest in the phone menu, then opens from it and Escape returns to More settings', async () => {
    await shell.open({ start: false });
    await page.viewport(390, 844);
    await userEvent.click(button('More settings'));
    await expect.element(page.getByRole('button', { name: /Keyboard shortcuts/ })).toBeVisible();
    expect(page.getByRole('button', { name: 'Provenance' }).elements()).toHaveLength(0);
    await userEvent.keyboard('{Escape}');
    shell.close();

    await shell.open();
    await page.viewport(390, 844);
    await userEvent.click(button('More settings'));
    await userEvent.click(button('Provenance'));
    const dialog = dialogNamed('Provenance');
    await vi.waitFor(() => expect(dialog.open).toBe(true));
    expect(dialog.parentElement).toBe(shell.target);
    expect(dialog.textContent).toContain('Neuropsychological domains');
    expect(dialog.textContent).toContain(
      domainName(shell.app.world!.engine.model.domains!.domains[0]!, 'en'),
    );
    expect(dialog.hasAttribute('data-instant')).toBe(false);
    // The files it lists are the loaded anatomy's own manifest and the site's index.
    const hrefs = [...dialog.querySelectorAll('a')].map((link) => new URL(link.href).pathname);
    expect(hrefs).toContain(`${ASSET_BASE}models/cdmd/manifest.json`);
    expect(hrefs).toContain(`${ASSET_BASE}models/anatomies.json`);
    await userEvent.keyboard('{Escape}');
    await vi.waitFor(() => expect(dialog.open).toBe(false));
    expect(document.activeElement).toBe(button('More settings').element());
  });

  test('the tract reference has its own Provenance rows, from the Tracts panel’s links', async () => {
    await shell.open({ tractAnatomy: 'reference-subject' });
    shell.app.world!.excursions.chooseExplorer('diffusion');
    flushSync();
    await page.viewport(390, 844);
    await userEvent.click(button('More settings'));
    await userEvent.click(button('Provenance'));
    const dialog = dialogNamed('Provenance');
    await vi.waitFor(() => expect(dialog.open).toBe(true));
    const labels = [...dialog.querySelectorAll('dt')].map((term) => term.textContent);
    expect(labels).toEqual([t('en', 'footer').tractReference, t('en', 'footer').sources]);
    const links = [...dialog.querySelectorAll('dd a')].map((a) => a.textContent!.trim());
    expect(links).toHaveLength(2);
    expect(links[0]).toContain(t('en', 'diffusion').source);
    expect(links[1]).toContain(t('en', 'diffusion').outlineProvenance);
  });
});
