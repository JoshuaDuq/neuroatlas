# 0007 Shell contract: one tablist, one instance per panel

Status: approved on #4 (single tablist); mechanism decided here. Chunks H5, H6, I1.

Legacy: `createWorkspace` builds two tablists (`#workspace-tabs`, `#sheet-tabs`), mirrors state into both, and `sheet.js` `onShell('rails'|'sheet')` flips `owned` (`workspace.js:275-280`, `app.js:1519`). The panels (`#navigator`, `#inspector`) never move: they stay in `#workspace-panel` inside `#sheet` in both shells.

Decision: **nothing moves in the DOM.**

- DOM order is fixed: sheet grip (phone only), then the single tablist, then the panels. This is also the legacy reading order in both shells.
- The tablist and the grip are placed by CSS (grid areas switched by the phone media query), not by relocating nodes. The single Svelte instance therefore survives a shell change with its focus, roving tab stop and state.
- The shell store exposes `shell: 'rails' | 'sheet'` for behaviour only (selection strip ownership, `inert` at peek, focus rescue), never to render the tablist or a panel twice.
- If a later need forces a physical move, use `Element.moveBefore()` (state-preserving) and restore focus when unavailable; a second instance is never created.
- Each panel is one always-mounted instance; the inactive one is `hidden`.
