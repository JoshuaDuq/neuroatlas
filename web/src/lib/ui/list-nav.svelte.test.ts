// listNav in Chromium: the field-to-list hand-off of the Functions, Deficits and Tracts lists.
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { listNav } from './list-nav.ts';

let host: HTMLElement;
let field: HTMLInputElement;
let rows: HTMLButtonElement[];
let action: ReturnType<typeof listNav>;

beforeEach(() => {
  host = document.body.appendChild(document.createElement('div'));
  host.innerHTML = `<input type="search" aria-label="Search">
    <div class="list">
      <button type="button" class="row">One</button>
      <button type="button" class="bridge">Two</button>
      <button type="button" class="row">Three</button>
    </div>`;
  field = host.querySelector('input')!;
  rows = [...host.querySelectorAll('button')];
  action = listNav(host.querySelector('.list')!, { field, rows: '.row, .bridge' });
});
afterEach(() => {
  action.destroy();
  host.remove();
});

const keydown = (key: string, init: KeyboardEventInit = {}) =>
  new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });

describe('listNav', () => {
  test('Down and Enter in the field move to the first row and are handled', async () => {
    field.focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(rows[0]);
    field.focus();
    const enter = keydown('Enter');
    field.dispatchEvent(enter);
    expect(enter.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(rows[0]);
  });

  test('Up and Down walk the rows, stop at the last, and Up from the first returns to the field', async () => {
    rows[0].focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(rows[1]);
    await userEvent.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(rows[2]);
    await userEvent.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(rows[2]);
    await userEvent.keyboard('{ArrowUp}{ArrowUp}');
    expect(document.activeElement).toBe(rows[0]);
    await userEvent.keyboard('{ArrowUp}');
    expect(document.activeElement).toBe(field);
  });

  test('with no rows the field keeps its keys', () => {
    host.querySelector('.list')!.replaceChildren();
    field.focus();
    const down = keydown('ArrowDown');
    field.dispatchEvent(down);
    expect(down.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(field);
  });

  test('Enter and ArrowDown while composing do not move focus and are not handled', () => {
    field.focus();
    for (const key of ['Enter', 'ArrowDown']) {
      const event = keydown(key, { isComposing: true });
      field.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
      expect(document.activeElement).toBe(field);
    }
  });

  test('modified keys are left alone', () => {
    field.focus();
    for (const init of [{ altKey: true }, { ctrlKey: true }, { shiftKey: true }]) {
      const event = keydown('ArrowDown', init);
      field.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
      expect(document.activeElement).toBe(field);
    }
    rows[0].focus();
    const alt = keydown('ArrowDown', { altKey: true });
    rows[0].dispatchEvent(alt);
    expect(alt.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(rows[0]);
  });

  test('keys on something that is not a row are not taken', () => {
    const extra = host.querySelector('.list')!.appendChild(document.createElement('select'));
    extra.focus();
    const down = keydown('ArrowDown');
    extra.dispatchEvent(down);
    expect(down.defaultPrevented).toBe(false);
  });

  test('update points the action at a new field; destroy removes the listeners', async () => {
    const other = host.insertBefore(document.createElement('input'), field);
    action.update({ field: other, rows: '.row, .bridge' });
    field.focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(field);
    other.focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(rows[0]);
    await userEvent.keyboard('{ArrowUp}');
    expect(document.activeElement).toBe(other);
    action.destroy();
    other.focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(other);
  });
});
