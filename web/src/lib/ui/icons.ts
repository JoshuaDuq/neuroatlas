// Every icon the viewer draws, gathered once so no feature edits this file. Sources:
// viewer/ui/chrome/button-label.js:2-9, index.html (<svg><path>), ui/panels/circuits.js:28,
// ui/panels/visibility-control.js:36-45, diffusion/native-ui.js:15-26, and the four orbit arrows
// of G2 (decision 22 on #4). All draw on a 24-unit grid.

export type IconShape =
  { path: string; fillRule?: 'evenodd' } | { circle: readonly [cx: number, cy: number, r: number] };

export interface IconDefinition {
  shapes: readonly IconShape[];
  /** Rendered size in CSS px; the `.control-icon` default (16) when absent. */
  size?: number;
  /** Stroke width in grid units; 1.5 when absent. */
  strokeWidth?: number;
  /** Solid shapes rather than strokes. */
  filled?: true;
}

const path = (d: string): IconShape => ({ path: d });
const circle = (cx: number, cy: number, r: number): IconShape => ({ circle: [cx, cy, r] });

const EYE_OUTLINE = 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z';

export const ICONS = {
  // Cut mode: one oblique projection, the uncut solid, then each plane through it.
  'cut-off': { shapes: [path('M4 9h11v11H4ZM4 9l5-5h11l-5 5M20 4v11l-5 5')] },
  'cut-sagittal': { shapes: [path('M9 9.5 15 3.5v11l-6 6Z')] },
  'cut-coronal': { shapes: [path('M6.5 6.5h11v11h-11Z')] },
  'cut-axial': { shapes: [path('M4 14.5 9 9.5h11l-5 5Z')] },
  'cut-oblique': { shapes: [path('M4 18 9 6h11l-5 12Z')] },

  fullscreen: { shapes: [path('M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5')] },
  camera: { shapes: [path('M8 5l2-2h4l2 2h4v15H4V5h4Z'), circle(12, 12, 4)] },
  more: {
    shapes: [circle(5, 12, 1.5), circle(12, 12, 1.5), circle(19, 12, 1.5)],
    filled: true,
  },
  close: { shapes: [path('m7 7 10 10M7 17 17 7')] },
  'close-small': { shapes: [path('m6 6 12 12M6 18 18 6')], size: 14, strokeWidth: 1.6 },
  'chevron-right': { shapes: [path('m9 6 6 6-6 6')], size: 14 },
  search: { shapes: [circle(11, 11, 7), path('M20 20l-3.5-3.5')], size: 14, strokeWidth: 2 },
  reset: { shapes: [path('M4 12a8 8 0 1 0 2.4-5.7M4 4v4.5h4.5')] },

  // The circuit stepper.
  previous: { shapes: [path('m15 6-6 6 6 6')] },
  next: { shapes: [path('m9 6 6 6-6 6')] },

  // Visibility: an eye, struck through when hidden.
  eye: { shapes: [path(EYE_OUTLINE), circle(12, 12, 3)], strokeWidth: 1.6 },
  'eye-off': {
    shapes: [path(EYE_OUTLINE), circle(12, 12, 3), path('m3 3 18 18')],
    strokeWidth: 1.6,
  },

  // Orbit steps (G2).
  'arrow-left': { shapes: [path('M19 12H5m6-6-6 6 6 6')] },
  'arrow-right': { shapes: [path('M5 12h14m-6-6 6 6-6 6')] },
  'arrow-up': { shapes: [path('M12 19V5m-6 6 6-6 6 6')] },
  'arrow-down': { shapes: [path('M12 5v14m-6-6 6 6 6-6')] },

  // The wordmark's left hemisphere (SNAIL subj_1): solid behind a coronal cut, outlined in front.
  brand: {
    shapes: [
      {
        path: 'M11.45 3.9L11.46 16.9C12.4 16.55 13.37 16.68 14.35 16.62C15.22 16.56 15.98 16.07 16.82 16.02C18.17 15.95 19.5 16.46 20.86 16.31C21.58 16.23 22.09 15.77 22.44 15.16C22.69 14.72 22.86 14.24 22.94 13.75C23.2 12.29 22.44 11.39 21.76 10.2C21.31 9.4 20.89 8.59 20.41 7.81C19.42 6.23 18.2 4.88 16.57 3.96C16.04 3.66 15.45 3.39 14.83 3.39C14.2 3.39 13.65 3.72 13.04 3.83C12.52 3.93 11.98 3.86 11.45 3.9ZM9.14 4.28C7.07 4.64 7.88 4.63 6.25 5.32C3.43 6.52 0.96 7.86 1 11.33C1.01 12.08 1.05 12.89 1.51 13.53C1.85 13.99 3.72 15.56 4.23 15.79C4.66 15.98 5.15 15.95 5.55 16.23C6.57 16.93 6.46 17.83 8 18.04C8.38 18.1 8.77 18.11 9.15 18.04C9.16 18.44 9.07 19.54 9.21 19.86C9.48 20.45 10.38 20.3 10.45 19.66C10.52 18.93 10.45 17.92 10.45 17.16C10.45 15.11 10.45 13.06 10.45 11.01C10.45 8.94 10.45 6.87 10.45 4.81C10.45 4.05 10.52 3.03 10.45 2.31C10.43 2.14 10.35 1.98 10.22 1.87C10.06 1.74 9.86 1.69 9.66 1.74C9.44 1.78 9.26 1.94 9.19 2.15C9.06 2.5 9.18 3.8 9.14 4.28ZM9.15 16.66C8.88 16.77 8.66 16.8 8.37 16.78C7.28 16.69 7.27 15.85 6.31 15.18C5.61 14.68 5.26 14.83 4.73 14.59C4.44 14.45 2.71 12.99 2.53 12.72C2.28 12.33 2.31 11.75 2.3 11.3C2.26 8.39 4.58 7.45 6.89 6.46C7.97 6 7.83 5.78 9.15 5.61ZM21.1 17.31C20.65 17.29 20.18 17.34 19.72 17.3C18.92 17.24 17.46 16.91 16.74 17.04C16.08 17.15 15.49 17.49 14.82 17.57C14.16 17.66 13.48 17.56 12.83 17.66C12.72 17.93 12.55 18.2 12.53 18.5C12.51 18.88 12.74 19.25 12.97 19.54C13.3 19.93 13.74 20.33 14.23 20.49C15.86 21.03 21.3 20.15 21.1 17.31Z',
        fillRule: 'evenodd',
      },
    ],
    size: 24,
    filled: true,
  },
} as const satisfies Record<string, IconDefinition>;

export type IconName = keyof typeof ICONS;
