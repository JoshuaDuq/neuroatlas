import { afterEach, expect, test, vi } from 'vitest';
import { missingWebgl } from './webgl-check.ts';

/** A `document` whose canvas hands out `getContext`'s result. */
function stubCanvas(getContext: () => unknown): void {
  vi.stubGlobal('document', { createElement: () => ({ getContext }) });
}

function fakeContext(extensions: Record<string, object | null>) {
  const loseContext = vi.fn();
  const getExtension = vi.fn((name: string) =>
    name === 'WEBGL_lose_context' ? { loseContext } : (extensions[name] ?? null),
  );
  return { gl: { getExtension }, loseContext };
}

afterEach(() => vi.unstubAllGlobals());

test('no WebGL 2 context is reported as webgl2', () => {
  const getContext = vi.fn(() => null);
  stubCanvas(getContext);
  expect(missingWebgl()).toBe('webgl2');
  expect(getContext).toHaveBeenCalledWith('webgl2');
});

test('a privacy mode that throws from getContext is reported as webgl2', () => {
  stubCanvas(() => {
    throw new Error('blocked');
  });
  expect(missingWebgl()).toBe('webgl2');
});

test('a context without EXT_color_buffer_float is reported as floatTargets, and freed once', () => {
  const { gl, loseContext } = fakeContext({});
  stubCanvas(() => gl);
  expect(missingWebgl()).toBe('floatTargets');
  expect(loseContext).toHaveBeenCalledTimes(1);
});

test('WebGL 2 with float render targets is complete, and its context is freed once', () => {
  const { gl, loseContext } = fakeContext({ EXT_color_buffer_float: {} });
  stubCanvas(() => gl);
  expect(missingWebgl()).toBeNull();
  expect(loseContext).toHaveBeenCalledTimes(1);
});
