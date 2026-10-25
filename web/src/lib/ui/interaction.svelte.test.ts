// Real-DOM checks for the interaction services, in Chromium: roving against the APG
// toolbar keyboard table, the focus registry, the announcer region and `data-instant`.
import axe from 'axe-core';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { announce, attachAnnouncer } from './announcer.svelte.ts';
import {
  FOCUS_TARGETS,
  captureInvoker,
  registerFocusTarget,
  requestFocus,
  rescueFocus,
} from './focus.ts';
import { INSTANT_ATTRIBUTE, isKeyboardActivation, setInstant } from './instant.ts';
import { OWN_KEYS_ATTRIBUTE, OWN_KEYS_SELECTOR } from './keys.ts';
import { bindRoving } from './roving.ts';

let host: HTMLElement;
beforeEach(() => {
  host = document.body.appendChild(document.createElement('div'));
});
afterEach(() => host.remove());

const html = (markup: string) => {
  host.innerHTML = markup;
  return host;
};

describe('bindRoving against the APG toolbar keyboard table', () => {
  const toolbar = `<div role="toolbar" aria-label="View presets">
    <button type="button" aria-pressed="false">Front</button>
    <button type="button" aria-pressed="true">Left</button>
    <button type="button" aria-pressed="false" disabled>Right</button>
    <button type="button" aria-pressed="false">Top</button>
  </div>`;

  test('one Tab stop on the pressed button; arrows, Home and End move focus and never press', async () => {
    html(toolbar);
    const group = host.firstElementChild as HTMLElement;
    const [front, left, , top] = [...group.querySelectorAll('button')];
    const roving = bindRoving(group);
    expect([...group.querySelectorAll('button')].map((b) => b.tabIndex)).toEqual([-1, 0, -1, -1]);

    left.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(top);
    await userEvent.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(front);
    await userEvent.keyboard('{ArrowLeft}');
    expect(document.activeElement).toBe(top);
    await userEvent.keyboard('{Home}');
    expect(document.activeElement).toBe(front);
    await userEvent.keyboard('{End}');
    expect(document.activeElement).toBe(top);
    expect(left.getAttribute('aria-pressed')).toBe('true');
    expect(top.getAttribute('aria-pressed')).toBe('false');

    await userEvent.keyboard('{Enter}');
    await userEvent.tab();
    expect(document.activeElement).not.toBe(front);
    roving.dispose();
  });

  test('Tab leaves the group and returns to the pressed button', async () => {
    html(`${toolbar}<button type="button" id="after">After</button>`);
    const group = host.firstElementChild as HTMLElement;
    bindRoving(group);
    const buttons = [...group.querySelectorAll('button')];
    buttons[0].focus();
    await userEvent.keyboard('{ArrowRight}{ArrowRight}');
    await userEvent.tab();
    expect(document.activeElement?.id).toBe('after');
    expect(buttons.map((b) => b.tabIndex)).toEqual([-1, 0, -1, -1]);
    await userEvent.tab({ shift: true });
    expect(document.activeElement).toBe(buttons[1]);
  });

  test('Alt+Arrow is left to the browser', async () => {
    html(toolbar);
    const group = host.firstElementChild as HTMLElement;
    bindRoving(group);
    const left = group.querySelectorAll('button')[1];
    left.focus();
    const event = new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      altKey: true,
      bubbles: true,
      cancelable: true,
    });
    left.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(left);
  });

  test('axe finds nothing in a roving toolbar', async () => {
    html(toolbar);
    bindRoving(host.firstElementChild as HTMLElement);
    const { violations } = await axe.run(host, {
      runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'],
    });
    expect(violations).toEqual([]);
  });
});

