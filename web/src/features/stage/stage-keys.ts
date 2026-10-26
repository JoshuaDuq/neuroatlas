// What the stage's colour keys say and how they fit the stage (viewport-chrome.js:23-42, 269-402).
import { cabNpName, networkCss, networkName } from '../../lib/core/catalog/networks.ts';
import { functionalShortName } from '../../lib/core/catalog/functional-regions.ts';
import type { FunctionalRegions } from '../../lib/core/catalog/functional-regions.ts';
import { t } from '../../lib/core/i18n/index.ts';
import type { Legend } from '../../lib/core/state/paint.ts';
import type {
  FunctionalLevel,
  Language,
  LoadStatus,
  Rgb,
  SurfaceColor,
} from '../../lib/types/index.ts';

/** A key longer than this many rows starts folded where the stage is crowded. */
const KEY_FOLD_ROWS = 8;
const KEY_FOLD_WIDTH_PX = 1000;
const KEY_ROW_PX = 24;
const TOUCH_ROW_PX = 44;
/** Narrower than this, a paint key keeps its rows and drops its note. */
export const KEY_NOTE_MIN_WIDTH_PX = 600;
/** The title row, foot and edges of a plate. */
const KEY_HEAD_PX = 42;

export type KeyName = 'network' | 'functional' | 'paint' | 'direction';

export interface KeyRow {
  id: string;
  /** A swatch colour: channels, or a CSS colour for the direction key. */
  color: Rgb | string;
  label: string;
  pressed: boolean;
  /** Keyed but not drawn in this view. */
  absent: boolean;
}

/** One plate of the stage key, in the order the plates are drawn. */
export interface KeyPlate {
  name: KeyName;
  /** What the reader's fold is remembered under. */
  map: string;
  title: string;
  rows: KeyRow[];
  /** The paint key's sentence under its rows; empty for the others. */
  note: string;
  /** The functional plate's level; null for the others. */
  level: FunctionalLevel | null;
  /** Each row is a toggle that shows that row alone. */
  pickable: boolean;
}

/** A partition with named colours: Yeo's networks and CAB-NP. */
export interface ColoredNetworks {
  networks: readonly string[];
  colors: Readonly<Record<string, Rgb>>;
}

export interface KeySources {
  lang: Language;
  status: LoadStatus;
  surfaceColor: SurfaceColor;
  functionalLevel: FunctionalLevel;
  networks: ColoredNetworks | null;
  cabNp: ColoredNetworks | null;
  functionalRegions: FunctionalRegions | null;
  /** The key of the paint on show (`legendFor`), or null. */
  legend: Legend | null;
  /** The streamlines are drawn, coloured by direction. */
  directionShown: boolean;
}

const row = (id: string, color: Rgb | string, label: string, pressed = false, absent = false) => ({
  id,
  color,
  label,
  pressed,
  absent,
});

/** The swatch's CSS colour. */
export const swatchColor = (color: Rgb | string) =>
  typeof color === 'string' ? color : networkCss(color);

/**
 * The plates the stage shows now, in drawing order. A paint covers the masthead's colour, so that
 * colour's plate would explain nothing on screen and is left out while a paint's key is up.
 */
export function keyPlates(sources: KeySources): KeyPlate[] {
  const { lang, surfaceColor, legend } = sources;
  const ready = sources.status === 'ready' || sources.status === 'switching';
  const plates: KeyPlate[] = [];
  // A key is titled as the masthead's Colour field names its map.
  const maps: Record<string, string> = t(lang, 'display').surfaceColors;

  const partition =
    ready && !legend
      ? surfaceColor === 'network'
        ? sources.networks
        : surfaceColor === 'cab-np'
          ? sources.cabNp
          : null
      : null;
  if (partition) {
    const name = surfaceColor === 'cab-np' ? cabNpName : networkName;
    plates.push({
      name: 'network',
      map: surfaceColor,
      title: maps[surfaceColor]!,
      rows: partition.networks.map((key) => row(key, partition.colors[key]!, name(key, lang))),
      note: '',
      level: null,
      pickable: false,
    });
  }

  if (ready && !legend && sources.functionalRegions && surfaceColor === 'functional') {
    plates.push({
      name: 'functional',
      map: 'functional',
      title: maps.functional!,
      rows: sources.functionalRegions.levels[sources.functionalLevel].map((record) =>
        row(
          record.id,
          record.color,
          (record.number ? `${record.number} · ` : '') + functionalShortName(record, lang),
        ),
      ),
      note: '',
      level: sources.functionalLevel,
      pickable: false,
    });
  }

  if (ready && legend) {
    plates.push({
      name: 'paint',
      map: legend.map,
      title: legend.title,
      rows: legend.rows.map((entry) =>
        row(entry.id, entry.color, entry.label, entry.pressed, entry.absent),
      ),
      note: legend.note,
      level: null,
      pickable: legend.pickable !== false && legend.rows.length > 1,
    });
  }

  if (ready && sources.directionShown) {
    const copy = t(lang, 'viewport').directionKey;
    plates.push({
      name: 'direction',
      map: 'direction',
      title: copy.title,
      rows: [
        row('lr', 'var(--scene-direction-lr)', copy.leftRight),
        row('ap', 'var(--scene-direction-ap)', copy.anteriorPosterior),
        row('si', 'var(--scene-direction-si)', copy.superiorInferior),
      ],
      note: '',
      level: null,
      pickable: false,
    });
  }
  return plates;
}

/** What `defaultOpen` weighs: the stage's visible rectangle, its gutter and the dock's height. */
export interface StageRoom {
  width: number;
  height: number;
  gutter: number;
  dockHeight: number;
}

/**
 * Whether a plate starts open when the reader has not folded it (viewport-chrome.js:304-320). A long
 * key starts folded to its title where the stage is narrow or its rows would not fit above the dock;
 * on a phone any key does where it would take more than half that room from the picture. `stage` is
 * null until the stage has a size.
 */
export function defaultOpen(
  plate: Pick<KeyPlate, 'name' | 'map' | 'pickable'> & { count: number },
  { phone, coarse }: { phone: boolean; coarse: boolean },
  stage: StageRoom | null,
): boolean {
  const columns = phone && plate.name !== 'direction' && plate.map !== 'deficit' ? 2 : 1;
  const rowPx = plate.pickable && (phone || coarse) ? TOUCH_ROW_PX : KEY_ROW_PX;
  const need = KEY_HEAD_PX + Math.ceil(plate.count / columns) * rowPx;
  const room = stage ? stage.height - 3 * stage.gutter - stage.dockHeight : -Infinity;
  const crowded = Boolean(stage?.width) && (stage!.width < KEY_FOLD_WIDTH_PX || need > room);
  return !(
    (plate.count > KEY_FOLD_ROWS && crowded) ||
    (phone && Boolean(stage?.height) && need > room / 2)
  );
}

/**
 * The band the keys take off the framing rectangle (viewport-chrome.js:403-415): the top strip down
 * to the keys' foot or the right column, whichever leaves the anatomy the larger square. Nothing
 * while the keys or the stage have no size.
 */
export function keyBand(
  size: { width: number; height: number },
  visible: { width: number; height: number } | null,
  gutter: number,
): { top: number; right: number } {
  if (!size.width || !size.height || !visible?.width || !visible.height)
    return { top: 0, right: 0 };
  const top = Math.round(gutter + size.height);
  const right = Math.round(gutter + size.width);
  const { width, height } = visible;
  return Math.min(width, height - top) >= Math.min(width - right, height)
    ? { top, right: 0 }
    : { top: 0, right };
}
