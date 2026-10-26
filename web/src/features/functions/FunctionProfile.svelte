<!--
  The profile of one function (viewer/ui/panels/functions.js:173-318, 320-335): its name, the meta
  line, the kind of evidence, the caveat, then the overview, or the areas and lesion checks, the
  method and the citation. Not a landmark (decision 13 on #4); the heading is the focus target
  when a function opens, and the meta line is the one live text.
  - one meta line stays in the page across profiles, so its text is announced when it changes
    (deviations/x1-meta-status.md);
  - an area's name comes from its content (deviations/x1-area-name.md) and the button stays
    focusable while a run is in flight (deviations/x1-focusable-while-opening.md).
-->
<script lang="ts">
  import { networkCss } from '../../lib/core/catalog/networks.ts';
  import { t } from '../../lib/core/i18n/index.ts';
  import Disclosure from '../../lib/ui/Disclosure.svelte';
  import SearchBridge from '../../lib/ui/SearchBridge.svelte';
  import type { FunctionExplorer } from './functions-explorer.svelte.ts';
  import { AREAS_SHOWN, functionProfile, type AreaRow } from './functions-view.ts';

  let { model }: { model: FunctionExplorer } = $props();

  const id = $derived(model.selected);
  const lang = $derived(model.lang);
  const copy = $derived(t(lang, 'functions'));
  const content = $derived(id ? functionProfile(model, id, lang) : null);

  let root = $state<HTMLElement | null>(null);
  $effect(() => {
    if (root) return model.attachProfile(root);
  });
</script>

<div class="profile" bind:this={root}>
  {#if content && id}
    <h2
      class="profile-name"
      data-function-title
      tabindex="-1"
      lang={content.searched ? 'en' : undefined}
    >
      {content.name}
    </h2>
  {/if}
  <!-- A new language is a new element: text inserted with its element is not announced. -->
  {#key model.lang}
    <p class="meta" role="status" data-error={String(model.failed)}>{model.meta}</p>
  {/key}
  {#if content && id}
    <div class="content">
      {#if content.all}
        <p class="summary">{t(lang, 'domains').keyAll}</p>
      {:else if content.term}
        <p class="kind">
          {content.term.before}<span lang="en">{content.term.term}</span>{content.term.after}
        </p>
      {/if}
      <p class="note caveat">{content.caveat}</p>

      {#if content.all}
        <div class="section">
          <h3 class="section-heading">{copy.overviewHeading}</h3>
          <ul class="links">
            {#each content.overview as link (link.id)}
              <li>
                <button
                  type="button"
                  class="link function-link"
                  data-function={link.id}
                  onclick={() => model.openFunction(link.id)}
                >
                  <span
                    class="function-swatch"
                    aria-hidden="true"
                    style:background={networkCss(link.colour)}
                  ></span>
                  <span class="link-text">
                    <span class="link-name">{link.name}</span>
                    <span class="visually-hidden">, </span>
                    <span class="link-detail">{link.detail}</span>
                  </span>
                  <span class="chevron" aria-hidden="true"></span>
                </button>
              </li>
            {/each}
          </ul>
        </div>
      {:else}
        {#if content.lesionBridge}
          <div class="section bridge">
            <h3 class="section-heading">{copy.lesionBridgeHeading}</h3>
            <SearchBridge
              text={content.lesionBridge.text}
              onclick={() => model.searchDeficits(content.lesionBridge!.query)}
            />
          </div>
        {/if}
        <div class="section">
          <h3 class="section-heading areas-heading">
            <span>{copy.areasHeading}</span>
            {#if content.areas.length}<span class="column-head" aria-hidden="true">z</span>{/if}
          </h3>
          {#if !content.areas.length}
            <p class="note">{content.noAreas}</p>
          {:else}
            <ul class="areas">
              {#each content.areas.slice(0, AREAS_SHOWN) as area (area.region)}
                <li>{@render areaButton(area)}</li>
              {/each}
            </ul>
            {#if content.areas.length > AREAS_SHOWN}
              {#key id}
                <div class="more">
                  <Disclosure summary={copy.more(content.areas.length - AREAS_SHOWN)}>
                    <ul class="areas">
                      {#each content.areas.slice(AREAS_SHOWN) as area (area.region)}
                        <li>{@render areaButton(area)}</li>
                      {/each}
                    </ul>
                  </Disclosure>
                </div>
              {/key}
            {/if}
          {/if}
        </div>
        {#if content.lesions}
          <div class="section">
            <h3 class="section-heading">{copy.lesionHeading}</h3>
            {#if !content.lesions.length}
              <p class="note">{t(lang, 'domains').noLesionCheck}</p>
            {:else}
              <ul class="links">
                {#each content.lesions as check (check.association)}
                  <li>
                    <button
                      type="button"
                      class="link"
                      data-deficit={check.deficit}
                      onclick={() => model.openDeficit(check.deficit)}
                    >
                      <span class="link-text">
                        <span class="link-name">{check.name}</span>
                        <span class="visually-hidden">, </span>
                        <span class="link-detail">{check.detail}</span>
                      </span>
                      <span class="chevron" aria-hidden="true"></span>
                    </button>
                  </li>
                {/each}
              </ul>
              <p class="note lesion-note">{copy.lesionNote}</p>
            {/if}
          </div>
        {/if}
      {/if}

      <p class="note method">{content.method}</p>
      <p class="note sources">{content.citation}</p>
    </div>
  {/if}
</div>

{#snippet areaButton(area: AreaRow)}
  <button
    type="button"
    class="function-area"
    data-function-region={area.region}
    aria-disabled={model.opening ? 'true' : undefined}
    onclick={() => model.openArea(area.region)}
  >
    <span class="area-name">
      <span>{area.name}</span>
      {#if area.division}
        <span class="visually-hidden">, </span>
        <span class="area-division">{area.division}</span>
      {/if}
    </span>
    <span class="visually-hidden">, z </span>
    <span class="area-z">{area.z}</span>
  </button>
{/snippet}

<style>
  @layer features {
    .profile {
      padding-inline: var(--panel-inset);
      font-size: var(--text-ui);
      line-height: var(--lh-prose);
    }
    .content,
    .profile-name {
      overflow-wrap: normal;
    }
    .profile-name {
      padding-top: var(--panel-inset);
      font-size: var(--text-headline);
      font-weight: 600;
      letter-spacing: -0.02em;
      line-height: var(--lh-title);
      overflow-wrap: anywhere;
      text-wrap: pretty;
    }
    .meta {
      color: var(--text-tertiary);
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
      font-variant-numeric: tabular-nums;
    }
    .meta:not(:empty) {
      margin-top: var(--space-2);
    }
    .meta[data-error='true'] {
      color: var(--danger);
    }
    .content {
      padding-bottom: var(--panel-inset);
    }
    .summary {
      margin-top: var(--space-4);
    }
    /* Which kind of evidence a profile rests on, said under its headline. */
    .kind {
      margin-top: var(--space-4);
      color: var(--text-secondary);
      font-size: var(--text-caption);
      font-weight: 600;
      line-height: var(--lh-caption);
      font-variant-numeric: tabular-nums;
    }
    .kind + .caveat {
      margin-top: var(--space-2);
    }
    .summary + .caveat {
      margin-top: var(--space-2);
    }
    .note {
      color: var(--text-secondary);
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
    }
    .content > .method {
      margin-top: var(--space-6);
    }
    .content > .method + .sources {
      margin-top: var(--space-2);
    }
    .content > .sources {
      color: var(--text-tertiary);
    }

    .section {
      margin-top: var(--space-6);
    }
    .section-heading {
      margin-bottom: var(--space-2);
      color: var(--text-primary);
      font-size: var(--text-ui);
      font-weight: 600;
      line-height: var(--lh-ui);
    }
    .areas-heading {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--space-3);
    }
    .column-head {
      flex: none;
      color: var(--text-tertiary);
      font-size: var(--text-caption);
      font-weight: 400;
      line-height: var(--lh-caption);
      white-space: nowrap;
    }
    .lesion-note {
      margin-top: var(--space-2);
    }

    /* Areas, strongest first: a primary-ink row whose name underlines on hover; z in the column its heading heads. */
    .areas,
    .links {
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .areas {
      border-top: 1px solid var(--border-subtle);
    }
    .areas > li {
      border-bottom: 1px solid var(--border-subtle);
    }
    .more {
      margin-top: var(--space-2);
    }
    .more :global(.areas) {
      margin-top: var(--space-2);
    }
    .function-area,
    .link {
      display: flex;
      width: 100%;
      min-height: var(--row-height);
      height: auto;
      margin: 0;
      padding: var(--space-1) 0;
      border: 0;
      border-radius: 0;
      background: none;
      color: var(--text-primary);
      font-size: var(--text-ui);
      font-weight: 400;
      line-height: var(--lh-ui);
      text-align: left;
    }
    .function-area {
      align-items: baseline;
      gap: var(--space-3);
    }
    .link {
      align-items: center;
      gap: var(--space-2);
    }
    .function-area:focus-visible,
    .link:focus-visible {
      outline-offset: 0;
    }
    .area-name {
      display: flex;
      flex: 1;
      flex-direction: column;
      min-width: 0;
      overflow-wrap: anywhere;
    }
    /* The functional division an HCP-MMP code belongs to, so the code is not the only name a reader gets. */
    .area-division {
      color: var(--text-tertiary);
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
    }
    .area-z {
      flex: none;
      font-size: var(--text-caption);
      font-weight: 500;
      font-variant-numeric: tabular-nums;
    }
    .function-area[aria-disabled='true'] {
      color: var(--text-tertiary);
      cursor: default;
    }
    .link-text {
      display: flex;
      flex: 1 1 auto;
      flex-direction: column;
      min-width: 0;
    }
    .link-name {
      font-weight: 500;
      line-height: var(--lh-ui);
      overflow-wrap: anywhere;
    }
    .link-detail {
      color: var(--text-secondary);
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
      font-variant-numeric: tabular-nums;
      overflow-wrap: anywhere;
    }
    /* A colour on the brain sits in a 12px slot, centred on the first line. */
    .function-swatch {
      flex: none;
      align-self: flex-start;
      width: 10px;
      height: 10px;
      margin: calc((var(--lh-ui) - 10px) / 2) 1px 0;
      border-radius: var(--radius-mark);
    }
    .chevron {
      flex: none;
      width: 6px;
      height: 6px;
      margin: 0 3px;
      color: var(--text-tertiary);
      border-right: 1.5px solid currentColor;
      border-bottom: 1.5px solid currentColor;
      transform: translateX(-1.6px) rotate(-45deg);
    }
    .bridge :global(.search-bridge) {
      padding-inline: 0;
    }
    @media (hover: hover) and (pointer: fine) {
      .chevron {
        opacity: 0;
      }
      .link:hover .chevron {
        opacity: 1;
        transition: opacity var(--ui-transition) var(--ease-ui);
      }
      .link:focus-visible .chevron {
        opacity: 1;
      }
      .link:hover .link-name,
      .function-area:not([aria-disabled='true']):hover .area-name > span:first-child {
        color: var(--accent-hover);
        text-decoration: underline;
        text-underline-offset: 3px;
      }
    }
    @media (pointer: coarse) {
      .function-area,
      .link {
        min-height: 44px;
      }
    }
  }
  @layer a11y {
    @media (forced-colors: active) {
      .profile-name:focus-visible {
        outline: 2px solid Highlight;
      }
      .function-swatch {
        forced-color-adjust: none;
      }
    }
  }
</style>
