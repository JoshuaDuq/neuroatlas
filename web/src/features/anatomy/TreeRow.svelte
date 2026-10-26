<!--
  The first cell of a region row (navigator.js:265-388): the name, and the row's own reason when it
  has one. A setting's reason (hemisphere, cortex hidden...) is said on the section instead. The
  row's accessible name says everything printed here; a click anywhere on the row is the tree's own.
-->
<script lang="ts">
  interface Props {
    name: string;
    /** The reason printed on the row, when it is the row's own. */
    reason: string | null;
    /** On a hidden row: its name, which says why and what a press does (U5 tooltip). */
    tooltip: string | undefined;
    hidden: boolean;
    /** Nothing can undo what hides it: the row explains itself and does nothing. */
    unavailable: boolean;
  }

  let { name, reason, tooltip, hidden, unavailable }: Props = $props();
</script>

<div
  class="row-main"
  data-tooltip={tooltip}
  data-hidden={hidden || undefined}
  data-unavailable={unavailable || undefined}
>
  <span class="row-name">{name}</span>
  {#if reason}<span class="row-reason">{reason}</span>{/if}
</div>
