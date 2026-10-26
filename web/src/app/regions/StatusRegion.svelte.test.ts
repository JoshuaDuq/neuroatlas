// The status region as the app mounts it, over the fake engine: the colophon, its count and the
// Provenance button that opens the masthead region's dialog.
import '../../styles/index.css';
import { flushSync } from 'svelte';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { tractCatalog } from '../../lib/core/diffusion/catalogs.ts';
import { t } from '../../lib/core/i18n/index.ts';
import { createShell } from './shell-test-support.ts';

vi.mock('../../lib/core/assets/published-anatomy.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/core/assets/published-anatomy.ts')>()),
  loadAnatomies: async () => ({ default: 'cdmd', anatomies: [{ id: 'cdmd' }] }),
}));

const shell = createShell();
afterEach(() => shell.close());

const colophon = () => document.getElementById('colophon')!;
const count = () => colophon().querySelector('.region-count')!.textContent;
const footer = t('en', 'footer');

describe('what the status region holds', () => {
  test('one contentinfo, #colophon, with the statement, the description, the count and Provenance', async () => {
    await shell.open();
    expect(document.querySelectorAll('footer')).toHaveLength(1);
    expect(page.getByRole('contentinfo').elements()).toEqual([colophon()]);
    expect(colophon().querySelector('.colophon-statement')!.textContent).toBe(
      footer.statementAlone,
    );
    expect(colophon().querySelector('.colophon-description')!.textContent).toBe(
      footer.colophon(
        'MGH CDMD sub_013',
        shell.app.world!.engine.model.manifest.anatomy.individual,
      ),
    );
    expect(count()).toBe(footer.visibleRegions(shell.app.world!.catalog.visibleCount));
    await expect.element(page.getByRole('button', { name: 'Provenance' })).toBeVisible();
  });

  test('before the engine it states what this is and nothing about what is loaded', async () => {
    await shell.open({ start: false });
    expect(colophon().querySelector('.colophon-statement')!.textContent).toBe(
      footer.statementAlone,
    );
    expect(colophon().querySelector('.colophon-description')!.textContent).toBe('');
    expect(count()).toBe('');
    expect(page.getByRole('button', { name: 'Provenance' }).elements()).toHaveLength(0);
  });

  test('before the engine it follows the reader’s language', async () => {
    await shell.open({ start: false });
    shell.app.chooseLanguage('fr');
    flushSync();
    expect(colophon().querySelector('.colophon-statement')!.textContent).toBe(
      t('fr', 'footer').statementAlone,
    );
  });

  test('follows the reader’s language', async () => {
    await shell.open();
    shell.app.chooseLanguage('fr');
    flushSync();
    const fr = t('fr', 'footer');
    expect(colophon().querySelector('.colophon-statement')!.textContent).toBe(fr.statementAlone);
    expect(count()).toBe(fr.visibleRegions(shell.app.world!.catalog.visibleCount));
  });
});

describe('the count', () => {
  test('a download nothing in the data bar holds is shown here', async () => {
    await shell.open();
    shell.app.session.setSwitching({ loaded: 34, total: 100 });
    flushSync();
    expect(count()).toBe(t('en', 'header').loadingProgress('34%'));
    shell.app.session.endSwitching();
    flushSync();
    expect(count()).toBe(footer.visibleRegions(shell.app.world!.catalog.visibleCount));
  });

  test('a download the data bar holds is shown there only', async () => {
    await shell.open();
    const { world } = shell.app;
    const other = world!.engine.model.manifest.detail_levels.find(
      ({ id }) => id !== world!.view.current.detail,
    )!;
    let finish!: () => void;
    const held = new Promise<void>((resolve) => (finish = resolve));
    const { setDetail } = world!.engine.model;
    vi.spyOn(world!.engine.model, 'setDetail').mockImplementation(async (id, progress) => {
      progress?.({ loaded: 34, total: 100 });
      await held;
      await setDetail(id);
    });
    await userEvent.selectOptions(
      page.getByRole('combobox', { name: 'Internal anatomy' }),
      other.id,
    );
    const detailOptions = () =>
      [
        ...page
          .getByRole('combobox', { name: 'Internal anatomy' })
          .element()
          .querySelectorAll('option'),
      ].map((option) => option.textContent);
    await expect
      .poll(() => detailOptions().filter((text) => text?.endsWith(' · Loading 34%')))
      .toHaveLength(1);
    expect(count()).toBe(footer.visibleRegions(world!.catalog.visibleCount));
    finish();
    await vi.waitFor(() => expect(shell.app.session.state.status).toBe('ready'));
    // The next download, started elsewhere, is the count's again.
    shell.app.session.setSwitching({ loaded: 50, total: 100 });
    flushSync();
    expect(count()).toBe(t('en', 'header').loadingProgress('50%'));
  });

  test('in the Tracts tab it counts bundles; alone, the reference is described as reference data', async () => {
    await shell.open({ tractAnatomy: 'reference-subject' });
    shell.app.world!.excursions.chooseExplorer('diffusion');
    flushSync();
    const catalog = tractCatalog('reference-subject');
    expect(count()).toBe(t('en', 'diffusion').bundleCollection(catalog.bundles.length));
    expect(colophon().querySelector('.colophon-description')!.textContent).toBe(
      footer.referenceColophon(catalog.name.en),
    );
  });
});

describe('Provenance', () => {
  test('opens the dialog with a pointer, animated, and Escape returns focus to the button', async () => {
    await shell.open();
    const opener = page.getByRole('button', { name: 'Provenance' });
    await userEvent.click(opener);
    const dialog = [...document.querySelectorAll('dialog')].find(
      (candidate) => candidate.querySelector('h2')?.textContent === 'Provenance',
    )!;
    await vi.waitFor(() => expect(dialog.open).toBe(true));
    expect(dialog.hasAttribute('data-instant')).toBe(false);
    expect(dialog.textContent).toContain('Neuropsychological domains');
    await userEvent.keyboard('{Escape}');
    await vi.waitFor(() => expect(dialog.open).toBe(false));
    expect(document.activeElement).toBe(opener.element());
  });

  test('opens instantly from the keyboard', async () => {
    await shell.open();
    page.getByRole('button', { name: 'Provenance' }).element().focus();
    await userEvent.keyboard('{Enter}');
    const dialog = [...document.querySelectorAll('dialog')].find(
      (candidate) => candidate.querySelector('h2')?.textContent === 'Provenance',
    )!;
    await vi.waitFor(() => expect(dialog.open).toBe(true));
    expect(dialog.hasAttribute('data-instant')).toBe(true);
  });
});
