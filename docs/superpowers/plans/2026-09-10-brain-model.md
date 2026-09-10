# Brain Model Implementation Plan

**Goal:** Deliver accurate source-derived, selectable brain assets and verify them.

**Architecture:** A deterministic Python pipeline reads FreeSurfer data, partitions
the cortical surface by vertex annotations and exports GLB region meshes.
Matching volume labels supply internal anatomy. A small Three.js viewer consumes
only the published assets and stable region metadata.

**Tech stack:** NiBabel, NumPy, SciPy, scikit-image, trimesh, pytest; Three.js/Vite.

- [ ] Audit cached fsaverage surfaces, annotations, volume geometry and licenses;
  copy only required inputs and record their hashes. Pin dependencies and YAML
  configuration. Source examples: NiBabel `read_geometry`/`read_annot`, MNE HCP
  fetcher, scikit-image marching cubes, trimesh GLB exporter.
- [ ] Test then implement coordinate conversion and mixed-label face partition
  in `brain_model/geometry.py`; use a scalene triangle with three labels and a
  two-label neighbor to assert area, coverage and source vertex ownership.
  Run `uv run pytest tests/test_geometry.py`.
- [ ] Implement `brain_model/build.py` and `brain_model/validate.py`, exporting
  two cortical atlases and segmented structures. Validate every exported mesh
  and source checksum. Run `uv run python -m brain_model.build` then
  `uv run python -m brain_model.validate`.
- [ ] Build independent minimal inspector in `viewer/`, exposing a reusable
  loader/selection API. Test real GLB rendering, picking, isolation, hemisphere
  filters, and atlas switching; run `npm run build`.
- [ ] Assemble Blender scene, capture preview, review numerical fidelity and
  implementation, fix findings, and write integration/provenance documentation.

Scope and numerical requirements are in `docs/model-design.md`. Work proceeds
in this empty repository on `codex/brain-model`; no existing checkout needs
isolation. No publishing or unrelated website design is included.
