// TEMP probe for K4: what the CI browser reports for hover and pointer. Removed before review.
import { expect, test } from 'vitest';

const queries = [
  '(hover: hover)',
  '(hover: none)',
  '(pointer: fine)',
  '(pointer: coarse)',
  '(pointer: none)',
  '(any-hover: hover)',
  '(any-pointer: fine)',
];
const report = () => queries.map((q) => `${q}=${matchMedia(q).matches}`).join(' ');

test('probe hover and pointer', async () => {
  console.log('PROBE start', navigator.userAgent, report());
  await new Promise((resolve) => setTimeout(resolve, 3000));
  console.log('PROBE later', report());
  expect(true).toBe(true);
});
