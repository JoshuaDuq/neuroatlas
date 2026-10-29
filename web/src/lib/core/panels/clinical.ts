import type { Hemisphere, Language, Region, SurfaceColor } from '../../types/index.ts';
import type { Translated } from '../clinical/types.ts';
import { failureNotice } from '../i18n/errors.ts';
import { atlasSwitchLabel, t } from '../i18n/index.ts';

/** The display settings a deficit's reveal or a lesson step may change, as the notice compares them. */
export interface RevealSettings {
  cut: boolean;
  isolated: boolean;
  atlas: string;
  cutAtlas: string;
  colour: SurfaceColor;
  detail: string;
  hemisphere: Hemisphere;
  cortex: boolean;
}

/** A published correction, in the reader's language, with its DOI link. */
export interface PublishedCorrection {
  doi: string;
  href: string;
  summary: string;
}

/** A reference's published corrections, in the reader's language, each with its DOI link. */
export function publishedCorrections(
  reference: { corrections?: readonly { doi: string; summary: Translated }[] },
  lang: Language,
): PublishedCorrection[] {
  return (reference.corrections ?? []).map(({ doi, summary }) => ({
    doi: `doi:${doi}`,
    href: `https://doi.org/${doi}`,
    summary: summary[lang],
  }));
}

/** The one side every association in a profile shares, said once under its title; null when they differ. */
export function sharedSide(lateralities: readonly string[]): string | null {
  return lateralities.length > 0 && lateralities.every((side) => side === lateralities[0])
    ? lateralities[0]
    : null;
}

/** Links under an association name their side only when the association's own side does not already. */
export function sideStated(laterality: string, hemispheres: readonly string[]): boolean {
  return hemispheres.length > 0 && hemispheres.every((hemisphere) => hemisphere === laterality);
}

/**
 * What revealing a deficit's regions changed in the reader's own settings, as one sentence for the
 * notice; null when nothing changed, so nothing is claimed that did not happen.
 */
export function revealNotice(
  lang: Language,
  before: RevealSettings,
  after: RevealSettings,
): string | null {
  const said = t(lang, 'clinical').changed;
  const clauses: string[] = [];
  if (before.cut && !after.cut) clauses.push(said.cut);
  if (before.isolated && !after.isolated) clauses.push(said.isolation);
  if (before.atlas !== after.atlas) clauses.push(said.atlas(atlasSwitchLabel(after.atlas, lang)));
  if (before.cutAtlas !== after.cutAtlas) {
    clauses.push(said.cutAtlas(atlasSwitchLabel(after.cutAtlas, lang)));
  }
  if (before.colour !== after.colour) {
    clauses.push(said.colour(t(lang, 'display').surfaceColors[after.colour]));
  }
  if (before.detail !== after.detail) {
    clauses.push(said.detail(atlasSwitchLabel(after.detail, lang)));
  }
  if (before.hemisphere !== after.hemisphere) clauses.push(said.hemisphere[after.hemisphere]);
  if (before.cortex !== after.cortex) {
    clauses.push(after.cortex ? said.cortexShown : said.cortexHidden);
  }
  if (!clauses.length) return null;
  const sentence = new Intl.ListFormat(lang, { type: 'conjunction' }).format(clauses);
  return `${sentence.charAt(0).toLocaleUpperCase(lang)}${sentence.slice(1)}.`;
}

/**
 * The profile's meta line: work in progress, a failure, or what the stage shows.
 * A failure is worded for the reader: its own `failure` text, else what `operation` could not do.
 */
export function stageMessage<K extends string>(
  text: Readonly<Record<NoInfer<K>, string>>,
  {
    opening,
    busy,
    error,
    failure,
    operation,
    lang,
    status,
  }: {
    opening: boolean;
    busy: K;
    error: unknown;
    failure: K | null;
    operation: string;
    lang: Language;
    status: string;
  },
): string {
  if (opening) return text[busy];
  if (error) return failure ? text[failure] : failureNotice(error, lang, operation).text;
  return status;
}

/** A region inspector does not title a Neuropsychology section that has nothing to report. */
export function relatedRegionVisible(
  selectedRegion: Pick<Region, 'id'> | null,
  deficitCount: number,
): boolean {
  return Boolean(selectedRegion) && deficitCount > 0;
}
