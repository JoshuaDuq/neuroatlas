/** Validated, immutable visibility masks with one history entry per action. */
export function createDissection(regions) {
  let hidden = new Set();
  const history = [];

  function validate(ids) {
    if (!Array.isArray(ids) || ids.some(id => typeof id !== 'string')) {
      throw new TypeError('Dissection requires an array of region identifiers.');
    }
    for (const id of ids) {
      if (!regions.has(id)) throw new Error(`Unknown region: ${id}`);
    }
    return new Set(ids);
  }

  function replace(next, context) {
    if (next.size === hidden.size && [...next].every(id => hidden.has(id))) return false;
    history.push({ hidden, context: { ...context } });
    hidden = next;
    return true;
  }

  return {
    get state() {
      return { hiddenRegions: new Set(hidden), dissectionCanUndo: history.length > 0 };
    },
    hide(ids, context) {
      const added = validate(ids);
      return replace(new Set([...hidden, ...added]), context);
    },
    show(ids, context) {
      const shown = validate(ids);
      return replace(new Set([...hidden].filter(id => !shown.has(id))), context);
    },
    restore(context) {
      return replace(new Set(), context);
    },
    undo() {
      const previous = history.pop();
      if (!previous) return null;
      hidden = previous.hidden;
      return previous.context;
    },
    load(ids) {
      hidden = validate(ids);
      history.length = 0;
    },
    reset() {
      hidden = new Set();
      history.length = 0;
    },
  };
}
