import type { Language } from '../../types/index.ts';
import { t } from '../i18n/index.ts';

/** The reader state an undo returns to the caller (selection, camera and the like); opaque here. */
export type DissectionContext = Readonly<Record<string, unknown>>;

/** Validated, immutable visibility masks with one history entry per action. */
export function createDissection(regions: ReadonlyMap<string, unknown>) {
  let hidden = new Set<string>();
  const history: { hidden: Set<string>; context: DissectionContext }[] = [];

  function validate(ids: readonly string[]) {
    if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string')) {
      throw new TypeError('Dissection requires an array of region identifiers.');
    }
    for (const id of ids) {
      if (!regions.has(id)) throw new Error(`Unknown region: ${id}`);
    }
    return new Set(ids);
  }

  function replace(next: Set<string>, context: DissectionContext) {
    if (next.size === hidden.size && [...next].every((id) => hidden.has(id))) return false;
    history.push({ hidden, context: { ...context } });
    hidden = next;
    return true;
  }

  return {
    get state() {
      return { hiddenRegions: new Set(hidden), dissectionCanUndo: history.length > 0 };
    },
    hide(ids: readonly string[], context: DissectionContext) {
      const added = validate(ids);
      return replace(new Set([...hidden, ...added]), context);
    },
    show(ids: readonly string[], context: DissectionContext) {
      const shown = validate(ids);
      return replace(new Set([...hidden].filter((id) => !shown.has(id))), context);
    },
    restore(context: DissectionContext) {
      return replace(new Set(), context);
    },
    undo() {
      const previous = history.pop();
      if (!previous) return null;
      hidden = previous.hidden;
      return previous.context;
    },
    load(ids: readonly string[]) {
      hidden = validate(ids);
      history.length = 0;
    },
    reset() {
      hidden = new Set();
      history.length = 0;
    },
  };
}

/**
 * The sentence the dissection panel's count is spoken as, for the announcer: "3 parts hidden"
 * or "All parts shown" (ui/panels/dissection.js:21,31). The caller says it only when the count
 * has changed.
 */
export const dissectionSaid = (view: {
  lang: Language;
  hiddenRegions: ReadonlySet<string>;
}): string => t(view.lang, 'dissection').hiddenCount(view.hiddenRegions.size);
