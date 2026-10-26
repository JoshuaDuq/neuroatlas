<script lang="ts">
  import type { Language } from '../../lib/types/index.ts';
  import { t } from '../../lib/core/i18n/index.ts';
  import { OWN_KEYS_ATTRIBUTE } from '../../lib/ui/keys.ts';

  let { lang }: { lang: Language } = $props();
</script>

<!--
  The one complementary landmark: the panels inside it are sections or tabpanels, never nested
  asides (decision 13 on #4). I1 fills it.
-->
<aside
  id="workspace-panel"
  {...{ [OWN_KEYS_ATTRIBUTE]: '' }}
  aria-label={t(lang, 'workspace').panelAria}
></aside>
