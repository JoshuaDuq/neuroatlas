// Full screen for the stage in a real browser: the toggle, labels that follow `fullscreenchange`, the
// focus hand-offs to and from the stage's exit control, and the failure notice (g6-fullscreen-*).
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { flushSync } from 'svelte';
import { userEvent } from 'vitest/browser';
import type { Language, Notice } from '../../lib/types/index.ts';
import { createFullscreen } from './fullscreen.ts';
import type { Fullscreen } from './fullscreen.ts';

let opener: HTMLButtonElement;
let host: HTMLElement;
let tool: HTMLButtonElement;
let exit: HTMLButtonElement;
let fullscreen: Fullscreen;
let notices: Notice[];
let lang: Language;
let cleanups: (() => void)[];

const button = (text: string) =>
  Object.assign(document.createElement('button'), { type: 'button', textContent: text });

beforeEach(() => {
  notices = [];
  lang = 'en';
  // The masthead's button, outside the stage, and the stage host with its exit control and a tool.
  opener = button('Full screen');
  host = Object.assign(document.createElement('main'), { id: 'viewport', tabIndex: -1 });
  tool = button('View');
  exit = button('Exit full screen');
  host.append(exit, tool);
  document.body.append(opener, host);
  fullscreen = createFullscreen({
    host,
    lang: () => lang,
    notify: (notice) => notices.push(notice),
  });
  opener.addEventListener('click', () => fullscreen.toggle());
  exit.addEventListener('click', () => fullscreen.toggle());
  cleanups = [
    fullscreen.exitControl(exit),
    // As the masthead renders it: the label follows `active`.
    $effect.root(() => {
      $effect(() => {
        opener.textContent = fullscreen.active ? 'Exit full screen' : 'Full screen';
      });
    }),
  ];
  flushSync();
});

afterEach(async () => {
  if (document.fullscreenElement) await document.exitFullscreen();
  cleanups.forEach((stop) => stop());
  opener.remove();
  host.remove();
});

const changed = () =>
  new Promise<void>((resolve) =>
    document.addEventListener('fullscreenchange', () => resolve(), { once: true }),
  );

async function enter() {
  const entered = changed();
  await userEvent.click(opener);
  await entered;
}

describe('entering', () => {
  test('the stage alone goes full screen, focus moves to the shown exit control and the label says how to leave', async () => {
    expect(exit.hidden).toBe(true);
    await enter();
    expect(document.fullscreenElement).toBe(host);
    expect(exit.hidden).toBe(false);
    expect(document.activeElement).toBe(exit);
    flushSync();
    expect(fullscreen.active).toBe(true);
    expect(opener.textContent).toBe('Exit full screen');
  });

  test('a refusal is a notice in the reader’s language, and nothing changes', async () => {
    lang = 'fr';
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    // The browser refuses an element that is not in the document.
    host.remove();
    await userEvent.click(opener);
    await vi.waitFor(() => expect(notices).toHaveLength(1));
    expect(notices[0]).toEqual({ text: 'Impossible de passer en plein écran.', action: null });
    expect(error).toHaveBeenCalledOnce();
    expect(document.fullscreenElement).toBeNull();
    expect(opener.textContent).toBe('Full screen');
    error.mockRestore();
  });
});

describe('leaving', () => {
  test('by the exit control with Enter: focus returns to the control that asked, whose label is back', async () => {
    await enter();
    const left = changed();
    await userEvent.keyboard('{Enter}');
    await left;
    expect(document.fullscreenElement).toBeNull();
    expect(exit.hidden).toBe(true);
    expect(document.activeElement).toBe(opener);
    flushSync();
    expect(opener.textContent).toBe('Full screen');
  });

  test('from a stage tool that stays shown (Escape, browser UI), focus stays on it', async () => {
    await enter();
    tool.focus();
    const left = changed();
    await document.exitFullscreen();
    await left;
    expect(document.activeElement).toBe(tool);
  });

  test('with the control that asked now disabled, focus goes to the stage rather than the page', async () => {
    await enter();
    opener.disabled = true;
    const left = changed();
    await userEvent.keyboard(' ');
    await left;
    expect(document.activeElement).toBe(host);
  });
});
