// The app shell: landmarks and their order, the tab order and the data-status cascade, before the engine.
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { expectAxeClean } from '../lib/ui/a11y-test-support.ts';
import { attachAnnouncer } from '../lib/ui/announcer.svelte.ts';
import type { Language, SessionState } from '../lib/types/index.ts';
import App from './App.svelte';
import { APP, createApp } from './application.svelte.ts';
import type { App as AppStore } from './application.svelte.ts';

let target: HTMLElement;
let app: Record<string, unknown>;
let store: AppStore;
let announcer: HTMLElement;
let detach: () => void;
let props = $state<{ status?: SessionState['status']; lang?: Language }>({});

/** `#app` is the mount point of index.html; the shell sets its data-status and lays it out. */
function mountShell(shellProps: typeof props = {}) {
  Object.assign(props, shellProps);
  app = mount(App, { target, props, context: new Map([[APP, store]]) });
  flushSync();
}

beforeEach(async () => {
  // The test frame is phone-sized by default.
  await page.viewport(1280, 800);
  store = createApp();
  announcer = document.body.appendChild(document.createElement('p'));
  detach = attachAnnouncer(announcer);
  target = document.body.appendChild(document.createElement('div'));
  target.id = 'app';
  target.dataset.status = 'loading';
  for (const key of Object.keys(props)) delete props[key as keyof typeof props];
});
afterEach(() => {
  unmount(app);
  store.dispose();
  detach();
  announcer.remove();
  target.remove();
  history.replaceState(null, '', location.pathname);
});

describe('landmarks', () => {
  test('one banner, complementary, main and contentinfo, in that order', async () => {
    mountShell();
    const landmarks = [...target.querySelectorAll('header#masthead, aside, main, footer')].map(
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
      .element(page.getByRole('complementary', { name: 'Panneau de l’atlas' }))
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
    const stops = ['aside', 'main'].map((selector) =>
      target.querySelector(selector)!.appendChild(document.createElement('button')),
    );
    await userEvent.tab();
    expect(document.activeElement).toBe(target.querySelector('header#masthead .skip-link'));
    // The masthead's own buttons come before the panel, which comes before the stage.
    const regions: string[] = [];
    while (document.activeElement !== stops[1] && regions.length < 30) {
      await userEvent.tab();
      const region = document.activeElement!.closest('header#masthead, aside, main')!.tagName;
      if (regions.at(-1) !== region) regions.push(region);
    }
    expect(regions).toEqual(['HEADER', 'ASIDE', 'MAIN']);
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
