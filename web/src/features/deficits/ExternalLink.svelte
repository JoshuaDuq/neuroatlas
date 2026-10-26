<!--
  A link that leaves the app (clinical.js:104-125). It opens a new tab, which the link says in
  words a screen reader reads and with an icon (WCAG technique G201, decision 17 on #4).
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { Language } from '../../lib/types/index.ts';
  import { NEW_TAB } from './copy.ts';

  let {
    href,
    lang,
    children,
    contentLang,
  }: {
    href: string;
    lang: Language;
    children: Snippet;
    /** Set when the link's words are not in the interface language. */
    contentLang?: Language;
  } = $props();
</script>

<a {href} target="_blank" rel="noreferrer"
  ><span lang={contentLang}>{@render children()}</span><span class="visually-hidden"
    >{` ${NEW_TAB[lang]}`}</span
  ><svg
    class="new-tab"
    viewBox="0 0 24 24"
    width="11"
    height="11"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"><path d="M7 17 17 7M8 7h9v9" /></svg
  ></a
>

<style>
  @layer features {
    a {
      display: inline-block;
      max-width: 100%;
      overflow-wrap: anywhere;
    }
    .new-tab {
      margin-left: 3px;
      vertical-align: -1px;
    }
    /* Touch (WCAG 2.5.8, phone.css:316-320): a link on its own line is a 44px target. */
    @media (pointer: coarse) {
      a {
        display: inline-flex;
        align-items: center;
        min-height: 44px;
      }
      .new-tab {
        flex: none;
      }
    }
  }
</style>
