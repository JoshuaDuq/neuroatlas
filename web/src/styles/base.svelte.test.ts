import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { withMedia } from '../lib/ui/a11y-test-support.ts';
import './index.css';

let host: HTMLElement;
beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
});
afterEach(() => host.remove());

/** What a CSS colour (or a `var(--token)`) computes to, read through a probe element. */
function colour(value: string): string {
  const probe = document.createElement('span');
  probe.style.color = value;
  host.append(probe);
  return getComputedStyle(probe).color;
}

function addButton(label: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.textContent = label;
  host.append(button);
  return button;
}

/** What a font stack token computes to, read through a probe element. */
function family(token: string): string {
  const probe = document.createElement('span');
  probe.style.fontFamily = `var(${token})`;
  host.append(probe);
  return getComputedStyle(probe).fontFamily;
}

describe('UI-09: one focus ring, for keyboard focus only', () => {
  test('keyboard focus draws a 2px accent outline 2px off the element', async () => {
    const button = addButton('Keyboard');
    // A key press first, so script focus counts as keyboard focus.
    await userEvent.keyboard('{Shift}');
    button.focus();
    expect(document.activeElement).toBe(button);
    const style = getComputedStyle(button);
    expect(style.outlineStyle).toBe('solid');
    expect(style.outlineWidth).toBe('2px');
    expect(style.outlineOffset).toBe('2px');
    expect(style.outlineColor).toBe(colour('var(--accent)'));
  });

  test('pointer focus draws none', async () => {
    const button = addButton('Pointer');
    await page.elementLocator(button).click();
    expect(document.activeElement).toBe(button);
    expect(getComputedStyle(button).outlineStyle).toBe('none');
  });

  test('forced colours make the ring Highlight and button borders CanvasText', async () => {
    const button = addButton('Forced');
    await withMedia([{ name: 'forced-colors', value: 'active' }], async () => {
      await userEvent.tab();
      expect(document.activeElement).toBe(button);
      const style = getComputedStyle(button);
      expect(style.outlineColor).toBe(colour('Highlight'));
      expect(style.borderTopColor).toBe(colour('CanvasText'));
    });
  });
});

describe('UI-10: hidden is hidden, and visually hidden text stays in the accessibility tree', () => {
  test('[hidden] hides an element whatever its own display', () => {
    const element = document.createElement('div');
    element.hidden = true;
    element.style.display = 'flex';
    host.append(element);
    expect(getComputedStyle(element).display).toBe('none');
  });

  test('.visually-hidden takes the text off screen but still names a button', async () => {
    const button = document.createElement('button');
    button.innerHTML = '<span class="visually-hidden">Close dialog</span>';
    host.append(button);
    const hidden = getComputedStyle(button.firstElementChild!);
    expect(hidden.position).toBe('absolute');
    expect(hidden.width).toBe('1px');
    expect(hidden.height).toBe('1px');
    expect(hidden.margin).toBe('-1px');
    expect(hidden.overflow).toBe('hidden');
    expect(hidden.clipPath).toBe('inset(50%)');
    expect(hidden.whiteSpace).toBe('nowrap');
    await expect.element(page.getByRole('button', { name: 'Close dialog' })).toBeInTheDocument();
  });

  test('the body uses the UI face and ink on the canvas ground', () => {
    const style = getComputedStyle(document.body);
    expect(style.margin).toBe('0px');
    expect(style.fontFamily).toBe(family('--font-ui'));
    expect(style.color).toBe(colour('var(--text-primary)'));
    expect(style.backgroundColor).toBe(colour('var(--surface-canvas)'));
  });
});

describe('UI-11: keys are drawn as caps and quantities line up', () => {
  const caption = () =>
    getComputedStyle(document.documentElement).getPropertyValue('--text-caption').trim();
  const sized = (value: string) => {
    const probe = document.createElement('span');
    probe.style.fontSize = value;
    host.append(probe);
    return getComputedStyle(probe).fontSize;
  };

  test('kbd is a 20px cap in the monospace caption face', () => {
    host.innerHTML = '<kbd>1</kbd>';
    const style = getComputedStyle(host.firstElementChild!);
    expect(style.display).toBe('inline-block');
    expect(style.minWidth).toBe('20px');
    expect(style.fontFamily).toBe(family('--font-mono'));
    expect(style.fontSize).toBe(sized(caption()));
    expect(style.textAlign).toBe('center');
    expect(style.color).toBe(colour('var(--text-secondary)'));
    expect(style.backgroundColor).toBe(colour('var(--surface-base)'));
    expect(style.borderTopWidth).toBe('1px');
    expect(style.borderTopColor).toBe(colour('var(--border-subtle)'));
    expect(style.boxShadow).toContain('inset');
  });

  test('.key-range is tertiary caption text, .measure has tabular figures, .code is monospace caption', () => {
    host.innerHTML =
      '<span class="key-range">1-6</span><span class="measure">1.0</span><span class="code">a.b</span>';
    const [range, measure, code] = [...host.children].map((element) => getComputedStyle(element));
    expect(range!.color).toBe(colour('var(--text-tertiary)'));
    expect(range!.fontSize).toBe(sized(caption()));
    expect(measure!.fontVariantNumeric).toBe('tabular-nums');
    expect(code!.fontFamily).toBe(family('--font-mono'));
    expect(code!.fontSize).toBe(sized(caption()));
  });
});
