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

  test('after each of the 22 commands, in a fixed order, the state equals the session’s own assembled state', () => {
    const options = { views: ['oblique', 'left'] };
    const store = createSessionStore(options);
    const core = createSession(options);
    const error = new Error('boom');
    const commands: Array<[string, unknown[]]> = [
      ['setView', ['left']],
      ['setQuery', ['gyrus']],
      ['setExplorer', ['functions']],
      ['setFunctionQuery', ['lang']],
      ['setFunction', ['language']],
      ['setClinicalQuery', ['aph']],
      ['setDeficit', ['aphasia']],
      ['setFinding', ['naming']],
      ['liftPaint', []],
      ['toggleGroup', ['a']],
      ['setExpanded', [['a', 'b']]],
      ['setTheme', ['dark']],
      ['setLang', ['fr']],
      ['setStatus', ['ready']],
      ['setProgress', [{ loaded: 1, total: 4 }]],
      ['setStatus', ['ready']],
      ['setSwitching', [{ loaded: 2, total: 4 }]],
      ['endSwitching', []],
      ['notify', [{ text: 'One.', action: 'reload' }]],
      ['holdNotices', []],
      ['notify', [{ text: 'Held.' }]],
      ['releaseNotices', [{ text: 'Lead.' }]],
      ['setContextLost', []],
      ['setError', [error]],
    ];
    for (const [name, args] of commands) {
      const command = (session: object) =>
        (session as Record<string, (...a: unknown[]) => unknown>)[name]!(...args);
      expect(command(store), name).toEqual(command(core));
      expect(store.state, name).toEqual(core.assemble({}));
    }
    expect(store.state).toMatchObject({
      view: 'left',
      query: 'gyrus',
      explorer: 'functions',
      functionQuery: 'lang',
      selectedFunction: 'language',
      clinicalQuery: 'aph',
      selectedDeficit: 'aphasia',
      selectedFinding: 'naming',
      paintLifted: true,
      theme: 'dark',
      lang: 'fr',
      status: 'error',
      error,
    });
    expect([...store.state.expanded]).toEqual(['a', 'b']);
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
