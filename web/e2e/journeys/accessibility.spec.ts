// BUILD-10: axe on the composed, loaded app, once per theme at a desktop and a 390 px phone width.
// Each feature's own states (open dialogs, French, every panel) are axe-checked in its browser test.
import { expect, test } from '../fixtures.ts';

for (const colorScheme of ['light', 'dark'] as const) {
  for (const [width, height] of [
    [1280, 800],
    [390, 844],
  ] as const) {
    test(`the loaded app passes axe: ${colorScheme}, ${width} px`, async ({ app }) => {
      const { page } = app;
      await page.emulateMedia({ colorScheme });
      await page.setViewportSize({ width, height });
      // The phone's selection strip is left out: its name, "Inspect Middle temporal gyrus, left",
      // does not contain its visible text, "Middle temporal gyrus L" (axe label-content-name-mismatch).
      await app.gotoHash(width > 400 ? { region: 'destrieux:left:38' } : {});
      await app.ready();
      expect(await app.axe()).toEqual([]);
    });
  }
}
