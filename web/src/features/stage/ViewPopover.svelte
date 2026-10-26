<!--
  The View popover's body (index.html:441-448, viewport-chrome.js:491-541): the seven presets, the turn
  buttons and Reset view.
  - The presets are U3's toolbar of `aria-pressed` toggles (decision 6, deviation u3-segmented-controls). One
    reads as pressed only while the camera sits where it put it: the engine's `viewHeld`, not the session's
    named view, which the link keeps either way. Pressing one closes the popover and returns focus to the tool.
  - Turn left, right, up and down are the single-pointer alternative to dragging the model (WCAG 2.5.7,
    deviation g2-orbit-step-buttons, decision 22 on #4): one press is one arrow key of the canvas.
    They do not toggle, and the popover and the focus stay, so a reader can press again.
-->
<script lang="ts">
  import { ORBIT_KEYS } from '../../lib/engine/render/keyboard-orbit.ts';
  import { t } from '../../lib/core/i18n/index.ts';
  import type { OrbitTurn } from '../../lib/engine/api.ts';
  import { VIEW_NAMES } from '../../lib/types/index.ts';
  import type { Language, ViewName } from '../../lib/types/index.ts';
  import IconButton, { iconGraphic } from '../../lib/ui/IconButton.svelte';
  import ToggleToolbar from '../../lib/ui/ToggleToolbar.svelte';

  interface Props {
    lang: Language;
    /** The named view the session keeps. */
    viewName: string;
    /** The camera still sits where that view put it. */
    held: boolean;
    captionId: string;
    close: () => void;
    onView: (view: ViewName) => void;
    onReset: () => void;
    onTurn: (turn: OrbitTurn) => void;
  }

  let { lang, viewName, held, captionId, close, onView, onReset, onTurn }: Props = $props();

  const uid = $props.id();
  const turnCaptionId = `turn-caption-${uid}`;

  // TODO(C1): `viewport.orbitGroup` and `orbitLeft`/`orbitRight`/`orbitUp`/`orbitDown` (requested on #4).
  const TURN = {
    en: {
      group: 'Turn the model',
      left: 'Turn left',
      right: 'Turn right',
      up: 'Turn up',
      down: 'Turn down',
    },
    fr: {
      group: 'Faire pivoter le modèle',
      left: 'Tourner à gauche',
      right: 'Tourner à droite',
      up: 'Tourner vers le haut',
      down: 'Tourner vers le bas',
    },
  } as const;

  const copy = $derived(t(lang, 'viewport'));
  const names = $derived(t(lang, 'views'));
  const turnCopy = $derived(lang === 'fr' ? TURN.fr : TURN.en);
  const presets = $derived(VIEW_NAMES.map((value) => ({ value, label: names[value] })));

  const TURNS = [
    { key: 'left', icon: 'arrow-left', turn: ORBIT_KEYS.ArrowLeft },
    { key: 'right', icon: 'arrow-right', turn: ORBIT_KEYS.ArrowRight },
    { key: 'up', icon: 'arrow-up', turn: ORBIT_KEYS.ArrowUp },
    { key: 'down', icon: 'arrow-down', turn: ORBIT_KEYS.ArrowDown },
  ] as const;
</script>

<p id={captionId} class="stage-field-label">{copy.viewAria}</p>
<ToggleToolbar
  labelledby={captionId}
  class="views"
  items={presets}
  pressed={held ? (viewName as ViewName) : null}
  onpress={(view) => {
    onView(view);
    close();
  }}
/>
<p id={turnCaptionId} class="stage-field-label turn-caption">{turnCopy.group}</p>
<div role="group" aria-labelledby={turnCaptionId} class="turn">
  {#each TURNS as { key, icon, turn } (key)}
    <IconButton
      {icon}
      label={turnCopy[key]}
      data-tooltip={turnCopy[key]}
      onclick={() => onTurn(turn)}
    />
  {/each}
</div>
<button
  type="button"
  class="stage-command stage-command-quiet reset"
  onclick={() => {
    onReset();
    close();
  }}
>
  {@render iconGraphic('reset')}
  <span>{t(lang, 'display').resetView}</span>
</button>

<style>
  @layer features {
    /* The oblique view, then one opposing pair per row, like the cutting planes. */
    :global(.toggle-toolbar.views) {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    :global(.toggle-toolbar.views button) {
      height: auto;
      min-height: var(--control-height);
      min-width: 0;
      font-size: var(--text-stage);
      /* At 200 % text a name wraps inside its cell instead of crossing into the next. */
      white-space: normal;
      overflow-wrap: anywhere;
    }
    :global(.toggle-toolbar.views button:first-child) {
      grid-column: 1 / -1;
    }
    .turn-caption {
      margin-top: var(--space-3);
    }
    .turn {
      display: flex;
      gap: var(--space-1);
    }
    .turn :global(.icon-button) {
      flex: 1;
      width: auto;
      min-height: var(--control-height);
      height: auto;
      background: var(--surface-tonal);
      color: var(--text-primary);
    }
    /* At the popover's foot, its icon on the popover's text column (past its padding and border). */
    .reset {
      margin: var(--space-2) 0 0 calc(-1 * var(--space-2) - 1px);
      padding: 0 var(--space-2);
    }
    @media (pointer: coarse) {
      :global(.toggle-toolbar.views button),
      .turn :global(.icon-button) {
        min-height: 44px;
      }
    }
  }
</style>
