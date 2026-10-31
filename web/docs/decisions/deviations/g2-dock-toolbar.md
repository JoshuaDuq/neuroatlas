# The stage dock is a toolbar

Chunk: G2
Status: fix (standard cited)

## Legacy behaviour

The dock's three worded tools (View, Section, Display) sit in a plain `div` with no role and no name. Each tool is its own Tab stop, and the arrow keys do nothing between them.

## New behaviour

The row of Section, Lesion, Coordinate (offered only while the anatomy publishes coordinate spaces) and Display is a `role="toolbar"` named "3D viewer tools" (French "Outils du visualiseur 3D"). It has one Tab stop (the focused tool, else the first); ← → ↑ ↓ and Home/End move between the visible tools, wrapping; Enter and Space open a tool's popover. Over the independent tract reference none of the tools applies, so the dock is not drawn. View's presets and turns left the dock for the orientation gizmo on 2026-10-31; the gizmo is its own toolbar on the same pattern. The popovers' controls are inside the toolbar's element (U5's popover keeps trigger and content together) but are not tools: only the `.stage-tool` buttons rove, and keys pressed inside a popover are its own. While a popover is open its tool is the Tab stop, so Shift+Tab from the popover's first control returns to that tool with the popover open, as in legacy. Tab from a popover's last control now leaves the dock (the popover closes), where legacy reached the next tool in the dock: the toolbar is one Tab stop.

## Standard cited

WAI-ARIA APG Toolbar pattern (a toolbar groups three or more controls, has one Tab stop and arrow-key movement; a lone control is not a toolbar); WCAG 2.2 SC 1.3.1 Info and Relationships and SC 2.1.1 Keyboard.
