/**
 * One MPR panel's picture (ui/chrome/sections.js:353-388, 290-293): the resampled slice with the
 * crosshair, the orientation letters and the plane's offset drawn into the bitmap, and the inverse
 * from a click on it to a point in RAS millimetres.
 */
import { decimal } from '../../lib/core/format.ts';
import { t } from '../../lib/core/i18n/index.ts';
import type { MprPlane, PlaneFrame, Vec3 } from '../../lib/engine/api.ts';
import type { Language } from '../../lib/types/index.ts';

/** The crosshair axis each plane's slider moves (sections.js:17). */
export const AXES: Readonly<Record<MprPlane, 0 | 1 | 2>> = { sagittal: 0, coronal: 1, axial: 2 };
export const PLANES = ['sagittal', 'coronal', 'axial'] as const satisfies readonly MprPlane[];

/** The coordinate limit of the MRI's slider and the keys' clamp (sections.js:289). */
export const COORDINATE_LIMIT = 128;

const dot = (a: readonly number[], b: readonly number[]) =>
  a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;

/**
 * The point under a click at (`xFraction`, `yFraction`) of the picture, from its top-left corner
 * (coordinates.js pointOnFrame). `fieldOfView` is the side of the square the frame spans.
 */
export function pointOnPlane(
  frame: PlaneFrame,
  xFraction: number,
  yFraction: number,
  fieldOfView: number,
): Vec3 {
  const across = (xFraction - 0.5) * fieldOfView;
  const up = (0.5 - yFraction) * fieldOfView;
  return [0, 1, 2].map(
    (axis) => frame.center[axis]! + frame.u[axis]! * across + frame.v[axis]! * up,
  ) as unknown as Vec3;
}

export interface PanelPicture {
  plane: MprPlane;
  frame: PlaneFrame;
  /** RGBA, `size` square, from `sections.pixels(frame)`. */
  pixels: Uint8ClampedArray;
  size: number;
  fieldOfView: number;
  crosshair: Vec3;
  lang: Language;
}

/** Draws the panel. The canvas takes the picture's size, which clears it. */
export function drawPanel(canvas: HTMLCanvasElement, picture: PanelPicture): void {
  const { plane, frame, pixels, size, fieldOfView, crosshair, lang } = picture;
  const context = canvas.getContext('2d')!;
  canvas.width = size;
  canvas.height = size;
  // The MRI keeps all source intensities, including voxels no label covers.
  for (let index = 3; index < pixels.length; index += 4) pixels[index] = 255;
  context.putImageData(new ImageData(pixels as Uint8ClampedArray<ArrayBuffer>, size, size), 0, 0);

  const displacement = crosshair.map((value, axis) => value - frame.center[axis]!);
  const x = (dot(displacement, frame.u) / fieldOfView + 0.5) * size;
  const y = (0.5 - dot(displacement, frame.v) / fieldOfView) * size;
  context.beginPath();
  context.moveTo(x, 0);
  context.lineTo(x, size);
  context.moveTo(0, y);
  context.lineTo(size, y);
  context.strokeStyle = '#0e1116';
  context.lineWidth = 3;
  context.stroke();
  context.strokeStyle = '#4fb6e0';
  context.lineWidth = 1;
  context.stroke();

  context.textAlign = 'center';
  context.font = '600 15px ui-sans-serif, system-ui, sans-serif';
  context.lineWidth = 3;
  context.strokeStyle = '#0e1116';
  context.fillStyle = '#f2f6fa';
  const letters = t(lang, 'orientation');
  const places: [number, number][] = [
    [size / 2, 22],
    [size - 16, size / 2],
    [size / 2, size - 14],
    [16, size / 2],
  ];
  for (const [index, place] of places.entries()) {
    const edge = frame.edges[index]! as keyof typeof letters;
    const letter = letters[edge] ?? edge;
    context.strokeText(letter, ...place);
    context.fillText(letter, ...place);
  }

  const annotation = `${t(lang, 'mpr').labels[plane]} ${decimal(crosshair[AXES[plane]], 1, lang, { signed: true })} mm`;
  context.font = '12px ui-monospace, SFMono-Regular, Menlo, monospace';
  context.textAlign = 'left';
  context.strokeStyle = '#0e1116';
  context.strokeText(annotation, 10, size - 12);
  context.fillText(annotation, 10, size - 12);
}
