// The visible stage as a PNG that documents itself (ui/chrome/snapshot.js; viewport-chrome.js:796-831;
// app.js:1450-1463): the rendered frame, the orientation letters, scale bar and colour keys, a caption
// naming subject, labels, colouring and view or section, and the not-clinical statement.
import { decimal, withUnit } from '../../lib/core/format.ts';
import { atlasSwitchLabel, t } from '../../lib/core/i18n/index.ts';
import { subjectName } from '../../lib/core/panels/header.ts';
import type { SceneCommands } from '../../lib/core/state/scene-commands.ts';
import type { Engine, EngineCamera, Rect } from '../../lib/engine/api.ts';
import type { StageLayout } from '../../lib/state/stage-layout.svelte.ts';
import type { CutMode, Language, SurfaceColor, ViewName } from '../../lib/types/index.ts';
import { announce } from '../../lib/ui/announcer.svelte.ts';
import { SNAPSHOT_LAYOUT, snapshotMarkings } from './markings.ts';
import type { KeyMark, Markings, StageKeysModel } from './markings.ts';

// TODO(C1): moves to the viewport area when the string lands (decision 33 on #4).
const SAVED: Record<Language, (file: string) => string> = {
  en: (file) => `Image saved as ${file}.`,
  fr: (file) => `Image enregistrée : ${file}.`,
};

const ELLIPSIS = '…';

/** The stage's own type size (--text-stage): markings, the scale bar and the caption's first line. */
const STAGE_TYPE = 13;

/** Between the facts of one caption line, as in the masthead. */
export const SEPARATOR = ' · ';

/** An object URL is kept this long after its download starts, as FileSaver.js does: revoked sooner, some browsers lose the file. */
const REVOKE_AFTER_MS = 40_000;

export interface Run {
  text: string;
  strong?: boolean;
}
/** One caption line: facts, each a list of runs. */
export type CaptionLine = Run[][];

export interface SnapshotSection {
  plane: Exclude<CutMode, 'off'>;
  /** Millimetres along the plane's normal. */
  offset: number;
  tilt: number;
  azimuth: number;
}

export interface CaptionFacts {
  subject?: string;
  atlas?: string | null;
  surfaceColor?: SurfaceColor;
  detail?: string | null;
  reference?: string | null;
  view?: ViewName | null;
  section?: SnapshotSection | null;
}

/**
 * The exported image's caption: what was imaged, how it is labelled and coloured, and the view
 * or section it shows. Each line is a list of facts, each fact a list of runs. Facts are joined
 * by SEPARATOR and a narrow image breaks a line between them.
 */
export function snapshotCaption(
  lang: Language,
  { subject, atlas, surfaceColor, detail, reference, view, section }: CaptionFacts,
): CaptionLine[] {
  const fact = (text: string | null | undefined, style: Omit<Run, 'text'> = {}) => [
    { text: text || '', ...style },
  ];
  const lines: CaptionLine[] = reference
    ? [[fact(reference, { strong: true })]]
    : [
        [fact(subject, { strong: true })],
        [
          atlas && atlasSwitchLabel(atlas, lang),
          surfaceColor && t(lang, 'display').surfaceColors[surfaceColor],
          detail && atlasSwitchLabel(detail, lang),
        ].map((text) => fact(text)),
      ];
  if (section) {
    const cuts = t(lang, 'cuts');
    const line = [
      fact(cuts.sectionNames[section.plane]),
      fact(withUnit(decimal(section.offset, 1, lang, { signed: true }), 'mm', lang)),
    ];
    if (section.plane === 'oblique') {
      line.push(
        fact(`${cuts.tiltShort} ${decimal(section.tilt, 0, lang)}°`),
        fact(`${cuts.azimuthShort} ${decimal(section.azimuth, 0, lang, { signed: true })}°`),
      );
    }
    lines.push(line);
  } else if (view) {
    lines.push([fact(t(lang, 'viewport').snapshotView(t(lang, 'views')[view]))]);
  }
  return lines
    .map((line) => line.filter((runs) => runs.some((run) => run.text)))
    .filter((line) => line.length);
}

/** Facts packed greedily into lines no wider than `room`; returns each line's fact indices. */
export function packFacts(widths: readonly number[], separator: number, room: number): number[][] {
  const lines: number[][] = [];
  let used = 0;
  widths.forEach((width, index) => {
    const line = lines.at(-1);
    if (line && used + separator + width <= room) {
      line.push(index);
      used += separator + width;
    } else {
      lines.push([index]);
      used = width;
    }
  });
  return lines;
}

