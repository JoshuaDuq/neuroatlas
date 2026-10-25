# E4a deviation: a failed reload after a model change is reported once

Chunk E4a (#27). A fix under the parity policy. Pinned by `sections.test.ts` ("one failing reload
after a model change is reported once").

- **Legacy**: `onModelChange` ran `setMode(...).catch((error) => this.report(error))`, but
  `setMode` already reports before it rethrows, so one failure produced two `console.error` calls
  and two `change` events.
- **New**: `onModelChange` only handles the rejection (`.catch(() => {})`, with a comment that
  `setMode` has reported it), so the failure is logged and emitted once.
- **Standard**: project rule "fail fast, no redundant handling" (CLAUDE.md): an error is reported
  where it is raised, once.
