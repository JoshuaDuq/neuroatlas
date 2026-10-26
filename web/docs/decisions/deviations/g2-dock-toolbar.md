# The stage dock is a toolbar

Chunk: G2
Status: fix (standard cited)

## Legacy behaviour

The dock's three worded tools (View, Section, Display) sit in a plain `div` with no role and no name. Each tool is its own Tab stop, and the arrow keys do nothing between them.

## New behaviour

While three or more tools are shown the row is a `role="toolbar"` named "3D viewer tools" (French "Outils du visualiseur 3D"). It has one Tab stop (the focused tool, else the first); ← → ↑ ↓ and Home/End move between the visible tools, wrapping; Enter and Space open a tool's popover. Over the independent tract reference only View is shown, so the row drops the role and the name and the lone button is an ordinary Tab stop. The popovers' controls are inside the toolbar's element (U5's popover keeps trigger and content together) but are not tools: only the `.stage-tool` buttons rove, and keys pressed inside a popover are its own.

## Standard cited

WAI-ARIA APG Toolbar pattern (a toolbar groups three or more controls, has one Tab stop and arrow-key movement; a lone control is not a toolbar); WCAG 2.2 SC 1.3.1 Info and Relationships and SC 2.1.1 Keyboard.
