<!--
  A reversible visibility action for a region or a group's side (viewer/ui/panels/visibility-control.js).
  The name is the action ("Hide X, left"), so there is no aria-pressed, which would read backwards
  against it. It lives in its own treegrid cell and is patched in place, so focus stays on it.
-->
<script module lang="ts">
  // TODO(C1): move to the dissection area of the i18n dictionary (requested on #4, decision 32).
  const ANNOUNCEMENTS = {
    en: {
      hidden: (name: string, side: string) => `Hidden: ${name}, ${side}.`,
      shown: (name: string, side: string) => `Shown: ${name}, ${side}.`,
    },
    fr: {
      hidden: (name: string, side: string) => `Masqué : ${name}, ${side}.`,
      shown: (name: string, side: string) => `Affiché : ${name}, ${side}.`,
    },
  } as const;
</script>

<script lang="ts">
  import { t } from '../../lib/core/i18n/index.ts';
  import { visibilityStateOf } from '../../lib/core/panels/navigator.ts';
  import type { Language, Region } from '../../lib/types/index.ts';
  import { announce } from '../../lib/ui/announcer.svelte.ts';
  import { iconGraphic } from '../../lib/ui/IconButton.svelte';

  interface Props {
    lang: Language;
    /** What the eye hides or shows: one region, or every revealable region of a group's side. */
    ids: readonly string[];
    /** The region's or the group's name. */
    name: string;
    side: Region['hemisphere'];
    hiddenRegions: ReadonlySet<string>;
    onHide: (ids: readonly string[]) => void;
    onShow: (ids: readonly string[]) => void;
  }

  let { lang, ids, name, side, hiddenRegions, onHide, onShow }: Props = $props();

  const state = $derived(visibilityStateOf(ids, hiddenRegions));
  const copy = $derived(t(lang, 'dissection'));
  const sideWord = $derived(t(lang, 'sides').words[side]);
  const label = $derived((state === 'hidden' ? copy.showPart : copy.hidePart)(name, sideWord));

  function toggle() {
    const hiding = state !== 'hidden';
    if (hiding) onHide(ids);
    else onShow(ids);
    announce(ANNOUNCEMENTS[lang][hiding ? 'hidden' : 'shown'](name, sideWord));
  }
</script>

<button
  type="button"
  class="visibility-control"
  data-side={side}
  data-state={state === 'hidden' ? 'hidden' : 'shown'}
  data-partial={state === 'partial'}
  aria-label={state === 'partial' ? `${label}, ${copy.partial}` : label}
  data-tooltip={state === 'partial' ? `${label} · ${copy.partial}` : label}
  onclick={toggle}
>
  {@render iconGraphic(state === 'hidden' ? 'eye-off' : 'eye')}
  <span class="visibility-side" aria-hidden="true">{t(lang, 'sides').glyphs[side]}</span>
</button>
