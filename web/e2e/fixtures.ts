// The helpers every journey in e2e/journeys/ shares. They drive the built app through its
// shareable link (src/lib/core/state/url-state.ts).
import AxeBuilder from '@axe-core/playwright';
import { expect, test as base, type Page } from '@playwright/test';

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

export interface RequestRecord {
  url: string;
  method: string;
  /** Null until the response arrives. */
  status: number | null;
}

function createApp(page: Page) {
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

    /**
     * Waits until the link, which carries the camera, has been still for 750 ms. The link only
     * changes once a move has finished: a move animates for TRANSITION_MS = 240
     * and the link writer then waits its 250 ms debounce, so a shorter window cannot tell motion
     * from rest.
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

    /** The link state in the address bar, without the `#`. */
    hash: () => page.evaluate(() => location.hash.replace(/^#/, '')),

    axe,
  };
}

export const test = base.extend<{ app: ReturnType<typeof createApp> }>({
  app: async ({ page }, use) => {
    await use(createApp(page));
  },
});

export { expect };
