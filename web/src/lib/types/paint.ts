/** A colour as red, green, blue in 0-255 (the manifest's `display_color`). */
export type Rgb = readonly [number, number, number];

/**
 * Regions drawn over the chosen surface colour. `id` is `function:…` or
 * `deficit:…[:finding]` (state/paint.js:6, clinical/catalog.js:47).
 */
export interface Paint {
  id: string;
  colors: ReadonlyMap<string, Rgb>;
}
