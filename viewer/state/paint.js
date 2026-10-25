import { ALL_DOMAINS, domainName, domainPaint, domainRecord, isTermId, overviewDomains } from '../catalog/neuropsych-domains.js';
import { decimal } from '../ui/format.js';
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
 * The stage key for the paint on show: the overview's functions, or the one function chosen on the z
 * scale, strongest band first, or each of the open deficit's findings. Only the overview's and the
 * deficit's rows are toggles; a scale's bands are not.
 */
export function legendFor(state, { domains, clinical, drawn }) {
  const kind = paintKind(state.paint);
  if (kind === 'function') {
    const copy = t(state.lang, 'domains');
    if (state.selectedFunction !== ALL_DOMAINS) {
      const picked = domainRecord(domains, state.selectedFunction);
      const bands = domains.z_scale.map((band, index) => ({
        id: `z-${band.from}`, color: band.color, pressed: false,
        label: copy.band(decimal(band.from, 0, state.lang),
          index + 1 < domains.z_scale.length ? decimal(domains.z_scale[index + 1].from, 0, state.lang) : null),
      })).reverse();
      return { map: 'function', title: domainName(picked, state.lang), pickable: false,
        note: isTermId(picked.id) ? copy.keyScaleTerm : copy.keyScale, rows: bands };
    }
    const row = record => ({ id: record.id, color: record.color, label: domainName(record, state.lang), pressed: false });
    return { map: 'function', title: copy.keyTitle, note: copy.keyAll, rows: overviewDomains(domains).map(row) };
  }
  if (kind === 'deficit') {
    const copy = t(state.lang, 'deficitKey');
    const { findings } = clinical.paint(state.selectedDeficit);
    // A finding whose colour no drawn region carries, because its regions are not drawn in this view or
    // take an earlier finding's colour, is keyed but greyed, so the key promises nothing the stage lacks.
    const shows = (association, color) => association.mappings.some(({ region }) =>
      state.paint.colors.get(region)?.join() === color.join() && drawn(region, state));
    const rows = findings.map(({ association, color }) => ({
      id: association.id, color, label: association.title[state.lang], pressed: association.id === state.selectedFinding,
      absent: (!state.selectedFinding || association.id === state.selectedFinding) && !shows(association, color),
    }));
    const note = findings.length === 1 ? copy.keyOne : state.selectedFinding ? copy.keyPicked : copy.keyAll;
    return {
      map: 'deficit', title: clinical.get(state.selectedDeficit).name[state.lang],
      note: rows.some(row => row.absent) ? `${note} ${copy.keyAbsent}` : note, rows,
    };
  }
  return null;
}
