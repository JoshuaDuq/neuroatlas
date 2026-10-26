import { expect } from 'vitest';

type Expected = RegExp | (new (...args: never[]) => Error) | ((error: unknown) => boolean);

/**
 * The part of `node:assert/strict` the contract suite uses, over Vitest's `expect`: the suite runs in
 * Node (against the fake) and in the browser project (against the real engine), where `node:assert`
 * is externalized and unusable.
 */
interface Assert {
  ok(value: unknown, message?: string): asserts value;
  equal(actual: unknown, expected: unknown, message?: string): void;
  notEqual(actual: unknown, expected: unknown, message?: string): void;
  deepEqual(actual: unknown, expected: unknown, message?: string): void;
  throws(run: () => unknown, expected?: Expected): void;
  rejects(promise: Promise<unknown>, expected?: Expected): Promise<void>;
}

function matches(error: unknown, expected: Expected | undefined) {
  if (expected === undefined) return;
  if (expected instanceof RegExp) {
    expect((error as Error).message).toMatch(expected);
  } else if (expected.prototype instanceof Error || expected === Error) {
    expect(error).toBeInstanceOf(expected);
  } else {
    expect((expected as (error: unknown) => boolean)(error)).toBe(true);
  }
}

export const assert: Assert = {
  ok: (value, message) => {
    expect(value, message).toBeTruthy();
  },
  equal: (actual, expected, message) => {
    expect(actual, message).toBe(expected);
  },
  notEqual: (actual, expected, message) => {
    expect(actual, message).not.toBe(expected);
  },
  deepEqual: (actual, expected, message) => {
    expect(actual, message).toStrictEqual(expected);
  },
  throws(run, expected) {
    let thrown: { error: unknown } | null = null;
    try {
      run();
    } catch (error) {
      thrown = { error };
    }
    expect(thrown, 'the call did not throw').not.toBeNull();
    matches(thrown!.error, expected);
  },
  async rejects(promise, expected) {
    let thrown: { error: unknown } | null = null;
    try {
      await promise;
    } catch (error) {
      thrown = { error };
    }
    expect(thrown, 'the promise did not reject').not.toBeNull();
    matches(thrown!.error, expected);
  },
};
