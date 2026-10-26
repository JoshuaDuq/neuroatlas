import { describe, expect, test } from 'vitest';
import { createSession } from '../core/state/session.ts';
import { createLessonStore, createSessionStore } from './session.svelte.ts';

describe('STORE-03: a session command shows at once and keeps the session’s answer', () => {
  test('an accepted view shows, a refused one returns false and leaves the view', () => {
    const store = createSessionStore({ views: ['oblique', 'left'] });
    expect(store.setView('left')).toBe(true);
    expect(store.state.view).toBe('left');
    expect(store.setView('nowhere')).toBe(false);
    expect(store.state.view).toBe('left');
  });

  test('an unknown explorer throws the session’s error and leaves the state', () => {
    const store = createSessionStore({ views: ['oblique'] });
    expect(() => store.setExplorer('nowhere' as never)).toThrow(
      new Error('Unknown explorer: nowhere'),
    );
    expect(store.state.explorer).toBe('anatomy');
  });

  test('after a run of commands the state equals the session’s own assembled state', () => {
    const options = { views: ['oblique', 'left'] };
    const store = createSessionStore(options);
    const core = createSession(options);
    const run = (command: (session: typeof core | typeof store) => unknown) => {
      expect(command(store)).toEqual(command(core));
      expect(store.state).toEqual(core.assemble({}));
    };
    run((s) => s.setQuery('gyrus'));
    run((s) => s.setExplorer('functions'));
    run((s) => s.setFunction('language'));
    run((s) => s.liftPaint());
    run((s) => s.toggleGroup('a'));
    run((s) => s.setLang('fr'));
    run((s) => s.setStatus('loading'));
    run((s) => s.setProgress({ loaded: 1, total: 4 }));
    run((s) => s.notify({ text: 'One.', action: 'reload' }));
    run((s) => s.setError(new Error('boom')));
    expect(store.state.lang).toBe('fr');
    expect(store.state.explorer).toBe('functions');
  });
});

describe('STORE-04: the lesson store shows each step taken, and refuses a step that does not exist', () => {
  const lesson = () => createLessonStore({ get: () => ({ steps: [{}, {}, {}, {}] }) } as never);

  test('start, go and close show at once', () => {
    const store = lesson();
    store.start('c');
    expect(store.state).toEqual({ circuit: 'c', step: 0, visited: [0] });
    store.go(2);
    expect(store.state).toEqual({ circuit: 'c', step: 2, visited: [0, 2] });
    store.go(2);
    expect(store.state.visited).toEqual([0, 2]);
    store.close();
    expect(store.state).toEqual({ circuit: null, step: 0, visited: [] });
  });

  test('a step that does not exist throws a RangeError and leaves the state', () => {
    const store = lesson();
    store.start('c');
    store.go(2);
    for (const bad of [4, -1, 1.5]) {
      expect(() => store.go(bad)).toThrow(RangeError);
      expect(() => store.go(bad)).toThrow(/^Invalid landmark index: /);
    }
    expect(store.state).toEqual({ circuit: 'c', step: 2, visited: [0, 2] });
  });
});
