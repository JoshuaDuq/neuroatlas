# The commands exist only while a region is selected

Chunk: R1
Status: note (platform practice); no behaviour change

## Legacy behaviour

Without a region the actions row was `hidden` and Focus, Isolate and Hide were also set `disabled` (inspector.js:300-303), so the same fact was held twice.

## New behaviour

The actions are not rendered without a region. When Clear × removes the selection while a command holds focus, S2's `clearSelection` and `hideSelection` hand focus on (`s2-hide-focus-fallback.md`).

## Standard

Svelte 5 idiom: state is rendered or not, rather than hidden and also disabled. WCAG 2.2 SC 2.4.3 Focus Order for the focus hand-off.
