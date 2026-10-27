// The shell as the app mounts it over the fake engine, for the masthead and status region tests. Not shipped.
import { flushSync, mount, unmount } from 'svelte';
import { expect, vi } from 'vitest';
import { page } from 'vitest/browser';
import manifestFile from '../../../../public/models/cdmd/manifest.json' with { type: 'json' };
import domainsFile from '../../../../public/models/cdmd/neuropsych-domains.json' with { type: 'json' };
import { validateNeuropsychDomains } from '../../lib/core/catalog/neuropsych-domains.ts';
import type { NeuropsychDomains } from '../../lib/core/catalog/neuropsych-domains.ts';
import { createFakeEngine } from '../../lib/engine/fake.ts';
import type { FakeEngine } from '../../lib/engine/fake.ts';
import type { Manifest } from '../../lib/types/index.ts';
import { expectAxeCleanOnce } from '../../lib/ui/a11y-test-support.ts';
import { attachAnnouncer } from '../../lib/ui/announcer.svelte.ts';
import { createApp } from '../application.svelte.ts';
import type { App } from '../application.svelte.ts';
import AppShell from '../App.svelte';
import { shellOptions, startApp } from '../boot.ts';

export const manifest = manifestFile as unknown as Manifest;
const domains = validateNeuropsychDomains(
  domainsFile as unknown as NeuropsychDomains,
  new Map(manifest.regions.map((region) => [region.id, region])),
);

export interface Shell {
  engine: FakeEngine;
  app: App;
  target: HTMLElement;
  /** The live region the page's announcer speaks through. */
  announcer: HTMLElement;
  /** Mounts the shell; with `start`, runs the app's start on the link, as main.ts does. */
  open(options?: { hash?: string; start?: boolean; tractAnatomy?: string }): Promise<void>;
  close(): void;
}

/** One shell per test: `open` it, `close` it in `afterEach`. */
export function createShell(): Shell {
  const shell = {} as Shell;
  let mounted: Record<string, unknown> | null = null;
  let detach: () => void;

  Object.assign(shell, {
    async open({ hash = '', start = true, tractAnatomy }: Parameters<Shell['open']>[0] = {}) {
      await page.viewport(1280, 800);
      localStorage.clear();
      history.replaceState(null, '', `${location.pathname}${hash}`);
      shell.target = document.body.appendChild(document.createElement('div'));
      shell.target.id = 'app';
      shell.announcer = document.body.appendChild(document.createElement('p'));
      detach = attachAnnouncer(shell.announcer);
      // As the real engine's canvas is: focusable, and the stage's first child.
      const canvas = document.createElement('canvas');
      canvas.tabIndex = 0;
      shell.engine = createFakeEngine({
        manifest,
        domains: domains as never,
        canvas,
        ...(tractAnatomy && { tractAnatomy }),
      });
      shell.app = createApp();
      mounted = mount(AppShell, { target: shell.target, ...shellOptions(shell.app) });
      flushSync();
      if (!start) return;
      await startApp(shell.app, async ({ host }) => {
        host.prepend(canvas);
        return shell.engine;
      });
      flushSync();
    },
    close() {
      shell.app.dispose();
      if (mounted) unmount(mounted);
      mounted = null;
      detach();
      shell.announcer.remove();
      shell.target.remove();
      history.replaceState(null, '', location.pathname);
      vi.restoreAllMocks();
    },
  });
  return shell;
}

/**
 * axe in both themes at desktop and phone width, with the masthead's data bar refitted to each size:
 * it measures itself, a frame after the window changes, and is crammed until then.
 */
export async function expectAxeCleanFitted(): Promise<void> {
  for (const theme of ['light', 'dark'] as const) {
    for (const [width, height] of [
      [1280, 800],
      [390, 844],
    ] as const) {
      await page.viewport(width, height);
      await expect
        .poll(() => document.querySelector('.data-bar')!.hasAttribute('data-collapsed'))
        .toBe(width === 390);
      await expectAxeCleanOnce(theme, width);
    }
  }
}
