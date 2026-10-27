// SHADER-16 in real WebGL: `labelAt` on the GPU names the label `Volume.label` (SLICE-09) names on the CPU.
import { expect, test } from 'vitest';
import { Volume } from '../slices/volume.ts';
import { LABEL_AT } from './label-sampling.ts';

type Point = [number, number, number];

const identity = [
  [1, 0, 0, 0],
  [0, 1, 0, 0],
  [0, 0, 1, 0],
  [0, 0, 0, 1],
];

const VERTEX = `#version 300 es
in vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }`;

// One pixel per point: the label at `points[x]`, written to an unsigned-integer target.
const FRAGMENT = (count: number) => `#version 300 es
precision highp float;
precision highp int;
uniform highp usampler3D volume;
uniform ivec3 shape;
uniform vec3 points[${count}];
out uvec4 label;
${LABEL_AT}
void main() {
  label = uvec4(labelAt(volume, shape, points[int(gl_FragCoord.x)]), 0u, 0u, 1u);
}`;

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) ?? 'shader did not compile');
  }
  return shader;
}

/** The labels the fragment shader samples at `points` from an x-fastest volume of `shape`. */
function gpuLabels(data: Uint8Array, shape: [number, number, number], points: Point[]) {
  const gl = document.createElement('canvas').getContext('webgl2')!;
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT(points.length)));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) ?? 'program did not link');
  }
  gl.useProgram(program);

  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.bindTexture(gl.TEXTURE_3D, gl.createTexture());
  gl.texImage3D(gl.TEXTURE_3D, 0, gl.R8UI, ...shape, 0, gl.RED_INTEGER, gl.UNSIGNED_BYTE, data);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.uniform1i(gl.getUniformLocation(program, 'volume'), 0);
  gl.uniform3i(gl.getUniformLocation(program, 'shape'), ...shape);
  gl.uniform3fv(gl.getUniformLocation(program, 'points'), points.flat());

  const target = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, target);
  gl.texStorage2D(gl.TEXTURE_2D, 1, gl.R32UI, points.length, 1);
  gl.bindFramebuffer(gl.FRAMEBUFFER, gl.createFramebuffer());
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, target, 0);
  gl.viewport(0, 0, points.length, 1);

  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, 'position');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  gl.drawArrays(gl.TRIANGLES, 0, 3);

  const pixels = new Uint32Array(points.length * 4);
  gl.readPixels(0, 0, points.length, 1, gl.RGBA_INTEGER, gl.UNSIGNED_INT, pixels);
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  return Array.from(pixels).filter((_, index) => index % 4 === 0);
}

/** The GPU's labels at `points`, with the CPU's beside them for the same volume. */
function sample(data: Uint8Array, shape: [number, number, number], points: Point[]) {
  const volume = new Volume({ shape, voxel_to_surface_ras_mm: identity, order: 'F' }, data);
  return { gpu: gpuLabels(data, shape, points), cpu: points.map((point) => volume.label(point)) };
}

test('a ramp: the label with the most weight, the lowest corner on a tie', () => {
  const data = new Uint8Array(64);
  for (let z = 0; z < 4; z++)
    for (let y = 0; y < 4; y++)
      for (let x = 0; x < 4; x++) data[x + 4 * (y + 4 * z)] = x + 10 * y + 40 * z;
  const { gpu, cpu } = sample(
    data,
    [4, 4, 4],
    [
      [1.4, 1.4, 1.4],
      [1.6, 1.6, 1.6],
      [1.5, 1.5, 1.5],
    ],
  );
  expect(gpu).toEqual([51, 102, 51]);
  expect(gpu).toEqual(cpu);
});

test('a boundary runs between voxel centres: the weight decides, not the nearest centre', () => {
  const { gpu, cpu } = sample(
    new Uint8Array([4, 9, 9, 9, 4, 9, 9, 9]),
    [2, 2, 2],
    [
      [0.4, 0.4, 0.5],
      [0.2, 0.2, 0.5],
    ],
  );
  expect(gpu).toEqual([9, 4]);
  expect(gpu).toEqual(cpu);
});

test('outside the grid is background 0, weighed like any other label', () => {
  const { gpu, cpu } = sample(
    new Uint8Array(8).fill(7),
    [2, 2, 2],
    [
      [-0.4, 0.5, 0.5],
      [-0.6, 0.5, 0.5],
    ],
  );
  expect(gpu).toEqual([7, 0]);
  expect(gpu).toEqual(cpu);
});
