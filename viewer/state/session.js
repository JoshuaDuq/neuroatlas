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

export function createSession({ views, theme = 'light', lang = 'en' }) {
  const knownViews = new Set(views);
  let state = {
    view: 'oblique',
    query: '',
    explorer: 'anatomy',
    clinicalQuery: '',
    selectedDeficit: null,
    expanded: new Set(),
    theme,
    lang: ['en', 'fr'].includes(lang) ? lang : 'en',
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

    setExplorer(explorer) {
      if (!['anatomy', 'deficits'].includes(explorer)) {
        throw new Error(`Unknown explorer: ${explorer}`);
      }
      return act({ explorer });
    },

    setClinicalQuery: clinicalQuery => act({ clinicalQuery }),
    setDeficit: selectedDeficit => act({ selectedDeficit }),

    toggleGroup(name) {
      const expanded = new Set(state.expanded);
      if (!expanded.delete(name)) expanded.add(name);
      return act({ expanded });
    },

    setExpanded(expanded) {
      return act({ expanded: new Set(expanded) });
    },

    setTheme: value => act({ theme: value }),

    setLang: value => act({ lang: ['en', 'fr'].includes(value) ? value : 'en' }),

    setStatus: status => act({ status, progress: null, error: null }),

    setProgress: progress => act({ status: 'loading', progress }),

    /**
     * Swapping atlas is not first load. There is already a model on screen,
     * so it stays visible and usable and only the atlas control reports.
     */
    setSwitching: progress => act({ status: 'switching', progress }),

    /**
     * A failed swap leaves the working atlas in place; it is not a dead viewer.
     *
     * The reader is told which atlas failed. The underlying error is not
     * shown: a missing file makes the glTF loader parse the 404 page and
     * report "Unexpected token '<'", which describes the parser rather than
     * anything the reader can act on. It goes to the console instead.
     */
    failSwitch(atlasLabel, error) {
      console.error(error);
      const isFr = state.lang === 'fr';
      state = {
        ...state,
        status: 'ready',
        progress: null,
        error: null,
        notice: isFr
          ? `Impossible de charger ${atlasLabel}. Le fichier modèle est peut-être `
            + 'indisponible — vérifiez votre connexion et réessayez.'
          : `Could not load the ${atlasLabel}. The model file may be `
            + 'unavailable — check your connection and try again.',
      };
    },

    setError: error => act({ status: 'error', error, progress: null }),

    /** The GPU dropped the context. Recoverable, and said so plainly. */
    setContextLost: () => act({
      status: 'context-lost',
      progress: null,
      error: new Error(state.lang === 'fr'
        ? 'La vue 3D a été interrompue par le pilote graphique. Restauration…'
        : 'The 3D view was interrupted by the graphics driver. Restoring…'),
    }),

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
