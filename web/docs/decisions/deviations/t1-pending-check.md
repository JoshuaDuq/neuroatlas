# The key stays checked while its bundle downloads

Chunk: T1
Status: fix (decision 42, B7); listed in the T1 PR

## Legacy behaviour

The first check of a bundle that is not loaded started a download with the controls disabled, and the next render set the box back to the engine's state (unchecked). The key flickered off and on, and for a screen reader user the state they had just set was reported as off. Reproduced on the legacy build: Playwright's `check()` reports that clicking did not change the state.

## New behaviour

The key keeps the state the reader asked for while the bundle downloads, and its row group carries `aria-busy="true"`. A failed download unchecks the key and shows the alert.

## Standard cited

WCAG 2.2 SC 4.1.2 Name, Role, Value (the state reflects the user's action); pending-state practice of IBM Carbon and Material 3 selection controls.