/** The longest start of `text` that, with an ellipsis, measures within `width`. */
export function ellipsize(text: string, width: number, measure: (text: string) => number): string {
  if (measure(text) <= width) return text;
  let low = 0;
  let high = text.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (measure(text.slice(0, mid).trimEnd() + ELLIPSIS) <= width) low = mid;
    else high = mid - 1;
  }
  return low ? text.slice(0, low).trimEnd() + ELLIPSIS : ELLIPSIS;
}

/**
 * Where the bottom line's statement and scale bar go: side by side when both fit between the
 * gutters, otherwise the scale bar one line up. Widths and the result are in CSS pixels.
 */
export function bottomLine(
  {
    width,
    height,
    statementWidth,
    scaleWidth,
  }: { width: number; height: number; statementWidth: number; scaleWidth: number },
  layout = SNAPSHOT_LAYOUT,
) {
  const { gutter, line, scaleGap } = layout;
  const baseline = height - gutter - line / 2;
  const shared = statementWidth + scaleGap * 2 + scaleWidth <= width - 2 * gutter;
  return {
    statement: { x: gutter, y: baseline },
    scale: { x: width - gutter - scaleWidth, y: shared ? baseline : baseline - line - scaleGap },
  };
}

interface Palette {
  ink: string;
  halo: string;
  haloCore: string;
}

/** Everything `annotateSnapshot` draws, in CSS pixels of the cropped stage. */
export interface SnapshotPlan extends Markings {
  width: number;
  height: number;
  caption: CaptionLine[];
  statement: string;
  font: string;
  palette: Palette;
}

type Context = CanvasRenderingContext2D;

const fontOf = ({
  weight = 400,
  size,
  family,
}: {
  weight?: number;
  size: number;
  family: string;
}) => `${weight} ${size}px ${family}`;

