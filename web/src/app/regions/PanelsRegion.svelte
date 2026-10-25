<script lang="ts">
  import type { Language } from '../../lib/types/index.ts';
  import { t } from '../../lib/core/i18n/index.ts';

  let { lang }: { lang: Language } = $props();
</script>

<!--
  The one complementary landmark: the panels inside it are sections or tabpanels, never nested
  asides (decision 13 on #4). I1 fills it.
-->
<aside id="workspace-panel" aria-label={t(lang, 'inspector').title}></aside>
