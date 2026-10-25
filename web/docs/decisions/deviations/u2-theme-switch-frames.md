# A second theme switch holds transitions for its own two frames

Chunk: U2
Status: fix (no approval needed; parity policy of 2026-10-25 on #4)

## Legacy behaviour

state/theme.js:44 sets `data-theme-switching` and schedules two animation frames to remove it. A second switch inside those frames (an OS flip right after a menu choice) sets the attribute again, but the first switch's frames still fire and remove it one frame early, so colours fade between palettes for the second switch.

## New behaviour

Each switch cancels the pending frames before scheduling its own. The attribute stays until the last switch has had two frames. `dispose()` cancels them too. A single switch behaves exactly as before.

## Standard cited

`requestAnimationFrame` / `cancelAnimationFrame` (HTML Living Standard, animation frames): a superseded callback is cancelled rather than left to run against newer state.
