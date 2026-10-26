import type { Rect } from '../../lib/engine/api.ts';

/** The popovers' width in CSS pixels when the stage has room (stage.css:410). */
export const POPOVER_WIDTH = 272;

/**
 * A popover opening upward above the whole dock, on the dock's start edge whichever tool opened it, kept
 * inside the visible stage (stage-tools.js:18-31). Rectangles are in stage coordinates; `toolbar` is the
 * dock's outer top left corner, and the returned `left` is relative to it. A full-width phone popover stops
 * a third of the stage short of the top, so the anatomy it adjusts stays in sight; past that it scrolls.
 */
export function placePopover({
  toolbar,
  visible,
  width,
  fill = false,
  gap = 8,
  gutter = 16,
}: {
  toolbar: { left: number; top: number };
  visible: Rect;
  width: number;
  fill?: boolean;
  gap?: number;
  gutter?: number;
}) {
  const room = Math.max(0, visible.width - 2 * gutter);
  const span = fill ? room : Math.min(width, room);
  const min = visible.x + gutter;
  const max = Math.max(min, visible.x + visible.width - gutter - span);
  const left = Math.min(Math.max(toolbar.left, min), max);
  const stage = toolbar.top - visible.y;
  const keep = fill ? Math.max(gutter, stage / 3) : gutter;
  return {
    left: Math.round(left - toolbar.left),
    width: Math.round(span),
    maxHeight: Math.max(0, Math.floor(stage - gap - keep)),
  };
}
