import { createCircuitSession } from '../core/learning/session.ts';
import type { CircuitSessionState } from '../core/learning/session.ts';
import { createSession } from '../core/state/session.ts';
import type { SessionOptions } from '../core/state/session.ts';
import type { SessionState } from '../types/index.ts';

/**
 * A command that changes state, followed by a fresh snapshot for the reactive graph. Notice
 * holding and releasing is `createSession`'s own, unchanged.
 */
const refreshing =
  <A extends unknown[], R>(command: (...args: A) => R, refresh: () => void) =>
  (...args: A): R => {
    const result = command(...args);
    refresh();
    return result;
  };

const refreshingAll = <C extends { [name in keyof C]: (...args: never[]) => unknown }>(
  commands: C,
  refresh: () => void,
): C =>
  Object.fromEntries(
    Object.entries<(...args: never[]) => unknown>(commands).map(([name, command]) => [
      name,
      refreshing(command, refresh),
    ]),
  ) as C;

/** The reader's session state, reactive: `createSession`'s commands, and its state as `state`. */
export function createSessionStore(options: SessionOptions) {
  const core = createSession(options);
  let state = $state.raw<SessionState>(core.assemble({}));
  const refresh = () => {
    ;
  };
  const { assemble: _assemble, ...commands } = core;
  const reactive = refreshingAll(commands, refresh);
  return {
    ...reactive,
    get state() {
      return state;
    },
  };
}

export type SessionStore = ReturnType<typeof createSessionStore>;

/** The circuit lesson's progress, reactive (`createCircuitSession`). */
export function createLessonStore(...args: Parameters<typeof createCircuitSession>) {
  const core = createCircuitSession(...args);
  let state = $state.raw<CircuitSessionState>(core.snapshot());
  const refresh = () => {
    state = core.snapshot();
  };
  return {
    start: refreshing(core.start, refresh),
    close: refreshing(core.close, refresh),
    go: refreshing(core.go, refresh),
    get state() {
      return state;
    },
  };
}

export type LessonStore = ReturnType<typeof createLessonStore>;
