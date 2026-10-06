import { atlasSwitchLabel, t } from '../i18n/translations.js';
import { decimal } from './format.js';

const NARROW_NBSP = ' ';
const ELLIPSIS = '…';

/** Stage geometry in CSS pixels, matching stage.css: gutter, marking line height, caption gaps. */
export const SNAPSHOT_LAYOUT = Object.freeze({ gutter: 16, line: 16, letterGap: 12, scaleGap: 8 });

/** Between the facts of one caption line, as in the masthead. */
export const SEPARATOR = ' · ';

/**
 * The exported image's caption: what was imaged, how it is labelled and coloured, and the view
 * or section it shows. Each line is a list of facts, each fact a list of runs; numbers are mono
 * runs, as on screen. Facts are joined by SEPARATOR and a narrow image breaks a line between them.
 */
export function snapshotCaption(lang, { subject, atlas, surfaceColor, detail, reference, view, section }) {
  const fact = (text, style = {}) => [{ text, ...style }];
  const lines = reference
    ? [[fact(reference, { strong: true })]]
    : [
      [fact(subject, { strong: true })],
      [atlas && atlasSwitchLabel(atlas, lang), t(lang, 'display').surfaceColors[surfaceColor],
        detail && atlasSwitchLabel(detail, lang)].map(text => fact(text)),
    ];
  if (section) {
    const cuts = t(lang, 'cuts');
    const line = [fact(cuts.sectionNames[section.plane]),
      fact(`${decimal(section.offset, 1, lang, { signed: true })}${NARROW_NBSP}mm`, { mono: true })];
    if (section.plane === 'oblique') {
      line.push([{ text: `${cuts.tiltShort} ` }, { text: `${decimal(section.tilt, 0, lang)}°`, mono: true }],
        [{ text: `${cuts.azimuthShort} ` }, { text: `${decimal(section.azimuth, 0, lang, { signed: true })}°`, mono: true }]);
    }
    lines.push(line);
  } else if (view) {
    lines.push([fact(t(lang, 'viewport').snapshotView(t(lang, 'views')[view]))]);
  }
  return lines.map(line => line.filter(runs => runs.some(run => run.text))).filter(line => line.length);
}

/** Facts packed greedily into lines no wider than `room`; returns each line's fact indices. */
export function packFacts(widths, separator, room) {
  const lines = [];
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
export function ellipsize(text, width, measure) {
  if (measure(text) <= width) return text;
  let low = 0;
  let high = text.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (measure(text.slice(0, mid).trimEnd() + ELLIPSIS) <= width) low = mid; else high = mid - 1;
  }
  return low ? text.slice(0, low).trimEnd() + ELLIPSIS : ELLIPSIS;
}

/**
 * Where the bottom line's statement and scale bar go: side by side when both fit between the
 * gutters, otherwise the scale bar one line up. Widths and the result are in CSS pixels.
 */
export function bottomLine({ width, height, statementWidth, scaleWidth }, layout = SNAPSHOT_LAYOUT) {
  const { gutter, line, scaleGap } = layout;
  const baseline = height - gutter - line / 2;
  const shared = statementWidth + scaleGap * 2 + scaleWidth <= width - 2 * gutter;
  return {
    statement: { x: gutter, y: baseline },
    scale: { x: width - gutter - scaleWidth, y: shared ? baseline : baseline - line - scaleGap },
  };
}

const fontOf = ({ weight = 400, size, family }) => `${weight} ${size}px ${family}`;

