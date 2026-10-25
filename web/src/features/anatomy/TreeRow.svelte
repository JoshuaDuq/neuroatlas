<!--
  The first cell of a region row (navigator.js:265-388): the name, and the row's own reason when it
  has one. A setting's reason (hemisphere, cortex hidden...) is said on the section instead. The
  row's accessible name says everything printed here; the keyboard activates it through the grid
  (Enter, Space), so the click is a pointer affordance.
-->
<script lang="ts">
  interface Props {
    name: string;
    /** The reason printed on the row, when it is the row's own. */
    reason: string | null;
    hidden: boolean;
    /** Nothing can undo what hides it: the row explains itself and does nothing. */
    unavailable: boolean;
    activate: () => void;
  }

  let { name, reason, hidden, unavailable, activate }: Props = $props();
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div
  class="row-main"
  data-hidden={hidden || undefined}
  data-unavailable={unavailable || undefined}
  onclick={activate}
>
  <span class="row-name">{name}</span>
  {#if reason}<span class="row-reason">{reason}</span>{/if}
</div>
