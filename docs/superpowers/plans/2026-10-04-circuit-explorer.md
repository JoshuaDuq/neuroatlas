# Circuit Explorer Implementation Plan

> **For agentic workers:** Use executing-plans to implement this plan inline. Preserve the existing uncommitted interface work.

**Goal:** Add three bilingual guided anatomy tours with linked MRI, literature, clinical context and retrieval questions for students, clinicians and researchers.

**Architecture:** Authored YAML resolves against each published anatomy through a strict catalog. A small lesson session tracks the selected tour, landmark and answer. The existing model, MRI controller and render cycle remain responsible for anatomy and display; a Circuits explorer supplies lesson navigation and an inspector profile.

**Tech Stack:** Existing Three.js atlas, BrainSections, vanilla DOM, build-time YAML, Node test runner and Vite.

## Accepted design

Add Circuits beside Anatomy and Deficits. The left rail contains three tours and their landmarks; the region inspector explains the active landmark. Previous/next controls also work on phones, where selecting a tour opens the region sheet. Each landmark has a prepared anatomical orientation and MRI plane through its actual centroid. Learners can return to the landmark after freely exploring.

Tours: visual pathway (chiasm, left tract, left LGN, left V1); memory landmarks (left hippocampal formation, fornix, mammillary bodies, mammillothalamic tract, whole thalamus); basal ganglia motor landmarks (precentral gyrus, putamen, GPi, whole thalamus, GPe, STN). Motor branch roles are explicit. These are schematic teaching relationships, not measured functional connectivity or tractography. Reference anatomy does not predict patient deficits. All lessons explain source granularity, including the coarse thalamic unions. One question per tour gives immediate explanatory feedback.

Keep scientific geometry and palettes. Use the existing restrained theme tokens and mobile sheet. English and French cover content, actions, errors and accessibility labels. Errors appear in the lesson status; invalid content fails during catalog construction. Do not add compatibility paths or silent fallback data.

## Work

- [x] Write failing tests in `viewer/learning/catalog.test.js` for both manifests, bilingual content, questions, exact source mappings and invalid data; session tests for validated step/answer transitions; navigation tests for centroid-based MRI and surfaced loading failures.
- [x] Run `node --test viewer/learning/*.test.js` and confirm the missing feature fails.
- [x] Add `data/circuits.yaml`, `viewer/learning/catalog.js`, `load.js`, `session.js`, `navigation.js`, `translations.js`. Validate nonempty bilingual fields, unique IDs, supported views/planes, HTTPS references, exact source names, clinical targets and answer bounds.
- [x] Add `viewer/ui/circuits.js` and `viewer/styles/circuits.css`; integrate the explorer and inspector in `index.html`, `viewer/app.js` and the existing explorer/session controllers. Export a region-centred opening action from the MRI controller. Keep lesson context visible after manual selection, with an explicit return action.
- [x] Run targeted tests, full `npm test`, and `npm run build`.
- [x] Perform one batched desktop/mobile, English/French, light/dark browser QA round. Check course switching, all anatomical layers, previous/next, answers, MRI, return after manual selection, keyboard focus and visible error states. Fix issues and perform one confirmation round.
- [x] Run Impeccable detection once on edited UI files. Obtain a focused code review and resolve material findings. Add usage documentation and report verified results.

## Sources reviewed

Existing `docs/usage.md`, clinical navigation and source manifests; Nilearn's official plotting examples; Purves *Neuroscience* visual pathways and retinotopy chapters; Bubb et al. (2017) hippocampal–diencephalic–cingulate anatomy; Aggleton et al. (2022) limitations of serial Papez models; Lanciego et al. (2012) basal ganglia functional anatomy. Lesson references are visible in the product. No new neuroimaging preprocessing is required.

## Verification

- Final Node suite: 455 passed, zero failures. Production Vite build passed; existing BVH chunk-size advisory remains. Whitespace checks passed.
- Desktop and phone checks covered both brains, English/French, light/dark, all three tours, quiz outcomes, return navigation, hidden anatomy recovery, clinical evidence focus, and authored MRI planes. Changing explorer during an AOMIC MRI load left the modal closed and circuit status hidden. Browser error logs were empty.
- Focused review findings were addressed: restore internal visibility before selection, open the authored phone MRI plane, update a mounted quiz live region, and respect explorer changes during async completion. The real BrainAtlas visibility regression passes.
- Impeccable detection ran once. Its standalone HTML probe reported default unstyled typography/colors; the running app showed 18px lesson titles over 14px body text, body contrast 12.89:1, note contrast 6.44:1, no horizontal overflow, and 44px phone action targets.
- Preview saved in the task visualization directory as `circuit-explorer.jpg`. Existing unrelated interface edits were preserved.
- After the workspace panel redesign, confirmed desktop course selection opens Region, `/` returns to the course list with keyboard focus, and phone Region opens the authored sagittal MRI. Phone action targets remain 44px with no horizontal overflow. Refreshed the preview; browser error logs remain empty.