/** Ink with the markings' dark rim and halo (stage.css .orientation > span). */
function haloText(ctx, text, x, y, { ink, halo, haloCore }, ratio) {
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3;
  ctx.strokeStyle = haloCore;
  for (const [blur, color] of [[8, halo], [4, haloCore], [2, haloCore], [1, haloCore]]) {
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

function runFont(run, fonts, size) {
  return fontOf({ weight: run.strong ? 600 : 400, size, family: run.mono ? fonts.mono : fonts.ui });
}

function runsWidth(ctx, runs, fonts, size) {
  return runs.reduce((total, run) => {
    ctx.font = runFont(run, fonts, size);
    return total + ctx.measureText(run.text).width;
  }, 0);
}

/** Shorten a line's runs from the end until they fit. */
function fitRuns(ctx, runs, fonts, size, width) {
  const kept = [];
  let used = 0;
  for (const run of runs) {
    ctx.font = runFont(run, fonts, size);
    const room = width - used;
    const measure = text => ctx.measureText(text).width;
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

function drawRuns(ctx, runs, x, y, fonts, size, palette, ratio) {
  let cursor = x;
  for (const run of runs) {
    ctx.font = runFont(run, fonts, size);
    haloText(ctx, run.text, cursor, y, palette, ratio);
    cursor += ctx.measureText(run.text).width;
  }
}

function drawScaleBar(ctx, { pixels, label }, x, y, fonts, palette, ratio) {
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
  ctx.font = fontOf({ size: 12, family: fonts.mono });
  haloText(ctx, label, x + pixels + scaleGap, y, palette, ratio);
}

/** A colour key, redrawn from its on-screen plate: the plate, its swatches and its words. */
function drawKey(ctx, key, palette) {
  const { box, swatches, texts } = key;
  ctx.save();
  ctx.fillStyle = palette.plate;
  ctx.strokeStyle = palette.border;
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
export function annotateSnapshot(canvas, plan) {
  const { ratio, width, height, letters, caption, statement, scale, keys, fonts, palette } = plan;
  const { gutter, line, letterGap } = SNAPSHOT_LAYOUT;
  const ctx = canvas.getContext('2d');
  ctx.save();
  ctx.scale(ratio, ratio);
  ctx.textBaseline = 'middle';

  ctx.textAlign = 'center';
  ctx.font = fontOf({ weight: 600, size: 13, family: fonts.ui });
  for (const letter of letters) haloText(ctx, letter.text, letter.x, letter.y, palette, ratio);
  ctx.textAlign = 'left';

  // The caption keeps to the left of the top letter, so the two never touch.
  const top = letters.find(letter => letter.edge === 'top');
  const room = (top ? top.x - ctx.measureText(top.text).width / 2 - letterGap : width - gutter) - gutter;
  let y = gutter + line / 2;
  caption.forEach((facts, index) => {
    const size = index === 0 ? 13 : 12;
    const separator = runsWidth(ctx, [{ text: SEPARATOR }], fonts, size);
    const widths = facts.map(runs => runsWidth(ctx, runs, fonts, size));
    for (const row of packFacts(widths, separator, room)) {
      const runs = row.flatMap((fact, at) => (at ? [{ text: SEPARATOR }, ...facts[fact]] : facts[fact]));
      const fitted = runsWidth(ctx, runs, fonts, size) > room ? fitRuns(ctx, runs, fonts, size, room) : runs;
      drawRuns(ctx, fitted, gutter, y, fonts, size, palette, ratio);
      y += line;
    }
  });

  for (const key of keys) drawKey(ctx, key, palette);

  ctx.font = fontOf({ size: 12, family: fonts.ui });
  const statementWidth = ctx.measureText(statement).width;
  ctx.font = fontOf({ size: 12, family: fonts.mono });
  const scaleWidth = scale ? scale.pixels + SNAPSHOT_LAYOUT.scaleGap + ctx.measureText(scale.label).width : 0;
  const spots = bottomLine({ width, height, statementWidth, scaleWidth });
  ctx.font = fontOf({ size: 12, family: fonts.ui });
  haloText(ctx, statement, spots.statement.x, spots.statement.y, palette, ratio);
  if (scale) drawScaleBar(ctx, scale, spots.scale.x, spots.scale.y, fonts, palette, ratio);
  ctx.restore();
  return canvas;
}

/** Every face and weight the annotations use, loaded for exactly the words they will draw. */
export function snapshotFonts(plan) {
  const words = [plan.statement, ...plan.letters.map(letter => letter.text),
    SEPARATOR, ...plan.caption.flat(2).map(run => run.text), ...plan.keys.flatMap(key => key.texts.map(text => text.text))].join(' ');
  const faces = [
    fontOf({ weight: 400, size: 12, family: plan.fonts.ui }),
    fontOf({ weight: 600, size: 13, family: plan.fonts.ui }),
    ...new Set(plan.keys.flatMap(key => key.texts.map(text => text.font))),
  ];
  return Promise.all(faces.map(face => document.fonts.load(face, words)));
}
