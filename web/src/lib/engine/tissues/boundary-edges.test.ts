import assert from 'node:assert/strict';
import { test } from 'vitest';
import { createEdgeUniforms, pairTexture } from './boundary-edges.ts';

test('the pair table is symmetric, unrated pairs are 0 and a share is 1 + share × 254', () => {
  const codes = new Map([
    ['nextbrain:left:1', 1],
    ['nextbrain:left:2', 2],
    ['nextbrain:left:3', 3],
  ]);
  const texture = pairTexture(codes, 4, [
    ['nextbrain:left:1', 'nextbrain:left:2', 100, 50],
    ['nextbrain:left:3', 'nextbrain:left:1', 100, 0],
  ]);
  const table = texture.image.data as Uint8Array;
  const at = (i: number, j: number) => table[i * 4 + j];
  assert.equal(at(1, 2), 1 + 127);
  assert.equal(at(2, 1), 1 + 127);
  // A rated boundary with no near tie is still rated, so it is not 0.
  assert.equal(at(1, 3), 1);
  assert.equal(at(3, 1), 1);
  assert.equal(at(2, 3), 0);
  assert.equal(table.filter(Boolean).length, 4);
});

test('a label too thin to win a cut block has no code and leaves no entry', () => {
  const codes = new Map([['nextbrain:left:1', 1]]);
  const texture = pairTexture(codes, 2, [['nextbrain:left:1', 'nextbrain:left:9', 60, 30]]);
  assert.deepEqual([...(texture.image.data as Uint8Array)], [0, 0, 0, 0]);
});

test('a new layer draws no outline until its atlas has published ratings', () => {
  const uniforms = createEdgeUniforms();
  assert.equal(uniforms.edgeEnabled.value, false);
  assert.equal(uniforms.edgeSoft.value, 1 / 3);
});
