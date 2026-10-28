# Planum

<!-- impeccable:product-schema 1 -->

## Platform

web

## Product Purpose

Interactive, source-faithful brain anatomy for neuroscience education and
anatomical research. The real reconstructed anatomy is the primary content.

## Users

The repository identifies neuroscience learners and researchers as its audience.
No additional user roles were established for this UI redesign.

## Capabilities and Constraints

- Explore and search cortical and internal anatomical regions.
- Inspect source labels, measurements, functional networks, and documented
  neuropsychological associations.
- Compare the Destrieux and HCP-MMP atlases by pial surface area, outline
  exact intersections, and export every contribution in CSV at full precision.
- Switch anatomies, cortical atlases, surface appearances, and hemispheres.
- Hide and restore anatomical parts, create anatomical cuts, and inspect linked
  MRI sections.
- Preserve scientific geometry, palettes, orientation, measurements, provenance,
  and the existing statement that this is not clinical anatomy.
- Preserve English and French, keyboard interaction, both UI themes, and the
  responsive phone sheet.
- Existing stack: JavaScript, Three.js, Vite, and self-hosted Source Sans 3.
- Errors surface; do not add compatibility layers or hidden fallbacks.

## Brand Commitments

Keep the Planum name and the cut-away mark: SNAIL subj_1's left hemisphere,
traced from its surfaces, solid behind a coronal cut and outlined in front. The
user requested a clean, clinical, professional interface and selected a light
clinical workspace.

The custom domain is planumatlas.com. The former address,
https://joshuaduq.github.io/neuroatlas/, is cited by a grant proposal and must
keep resolving through GitHub Pages’ custom-domain redirect; the repository
therefore stays named `neuroatlas`.

## Evidence on Hand

README.md and docs/ describe the anatomy, scientific constraints, sources, and
usage. public/models/ contains the actual published anatomy. Clinical content
comes from data/neuropsychology.yaml and its existing references.

## Product Principles

- Scientific correctness takes priority over visual invention.
- Keep anatomy, navigation, and inspection easy to understand together.
- Keep existing operations and scientific content intact during UI work.
- Prefer clear, concise controls and established browser semantics.
