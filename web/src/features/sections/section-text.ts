/**
 * The words of the section bar (ui/chrome/sections.js:409-527): the letters at the slider's ends, the
 * cut labels' name, the colour note and the status sentence, said and shown. Pure, so each is tested
 * without a stage.
 */
import { decimal } from '../../lib/core/format.ts';
import { failureNotice } from '../../lib/core/i18n/errors.ts';
import { t } from '../../lib/core/i18n/index.ts';
import { paintKind } from '../../lib/core/state/paint.ts';
import type { CutMode, Language, Paint, SurfaceColor } from '../../lib/types/index.ts';
import type { SectionsState } from '../../lib/engine/api.ts';

/** The orientation letter at each end of a plane's slider, negative first (sections.js:19). */
const AXIS_ENDS = {
  sagittal: ['L', 'R'],
  coronal: ['P', 'A'],
  axial: ['I', 'S'],
} as const;

const MINUS = '−';

// TODO(C1): `cuts.positionRange` (requested on #4).
const RANGE_MESSAGE = {
  en: (min: string, max: string) => `Enter a position from ${min} to ${max}\u202fmm.`,
  fr: (min: string, max: string) => `Saisissez une position de ${min} à ${max}\u202fmm.`,
} as const;

/** The letters drawn at the slider's ends; an oblique plane has no anatomical ends, only − and +. */
export function axisEnds(plane: CutMode, lang: Language): readonly [string, string] {
  if (!(plane in AXIS_ENDS)) return [MINUS, '+'];
  const letters = t(lang, 'orientation');
  const [low, high] = AXIS_ENDS[plane as keyof typeof AXIS_ENDS];
  return [letters[low], letters[high]];
}

/** Said under the exact field when its value is outside the plane's range (deviation u4-number-field-range-error). */
export function rangeMessage([min, max]: readonly [number, number], lang: Language): string {
  const format = (value: number) => decimal(value, 1, lang, { trim: true });
  return RANGE_MESSAGE[lang](format(min), format(max));
}

/** A cut angle as the bar shows and speaks it: whole degrees, the azimuth signed. */
export function degrees(value: number, lang: Language, signed = false): string {
  return `${decimal(value, 0, lang, { signed })}°`;
}

export interface SentenceInput {
  lang: Language;
  state: Pick<SectionsState, 'status' | 'error' | 'cutAtlas'>;
  active: boolean;
  /** The crosshair's offset along the cut's normal, mm. */
  offset: number;
  /** The cut atlas's voxel spacing, mm. */
  spacing: number;
  surfaceColor: SurfaceColor;
  paint: Paint | null;
  /** NextBrain is segmented on this brain rather than warped to it (manifest `procedure`). */
  nextbrainSegmented: boolean;
  /** The atlases CAB-NP and the domains colour. */
  colourAtlases: { cabNp?: string; domains?: string };
  /** An error the bar itself caught, said in place of the state's sentence until the cut changes again. */
  failure: unknown;
}

/**
 * The status line (sections.js:490-526). `said` is the full sentence, for the live region; `shown`
 * leaves out the position, which the slider and the field beside it already give.
 */
export function sectionSentences(input: SentenceInput): { said: string; shown: string } {
  const { lang, state, active } = input;
  const copy = t(lang, 'cuts');
  if (input.failure !== null) {
    const text = failureNotice(input.failure, lang, 'section').text;
    return { said: text, shown: text };
  }
  const atlasLabel =
    {
      'hcp-mmp': copy.hcpDerived,
      julich: copy.julichDerived,
      destrieux: copy.destrieuxNative,
      nextbrain: input.nextbrainSegmented ? copy.nextbrainSegmented : copy.nextbrainWarped,
      arterial: copy.arterialRegistered,
    }[state.cutAtlas] ?? state.cutAtlas;
  // A cut is sampled from a label volume, so its network colour is per parcel while the surface's is
  // per vertex. CAB-NP groups HCP-MMP areas: other labels have none.
  const { cabNp, domains } = input.colourAtlases;
  const colourNote = input.paint
    ? null
    : input.surfaceColor === 'network'
      ? copy.networkByRegion
      : input.surfaceColor === 'territory' && state.cutAtlas !== 'arterial'
        ? copy.territoryByRegion
        : input.surfaceColor === 'cab-np'
          ? state.cutAtlas === cabNp
            ? copy.cabNpByArea
            : copy.cabNpOtherLabels
          : null;
  // A function's paint, like the HCP-MMP colourings, has areas only on HCP-MMP labels.
  const paintNote =
    paintKind(input.paint) === 'function'
      ? state.cutAtlas === domains
        ? copy.domainsByArea
        : copy.domainsOtherLabels
      : null;
  const note = (colourNote ?? paintNote) ? ` · ${colourNote ?? paintNote}` : '';
  const mri = input.surfaceColor === 'mri' && !input.paint;
  const spacing = decimal(input.spacing, 2, lang, { trim: true });
  const said =
    state.status === 'loading'
      ? copy.statusPreparing
      : state.error
        ? failureNotice({ code: state.error }, lang, 'section').text
        : active
          ? (mri
              ? copy.statusMri(decimal(input.offset, 1, lang, { signed: true }), atlasLabel)
              : copy.statusActive(
                  decimal(input.offset, 1, lang, { signed: true }),
                  atlasLabel,
                  spacing,
                )) + note
          : copy.statusFull;
  const shown =
    active && state.status !== 'loading' && !state.error
      ? (mri ? copy.gridMri(atlasLabel) : copy.grid(atlasLabel, spacing)) + note
      : said;
  return { said, shown };
}
