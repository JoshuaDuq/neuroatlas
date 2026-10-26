// The workspace's pure rules (viewer/ui/chrome/workspace.js:6-63) and its current-item registry.
import { MODES } from '../types/constants.ts';
import type { Explorer, Language, Notice, Region, SessionState } from '../types/index.ts';
import { isIndependentTractReference } from './diffusion/presentation.ts';
import { t } from './i18n/index.ts';

export { MODES };

/** The slice of the view `detailAvailable` reads. */
export interface DetailState {
  explorer: Explorer;
  selectedRegion?: Pick<Region, 'id'> | null;
  selectedFunction?: SessionState['selectedFunction'];
  selectedDeficit?: SessionState['selectedDeficit'];
  lesson?: { circuit: string | null };
  anatomy?: string | null;
  referenceAnatomy?: string | null;
}

export type WorkspaceView = 'list' | 'detail';

/** Whether the current mode has anything for the detail view to show. */
export function detailAvailable(state: DetailState): boolean {
  if (isIndependentTractReference(state)) return false;
  if (state.selectedRegion) return true;
  if (state.explorer === 'functions') return Boolean(state.selectedFunction);
  if (state.explorer === 'deficits') return Boolean(state.selectedDeficit);
  if (state.explorer === 'circuits') return Boolean(state.lesson?.circuit);
  return false;
}

/**
 * The panel view after a render. A new region selection drills in from any
 * mode; losing the last context returns to the list; tract reference data
 * has no detail view at all.
 */
export function viewAfterUpdate({
  view,
  reference,
  wasAvailable,
  available,
  previousSelection,
  selection,
}: {
  view: WorkspaceView;
  reference: boolean;
  wasAvailable: boolean;
  available: boolean;
  previousSelection: string | null;
  selection: string | null;
}): WorkspaceView {
  if (reference) return 'list';
  if (selection && selection !== previousSelection) return 'detail';
  if (wasAvailable && !available) return 'list';
  return view;
}

/** What the selection strip names (app.js:1574-1597); `side` is the glyph, `sideWord` what is said. */
export interface ContextSelection {
  kind?: 'region' | 'landmark' | 'function' | 'deficit' | 'lesson';
  label?: string;
  side?: string;
  sideWord?: string;
  clearable?: boolean;
}

/** The modes whose list already shows a selection of each kind. */
const LISTED_IN: Record<NonNullable<ContextSelection['kind']>, readonly Explorer[]> = {
  region: ['anatomy'],
  landmark: ['anatomy', 'circuits'],
  function: ['functions'],
  deficit: ['deficits'],
  lesson: ['circuits'],
};

/** The selection strip leads to a selection only where the panel in front is not already showing it. */
export function stripVisible({
  view,
  mode,
  selection,
}: {
  view: WorkspaceView;
  mode: Explorer;
  selection: ContextSelection;
}): boolean {
  if (view !== 'list' || !selection.label) return false;
  const listed = selection.kind && LISTED_IN[selection.kind];
  if (!listed) throw new Error(`Unknown selection kind: ${selection.kind}`);
  return !listed.includes(mode);
}

export interface Crumb {
  kind: 'list' | 'group';
  label: string;
  key?: string;
}

/**
 * The location bar's path: the mode the detail returns to, then the place in it: the tree
 * group that holds a region read from Anatomy, or the `place` another mode names (a lesson's
 * circuit, a function's group, a deficit's group).
 */
export function locationCrumbs({
  mode,
  place,
  group,
  labels,
}: {
  mode: Explorer;
  place: string | null;
  group: { key: string; label: string } | null;
  labels: Record<Explorer, string>;
}): Crumb[] {
  const crumbs: Crumb[] = [{ kind: 'list', label: labels[mode] }];
  const inner = mode === 'anatomy' ? group : place && { label: place };
  if (inner) crumbs.push({ kind: 'group', ...inner });
  return crumbs;
}

/** What a notice's one action is called (notice.js:36-39): a reload, or seeing through the cortex. */
export function noticeActionLabel(lang: Language, action: NonNullable<Notice['action']>): string {
  switch (action) {
    case 'reload':
      return t(lang, 'errors').reload;
    case 'see-through':
      return t(lang, 'display').seeThrough;
    default:
      throw new Error(`Unknown notice action: ${action}`);
  }
}

// ---- the list's current item ---------------------------------------------------------------

type Find = () => HTMLElement | null;

const finders = new Set<Find>();

/**
 * A list registers how to find its current item: the selected tree row, the open function,
 * deficit or circuit row. The workspace asks without knowing any list's markup
 * (it replaces legacy's selector string, workspace.js:9-12). Returns the unregister function.
 */
export function registerCurrentItem(find: Find): () => void {
  finders.add(find);
  return () => finders.delete(find);
}

/** Whether focus or scrolling could meaningfully land on `element` now. */
export const onScreen = (element: HTMLElement | null): element is HTMLElement =>
  element !== null && element.isConnected && element.checkVisibility();

/** The first current item that is on screen, or null. */
export function currentItem(): HTMLElement | null {
  for (const find of finders) {
    const element = find();
    if (onScreen(element)) return element;
  }
  return null;
}

/** Scrolls the current item into view, as a list returning from the detail view does (workspace.js:214). */
export function revealSelected(): void {
  currentItem()?.scrollIntoView({ block: 'nearest' });
}
