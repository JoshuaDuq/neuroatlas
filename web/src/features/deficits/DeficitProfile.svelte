<!--
  The open deficit's profile (clinical.js:267-330), for the workspace's detail slot. The heading and
  the meta line stay mounted while no deficit is open, so the status region exists before its text
  changes and the change is announced (deviation x2-status-live-region). What follows them is
  mounted once per deficit (ProfileBody).
-->
<script lang="ts">
  import { t } from '../../lib/core/i18n/index.ts';
  import { sharedSide, stageMessage } from '../../lib/core/panels/clinical.ts';
  import type { View } from '../../lib/state/view.svelte.ts';
  import StatusLine from '../../lib/ui/StatusLine.svelte';
  import type { DeficitsExplorer } from './explorer.svelte.ts';
  import ProfileBody from './ProfileBody.svelte';
  import { stageCounts } from './profile-meta.ts';

  let { explorer, view }: { explorer: DeficitsExplorer; view: View } = $props();

  const clinical = $derived(explorer.deps.clinical);
  const anatomy = $derived(explorer.deps.anatomy);
  const lang = $derived(view.lang);
  const text = $derived(t(lang, 'clinical'));
  const deficit = $derived(
    view.explorer === 'deficits' && view.selectedDeficit
      ? clinical.get(view.selectedDeficit)
      : null,
  );
  const found = $derived(deficit ? clinical.forDeficit(deficit.id) : []);
  const colours = $derived(
    new Map(
      deficit ? clinical.paint(deficit.id).findings.map((f) => [f.association.id, f.color]) : [],
    ),
  );
  const side = $derived(sharedSide(found.map((association) => association.laterality)));

  /** Counted from what is drawn now, so the meta line stays true as the reader hides, cuts or isolates. */
  const meta = $derived.by(() => {
    if (!deficit) return '';
    const mapped = clinical.mappedRegions(deficit.id);
    const ids = view.paint ? mapped.filter((id) => view.paint!.colors.has(id)) : mapped;
    const counts = stageCounts(
      ids,
      (id) =>
        clinical.drawnAs(id, view.detail).map((drawn) => {
          const entry = anatomy.get(drawn);
          if (!entry) throw new Error(`Unknown region: ${drawn}`);
          return entry.region;
        }),
      view,
      Boolean(view.paint),
    );
    const shown = text.regionsMarked(counts.shown, counts.total, counts.coloured);
    return stageMessage(text, {
      opening: explorer.opening,
      busy: explorer.busy,
      error: explorer.actionError,
      failure: explorer.failure,
      operation: explorer.operation,
      lang,
      status: side ? `${text.laterality[side as keyof typeof text.laterality]} · ${shown}` : shown,
    });
  });
</script>

<div class="clinical-profile" hidden={!deficit}>
  <div class="clinical-content">
    <h2
      class="clinical-profile-name"
      tabindex="-1"
      data-deficit={deficit?.id}
      bind:this={explorer.refs.heading}
    >
      {deficit?.name[lang]}
    </h2>
    <StatusLine class={explorer.actionError ? 'meta error' : 'meta'} text={meta} />
    {#if deficit}
      {#key deficit.id}
        <ProfileBody {explorer} {deficit} {lang} {side} {colours} />
      {/key}
    {/if}
  </div>
</div>

<style>
  @layer features {
    .clinical-content {
      padding: var(--panel-inset);
      font-size: var(--text-ui);
      line-height: var(--lh-prose);
      overflow-wrap: normal;
    }
    /* Headline, a close meta line, then the definition and its attached caveat (clinical.css:176-196). */
    .clinical-profile-name {
      margin: 0;
      font-size: var(--text-headline);
      font-weight: 600;
      letter-spacing: -0.02em;
      line-height: var(--lh-title);
      overflow-wrap: anywhere;
      text-wrap: pretty;
    }
    .clinical-content :global(.meta) {
      margin: var(--space-2) 0 0;
      color: var(--text-tertiary);
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
      font-variant-numeric: tabular-nums;
    }
    .clinical-content :global(.meta.error) {
      color: var(--danger);
    }
  }
</style>
