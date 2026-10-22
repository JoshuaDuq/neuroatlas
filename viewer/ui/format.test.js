import assert from 'node:assert/strict';
import test from 'node:test';
import { count, decimal, formatRas, grouped, quantity, millimetres, percent, withUnit } from './format.js';

const NNBSP = '\u202f';
const MINUS = '\u2212';

test('quantities carry four significant figures and their unit', () => {
  assert.equal(quantity(3214.153, 'mm²'), `3214${NNBSP}mm²`);
  assert.equal(quantity(775.634310225458, 'mm²'), `775.6${NNBSP}mm²`);
  assert.equal(quantity(5.1234, 'mm³'), `5.123${NNBSP}mm³`);
});

test('five digits and up get a narrow no-break space between groups, not a comma', () => {
  assert.equal(quantity(21472, 'mm³'), `21${NNBSP}470${NNBSP}mm³`);
  assert.equal(quantity(64385, 'mm³'), `64${NNBSP}390${NNBSP}mm³`);
});

test('an absent quantity is an em dash, never a zero', () => {
  assert.equal(quantity(null, 'mm²'), '—');
  assert.equal(quantity(undefined, 'mm²'), '—');
  assert.equal(quantity(Number.NaN, 'mm²'), '—');
});

test('a genuine zero is shown as zero', () => {
  assert.equal(quantity(0, 'mm²'), `0${NNBSP}mm²`);
});

test('trailing zeros from rounding are not shown as false precision', () => {
  assert.equal(quantity(1000, 'mm²'), `1000${NNBSP}mm²`);
  assert.equal(quantity(2.5, 'mm²'), `2.5${NNBSP}mm²`);
});

test('counts agree with their noun', () => {
  assert.equal(count(0, 'region'), '0 regions');
  assert.equal(count(1, 'region'), '1 region');
  assert.equal(count(2, 'region'), '2 regions');
  assert.equal(count(185, 'region'), '185 regions');
});

test('counts group their digits like every other number here', () => {
  assert.equal(count(21472, 'match'), `21${NNBSP}472 matches`);
});

test('French quantities take a decimal comma', () => {
  assert.equal(quantity(775.634, 'mm²', 'fr'), `775,6${NNBSP}mm²`);
  assert.equal(quantity(21472, 'mm³', 'fr'), `21${NNBSP}470${NNBSP}mm³`);
});

test('a RAS point is a signed triple with a true minus sign', () => {
  assert.equal(formatRas([-41.04, 26.2, 28.31]), `${MINUS}41.0, +26.2, +28.3${NNBSP}mm`);
  assert.equal(formatRas([-41.04, 26.2, 28.31], 'fr'),
    `${MINUS}41,0${NNBSP}; +26,2${NNBSP}; +28,3${NNBSP}mm`);
});

test('a RAS axis that rounds to zero carries no sign', () => {
  assert.equal(formatRas([0, -0.04, 0.04]), `0.0, 0.0, 0.0${NNBSP}mm`);
});

test('a missing or partial RAS point is an em dash', () => {
  assert.equal(formatRas(null), '—');
  assert.equal(formatRas([1, 2]), '—');
  assert.equal(formatRas([1, Number.NaN, 2]), '—');
});

test('a stage number takes the reader\'s decimal mark and a true minus sign', () => {
  assert.equal(decimal(-32.5), `${MINUS}32.5`);
  assert.equal(decimal(-32.5, 1, 'fr'), `${MINUS}32,5`);
  assert.equal(decimal(12, 1, 'en', { signed: true }), '+12.0');
  assert.equal(decimal(-0.04, 1, 'fr', { signed: true }), '0,0');
  assert.equal(decimal(-30, 0, 'en', { signed: true }), `${MINUS}30`);
});

test('a trimmed number drops the zeros a step size does not have', () => {
  assert.equal(decimal(0.8, 2, 'fr', { trim: true }), '0,8');
  assert.equal(decimal(1, 2, 'en', { trim: true }), '1');
  assert.equal(decimal(0.5, 1, 'en', { trim: true }), '0.5');
  assert.equal(decimal(Number.NaN), '—');
});

test('slider readouts and their spoken values give signed millimetres and percentages in the reader’s notation', () => {
  assert.equal(millimetres(12.5, 'en'), '+12.5 mm');
  assert.equal(millimetres(-3, 'fr'), '−3,0 mm');
  assert.equal(millimetres(0, 'en'), '0.0 mm');
  assert.equal(percent(0.4, 'en'), '40%');
  assert.equal(percent(0.35, 'fr'), '35 %');
  assert.equal(percent(1, 'en'), '100%');
});

test('a unit is held to its number by a narrow no-break space, never a breaking one', () => {
  assert.equal(withUnit('5670', 'mm²'), `5670${NNBSP}mm²`);
  assert.equal(withUnit('2797,9', 'mm²', 'fr'), `2797,9${NNBSP}mm²`);
  assert.equal(withUnit('16', '%'), '16%');
  assert.equal(withUnit('16', '%', 'fr'), `16${NNBSP}%`);
  for (const text of [quantity(21472, 'mm³', 'fr'), formatRas([1, 2, 3], 'fr'), millimetres(-3, 'fr'), percent(0.5, 'fr')]) {
    assert.doesNotMatch(text, /[\u0020\u2009](?:mm|%)/);
  }
});

test('digit groups start past four digits, as in counts and quantities alike', () => {
  assert.equal(grouped(1234), '1234');
  assert.equal(grouped(123456), `123${NNBSP}456`);
});
