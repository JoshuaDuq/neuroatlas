# Atlas comparison inspector

The user approved the proposed Destrieux/HCP-MMP comparison and requested precision, clarity and a clean UI. This extends the existing region inspector and retains the Clinical Reading Room design, both languages, both themes and phone layout.

## Scientific contract

Compare the two annotations on the same subject's original pial tessellation. Every triangle contributes one third of its area to each vertex's barycentric cell. Joint annotation pairs group those cells; this is exactly the viewer's existing midpoint/centroid boundary convention. Count surface area in float64 mm², including every unassigned cell. A percentage is joint overlap area divided by the whole selected region's source pial area. Reverse comparisons use their own selected-region denominator. Never substitute vertex counts, renormalize assigned shares or discard small overlaps.

An independent explicit geometric subdivision verifies the weighted calculation. Real source round-trips verify both annotation marginal totals against the published cortical surfaces within their float32 storage tolerance. Exact overlap meshes use the same barycentric cells; highlighting cannot include any area outside the selected pair. Store source annotation/pial hashes, published cortical asset hashes, method, subject, units and citations. HCP projection and subvertex-boundary limitations remain visible in the method disclosure.

## Data contract

`manifest.atlas_comparison` names `atlas-comparison.json` and its SHA-256. The sidecar has `schema_version: 1`, `anatomy_id`, `atlases: ['destrieux', 'hcp-mmp']`, `surface: 'pial'`, `method: 'barycentric-vertex-cells'`, `units: 'mm2'`, `totals` keyed by region ID, and `pairs` of `{region_ids: [destrieuxId, hcpId], area_mm2, mesh_id}`. It carries `sources` per hemisphere (pial and annotations with filename/hash), `atlas_assets` (atlas/file/hash/citation), and `geometry: {file: 'atlas-overlaps.glb', sha256}`. GLB extras carry `overlap_id` matching `mesh_id`. All positive pairs, including non-region labels, are retained.

Build the sidecar and meshes through a focused comparison exporter, called by the normal build. Publish SNAIL first. Subjects without a declared comparison show no comparison control; malformed declared data or failed requested loads surface an error. Existing numerical data and assets are not rebuilt to add this feature.

## Interaction and UI

A compact ruled "Atlas comparison" disclosure follows the selected region's measurements. It shows the target atlas, the full pial-area denominator, the largest four overlaps (name, area and share), an explicitly named unassigned remainder, and a disclosure for remaining rows. Display one decimal; nonzero values smaller than the display precision read "<0.1". Downloads retain full numerical precision.

Rows are buttons with an accessible pressed state. Activating a row outlines that exact pair intersection on the current anatomy; activating it again clears the comparison highlight. Keep the selected source region and current atlas. No copied atlas surfaces, camera changes, recoloring or atlas-switch side effects. Existing cut/dissection visibility governs highlighting; the method note explains that table measurements use the whole pial region even when the view is cut or parts are hidden. Clear stale highlights when the source selection changes. Loading and error states are local to this section and announced.

A secondary CSV export includes all rows and the subject, region IDs, complete area denominator, raw fractions, method, versions, source hashes and citations. A "Method and sources" disclosure holds scientific detail. Both English and French use the established number formatting and complete anatomical names. The stage and toolbar gain no permanent controls.

## Acceptance

- Unequal triangle areas produce area-weighted, asymmetric fractions with exact conservation, including unassigned cells.
- Real SNAIL totals and overlay geometry independently agree; hemisphere and source identities cannot be mixed.
- Switching selection/atlas, cuts, dissection and loading failures leave no stale highlight or hidden fallback.
- Export includes small and unassigned contributions at full precision with reproducible provenance.
- English/French desktop and phone layouts are readable, keyboard accessible and free from overflow.
- Existing suites, scientific comparison checks, production build and independent review pass.