/** Ink with the markings' dark rim and halo (the orientation letters' text stroke and shadows). */
function haloText(
  ctx: Context,
  text: string,
  x: number,
  y: number,
  { ink, halo, haloCore }: Palette,
  ratio: number,
) {
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3;
  ctx.strokeStyle = haloCore;
  for (const [blur, color] of [
    [8, halo],
    [4, haloCore],
    [2, haloCore],
    [1, haloCore],
  ] as const) {
    // Shadows ignore the transform, so the blur is given in export pixels.
    ctx.shadowColor = color;
    ctx.shadowBlur = blur * ratio;
    ctx.strokeText(text, x, y);
  }
  ctx.shadowColor = 'transparent';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = ink;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function runFont(run: Run, family: string, size: number) {
  return fontOf({ weight: run.strong ? 600 : 400, size, family });
}

function runsWidth(ctx: Context, runs: readonly Run[], family: string, size: number) {
  return runs.reduce((total, run) => {
    ctx.font = runFont(run, family, size);
    return total + ctx.measureText(run.text).width;
  }, 0);
}

/** Shorten a line's runs from the end until they fit. */
function fitRuns(ctx: Context, runs: readonly Run[], family: string, size: number, width: number) {
  const kept: Run[] = [];
  let used = 0;
  for (const run of runs) {
    ctx.font = runFont(run, family, size);
    const room = width - used;
    const measure = (text: string) => ctx.measureText(text).width;
    if (measure(run.text) <= room) {
      kept.push(run);
      used += measure(run.text);
      continue;
    }
    kept.push({ ...run, text: ellipsize(run.text, room, measure) });
    break;
  }
  return kept;
}

function drawRuns(
  ctx: Context,
  runs: readonly Run[],
  x: number,
  y: number,
  family: string,
  size: number,
  palette: Palette,
  ratio: number,
) {
  let cursor = x;
  for (const run of runs) {
    ctx.font = runFont(run, family, size);
    haloText(ctx, run.text, cursor, y, palette, ratio);
    cursor += ctx.measureText(run.text).width;
  }
}

function drawScaleBar(
  ctx: Context,
  { pixels, label }: { pixels: number; label: string },
  x: number,
  y: number,
  family: string,
  palette: Palette,
  ratio: number,
) {
  const { scaleGap } = SNAPSHOT_LAYOUT;
  // The rule is a 6px bracket open at the top, its foot a pixel below the line's centre.
  const foot = Math.round(y + 3) - 0.5;
  const left = Math.round(x) + 0.5;
  const right = left + Math.round(pixels) - 1;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(left, foot - 6);
  ctx.lineTo(left, foot);
  ctx.lineTo(right, foot);
  ctx.lineTo(right, foot - 6);
  ctx.lineJoin = 'miter';
  ctx.lineCap = 'square';
  ctx.strokeStyle = palette.haloCore;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.strokeStyle = palette.ink;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
  ctx.font = fontOf({ size: STAGE_TYPE, family });
  haloText(ctx, label, x + pixels + scaleGap, y, palette, ratio);
}

/** A colour key, redrawn from its on-screen plate: the plate, its swatches and its words. */
function drawKey(ctx: Context, { box, fill, edge, swatches, texts }: KeyMark) {
  ctx.save();
  ctx.fillStyle = fill;
  ctx.strokeStyle = edge;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(box.x + 0.5, box.y + 0.5, box.width - 1, box.height - 1, 4);
  ctx.fill();
  ctx.stroke();
  for (const swatch of swatches) {
    ctx.fillStyle = swatch.color;
    ctx.beginPath();
    ctx.roundRect(swatch.x, swatch.y, swatch.width, swatch.height, swatch.radius);
    ctx.fill();
  }
  ctx.textBaseline = 'middle';
  for (const text of texts) {
    ctx.font = text.font;
    ctx.fillStyle = text.color;
    ctx.fillText(text.text, text.x, text.y);
  }
  ctx.restore();
}

/**
 * Write the stage's markings onto a captured frame, in place. Everything in `plan` is in CSS
 * pixels of the cropped stage; `ratio` is the frame's pixels per CSS pixel. Only marks are
 * drawn: the rendered anatomy under them is not resampled or filtered.
 */
export function annotateSnapshot(
  canvas: HTMLCanvasElement,
  plan: SnapshotPlan & { ratio: number },
): HTMLCanvasElement {
  const { ratio, width, height, letters, caption, statement, scale, keys, font, palette } = plan;
  const { gutter, line, letterGap } = SNAPSHOT_LAYOUT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('The snapshot canvas has no 2D context.');
  ctx.save();
  ctx.scale(ratio, ratio);
  ctx.textBaseline = 'middle';

  ctx.textAlign = 'center';
  ctx.font = fontOf({ weight: 600, size: STAGE_TYPE, family: font });
  for (const letter of letters) haloText(ctx, letter.text, letter.x, letter.y, palette, ratio);
  ctx.textAlign = 'left';

  // The caption keeps to the left of the top letter, so the two never touch.
  const top = letters.find((letter) => letter.edge === 'top');
  const room =
    (top ? top.x - ctx.measureText(top.text).width / 2 - letterGap : width - gutter) - gutter;
  let y = gutter + line / 2;
  caption.forEach((facts, index) => {
    const size = index === 0 ? STAGE_TYPE : 12;
    const separator = runsWidth(ctx, [{ text: SEPARATOR }], font, size);
    const widths = facts.map((runs) => runsWidth(ctx, runs, font, size));
    for (const row of packFacts(widths, separator, room)) {
      const runs = row.flatMap((fact, at) =>
        at ? [{ text: SEPARATOR }, ...facts[fact]!] : facts[fact]!,
      );
      const fitted =
        runsWidth(ctx, runs, font, size) > room ? fitRuns(ctx, runs, font, size, room) : runs;
      drawRuns(ctx, fitted, gutter, y, font, size, palette, ratio);
      y += line;
    }
  });

  for (const key of keys) drawKey(ctx, key);

  ctx.font = fontOf({ size: 12, family: font });
  const statementWidth = ctx.measureText(statement).width;
  ctx.font = fontOf({ size: STAGE_TYPE, family: font });
  const scaleWidth = scale
    ? scale.pixels + SNAPSHOT_LAYOUT.scaleGap + ctx.measureText(scale.label).width
    : 0;
  const spots = bottomLine({ width, height, statementWidth, scaleWidth });
  ctx.font = fontOf({ size: 12, family: font });
  haloText(ctx, statement, spots.statement.x, spots.statement.y, palette, ratio);
  if (scale) drawScaleBar(ctx, scale, spots.scale.x, spots.scale.y, font, palette, ratio);
  ctx.restore();
  return canvas;
}

/** Every face and weight the annotations use, loaded for exactly the words they will draw. */
export function snapshotFonts(plan: SnapshotPlan) {
  const words = [
    plan.statement,
    ...plan.letters.map((letter) => letter.text),
    plan.scale?.label ?? '',
    SEPARATOR,
    ...plan.caption.flat(2).map((run) => run.text),
    ...plan.keys.flatMap((key) => key.texts.map((text) => text.text)),
  ].join(' ');
  const faces = [
    fontOf({ weight: 400, size: 12, family: plan.font }),
    fontOf({ weight: 400, size: STAGE_TYPE, family: plan.font }),
    fontOf({ weight: 600, size: STAGE_TYPE, family: plan.font }),
    ...new Set(plan.keys.flatMap((key) => key.texts.map((text) => text.font))),
  ];
  return Promise.all(faces.map((face) => document.fonts.load(face, words)));
}

/** The stage the snapshot is taken of. */
export interface SnapshotStage {
  /** The stage host, `<main id="viewport">`. */
  host: HTMLElement;
  stage: Pick<StageLayout, 'visibleRect' | 'keyInset' | 'dockTall'>;
  /** The stage keys (`bind:this` on `StageKeys`). */
  keys: StageKeysModel;
  engine: Pick<Engine, 'captureSnapshot'> & { camera: Pick<EngineCamera, 'viewHeld'> };
}

/** What the caption says, as the session holds it. */
export interface SnapshotSubject {
  lang: Language;
  /** The manifest's anatomy entry, which names the subject. */
  anatomy: Parameters<typeof subjectName>[0];
  atlas: string | null;
  surfaceColor: SurfaceColor;
  detail: string | null;
  /** The masthead offers an internal anatomy choice (more than one detail level). */
  offersDetail: boolean;
  view: ViewName | null;
  /** The tract reference's label while it is shown alone (`isIndependentTractReference`), else null. */
  reference: string | null;
  /** The open section, or null. */
  section: SnapshotSection | null;
}

/** The markings plan and caption for the visible stage, measured now. */
export function snapshotPlan(
  { host, stage, keys, engine }: SnapshotStage,
  subject: SnapshotSubject,
): { crop: Rect; plan: SnapshotPlan } {
  const rect = stage.visibleRect;
  if (!rect) throw new Error('The stage has not been laid out yet.');
  const { lang, reference } = subject;
  const caption = snapshotCaption(lang, {
    subject: subjectName(subject.anatomy),
    atlas: subject.atlas,
    surfaceColor: subject.surfaceColor,
    detail: subject.offersDetail ? subject.detail : null,
    reference,
    view: engine.camera.viewHeld ? subject.view : null,
    section: reference ? null : subject.section,
  });
  const tokens = getComputedStyle(host);
  const token = (name: string) => tokens.getPropertyValue(name).trim();
  const crop = { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  return {
    crop,
    plan: {
      ...snapshotMarkings(host, crop, { stage, keys, lang }),
      width: crop.width,
      height: crop.height,
      caption,
      statement: t(lang, 'viewport').snapshotStatement,
      font: token('--font-ui'),
      palette: {
        ink: token('--overlay-ink'),
        halo: token('--overlay-halo'),
        haloCore: token('--overlay-halo-core'),
      },
    },
  };
}

/** The annotated frame of the visible stage. Measuring, capturing and annotating follow each other, with only the fonts loaded between. */
export async function snapshotImage(
  scene: SnapshotStage,
  subject: SnapshotSubject,
): Promise<HTMLCanvasElement> {
  const { crop, plan } = snapshotPlan(scene, subject);
  await snapshotFonts(plan);
  const { canvas, ratio } = scene.engine.captureSnapshot(crop);
  return annotateSnapshot(canvas, { ...plan, ratio });
}

function pngOf(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('The snapshot could not be encoded.'))),
      'image/png',
    ),
  );
}

async function save(scene: SnapshotStage, subject: SnapshotSubject) {
  const file = `planum-${subject.atlas ?? 'brain'}.png`;
  const url = URL.createObjectURL(await pngOf(await snapshotImage(scene, subject)));
  const link = document.createElement('a');
  link.download = file;
  link.href = url;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_AFTER_MS);
  announce(SAVED[subject.lang](file));
}

let saving: Promise<void> | null = null;

/**
 * Download the visible stage as `planum-<atlas>.png` and say so. A failure is the scene commands'
 * `snapshot` notice. While one is being made, asking again joins it rather than saving twice.
 */
export function saveSnapshot(
  scene: SnapshotStage,
  subject: SnapshotSubject,
  commands: Pick<SceneCommands, 'fail'>,
): Promise<void> {
  saving ??= save(scene, subject)
    .catch((error: unknown) => commands.fail('snapshot', error))
    .finally(() => {
      saving = null;
    });
  return saving;
}
