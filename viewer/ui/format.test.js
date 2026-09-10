import assert from 'node:assert/strict';
import test from 'node:test';
import { count, quantity } from './format.js';

const THIN = ' ';

test('quantities carry four significant figures and their unit', () => {
  assert.equal(quantity(3214.153, 'mm²'), `3214${THIN}mm²`);
  assert.equal(quantity(775.634310225458, 'mm²'), `775.6${THIN}mm²`);
  assert.equal(quantity(5.1234, 'mm³'), `5.123${THIN}mm³`);
});

test('five digits and up get a thin space between groups, not a comma', () => {
  assert.equal(quantity(21472, 'mm³'), `21${THIN}470${THIN}mm³`);
  assert.equal(quantity(64385, 'mm³'), `64${THIN}390${THIN}mm³`);
});

test('an absent quantity is an em dash, never a zero', () => {
  assert.equal(quantity(null, 'mm²'), '—');
  assert.equal(quantity(undefined, 'mm²'), '—');
  assert.equal(quantity(Number.NaN, 'mm²'), '—');
});

test('a genuine zero is shown as zero', () => {
  assert.equal(quantity(0, 'mm²'), `0${THIN}mm²`);
});

test('trailing zeros from rounding are not shown as false precision', () => {
  assert.equal(quantity(1000, 'mm²'), `1000${THIN}mm²`);
  assert.equal(quantity(2.5, 'mm²'), `2.5${THIN}mm²`);
});

test('counts agree with their noun', () => {
  assert.equal(count(0, 'region'), '0 regions');
  assert.equal(count(1, 'region'), '1 region');
  assert.equal(count(2, 'region'), '2 regions');
  assert.equal(count(185, 'region'), '185 regions');
});

test('counts group their digits like every other number here', () => {
  assert.equal(count(21472, 'match'), `21${THIN}472 matches`);
});
