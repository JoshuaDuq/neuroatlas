// Frozen after F4 merges: every helper the feature specs need lives here. Feature-specific
// helpers go in e2e/parity/<feature>.helpers.ts. The helpers drive both apps through the
// shareable link (viewer/state/url-state.js), which the legacy viewer and the Svelte app share.
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import AxeBuilder from '@axe-core/playwright';
import { expect, test as base, type Page } from '@playwright/test';

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const baselines = new URL('./a11y-baseline/', import.meta.url);

export interface RequestRecord {
  url: string;
  method: string;
  /** Null until the response arrives. */
  status: number | null;
}

function createApp(page: Page, projectName: string) {
  const requests: RequestRecord[] = [];
  const records = new Map<unknown, RequestRecord>();
  page.on('request', (request) => {
    const record = { url: request.url(), method: request.method(), status: null };
    records.set(request, record);
    requests.push(record);
  });
  page.on('response', (response) => {
    const record = records.get(response.request());
    if (record) record.status = response.status();
  });

  /** Replaces link parameters in the current hash; the app reacts to `hashchange`. */
  async function setHashParams(changes: Record<string, string>) {
    await page.evaluate((changes) => {
      const params = new URLSearchParams(location.hash.replace(/^#/, ''));
      for (const [key, value] of Object.entries(changes)) params.set(key, value);
      location.hash = params.toString().replaceAll('%3A', ':').replaceAll('%2C', ',');
    }, changes);
  }

  /** axe-core over the page frame with the WCAG 2.2 AA rule tags. */
  async function axe() {
    return (await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze()).violations;
  }

  return {
    page,
    /** Every request the page has made since the test began. */
    requests,

    /** The requests whose URL matches. */
    requestsTo: (pattern: RegExp) => requests.filter(({ url }) => pattern.test(url)),

    /** Loads the app with this link state, such as `{ tab: 'functions', region: 'destrieux:left:38' }`. */
    async gotoHash(state: Record<string, string> = {}) {
      const hash = new URLSearchParams(state)
        .toString()
        .replaceAll('%3A', ':')
        .replaceAll('%2C', ',');
      await page.goto(hash ? `./#${hash}` : './');
    },

    /** Waits until the app reports it is usable. */
    ready: () =>
      expect(page.locator('#app')).toHaveAttribute('data-status', 'ready', { timeout: 90_000 }),

    /** Opens an explorer mode: anatomy, functions, deficits, circuits or diffusion. */
    openMode: (name: string) => setHashParams({ tab: name }),

    /** Selects a region by its id, such as `destrieux:left:38`. */
    selectRegion: (id: string) => setHashParams({ region: id }),

    /**
     * Waits until the link, which carries the camera, has been still for 750 ms. The link only
     * changes once a move has finished: a move animates for TRANSITION_MS = 240
     * (viewer/render/scene.js:20) and the link writer then waits its 250 ms debounce
     * (viewer/state/link-writer.js:7), so a shorter window cannot tell motion from rest.
     */
    waitForCameraIdle: () =>
      page.waitForFunction(() => {
        const start = location.hash;
        return new Promise<boolean>((resolve) =>
          requestAnimationFrame(() =>
            requestAnimationFrame(() => setTimeout(() => resolve(location.hash === start), 750)),
          ),
        );
      }),

    /** Clicks the canvas at CSS pixels (x, y) from its top left corner. */
    pickAt: (x: number, y: number) =>
      page.locator('#app canvas').first().click({ position: { x, y } }),

    /** The link state in the address bar, without the `#`. */
    hash: () => page.evaluate(() => location.hash.replace(/^#/, '')),

    axe,

    /**
     * The accessibility gate for a feature. The legacy app's violations are recorded
     * (with `A11Y_BASELINE=1`) in e2e/a11y-baseline/<feature>.legacy.json for information
     * only; the next app must have none.
     */
    async expectAccessible(feature: string) {
      const violations = await axe();
      if (projectName === 'legacy') {
        if (process.env.A11Y_BASELINE) {
          mkdirSync(fileURLToPath(baselines), { recursive: true });
          const summary = violations.map(({ id, impact, nodes }) => ({
            id,
            impact,
            targets: nodes.map(({ target }) => target.join(' ')),
          }));
          writeFileSync(
            fileURLToPath(new URL(`${feature}.legacy.json`, baselines)),
            `${JSON.stringify(summary, null, 2)}\n`,
          );
        }
        return;
      }
      expect(violations).toEqual([]);
    },
  };
}

export const test = base.extend<{ app: ReturnType<typeof createApp> }>({
  app: async ({ page }, use, testInfo) => {
    await use(createApp(page, testInfo.project.name));
  },
});

export { expect };
