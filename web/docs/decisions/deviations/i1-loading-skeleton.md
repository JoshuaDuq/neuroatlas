# The panel's loading skeleton is hidden from assistive technology

Chunk: I1

## Legacy behaviour

While the anatomy loads, the panel shows a skeleton drawn on the empty `#tree` (layout.css, `#app[data-status='loading'] #tree:empty`). That element is `role="tree"` with an accessible name and no `treeitem`, so assistive technology meets an empty tree, and axe reports `aria-required-children`.

## New behaviour

Before the engine has loaded, the panel's landmark holds one `<div id="tree" aria-hidden="true">`, which the same rule draws as the skeleton. It has no role and is not exposed; the real tree mounts with the world.

## Standard cited

WAI-ARIA 1.2, `tree` role: required owned elements (`treeitem` or `group`); WCAG 2.2 SC 4.1.2 Name, Role, Value. Requested on #4 by H1b (issuecomment-6402110217, item 3).
