// Switch against the APG Switch pattern.
import { describe, expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';
import { expectAxeClean, withMedia } from './a11y-test-support.ts';
import Switch from './Switch.svelte';

const toggle = () => page.getByRole('switch', { name: 'Single-key shortcuts' });
const el = () => toggle().element() as HTMLElement;
const props = (extra = {}) => ({ checked: false, label: 'Single-key shortcuts', ...extra });

// Two frames start the transitions a change triggers; then they are awaited, not timed.
async function settled() {
  for (let frame = 0; frame < 2; frame++)
    await new Promise((resolve) => requestAnimationFrame(resolve));
  await Promise.all(
    el()
      .getAnimations({ subtree: true })
      .map((animation) => animation.finished),
  );
}

describe('Switch', () => {
  test('role switch named by its visible label, state in aria-checked', async () => {
    render(Switch, props({ checked: true }));
    await expect.element(toggle()).toBeVisible();
    expect(el().getAttribute('aria-checked')).toBe('true');
  });

  test('Space and Enter toggle it, and a click on the label does too', async () => {
    render(Switch, props());
    el().focus();
    await userEvent.keyboard(' ');
    expect(el().getAttribute('aria-checked')).toBe('true');
    await userEvent.keyboard('{Enter}');
    expect(el().getAttribute('aria-checked')).toBe('false');
    await page.getByText('Single-key shortcuts').click();
    expect(el().getAttribute('aria-checked')).toBe('true');
  });

  test('a disabled switch ignores the keyboard and is not focusable', async () => {
    render(Switch, props({ disabled: true }));
    expect(el().hasAttribute('disabled')).toBe(true);
    el().focus();
    await userEvent.keyboard(' ');
    expect(el().getAttribute('aria-checked')).toBe('false');
  });

  test('the target is at least 24 px tall and wide', async () => {
    render(Switch, props());
    const box = el().getBoundingClientRect();
    expect(box.width).toBeGreaterThanOrEqual(24);
    expect(box.height).toBeGreaterThanOrEqual(24);
  });

  test('forced colours draw track and thumb in CanvasText, inverted when on', async () => {
    render(Switch, props());
    await withMedia([{ name: 'forced-colors', value: 'active' }], async () => {
      const thumb = el().querySelector('.switch-thumb') as HTMLElement;
      expect(getComputedStyle(el()).borderTopColor).toBe(getComputedStyle(thumb).backgroundColor);
      const off = getComputedStyle(thumb).backgroundColor;
      el().click();
      // The colours transition; read them once the transitions have finished.
      await settled();
      expect(getComputedStyle(thumb).backgroundColor).not.toBe(off);
      expect(getComputedStyle(el()).backgroundColor).toBe(off);
    });
  });

  test('axe: light and dark, desktop and 390 px, off and on', async () => {
    render(Switch, props());
    await expectAxeClean();
    el().click();
    await expectAxeClean();
  });
});
