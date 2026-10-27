import type { Emitter, EngineEvents } from '../api.ts';

/** One call the application made into the fake, in order (`FakeEngine.calls`). */
export interface Call {
  domain: string;
  method: string;
  args: readonly unknown[];
}

export type Emit = <K extends keyof EngineEvents>(type: K, event: EngineEvents[K]) => void;

export interface Events extends Emitter<EngineEvents> {
  emit: Emit;
}

type Listener = (event: unknown) => void;

export function createEvents(): Events {
  const listeners = new Map<keyof EngineEvents, Set<Listener>>();
  return {
    on(type, listener) {
      const set = listeners.get(type) ?? new Set();
      set.add(listener as Listener);
      listeners.set(type, set);
      return () => set.delete(listener as Listener);
    },
    emit(type, event) {
      for (const listener of listeners.get(type) ?? []) listener(event);
    },
  };
}

/** Wrap every method of `target` so each call is appended to `calls`. Getters pass through. */
export function recorded<T extends object>(domain: string, target: T, calls: Call[]): T {
  return new Proxy(target, {
    get(object, key) {
      const value = Reflect.get(object, key) as unknown;
      if (typeof value !== 'function') return value;
      return (...args: unknown[]) => {
        calls.push({ domain, method: String(key), args });
        return (value as (...a: unknown[]) => unknown).apply(object, args);
      };
    },
  });
}

/** An error carrying the machine-readable code the real engine raises (brain-atlas.js:50). */
export const coded = (message: string, code: string) => Object.assign(new Error(message), { code });

export const sameSet = (a: ReadonlySet<string>, b: ReadonlySet<string>) =>
  a.size === b.size && [...a].every((id) => b.has(id));

export function canvasElement(): HTMLCanvasElement {
  if (typeof document === 'undefined') {
    throw new Error('The fake engine has no canvas outside a DOM; pass one in the options.');
  }
  return document.createElement('canvas');
}
