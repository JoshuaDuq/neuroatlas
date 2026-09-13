# Learning anatomy implementation plan

Goal: deliver a legible internal anatomy overview with traceable structures and
system-based exploration, preserving original reference assets.

Architecture: a dedicated Python learning module builds a third detail level
from explicit YAML source-label unions. The viewer consumes the same manifest
contract and one shared visibility predicate. UI controls call model commands.

- [ ] Add union/membership and bounded-smoothing tests; confirm failure.
- [ ] Implement config/learning-anatomy.yaml and brain_model/learning.py with
      strict source lookup, unique membership, deterministic meshes and metadata.
- [ ] Integrate build and independent manifest/mesh validation. Rebuild assets.
- [ ] Add anatomical NextBrain grouping and model system-filter tests; confirm
      failure, then implement state, visibility and cut filtering.
- [ ] Add overview entry action, localized system control and constituent links;
      update startup asset hints and URL restoration.
- [ ] Run relevant Python and JS suites, production build, asset validation and
      browser QA for overview, systems, hemisphere, selection, isolation, cuts,
      detailed-label navigation, reset and French.

Visual thesis: calm anatomical workspace with a readable cluster of large
internal shapes. Content: anatomy navigation, central model, compact inspector.
Interaction: one action reveals the interior; system choice reframes it; a
constituent link takes the reader from the larger structure to its native label.
