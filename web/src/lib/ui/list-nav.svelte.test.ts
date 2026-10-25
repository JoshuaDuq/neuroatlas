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

describe('listNav', () => {
  test('Down and Enter in the field move to the first row and are handled', async () => {
    field.focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(rows[0]);
    field.focus();
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
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

  test('with no rows the field keeps its keys', async () => {
    host.querySelector('.list')!.replaceChildren();
    field.focus();
    const down = new KeyboardEvent('keydown', {
      key: 'ArrowDown',
      bubbles: true,
      cancelable: true,
    });
    field.dispatchEvent(down);
    expect(down.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(field);
  });

  test('composition and modified keys are left alone', () => {
    field.focus();
    for (const init of [
      { isComposing: true },
      { altKey: true },
      { ctrlKey: true },
      { shiftKey: true },
    ]) {
      const event = new KeyboardEvent('keydown', {
        key: 'ArrowDown',
        bubbles: true,
        cancelable: true,
        ...init,
      });
      field.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
      expect(document.activeElement).toBe(field);
    }
    rows[0].focus();
    const alt = new KeyboardEvent('keydown', {
      key: 'ArrowDown',
      altKey: true,
      bubbles: true,
      cancelable: true,
    });
    rows[0].dispatchEvent(alt);
    expect(alt.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(rows[0]);
  });

  test('keys on something that is not a row are not taken', () => {
    const extra = host.querySelector('.list')!.appendChild(document.createElement('select'));
    extra.focus();
    const down = new KeyboardEvent('keydown', {
      key: 'ArrowDown',
      bubbles: true,
      cancelable: true,
    });
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
