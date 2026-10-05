# Organization verification

Request: clean clinical professional UI. User rejected the previous organization
and confirmed the problem was too many panels and scattered controls.

The replacement uses one task panel, four destinations, a 64px header, and a
stable larger scene. View settings share one location. Contextual details occupy
the task panel, rather than an empty permanent column.

- Latest full test run: 455 passed, zero failures.
- Latest production build passed. Existing Three.js BVH chunk size advisory.
- Whitespace validation passed.
- 36 palette contrast pairs recomputed from current tokens, all passed.
- The five selection transition tests failed before implementation and pass now:
  Explore opens new selections; Sections/View are not interrupted; returning to
  Explore preserves the list; clearing the last desktop context returns Explore;
  circuit/deficit context can remain without a selected anatomical mesh.
- Browser keyboard regression: search Enter opens Region and focuses
  workspace-panel-region. The / shortcut reopens Explore and focuses search.
- Workspace and sheet panel changes request a scene redraw. Renderer stays on
  demand and the scientific render loop is unchanged.
- Tested English/French, light/dark, anatomy selection, View, Sections, Circuits,
  and viewport changes. Phone retains its existing selection and sheet behavior;
  desktop context gating is intentionally specific to the desktop controller.

Required viewport evidence in this directory: desktop.jpg (1440x960), tablet.jpg
(900x1000), mobile.jpg and mobile-view.jpg/mobile-sections.jpg (390x844),
mobile-narrow.jpg (320x740), mobile-landscape.jpg (812x375), user-522.jpg (522x773).
Additional desktop states: desktop-view.jpg, desktop-region.jpg,
desktop-sections.jpg, desktop-circuits-list.jpg, desktop-circuits.jpg,
desktop-french.jpg, desktop-dark.jpg. Some captures were replaced after a
transient unpainted WebGL frame; pass only files whose saved image contains the
brain and the named task. File capture and display now use the same bytes.

Detector ran once for this build. Its flat type warning and black-text color
finding inspect static HTML without the Vite-imported stylesheet. Actual body
is 15px, brand 20px, panel headings 18px, selected name 22px. Other findings
concern documented menu shadow, established small control/measurement radii,
and necessary sheet span/progress transitions. New brand size and workspace
geometry are recorded by the independent documenter.

The independent finish review requested one Circuits hierarchy correction.
Populated lessons now show the circuit name as an 18px h2, the landmark as a
22px h3, and meaningful progress immediately below. The lesson's explanations,
cautions, disclosures, and controls are preserved. desktop-circuits.jpg was
recaptured; the same reviewer scored this material fix resolved with a ship
verdict covering the listed fix only. Documentation was rechecked after the
correction. The final full test and build logs include this correction.

Logs: /tmp/neuroatlas-organization-tests-final.log and
/tmp/neuroatlas-organization-build-final.log.
