<!--
  The tracts a sphere reaches, the body of its report's Tracts section: counted on asking, each bundle
  drawn alone on choosing it. A lesion and a published coordinate word it each their own way; the
  report around it styles its notes (report.css).
-->
<script lang="ts">
  import { count, grouped } from '../../lib/core/format.ts';
  import type { TRANSLATIONS } from '../../lib/core/i18n/index.ts';
  import { sharePercent, tractRows } from '../../lib/core/lesion/report.ts';
  import type { LesionStore } from '../../lib/state/lesion.svelte.ts';
  import type { Language } from '../../lib/types/index.ts';
  import StatusLine from '../../lib/ui/StatusLine.svelte';
  import Swatch from '../../lib/ui/Swatch.svelte';

  type Copy = (typeof TRANSLATIONS)['en']['lesion'];

  let {
    lesion,
    lang,
    bundleName,
    copy,
  }: {
    lesion: LesionStore;
    lang: Language;
    bundleName: (id: string) => string;
    copy: Pick<
      Copy,
      | 'noTracts'
      | 'countTracts'
      | 'tractsDownload'
      | 'counting'
      | 'tractsFailed'
      | 'tractsNote'
      | 'tractsChoose'
      | 'tractLoading'
      | 'tractShown'
      | 'tractShowFailed'
      | 'showTract'
      | 'ofTotal'
      | 'notReached'
      | 'tractsCaveat'
    >;
  } = $props();

  const counted = $derived(lesion.counted);
  const tracts = $derived(counted.status === 'ready' ? tractRows(counted.crossings) : null);
  const tractView = $derived(lesion.tractView);
  const tractStatus = $derived(
    lesion.selectedTract === null
      ? ''
      : tractView.status === 'loading'
        ? copy.tractLoading
        : tractView.status === 'ready'
          ? copy.tractShown(bundleName(lesion.selectedTract))
          : '',
  );
  const bundles = $derived(lesion.bundles);
</script>

{#if !bundles.length}
  <p class="detail-note">{copy.noTracts}</p>
{:else if counted.status === 'idle'}
  <div class="actions">
    <button type="button" onclick={lesion.countTracts}>
      {copy.countTracts(count(bundles.length, 'bundle', lang))}
    </button>
  </div>
  <p class="detail-note">{copy.tractsDownload}</p>
{:else if counted.status === 'counting'}
  <p class="detail-note" role="status">
    {copy.counting(grouped(Math.min(counted.counted + 1, counted.total)), grouped(counted.total))}
  </p>
{:else if counted.status === 'error'}
  <p class="detail-note lesion-error" role="alert">{copy.tractsFailed}</p>
{:else if tracts}
  <p class="detail-note">
    {copy.tractsNote}. {tracts.crossed.length ? copy.tractsChoose : ''}
  </p>
  {#key lang}
    <StatusLine
      class="detail-note lesion-tract-status{tractView.status === 'ready'
        ? ' visually-hidden'
        : ''}"
      text={tractStatus}
    />
  {/key}
  {#if tractView.status === 'error'}
    <p class="detail-note lesion-error" role="alert">{copy.tractShowFailed}</p>
  {/if}
  <ul class="lesion-tracts" aria-busy={tractView.status === 'loading'}>
    {#each tracts.crossed as bundle (bundle.id)}
      <li>
        <button
          type="button"
          class="lesion-tract"
          aria-pressed={lesion.selectedTract === bundle.id}
          aria-label={copy.showTract(bundleName(bundle.id), grouped(bundle.crossing))}
          onclick={() =>
            lesion.selectedTract === bundle.id ? lesion.clearTract() : lesion.showTract(bundle.id)}
        >
          <span class="lesion-tract-name">
            {bundleName(bundle.id)}
            <span class="lesion-row-volume">
              {copy.ofTotal(grouped(bundle.crossing), grouped(bundle.total))}
            </span>
          </span>
          <Swatch kind="bar" share={bundle.share} />
          <span class="measure">{sharePercent(bundle.share, lang)}</span>
        </button>
      </li>
    {/each}
  </ul>
  {#if tracts.missed.length}
    <p class="detail-note">{copy.notReached(tracts.missed.map(bundleName).join(', '))}</p>
  {/if}
  <p class="detail-note">{copy.tractsCaveat}</p>
{/if}

<style>
  @layer features {
    /* A row draws its bundle's crossing streamlines alone, as a comparison row outlines its overlap. */
    .lesion-tracts {
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .lesion-tract {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(32px, 56px) 3rem;
      align-items: start;
      gap: var(--space-2);
      box-sizing: border-box;
      width: calc(100% + 2 * var(--panel-inset));
      min-height: var(--row-height);
      margin-inline: calc(-1 * var(--panel-inset));
      padding: calc((var(--row-height) - var(--lh-ui)) / 2) var(--panel-inset);
      border: 0;
      border-radius: 0;
      background: transparent;
      color: var(--text-primary);
      font: inherit;
      font-size: var(--text-ui);
      line-height: var(--lh-ui);
      text-align: left;
      cursor: pointer;
    }
    .lesion-tract-name {
      min-width: 0;
      overflow-wrap: anywhere;
    }
    .lesion-tract .measure {
      text-align: right;
      color: var(--text-secondary);
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    .lesion-tract[aria-pressed='true'] {
      background: var(--accent-wash);
      color: var(--accent);
    }
    .lesion-tract[aria-pressed='true'] .lesion-tract-name {
      font-weight: 600;
    }
    .lesion-tract[aria-pressed='true'] .measure,
    .lesion-tract[aria-pressed='true'] .lesion-row-volume {
      color: var(--accent);
    }
    @media (hover: hover) and (pointer: fine) {
      .lesion-tract:hover {
        background: var(--surface-hover);
      }
      .lesion-tract[aria-pressed='true']:hover {
        background: var(--accent-wash);
      }
    }
    .lesion-tract:focus-visible {
      outline-offset: -2px;
    }
    @media (pointer: coarse) {
      .lesion-tract {
        min-height: 44px;
      }
    }
    :global(.lesion-tract-status:empty) {
      display: none;
    }
  }
</style>
