/**
 * View-level state, and the assembly of the single snapshot every UI module
 * renders from.
 *
 * The model owns what is displayed; the session owns how the interface is
 * arranged around it. Keeping both behind one `assemble` means panels are
 * updated from one place, and cannot be reached by two update paths that
 * disagree.
 *
 * Free of the DOM and of Three.js, so all of it is unit tested.
 */

/** Inputs that consume typed characters, where a global shortcut would steal them. */
const TYPING_INPUT_TYPES = new Set([
  'text', 'search', 'email', 'number', 'password', 'tel', 'url', undefined,
]);

/**
 * Whether a single-key shortcut may act, given what currently has focus.
 * Without this, `3` could not be typed into search, and `3b` is a real
 * HCP-MMP area.
 */
export function shortcutsAllowed(target) {
  if (!target) return true;
  if (target.isContentEditable) return false;
  const tag = target.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return false;
  if (tag === 'INPUT') return !TYPING_INPUT_TYPES.has(target.type);
  return true;
}

export function createSession({ views, theme = 'light' }) {
  const knownViews = new Set(views);
  let state = {
    view: 'oblique',
    query: '',
    expanded: new Set(),
    theme,
    status: 'loading',
    progress: null,
    error: null,
    notice: null,
  };

  /** Any deliberate action supersedes a standing notice. */
  const act = change => {
    state = { ...state, notice: null, ...change };
    return true;
  };

  return {
    setView(view) {
      if (!knownViews.has(view)) return false;
      return act({ view });
    },

    setQuery: query => act({ query }),

    toggleGroup(name) {
      const expanded = new Set(state.expanded);
      if (!expanded.delete(name)) expanded.add(name);
      return act({ expanded });
    },

    setTheme: value => act({ theme: value }),

    setStatus: status => act({ status, progress: null, error: null }),

    setProgress: progress => act({ status: 'loading', progress }),

    setError: error => act({ status: 'error', error, progress: null }),

    /** Notices are cleared by the next action, never by a timer. */
    notify(notice) {
      state = { ...state, notice };
    },

    /**
     * One object, assembled once per change. Derived values — search results,
     * groups, visible counts — are computed by the catalog at render time and
     * deliberately absent here.
     */
    assemble(modelState) {
      return { ...modelState, ...state };
    },
  };
}
