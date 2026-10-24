import { ALL_DOMAINS, domainName, domainPaint, domainRecord, isTermId, overviewDomains } from '../catalog/neuropsych-domains.js';
import { t } from '../i18n/translations.js';

/** Which tab a paint belongs to, by its id: `function:…` or `deficit:…`. */
export const paintKind = paint => paint?.id.slice(0, paint.id.indexOf(':')) || null;

/**
 * The tab's paint: the open function on its own atlas, or the open deficit, while that tab is in
 * front and the reader has not chosen a masthead colour or atlas over it.
 */
export function paintFor(state, { domains, clinical }) {
  if (state.paintLifted) return null;
  if (state.explorer === 'functions' && state.selectedFunction && state.atlas === domains.atlas) {
    return domainPaint(domains, state.selectedFunction);
  }
  if (state.explorer === 'deficits' && state.selectedDeficit) {
    return clinical.paint(state.selectedDeficit, state.selectedFinding).paint;
  }
  return null;
}

/**
 * The stage key for the paint on show: the overview's functions, or the one function chosen, or each
 * of the open deficit's findings. A chosen function keys itself alone however many the list holds.
 */
export function legendFor(state, { domains, clinical }) {
  const kind = paintKind(state.paint);
  if (kind === 'function') {
    const copy = t(state.lang, 'domains');
    const picked = state.selectedFunction === ALL_DOMAINS ? null : domainRecord(domains, state.selectedFunction);
    const row = record => ({
      id: record.id, color: record.color, label: domainName(record, state.lang), pressed: record === picked,
    });
    return picked
      ? { map: 'function', title: isTermId(picked.id) ? copy.keyTitleTerm : copy.keyTitle, note: copy.keyPicked, rows: [row(picked)] }
      : { map: 'function', title: copy.keyTitle, note: copy.keyAll, rows: overviewDomains(domains).map(row) };
  }
  if (kind === 'deficit') {
    const copy = t(state.lang, 'deficitKey');
    const { findings } = clinical.paint(state.selectedDeficit);
    return {
      map: 'deficit', title: clinical.get(state.selectedDeficit).name[state.lang],
      note: findings.length === 1 ? copy.keyOne : state.selectedFinding ? copy.keyPicked : copy.keyAll,
      rows: findings.map(({ association, color }) => ({
        id: association.id, color, label: association.title[state.lang], pressed: association.id === state.selectedFinding,
      })),
    };
  }
  return null;
}
