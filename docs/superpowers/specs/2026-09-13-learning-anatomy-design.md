# Internal anatomy for learning

The current 35-label aseg layer is too coarse, and the 298 individually meshed
NextBrain labels form a fragmented introduction to deep anatomy. The NextBrain
input is already a 1 mm MNI segmentation warped onto bert; smoother rendering
cannot recover missing histological information.

Add an explicitly derived Learning anatomy detail level. Union named NextBrain
labels into recognizable structures before extracting surfaces. Supplement with
aseg ventricles and corpus callosum, whose provenance stays
explicit. Do not combine competing thalamic or basal-ganglia segmentations.
Use bounded Taubin smoothing only on the new display geometry; preserve original
source volumes, both existing detail levels, topology and voxel-derived metrics.
Publish the constituent source IDs and measured maximum display displacement.

The existing restrained canvas remains the visual focus. Add a prominent Explore
internal anatomy action, an anatomical-system selector, and constituent links in
the inspector. Exploring hides cortex, selects learning anatomy, uses region
colours and frames the visible internal structures. A system filter hides other
internal structures and is respected by mesh rendering, picking, cuts, catalog,
isolation and shared links. The reader can return to all systems or reset.

Use anatomical navigation for NextBrain in both languages. Retain the existing
French name table; add an explicit English grouping table using published label
IDs. Cerebellar vermis layers (PVA) belong to cerebellum, not thalamus.

Alternatives considered: smoothing every original surface loses the unchanged
reference; increasing source resolution requires running a new segmentation and
cannot be achieved by upsampling this atlas. The derived overview is immediately
useful and separately auditable.

References reviewed: NextBrain MNI atlas repository and pipeline, FreeSurfer
HistoAtlasSegmentation documentation, Trimesh filter_taubin and
laplacian_calculation documentation and installed implementation.
