// The app shell: landmarks and their order, the skip link, and the data-status cascade.
import { createRawSnippet, flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { expectAxeClean } from '../lib/ui/a11y-test-support.ts';
import type { Language, SessionState } from '../lib/types/index.ts';
import App from './App.svelte';

let target: HTMLElement;
let app: Record<string, unknown>;
let props = $state<{ status?: SessionState['status']; lang?: Language }>({});

// What H2 and H4 render into the two slots: the banner and contentinfo landmarks.
const masthead = createRawSnippet(() => ({ render: () => '<header id="masthead"></header>' }));
const statusBar = createRawSnippet(() => ({ render: () => '<footer id="colophon"></footer>' }));

/** `#app` is the mount point of index.html; the shell sets its data-status and lays it out. */
function mountShell(shellProps: typeof props = {}) {
  Object.assign(props, shellProps);
  app = mount(App, { target, props: Object.assign(props, { masthead, statusBar }) });
  flushSync();
}

beforeEach(async () => {
  // The test frame is phone-sized by default.
  await page.viewport(1280, 800);
  target = document.body.appendChild(document.createElement('div'));
  target.id = 'app';
  target.dataset.status = 'loading';
  for (const key of Object.keys(props)) delete props[key as keyof typeof props];
});
afterEach(() => {
  unmount(app);
  target.remove();
  history.replaceState(null, '', location.pathname);
});

describe('landmarks', () => {
  test('one banner, complementary, main and contentinfo, in that order', async () => {
    mountShell();
    const landmarks = [...target.querySelectorAll('header, aside, main, footer')].map(
      (element) => element.tagName,
    );
    expect(landmarks).toEqual(['HEADER', 'ASIDE', 'MAIN', 'FOOTER']);
    for (const role of ['banner', 'complementary', 'main', 'contentinfo']) {
      await expect.element(page.getByRole(role)).toBeInTheDocument();
    }
    expect(document.querySelectorAll('nav')).toHaveLength(0);
  });

  test('the complementary landmark is named in the reader’s language', async () => {
    mountShell({ lang: 'fr' });
    await expect
      .element(page.getByRole('complementary', { name: 'Détails anatomiques' }))
      .toBeInTheDocument();
  });

  test('the footer is gone on a phone, where the sheet carries its text', async () => {
    mountShell();
    await page.viewport(390, 844);
    try {
      expect(getComputedStyle(target.querySelector('footer')!).display).toBe('none');
      expect(getComputedStyle(target.querySelector('aside')!).display).toBe('contents');
    } finally {
      await page.viewport(1280, 800);
    }
  });
});

describe('tab order', () => {
  test('the masthead comes first, then the panel, then the stage; main is a focus target only', async () => {
    mountShell();
    const stops = ['header', 'aside', 'main'].map((selector) =>
      target.querySelector(selector)!.appendChild(document.createElement('button')),
    );
    for (const stop of stops) {
      await userEvent.tab();
      expect(document.activeElement).toBe(stop);
    }
    const main = target.querySelector('main')!;
    expect(main.tabIndex).toBe(-1);
    main.focus();
    expect(document.activeElement).toBe(main);
  });

  test('passes axe in both themes and at phone width', async () => {
    mountShell();
    await expectAxeClean();
  });
});

describe('data-status', () => {
  test('follows the status on the mount point, from loading', async () => {
    mountShell();
    expect(target.dataset.status).toBe('loading');
    for (const status of ['ready', 'switching', 'error', 'context-lost'] as const) {
      props.status = status;
      flushSync();
      expect(target.dataset.status).toBe(status);
    }
  });
});
