// The stage's markings measured where they are drawn, for the snapshot (viewport-chrome.js:642-696).
import { t } from '../../lib/core/i18n/index.ts';
import type { Rect } from '../../lib/engine/api.ts';
import type { Edge, StageLayout } from '../../lib/state/stage-layout.svelte.ts';
import { FUNCTIONAL_LEVELS } from '../../lib/types/index.ts';
import type { Language } from '../../lib/types/index.ts';
import type { KeyPlate } from '../stage/stage-keys.ts';

/** Stage geometry in CSS pixels, matching the stage styles: gutter, marking line height, caption gaps. */
export const SNAPSHOT_LAYOUT = Object.freeze({ gutter: 16, line: 16, letterGap: 12, scaleGap: 8 });

/** What the stage keys report of themselves (`StageKeys.model`, G3): the plates as drawn, with each one's fold. */
export interface StageKeysModel {
  model(): (KeyPlate & { open: boolean })[];
}

export interface Letter {
  edge: Edge;
  text: string;
  x: number;
  y: number;
}

export interface KeyWords {
  text: string;
  /** The left end and vertical middle of the words. */
  x: number;
  y: number;
  color: string;
  font: string;
}

export interface KeySwatch extends Rect {
  color: string;
  radius: number;
}

/** A colour key's plate, its swatches and its words. */
export interface KeyMark {
  box: Rect;
  fill: string;
  edge: string;
  swatches: KeySwatch[];
  texts: KeyWords[];
}

export interface Markings {
  letters: Letter[];
  keys: KeyMark[];
  scale: { pixels: number; label: string } | null;
}

/**
 * The markings as the reader sees them, in CSS pixels of the visible stage `crop`: the letters where
 * they are drawn, the scale bar's rule and words, and each colour key's plate. What a key says comes
 * from `keys.model()`; only where it is drawn is measured.
 */
export function snapshotMarkings(
  host: HTMLElement,
  crop: Rect,
  {
    stage,
    keys,
    lang,
  }: {
    stage: Pick<StageLayout, 'keyInset' | 'dockTall'>;
    keys: StageKeysModel;
    lang: Language;
  },
): Markings {
  const origin = host.getBoundingClientRect();
  const local = (node: Element | Range): Rect => {
    const r = node.getBoundingClientRect();
    return {
      x: r.left - origin.left - crop.x,
      y: r.top - origin.top - crop.y,
      width: r.width,
      height: r.height,
    };
  };
  const find = <T extends Element = HTMLElement>(root: ParentNode, selector: string): T => {
    const node = root.querySelector<T>(selector);
    if (!node) throw new Error(`The snapshot cannot find ${selector} on the stage.`);
    return node;
  };
  const { gutter: margin, line } = SNAPSHOT_LAYOUT;

  const orientation = find(host, '#orientation');
  const letters = orientation.hidden
    ? []
    : [...orientation.querySelectorAll<HTMLElement>('[data-edge]')].map((node) => {
        const edge = node.dataset.edge as Edge;
        const box = local(node);
        const spot = {
          edge,
          text: node.textContent,
          x: box.x + box.width / 2,
          y: box.y + box.height / 2,
        };
        // Without the dock the top letter needs no room under a phone's scale bar; a key's band it keeps.
        if (edge === 'top' && !stage.keyInset.top) spot.y = 12 + line / 2;
        // Hidden over a tall dock; on the image it keeps the line above the statement.
        if (edge === 'bottom' && stage.dockTall) {
          Object.assign(spot, { x: crop.width / 2, y: crop.height - margin - line * 2 });
        }
        return spot;
      });

  // A key's words; a range measures the text, not the control that holds it.
  const words = (node: HTMLElement, text: string): KeyWords => {
    const range = document.createRange();
    range.selectNodeContents(node);
    const box = local(range);
    const style = getComputedStyle(node);
    return {
      text,
      x: box.x,
      y: box.y + box.height / 2,
      color: style.color,
      font: `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`,
    };
  };
  const levels = t(lang, 'functional').levels;
  const plates = find(host, '#stage-keys');
  const keyMarks = keys.model().map((plate): KeyMark => {
    const node = find(plates, `.stage-key[data-name="${plate.name}"]`);
    const look = getComputedStyle(node);
    const box = local(node);
    // Rows scrolled out of a long list stay out of the image too.
    const inside = (mark: { y: number }) => mark.y >= box.y && mark.y <= box.y + box.height;
    const texts = [words(find(node, `#${plate.name}-key-title`), plate.title)];
    // The level shown shares the title row, so a fold keeps it.
    if (plate.level) {
      const radios = node.querySelectorAll<HTMLElement>('.stage-key-head [role="radio"]');
      const radio = radios[FUNCTIONAL_LEVELS.indexOf(plate.level)];
      if (!radio)
        throw new Error(`The snapshot cannot find the ${plate.level} level on the stage.`);
      texts.push(words(radio, levels[plate.level]));
    }
    const swatches: KeySwatch[] = [];
    // A folded key draws what it shows, its title; unfolded on screen, so is it in the image.
    if (plate.open) {
      const items = node.querySelectorAll<HTMLElement>('.stage-key-list > li');
      if (items.length !== plate.rows.length) {
        throw new Error(
          `The ${plate.name} key shows ${items.length} rows of ${plate.rows.length}.`,
        );
      }
      plate.rows.forEach((row, index) => {
        const item = items[index]!;
        const swatch = find(item, '.network-swatch');
        const style = getComputedStyle(swatch);
        swatches.push({
          ...local(swatch),
          color: style.backgroundColor,
          radius: parseFloat(style.borderTopLeftRadius) || 0,
        });
        texts.push(words(find(item, '.stage-key-label'), row.label));
      });
    }
    return {
      box,
      fill: look.backgroundColor,
      edge: look.borderTopColor,
      swatches: swatches.filter(inside),
      texts: texts.filter(inside),
    };
  });

  const bar = find(host, '#scale-bar');
  return {
    letters,
    keys: keyMarks,
    scale: bar.hidden
      ? null
      : {
          pixels: find(bar, '.scale-bar-rule').offsetWidth,
          label: find(bar, '.measure').textContent,
        },
  };
}
