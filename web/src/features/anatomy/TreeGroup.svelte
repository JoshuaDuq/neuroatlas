<!--
  The first cell of a group row (navigator.js:526-540): the chevron, the group's name and its count.
  The row's name already says the name and the count ("Frontal lobe, 12 regions"), so the chevron
  and the count are decorative. A click anywhere on the row toggles the group (the tree's own).
-->
<script lang="ts">
  interface Props {
    name: string;
    count: number;
    expanded: boolean;
    /** No region of the group is on screen. */
    dimmed: boolean;
  }

  let { name, count, expanded, dimmed }: Props = $props();
</script>

<div class="row-main group-main" data-hidden={dimmed || undefined}>
  <span class="chevron" data-expanded={expanded} aria-hidden="true"></span>
  <span class="row-name">{name}</span>
  <span class="group-count" aria-hidden="true">{count}</span>
</div>
