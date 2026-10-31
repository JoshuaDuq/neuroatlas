import assert from 'node:assert/strict';
import { test } from 'vitest';
import { parseCoordinate } from './parse.ts';

test('reads a coordinate however a paper or its table prints it', () => {
  for (const text of [
    '-42, 22, 6',
    '-42 22 6',
    '(-42 22 6)',
    '[-42;22;6]',
    '-42\t22\t6',
    '−42, 22, 6',
    '  ( −42 ,22 , 6 ) ',
    '{-42, +22, 6.}',
  ]) {
    assert.deepEqual(parseCoordinate(text), [-42, 22, 6], text);
  }
  assert.deepEqual(parseCoordinate('-41.5, .25, -6.75'), [-41.5, 0.25, -6.75]);
});

test('refuses anything but exactly three finite numbers', () => {
  for (const text of [
    '',
    '   ',
    '-42, 22',
    '-42, 22, 6, 1',
    '-42,5, 22, 6',
    'x -42 22 6',
    '-42, 22, six',
    '-42, 22, Infinity',
    '-42, 22, NaN',
    '-42, 22, 0x10',
    '-42, 22, 1e3',
    '-42, 22, 6mm',
    '--42, 22, 6',
    '-, 22, 6',
  ]) {
    assert.equal(parseCoordinate(text), null, text);
  }
});
