/** How a run ended: the action's value, or the error it threw. */
export type Outcome<T> = { ok: true; value: T } | { ok: false; error: unknown };

/**
 * A panel's latest-wins runner (Functions and Deficits tabs, functions.js:124, clinical.js:288;
 * the comparison's highlight, atlas-comparison.js:65-88). A later run overtakes an earlier one:
 * the earlier one still resolves, but only the latest reports. A failure is always logged,
 * and only the latest tells the reader. `cancel` overtakes the run in flight without starting
 * another, which is how a panel that closes or clears drops a download that lands later.
 */
export function createLatestRunner() {
  let latest = 0;
  return {
    cancel(): void {
      latest += 1;
    },
    /**
     * Runs `action` now. `onResult`, `onError` and `onSettled` fire only if no run started or
     * was cancelled since, `onSettled` last. The returned outcome is reported to the caller
     * whether or not the run was overtaken.
     */
    async run<T>(
      action: () => Promise<T> | T,
      handlers: {
        onResult?: (value: T) => void;
        onError?: (error: unknown) => void;
        onSettled?: () => void;
      } = {},
    ): Promise<Outcome<T>> {
      const mine = ++latest;
      let outcome: Outcome<T>;
      try {
        outcome = { ok: true, value: await action() };
      } catch (error) {
        console.error(error);
        outcome = { ok: false, error };
      }
      if (mine === latest) {
        if (outcome.ok) handlers.onResult?.(outcome.value);
        else handlers.onError?.(outcome.error);
      }
      if (mine === latest) handlers.onSettled?.();
      return outcome;
    },
  };
}

/**
 * The Circuits tab's refuse-while-busy runner (circuits.js:246-265): a run asked for while
 * another is in flight is turned away, not queued and not overtaking. Every run that starts
 * settles: the failure is logged and reported, then `onSettled` fires with `busy` already false.
 * Resolves true when the action completed, false when it failed or was refused.
 */
export function createBusyRunner() {
  let busy = false;
  return {
    get busy(): boolean {
      return busy;
    },
    async run(
      action: () => Promise<unknown> | unknown,
      handlers: {
        onStart?: () => void;
        onError?: (error: unknown) => void;
        onSettled?: () => void;
      } = {},
    ): Promise<boolean> {
      if (busy) return false;
      busy = true;
      handlers.onStart?.();
      try {
        await action();
        return true;
      } catch (error) {
        console.error(error);
        handlers.onError?.(error);
        return false;
      } finally {
        busy = false;
        handlers.onSettled?.();
      }
    },
  };
}
