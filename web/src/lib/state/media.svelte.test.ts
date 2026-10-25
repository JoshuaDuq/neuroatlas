import { afterEach, describe, expect, test, vi } from 'vitest';
import { COARSE_POINTER_QUERY, PHONE_QUERY } from '../types/index.ts';
import { REDUCED_MOTION_QUERY, SIDEWAYS_QUERY, createMedia } from './media.svelte.ts';

/** A matchMedia whose answers the test sets per query and can change live. */
function stubMatchMedia(answers: Record<string, boolean>) {
  const lists = new Map<string, { matches: boolean; listeners: Set<(event: Event) => void> }>();
  vi.stubGlobal('matchMedia', (query: string) => {
    if (!(query in answers)) throw new Error(`Unexpected media query: ${query}`);
    let entry = lists.get(query);
    if (!entry) {
      entry = { matches: answers[query], listeners: new Set() };
      lists.set(query, entry);
    }
    const state = entry;
    return {
      get matches() {
        return state.matches;
      },
      addEventListener: (_: string, listener: (event: Event) => void) =>
        state.listeners.add(listener),
      removeEventListener: (_: string, listener: (event: Event) => void) =>
        state.listeners.delete(listener),
    };
  });
  return (query: string, matches: boolean) => {
    const entry = lists.get(query)!;
    entry.matches = matches;
    for (const listener of entry.listeners) listener(new Event('change'));
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('createMedia', () => {
  test('asks the four queries, each its own', () => {
    stubMatchMedia({
      [PHONE_QUERY]: true,
      [SIDEWAYS_QUERY]: false,
      [COARSE_POINTER_QUERY]: true,
      [REDUCED_MOTION_QUERY]: false,
    });
    const media = createMedia();
    expect(media.phone).toBe(true);
    expect(media.sideways).toBe(false);
    expect(media.coarsePointer).toBe(true);
    expect(media.reducedMotion).toBe(false);
  });

  test('the queries are the legacy ones', () => {
    expect(PHONE_QUERY).toBe(
      '(max-width: 800px), (max-height: 480px) and (orientation: landscape)',
    );
    expect(SIDEWAYS_QUERY).toBe('(max-height: 480px) and (orientation: landscape)');
    expect(COARSE_POINTER_QUERY).toBe('(pointer: coarse)');
    expect(REDUCED_MOTION_QUERY).toBe('(prefers-reduced-motion: reduce)');
  });

  test('follows a live change while an effect watches it', () => {
    const flip = stubMatchMedia({
      [PHONE_QUERY]: false,
      [SIDEWAYS_QUERY]: false,
      [COARSE_POINTER_QUERY]: false,
      [REDUCED_MOTION_QUERY]: false,
    });
    const media = createMedia();
    const seen: boolean[] = [];
    const stop = $effect.root(() => {
      $effect(() => {
        seen.push(media.phone);
      });
    });
    return Promise.resolve().then(async () => {
      flip(PHONE_QUERY, true);
      await Promise.resolve();
      await Promise.resolve();
      expect(seen).toEqual([false, true]);
      stop();
    });
  });
});
