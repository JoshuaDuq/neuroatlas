<!--
  The first cell of a group row (navigator.js:526-540): the chevron, the group's name and its count.
  The row's name already says the name and the count ("Frontal lobe, 12 regions"), so the chevron
  and the count are decorative. A click anywhere in the cell toggles the group; the keyboard
  equivalents are the grid's own (Enter, Space, Right, Left), so the click is a pointer affordance.
-->
<script lang="ts">
  interface Props {
    name: string;
    count: number;
    expanded: boolean;
    /** No region of the group is on screen. */
    dimmed: boolean;
    toggle: () => void;
  }

  let { name, count, expanded, dimmed, toggle }: Props = $props();
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="row-main group-main" data-hidden={dimmed || undefined} onclick={toggle}>
  <span class="chevron" data-expanded={expanded} aria-hidden="true"></span>
  <span class="row-name">{name}</span>
  <span class="group-count" aria-hidden="true">{count}</span>
</div>
