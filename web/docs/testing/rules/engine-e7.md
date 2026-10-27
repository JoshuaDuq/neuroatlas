# Engine E7 rules: the engine facade, framing and presentation

Scope: chunk E7 (#31). This covers where the camera goes and what it keeps: framing a named view, a region, a landmark, a deficit, the internal anatomy or a cut; the reader's magnification across resizes; refits for the sheet and dock; the pan limit; the held view; and the camera as a link carries it. In legacy these live in `viewer/app.js` (241-524, 750-822, 1116-1138, 1281-1297, 1515-1550, 1783-1851) and `viewer/ui/chrome/viewport-chrome.js` (47-51, 560-614), and in the new app in `web/src/lib/engine/framing.ts` and `held-view.ts`. Also covered: hover and selection marking (`app.js:1721-1751,1798-1812` → `presentation.ts`) and the facade's own contract (`engine/index.ts`, `api.ts`, the contract suite in `engine/fake/contract-suite.ts`). The scene's eased moves and picking are in `engine-e5.md`. The link's text encoding (`viewer/state/url-state.js`) is in `core-state.md` (STATE-) and its restore and write in `links.md` (LINK-); the engine's side of the MRI window link is FACADE-37 here. "Via contract suite" means a case of `src/lib/engine/fake/contract-suite.ts`. It runs on the real engine in `src/lib/engine/index.contract.test.ts` and on the fake in `src/lib/engine/contract.test.ts`; only the first proves the app, so the fake run is not listed again.

Shared expectations. "The anatomy fits" means every drawn vertex projects inside ±`FRAME_FILL` (0.8) of the cleared frame on both axes, with 1e-9 tolerance. The cleared frame is the visible rectangle minus the framing inset, scaled by the framing source's `scale`. Distances are in metres; links are in millimetres.

## Framing

### FACADE-01 · A named view frames the whole drawn anatomy and holds the view

- **Rule:** Choosing a named view frames everything drawn, seen from that view's direction with its up. The anatomy fills the room the interface leaves without leaving it, and the view is marked as held.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:406-446`; `viewer/render/camera-views.js:63`
- **Expected:** After `applyView(v)` for each of the published views, the heading equals `VIEW_DIRECTIONS[v]` (≤1e-9) and `camera.up` equals `upFor(v)`. The anatomy fits, and the view's largest extent reaches at least 0.8×FRAME_FILL (tight, not just inside). `viewHeld === true`.
- **Covered by:** `src/lib/engine/framing.test.ts` (R, fits), `src/lib/engine/index.contract.test.ts` (R, via contract suite: held)

### FACADE-02 · The first framing lands at once

- **Rule:** The opening view is placed without animation. The camera does not swoop out of the brain on every load.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:407-408,433-434`; `viewer/render/scene.js:314-317`
- **Expected:** The first `applyView(v)` with no `immediate` leaves the camera on the plan before any frame.
- **Covered by:** uncovered

### FACADE-03 · An unknown view is refused and the camera stays

- **Rule:** A view name the camera does not publish is an error, and nothing moves.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:443-446`
- **Expected:** `applyView('missing')` throws `Unknown view: missing`, and `destination.position` is unchanged.
- **Covered by:** `src/lib/engine/framing.test.ts` (R)

### FACADE-04 · "The whole anatomy" is what is drawn

- **Rule:** The whole-anatomy frame (named views, pull back, resize) fits what the reader can see:
  - both hemispheres: the opening brain box;
  - one hemisphere: that hemisphere;
  - the cord shown beneath the brain: brain and cord together;
  - the cord system on its own: the cord;
  - an isolated region: that region;
  - the cortex hidden: the drawn non-cord structures;
  - the tract reference shown alone: its streamlines, once loaded.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:266-307,320-345`
- **Expected:** On a synthetic brain (boxes with the user data framing reads), for each of the six display states (both hemispheres, one hemisphere, an isolated region, the cortex hidden, the cord beneath the brain, the cord on its own; proved in `framing.test.ts`), `applyView('left')` makes the drawn meshes fit. In "one hemisphere" no right-hemisphere vertex limits the fit (the frame is tighter than the both-hemispheres frame). With the cord shown, the cord's lowest vertex is inside the frame.
- **Covered by:** `src/lib/engine/framing.test.ts` (R)

### FACADE-05 · Focus on a region frames it from where the reader is looking

- **Rule:** Focusing a selected region frames its drawn meshes along the current heading and lets go of the held view. A region with nothing drawn does nothing and reports so.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:510-524`
- **Expected:** `frameRegion(id)` returns `true`, the region's meshes fit, the heading is unchanged (≤1e-9) and `viewHeld === false`. For an id with no drawn mesh it returns `false` and the camera and held state are unchanged.
- **Covered by:** `src/lib/engine/framing.test.ts` (R), `src/lib/engine/index.contract.test.ts` (R, via contract suite)

### FACADE-06 · A landmark is framed as its lesson authored it

- **Rule:** A lesson landmark is framed from its authored view, with the authored margin of anatomical context around it, and the held view is released. A landmark with nothing drawn does nothing.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:456-472`
- **Expected:** `frameLandmark(id, 'anterior', 20)` returns `true`, the heading equals `VIEW_DIRECTIONS.anterior`, and the region box grown by 0.020 m (then `withContext`) fits. `viewHeld === false`. An undrawn region returns `false`.
- **Covered by:** `src/lib/engine/framing.test.ts` (R), `src/lib/engine/index.contract.test.ts` (R, via contract suite)

### FACADE-07 · A deficit's regions are framed together, from their own side

- **Rule:** A deficit's drawn regions are framed together with context. When they all lie in one hemisphere and the reader is looking from the other side, the camera swings to their side. Nothing drawn means no move and the held view is kept.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:474-494`
- **Expected:** Viewing from `right` (+x), `frameRegions([leftRegionA, leftRegionB])` gives a heading with x < 0. `frameRegions(['no-such-region'])` emits no camera event and leaves `viewHeld` as it was.
- **Covered by:** `src/lib/engine/index.contract.test.ts` (R, via contract suite: nothing drawn); `src/lib/engine/framing.test.ts` (R)

### FACADE-08 · Internal anatomy and "pull back" keep the reader's heading and the held view

- **Rule:** Framing the internal structures, or pulling back to the whole anatomy, keeps the current heading and does not release a held view. The internal frame excludes the cord unless the cord system is chosen.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:1116-1138`
- **Expected:** After `applyView('left')`, both `frameInternal()` and `frameWhole()` keep the heading on `left` (≤1e-9) and `viewHeld === true`. With the cord shown under the brain, the internal frame lies entirely above the brain's lower bound.
- **Covered by:** `src/lib/engine/index.contract.test.ts` (R, via contract suite: held kept); `src/lib/engine/framing.test.ts` (R)

### FACADE-09 · Facing the cut

- **Rule:** "Face the cut" looks straight at the cut plane, from the reversed side when the cut is reversed, with the plane's up. It reports the named view it faces. An oblique cut is faced along its own normal and releases the held view. A cut below the brain (through the cord) is framed in an 8 cm box around its centre.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:1281-1297`
- **Expected:** With no cut it returns `null`. Coronal returns `anterior` and holds; coronal reversed returns `posterior`; oblique returns `'oblique'` and `viewHeld === false`. The heading equals ±normal (≤1e-9). With the centre below `bounds.min.y`, the framed box is centre ± 0.04 m.
- **Covered by:** `src/lib/engine/index.contract.test.ts` (R, via contract suite: returned view and held); `src/lib/engine/framing.test.ts` (R)

### FACADE-10 · Focusing a point keeps distance and heading

- **Rule:** Focusing a point (double-click on the surface, or a RAS point) moves the orbit centre onto it, keeping the camera's distance and heading, and releases the held view. Below the brain (on the cord) the camera may come as close as 15 mm.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:1783-1797`
- **Expected:** `focusPoint([x, y, z] mm)` makes the target equal to `rasToWorld` of the point. The position moves by the same delta, and `viewHeld === false`. For a point with world y < `bounds.min.y`, `minDistance === min(previous, 0.015)`.
- **Covered by:** `src/lib/engine/index.contract.test.ts` (R, via contract suite: release); `src/lib/engine/framing.test.ts` (R)

## Magnification and resize

### FACADE-11 · The reader's magnification survives a resize; a named view resets it

- **Rule:** A canvas resize keeps the reader's magnification (camera distance as a multiple of the whole-anatomy fit) and heading, so the picture re-fits rather than clipping or stranding the anatomy. A named view or Reset sets the magnification back to the whole anatomy.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:257-263,355-363,436-441`
- **Expected:** `applyView('anterior')`, `dolly(0.2)`, `applyView('left')`, then resize 390×792 → 537×695: the anatomy fits before and after. Without an intervening view, distance after resize = fitted(new) × (distance / fitted(old)) within 1e-12.
- **Covered by:** `src/lib/engine/framing.test.ts` (R)

### FACADE-12 · Every framing updates the magnification

- **Rule:** After Focus, a landmark, a deficit, internal anatomy, pull back or a cut face, the next resize keeps the distance that framing chose. It does not jump back to the old whole-brain magnification.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:263`; deviation `e7-zoom-after-framing.md`
- **Expected:** `frameRegion('small')` then a resize to the same size leaves the distance unchanged (≤1e-12); the same holds for `frameLandmark`. Expected likewise for `frameRegions`, `frameInternal`, `frameWhole` and `faceCut`.
- **Covered by:** `src/lib/engine/framing.test.ts` (R)

### FACADE-13 · A framing during an eased move starts from where the move lands

- **Rule:** A framing or capture made while the camera is still easing uses the heading and pose the move is going to, not the half-way camera.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:264,519,1826`; deviation `e7-heading-in-flight.md`
- **Expected:** `applyView('right', immediate)`, `applyView('left')` (eased), then `frameWhole()`: the heading equals `VIEW_DIRECTIONS.left` (≤1e-9). `capture()` taken mid-move and restored gives the `left` heading.
- **Covered by:** `src/lib/engine/framing.test.ts` (R)

### FACADE-14 · A resize during an eased move wins

- **Rule:** When the canvas resizes while a move is easing, the camera is placed at once in the new frame, and the old move cannot overwrite it with its old endpoint.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:355-363`
- **Expected:** Eased `applyView('oblique')`, a resize, then the remaining frames run: the position and target are unchanged from just after the resize (≤1e-12) and the anatomy fits.
- **Covered by:** `src/lib/engine/framing.test.ts` (R)

## Sheet, dock and gestures

### FACADE-15 · A dock or sheet change keeps the reader's framing, after the finger lifts

- **Rule:** When the dock or settled sheet changes the room, the camera keeps its heading and target and scales its distance by the new fit over the old. A held view is re-framed instead. If a gesture is down, the refit waits for the lift, and the magnification is then read where the refit lands.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:386-400,1515-1550,1830-1851`
- **Expected:** With a fit `before` and the source now giving fit `after`, `keepFraming(before)` gives distance = old × after/before (≤1e-12), with the same heading and target. Between `start` and `end`, `refitDock()` and `keepFraming()` move nothing, and at `end` the same result applies.
- **Covered by:** `src/lib/engine/index.contract.test.ts` (R, via contract suite, weak: only checks the view stays held); `src/lib/engine/framing.test.ts` (R)

### FACADE-16 · Framing reads the interface's clearance when it frames, and reports the viewport

- **Rule:** Each framing measures the interface's current clearance (dock inset and label scale) at that moment. A chrome inset change reports the new visible rectangle and host size.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:365-376,1524-1530`
- **Expected:** A framing source counted by calls is asked at least once per `applyView`. After `setChromeInsets({ bottom: 200 })`, a `viewport` event carries `hostSize` equal to `camera.hostSize` and the shrunk `visibleRect`.
- **Covered by:** `src/lib/engine/index.contract.test.ts` (R, via contract suite)

### FACADE-17 · A pan cannot lose the anatomy

- **Rule:** During a drag, the orbit centre cannot be panned beyond the bounding sphere of what is drawn. A centre already further out is held where it is rather than pulled in. Any framing lifts the limit.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:251-254,1834-1839`
- **Expected:** On gesture `start`, `controls.cursor` is the sphere centre and `maxTargetRadius = max(radius, |target − centre|)`. After any framing command, `maxTargetRadius === Infinity`.
- **Covered by:** `src/lib/engine/framing.test.ts` (R)

## The held view

### FACADE-18 · Which commands hold the view and which let it go

- **Rule:** A named view and a non-oblique cut face hold the view, as does a restored camera that was held. Focus, landmark, deficit regions, focus point, a placed link camera, keyboard orbit and zoom, and an oblique cut face let it go. Pull back and internal anatomy leave it as it was.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:440,463,491,520,787,806,1290,1784`
- **Expected:** As listed, checked through `viewHeld` after each command starting from `applyView('left')`.
- **Covered by:** `src/lib/engine/index.contract.test.ts` (R, via contract suite)

### FACADE-19 · A gesture that moves the camera lets go of the view; a click does not

- **Rule:** A drag, pinch or wheel that moves the camera or orbit centre by more than 1e-6 m from where the gesture began releases the held view. A press that moves nothing (a click that selects) keeps it.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/ui/chrome/viewport-chrome.js:51,570-593`
- **Expected:** `hold()`, `start`, a position step of 1e-6 and `change`: still held. A step of 1.0000001e-6 (or 1e-5) and `change`: released. A target step behaves the same. `start` then `end` with no change: held.
- **Covered by:** `src/lib/engine/held-view.test.ts` (R)

### FACADE-20 · A wheel step's movement still counts just after the step ends

- **Rule:** A wheel step reports its end before the camera moves on the next frame. So a move up to 250 ms after a gesture ends still counts as the reader's and releases the view. A move well after that (an eased framing, damping coming to rest) does not.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/ui/chrome/viewport-chrome.js:588-591`
- **Expected:** `hold()`, `start`, `end`, then a 1e-5 move at +100 ms releases. The same move at +500 ms keeps the view held. 250 ms is the requirement. The exact boundary (249/250/251 ms) is timer implementation and should be tested only as "within a frame or two of 250 ms".
- **Covered by:** `src/lib/engine/held-view.test.ts` (R)

### FACADE-21 · Camera keys on the canvas let go of the view, browser shortcuts do not

- **Rule:** With the canvas focused, the arrow keys, `+`, `=` and `-` release the held view. The same keys with Ctrl, Meta or Alt are the browser's (page zoom, history) and leave it. Shift is allowed because it is how `+` is typed. Keys pressed elsewhere do nothing.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/ui/chrome/viewport-chrome.js:47,610-614`; deviation `e7-held-view-modified-keys.md`
- **Expected:** `-` on a CANVAS target with Ctrl, Meta or Alt keeps the view. With Shift it releases. `-` on a DIV keeps it. `a`, `Enter` and `Escape` on the canvas keep it.
- **Covered by:** `src/lib/engine/held-view.test.ts` (R)

### FACADE-22 · The held state is announced only when it changes

- **Rule:** The application is told when the view becomes held or is let go, never when it is set to what it already is.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/ui/chrome/viewport-chrome.js:560-568`
- **Expected:** `release, hold, hold, release, release` reports `[true, false]`. `applyView('left')` then `frameCurrent('right')` emits one `{ held: true }`.
- **Covered by:** `src/lib/engine/index.contract.test.ts` (R, via contract suite); `src/lib/engine/held-view.test.ts` (R)

## Capture, restore and the link

### FACADE-23 · A captured camera restores to itself, with its magnification and held state

- **Rule:** A captured camera (taken where the camera is going) restores the same pose and limits, the same magnification for later resizes, and the same held or released state.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:753-766,781-789`
- **Expected:** `capture()` then `restore(view, snapshot, immediate)` reproduces position, target, up, near, far and the limits exactly. A held capture restores `viewHeld === true` and a released one `false`. The next resize gives the same distance as before the capture.
- **Covered by:** `src/lib/engine/index.contract.test.ts` (R, via contract suite: held), `src/lib/engine/framing.test.ts` (R, mid-move)

### FACADE-24 · What the link carries of the camera

- **Rule:** A held view has no orbit link (the view name carries it), and neither does the tract reference shown alone. Otherwise the link carries the camera position and target in millimetres, exactly the metres × 1000 (rounding is the link writer's job). It carries the up vector only when it differs from the named view's up by more than 1e-3.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:791-792,813-822`
- **Expected:** After `applyView`, `orbitLink() === null`. After `orbitBy`, position[i] equals `destination.position[i] * 1000` (`Object.is`). With the up leaning 0.0009 from `upFor(view)` there is no `up` key; with 0.0011 `up` equals `camera.up.toArray()`. With the reference active it is `null`.
- **Covered by:** `src/lib/engine/index.contract.test.ts` (R, via contract suite: null when held, millimetres read back within 1e-3); `src/lib/engine/contract.test.ts` (W, "links no orbit while the tract reference is shown" runs on the fake only, so the real engine's reference case is unproven); `src/lib/engine/framing.test.ts` (R)

### FACADE-25 · A link camera is placed exactly, or refused

- **Rule:** A camera from a link is placed exactly where it says, with its up or the named view's. The orbit limits widen only as far as needed to admit it. A camera beyond the orbit limit by more than the link's rounding (`ORBIT_ROUNDING_MM` = 2·√(3·0.05²) ≈ 0.173 mm) is refused with a RangeError, and nothing moves. The magnification is then read from the placed camera.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:794-811`; `viewer/state/url-state.js:84-90`
- **Expected:** An orbit at `maxDistance·1000 + ORBIT_ROUNDING_MM/2` mm is placed, and `maxDistance` grows to admit it. At `+ 2·ORBIT_ROUNDING_MM` it throws `RangeError` and the camera is unchanged. Placing a link read back with `orbitLink()` reproduces it within 1e-3 mm, and `viewHeld === false`.
- **Covered by:** `src/lib/engine/index.contract.test.ts` (R, via contract suite); `src/lib/engine/framing.test.ts` (R)

### FACADE-26 · The link writes the camera to a tenth of a millimetre

- **Rule:** In the page link, camera position and target are rounded to 0.1 mm. A camera placed from a decoded link is within 0.05 mm per axis of the one written.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/state/url-state.js:60,111`
- **Expected:** `decodeState('#' + encodeState({ orbit })).orbit.position[i] === Math.round(position[i]·10)/10`.
- **Covered by:** `src/lib/core/state/url-state.test.ts` (R)

## Camera reporting

### FACADE-27 · The camera is reported per move, outside the change event

- **Rule:** Every camera move reports the orientation letters for the four edges and the scale bar, and every framing command reports that the destination is settled. Neither is part of the model's change event. An eased move keeps reporting frame by frame after the call returns.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:1817-1823`; `web/src/lib/engine/api.ts` (`HIGH_FREQUENCY_EVENTS`)
- **Expected:** `applyView('superior', immediate)` emits at least one `camera` event with `edges` keys `bottom, left, right, top`, at least one `cameraSettled`, and no `change`. `camera.view` equals the last event. `HIGH_FREQUENCY_EVENTS` is `['camera', 'hover', 'viewport']`.
- **Covered by:** `src/lib/engine/index.contract.test.ts` (R, via contract suite)

## Presentation

### FACADE-28 · Hover names a region the reader could select

- **Rule:** Hovering a region names it with the pointer position. Moving within the same region only moves the name and does not redraw the marking. A region the reader cannot select (hidden, or cortex made transparent) is not hovered.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:1721-1730,1798-1812`
- **Expected:** `hover(a, p1)` emits `hover { region: a, position: p1 }` and outlines a. `hover(a, p2)` emits position p2 without a new `setOutlined`. With `canSelect(a) === false`, the next outline pass emits `hover { region: null }`.
- **Covered by:** `src/lib/engine/presentation.test.ts` (R)

### FACADE-29 · How the selection and hover are marked depends on what is shown

- **Rule:** On the surface, the selection gets the two-tone outline and the hovered region the halo. While a cut is open there is no outline (it would ring the whole solid) and the cut faces light the hovered and selected regions instead. While the tract reference is shown alone, nothing is outlined.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:1732-1751`
- **Expected:** No cut: `setOutlined({ selected: [mesh(sel)], hovered: [mesh(hov)] })`. Cut active: `setOutlined()` with no argument, plus `sections.setHighlight({ hovered: hov, selected: sel })`. Reference active: `setOutlined()` and no highlight.
- **Covered by:** `src/lib/engine/presentation.test.ts` (R)

### FACADE-30 · An atlas-comparison overlap replaces the selection outline while shown

- **Rule:** While an overlap is highlighted and visible, it is outlined in place of the selection. Hiding the comparison (a cut opening) or clearing it brings the selection's outline back at once, with no other model change needed.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:1745-1750`
- **Expected:** Selection then `highlight(overlap)`: outlined selected is `[overlapMesh]`. `setVisible(false)` redraws once with the selection's mesh. `setVisible(true)` shows the overlap again, and `clear()` goes back to the selection.
- **Covered by:** `src/lib/engine/index.test.ts` (R)

### FACADE-31 · The canvas is named in the reader's language

- **Rule:** The canvas's accessible name and role description follow the reader's language. While the tract reference is shown alone, the name says so.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/render/scene.js:72-76`; decision 28 on #4
- **Expected:** `present({ lang: 'fr', referenceOnly: false })` sets `aria-label` to `t('fr','viewport').canvasLabel` and `aria-roledescription` to `t('fr','viewport').canvasRole`. `present({ lang: 'en', referenceOnly: true })` sets `aria-label` to `t('en','diffusion').nativeCanvas`.
- **Covered by:** `src/lib/engine/index.test.ts` (R)

## Engine lifecycle

### FACADE-32 · The engine does not start if it cannot draw an outline

- **Rule:** The outline programs are compiled before the stage reports ready. If they cannot be, the engine fails to start and frees the scene and the model, rather than starting without a way to mark the selection.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:2122-2123`; deviation `e7-warm-outlines-fail-fast.md`
- **Expected:** With `warmOutlines` throwing, `createEngine` rejects `/outline programs did not compile/`, the renderer is disposed once and `model.disposed === true`.
- **Covered by:** `src/lib/engine/index.test.ts` (R)

### FACADE-33 · A snapshot is the settled frame, cropped to the rectangle asked for

- **Rule:** A snapshot is the full-resolution frame, cropped to the stage rectangle given in CSS pixels, at the canvas's pixel ratio, with the brain drawn.
- **Kind:** behaviour
- **Level:** browser — real WebGL: renders the settled frame and reads its pixels back
- **Source:** `viewer/render/scene.js:551-566`
- **Expected:** `captureSnapshot({ x: 100, y: 50, width: 400, height: 300 })` gives a canvas of `round(400·ratio)` × `round(300·ratio)` with more than 8 distinct colours in a sparse sample.
- **Covered by:** `src/lib/engine/index.contract.test.ts` (R); `src/lib/engine/contract.test.ts` (W, the fake's canvas sizing only)

### FACADE-34 · One change event per model change, with the cut beside it

- **Rule:** Every model change reaches the application as one `change` event carrying the model state and the cut's state.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:1611-1639`
- **Expected:** `model.setHemisphere('left')` makes the last `change` have `model.hemisphere === 'left'` and `sections.mode === 'off'`. Each event carries its own copy of the cut state: after `setDisplay({ reverse: true })` then `{ reverse: false }`, the last event with `reverse` true still says true and the final one says false, and two reads of `sections.state` are different objects.
- **Covered by:** `src/lib/engine/index.test.ts` (R); `src/lib/engine/index.contract.test.ts` (R, via contract suite: the copies)

### FACADE-35 · The engine is disposed once

- **Rule:** Disposing the engine disposes the model, and the model says so.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `web/src/lib/engine/index.ts`
- **Expected:** `model.disposed` is `false` before `dispose()` and `true` after.
- **Covered by:** `src/lib/engine/index.contract.test.ts` (R, via contract suite; could move down to unit: it needs no drawing)

### FACADE-36 · The scan is shown on the surface only while nothing paints it

- **Rule:** The engine opens with no cut drawn. The MRI surface colour shows the scan unless a paint (a network, a deficit) is over it, in which case the paint wins. Removing the paint brings the scan back.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:1611-1639`
- **Expected:** At open, the `GPU labelled brain sections` object has `visible === false`. `setSurfaceColor('mri')` turns the MRI appearance on; `setPaint({...})` turns it off; `setPaint(null)` with the reference not shown turns it back on.
- **Covered by:** `src/lib/engine/index.test.ts` (R)

### FACADE-37 · The MRI window is linked only once the reader moves it

- **Rule:** The link carries the MRI window only when the linked MRI has loaded and the shown window differs from the published one. The published window is not a link field, and setting the window back to it removes the field.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `viewer/app.js:825-832`
- **Expected:** Before `load()`: `mriWindowLink() === null`. After it, with the published window shown: `null`. `setWindow(c + 10, w + 20)` → `{ center: c + 10, width: w + 20 }`. `setWindow(c, w)` → `null`. A centre or width that differs by 1 alone is linked.
- **Covered by:** `src/lib/engine/index.contract.test.ts` (R, via contract suite), `src/lib/engine/adapters.test.ts` (R)

### FACADE-38 · A listener that unsubscribes hears nothing more

- **Rule:** Subscribing to an engine event returns a function that removes that listener. After it is called the listener receives no further events, so a closed panel does not keep reacting.
- **Kind:** behaviour
- **Level:** unit
- **Source:** `web/src/lib/engine/index.ts` (`createEvents`)
- **Expected:** A `change` listener hears `select(left)`; after its `off()`, `select(null)` adds no event.
- **Covered by:** `src/lib/engine/index.contract.test.ts` (R, via contract suite)
