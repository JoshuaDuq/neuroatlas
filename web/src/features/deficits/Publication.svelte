<!--
  One publication an association rests on (clinical.js:76-113): its role and method, the paper, its
  authors, the population studied, which source was inspected, and each correction published for it.
  Titles, authors and journals are English whatever the interface says (WCAG 3.1.2).
-->
<script lang="ts">
  import type { ClinicalReference } from '../../lib/core/clinical/types.ts';
  import { t } from '../../lib/core/i18n/index.ts';
  import { publishedCorrections } from '../../lib/core/panels/clinical.ts';
  import type { Language } from '../../lib/types/index.ts';
  import ExternalLink from './ExternalLink.svelte';

  let {
    reference,
    role,
    lang,
  }: { reference: ClinicalReference; role: 'supporting' | 'qualifying'; lang: Language } =
    $props();

  const text = $derived(t(lang, 'clinical'));
  const english = $derived(lang === 'fr' ? 'en' : undefined);
</script>

<article class="publication">
  <p class="note">{text[role]} · {text.methods[reference.method]}</p>
  <ExternalLink href="https://doi.org/{reference.doi}" {lang} contentLang={english}>
    {reference.title}
  </ExternalLink>
  <p class="note" lang={english}>{reference.authors} ({reference.year}). {reference.journal}.</p>
  <p>{text.population}: {reference.population[lang]}</p>
  <p class="note">{text[reference.scope]}</p>
  <ExternalLink href="https://pubmed.ncbi.nlm.nih.gov/{reference.pmid}/" {lang}>
    PubMed · {reference.pmid}
  </ExternalLink>
  {#each publishedCorrections(reference, lang) as correction (correction.doi)}
    <p class="note correction">{text.correction}</p>
    <p>{correction.summary}</p>
    <ExternalLink href={correction.href} {lang}>{correction.doi}</ExternalLink>
  {/each}
</article>

<style>
  @layer features {
    /* A reference entry reads a step smaller than the finding it supports (clinical.css:268-278). */
    .publication {
      padding: var(--space-3) 0;
      border-top: 1px solid var(--border-subtle);
      font-size: var(--text-caption);
      line-height: var(--lh-caption);
    }
    .publication > :global(* + *) {
      margin-top: var(--space-1);
    }
    .publication > :global(a:first-of-type) {
      font-weight: 500;
    }
    .publication > .correction {
      margin-top: var(--space-2);
    }
    .publication:last-child {
      padding-bottom: 0;
    }
    p {
      margin: 0;
    }
    .note {
      color: var(--text-secondary);
    }
  }
</style>
