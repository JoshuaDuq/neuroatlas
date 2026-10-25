import type { createCatalog } from '../core/catalog/catalog.ts';
import type { ViewStore } from './view.svelte.ts';

/** What the view derives from the catalog (app.js:1620-1623): its language, groups and count. */
export function createCatalogStore(catalog: ReturnType<typeof createCatalog>, view: ViewStore) {
  $effect.pre(() => catalog.setLanguage(view.current.lang));
  const lang = $derived(view.current.lang);
  const groups = $derived(catalog.groups(view.current));
  const visibleCount = $derived(catalog.visibleCount(view.current));
  return {
    get lang() {
      return lang;
    },
    get groups() {
      return groups;
    },
    get visibleCount() {
      return visibleCount;
    },
    /** A region's label in the view's language, read reactively. */
    label: (id: string) => catalog.label(id, view.current),
  };
}

export type CatalogStore = ReturnType<typeof createCatalogStore>;
