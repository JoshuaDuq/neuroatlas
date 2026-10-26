// The stage in full screen (viewport-chrome.js:625-631), with a visible way out and labels that follow
// `fullscreenchange` (decisions 4 and 33 on #4; deviations g6-fullscreen-*). One instance per stage; the
// masthead reads `active` and calls `toggle`, and the stage's "Exit full screen" button takes `exitControl`.
import { on } from 'svelte/events';
import { createSubscriber } from 'svelte/reactivity';
import { failureNotice } from '../../lib/core/i18n/errors.ts';
import type { Language, Notice } from '../../lib/types/index.ts';
import { captureInvoker } from '../../lib/ui/focus.ts';

export function createFullscreen({
  host,
  lang,
  notify,
}: {
  /** The stage host, `<main id="viewport">`: only the stage goes full screen. */
  host: HTMLElement;
  lang: () => Language;
  /** Shows a notice (`session.notify`). */
  notify: (notice: Notice) => void;
}) {
  const subscribe = createSubscriber((update) => on(document, 'fullscreenchange', update));
  // Gives focus back to the control that asked for full screen. Recorded when it asks, because the
  // browser takes focus from everything outside the full-screen stage as it enters.
  let restore = () => false;

  return {
    /** Something is full screen; read in an effect or a template, it follows `fullscreenchange`. */
    get active() {
      subscribe();
      return document.fullscreenElement !== null;
    },

    /** Enters or leaves full screen. Call it from the click or key that asked: the browser requires that activation. */
    toggle() {
      if (document.fullscreenElement) {
        void document.exitFullscreen();
        return;
      }
      restore = captureInvoker();
      host.requestFullscreen().catch((error: unknown) => {
        console.error(error);
        notify(failureNotice(error, lang(), 'fullscreen'));
      });
    },

    /**
     * Attachment for the stage's "Exit full screen" button: it is shown only while the stage is full
     * screen, set here in the event so that focus never waits on a render. Entering moves focus to it,
     * because the control that asked is outside the stage and no longer drawn. Leaving gives focus back
     * to that control if focus was on this button or nowhere, else to the stage; focus on a stage tool
     * that is still shown stays where it is.
     */
    exitControl(button: HTMLElement) {
      button.hidden = document.fullscreenElement !== host;
      return on(document, 'fullscreenchange', () => {
        if (document.fullscreenElement === host) {
          button.hidden = false;
          button.focus();
          return;
        }
        const focused = document.activeElement;
        const stranded = !focused || focused === document.body || button.contains(focused);
        button.hidden = true;
        const back = restore;
        restore = () => false;
        if (stranded && !back()) host.focus();
      });
    },
  };
}

export type Fullscreen = ReturnType<typeof createFullscreen>;