describe('focus registry', () => {
  const unregister: Array<() => void> = [];
  afterEach(() => {
    while (unregister.length) unregister.pop()!();
  });
  const register = (name: string, resolve: () => HTMLElement | null) =>
    unregister.push(registerFocusTarget(name, resolve));

  test('resolves lazily, so an element rendered later is found', () => {
    register(FOCUS_TARGETS.regionTitle, () => document.getElementById('title'));
    expect(requestFocus(FOCUS_TARGETS.regionTitle)).toBe(false);
    html('<h2 id="title" tabindex="-1">Region</h2>');
    expect(requestFocus(FOCUS_TARGETS.regionTitle)).toBe(true);
    expect(document.activeElement?.id).toBe('title');
  });

  test('a hidden, disabled or inert target is skipped for the fallback', () => {
    html(`<button id="undo" disabled>Undo</button>
      <div hidden><button id="restore">Restore</button></div>
      <div inert><button id="inert">Inert</button></div>
      <button id="tree" tabindex="0">Tree</button>`);
    register(FOCUS_TARGETS.dissectionUndo, () => document.getElementById('undo'));
    register('restore', () => document.getElementById('restore'));
    register('inert', () => document.getElementById('inert'));
    register(FOCUS_TARGETS.treeStop, () => document.getElementById('tree'));
    for (const name of [FOCUS_TARGETS.dissectionUndo, 'restore', 'inert']) {
      expect(requestFocus(name), name).toBe(false);
      expect(requestFocus(name, { fallback: FOCUS_TARGETS.treeStop }), name).toBe(true);
      expect(document.activeElement?.id).toBe('tree');
      (document.activeElement as HTMLElement).blur();
    }
  });

  test('reports false when a target is visible but cannot take focus', () => {
    html('<div id="plain">Not focusable</div>');
    register('plain', () => document.getElementById('plain'));
    expect(requestFocus('plain')).toBe(false);
  });

  test('an unknown name or a duplicate registration is an error', () => {
    expect(() => requestFocus('nobody')).toThrow('No focus target registered: nobody');
    register('twice', () => null);
    expect(() => registerFocusTarget('twice', () => null)).toThrow('already registered');
  });

  test('unregistering frees the name', () => {
    const off = registerFocusTarget('temporary', () => null);
    off();
    expect(() => requestFocus('temporary')).toThrow('No focus target registered');
  });

  test('rescueFocus acts only when focus is stranded', () => {
    html(`<button id="tab" role="tab" aria-selected="true">Anatomy</button>
      <button id="gone">Gone</button>`);
    register(FOCUS_TARGETS.activeTab, () => document.getElementById('tab'));
    const gone = document.getElementById('gone')!;
    gone.focus();
    expect(rescueFocus(FOCUS_TARGETS.activeTab)).toBe(false);
    expect(document.activeElement).toBe(gone);
    gone.hidden = true;
    expect(rescueFocus(FOCUS_TARGETS.activeTab)).toBe(true);
    expect(document.activeElement?.id).toBe('tab');
    (document.activeElement as HTMLElement).blur();
    expect(rescueFocus(FOCUS_TARGETS.activeTab)).toBe(true);
  });

  test('captureInvoker returns focus to the opener, unless it has gone', () => {
    html('<button id="opener">Open</button><button id="other">Other</button>');
    const opener = document.getElementById('opener')!;
    opener.focus();
    const back = captureInvoker();
    document.getElementById('other')!.focus();
    expect(back()).toBe(true);
    expect(document.activeElement).toBe(opener);
    opener.remove();
    expect(back()).toBe(false);
  });
});

describe('announcer region', () => {
  test('writes into the attached live region and stops after release', () => {
    html('<div id="announcer" role="status" aria-live="polite"></div>');
    const region = document.getElementById('announcer')!;
    const release = attachAnnouncer(region);
    announce('Hello');
    expect(region.textContent).toBe('Hello');
    release();
    expect(() => announce('Late')).toThrow('before attachAnnouncer');
  });

  test('a repeat changes the DOM twice, so the live region is observed to change', async () => {
    html('<div id="announcer" role="status" aria-live="polite"></div>');
    const region = document.getElementById('announcer')!;
    const release = attachAnnouncer(region);
    const seen: string[] = [];
    new MutationObserver(() => seen.push(region.textContent ?? '')).observe(region, {
      childList: true,
    });
    announce('Again');
    announce('Again');
    await vi.waitFor(() => expect(region.textContent).toBe('Again'));
    await vi.waitFor(() => expect(seen).toEqual(['', 'Again']));
    release();
  });
});

describe('data-instant and data-own-keys', () => {
  test('a keyboard click has detail 0, a pointer click does not', async () => {
    html('<button id="open">Open</button>');
    const button = document.getElementById('open')!;
    const details: boolean[] = [];
    button.addEventListener('click', (event) => details.push(isKeyboardActivation(event)));
    button.focus();
    await userEvent.keyboard('{Enter}');
    await userEvent.click(button);
    expect(details).toEqual([true, false]);
  });

  test('setInstant toggles the attribute', () => {
    html('<div id="sheet"></div>');
    const sheet = document.getElementById('sheet')!;
    setInstant(sheet, true);
    expect(sheet.hasAttribute(INSTANT_ATTRIBUTE)).toBe(true);
    setInstant(sheet, false);
    expect(sheet.hasAttribute(INSTANT_ATTRIBUTE)).toBe(false);
  });

  test('the own-keys marker matches the selector', () => {
    html(`<button ${OWN_KEYS_ATTRIBUTE}>a</button><button>b</button>`);
    expect(host.querySelectorAll(OWN_KEYS_SELECTOR)).toHaveLength(1);
    expect(OWN_KEYS_ATTRIBUTE).toBe('data-own-keys');
  });
});
