import assert from 'node:assert/strict';
import { test } from 'vitest';
import { BufferAttribute, BufferGeometry, Color, SRGBColorSpace } from 'three';
import type { Rgb } from '../../types/index.ts';
import { NETWORK_COLOR_ITEM_SIZE, attachNetworkColors, networkColors } from './network-colors.ts';

const METADATA = {
  networks: ['Vis', 'SomMot', 'DorsAttn', 'SalVentAttn', 'Limbic', 'Cont', 'Default'],
  colors: {
    Vis: [120, 18, 134],
    SomMot: [70, 130, 180],
    DorsAttn: [0, 118, 14],
    SalVentAttn: [196, 58, 250],
    Limbic: [220, 248, 164],
    Cont: [230, 148, 34],
    Default: [205, 62, 78],
  } as Record<string, Rgb>,
};

const rgba = (values: Float32Array, vertex: number) =>
  Array.from(
    values.slice(vertex * NETWORK_COLOR_ITEM_SIZE, (vertex + 1) * NETWORK_COLOR_ITEM_SIZE),
  );

/** The attribute is float32; Color computes in float64, so they differ in the last bits. */
const assertChannels = (actual: number[], expected: number[]) => {
  expected.forEach((value, channel) => {
    assert.ok(
      Math.abs(actual[channel]! - value) < 1e-6,
      `channel ${channel}: ${actual[channel]} is not ${value}`,
    );
  });
};

const linear = (name: string) => {
  const [red, green, blue] = METADATA.colors[name]!;
  const color = new Color().setRGB(red / 255, green / 255, blue / 255, SRGBColorSpace);
  return [color.r, color.g, color.b];
};

test('a vertex in no network is left transparent, keeping its region colour', () => {
  assert.deepEqual(rgba(networkColors(new Float32Array([0]), METADATA), 0), [0, 0, 0, 0]);
});

test('the published colour is converted out of sRGB into the working space', () => {
  const [red, green, blue, present] = rgba(networkColors(new Float32Array([1]), METADATA), 0) as [
    number,
    number,
    number,
    number,
  ];
  assertChannels([red, green, blue], linear('Vis'));
  assert.equal(present, 1);
  // sRGB 120/255 is 0.47; linear must be darker, or the palette renders washed out.
  assert.ok(red < 120 / 255);
});

test('every network index maps to its own published colour', () => {
  const values = networkColors(
    new Float32Array(METADATA.networks.map((_, index) => index + 1)),
    METADATA,
  );
  METADATA.networks.forEach((name, index) => {
    const [red, green, blue, present] = rgba(values, index) as [number, number, number, number];
    assertChannels([red, green, blue], linear(name));
    assert.equal(present, 1);
  });
});

test('an index past the palette is treated as no network rather than wrapping', () => {
  assert.deepEqual(rgba(networkColors(new Float32Array([99]), METADATA), 0), [0, 0, 0, 0]);
});

test('geometry carrying the field gets a four-channel attribute', () => {
  const geometry = new BufferGeometry();
  geometry.setAttribute('_network', new BufferAttribute(new Float32Array([1, 0, 7]), 1));
  assert.equal(attachNetworkColors(geometry, METADATA), true);
  const attribute = geometry.getAttribute('_networkColor');
  assert.equal(attribute.itemSize, NETWORK_COLOR_ITEM_SIZE);
  assert.equal(attribute.count, 3);
  assert.equal(attribute.getW(0), 1);
  assert.equal(attribute.getW(1), 0);
  assert.equal(attribute.getW(2), 1);
});

test('geometry without the field is left alone rather than given empty colours', () => {
  const geometry = new BufferGeometry();
  assert.equal(attachNetworkColors(geometry, METADATA), false);
  assert.equal(geometry.getAttribute('_networkColor'), undefined);
});

test('SHADER-09 an index is rounded to the nearest network, never wrapped, and one that names none is transparent', () => {
  const indices = [0, 99, -1, NaN, 0.4, 7.5, 0.5, 1.5, 6.5, 7.49];
  const values = networkColors(new Float32Array(indices), METADATA);
  for (const vertex of [0, 1, 2, 3, 4, 5]) assert.deepEqual(rgba(values, vertex), [0, 0, 0, 0]);
  for (const [vertex, name] of [
    [6, 'Vis'],
    [7, 'SomMot'],
    [8, 'Default'],
    [9, 'Default'],
  ] as const) {
    assertChannels(rgba(values, vertex), [...linear(name), 1]);
  }
});
