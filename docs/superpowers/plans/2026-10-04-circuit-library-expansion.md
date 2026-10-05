# Circuit Library Expansion Implementation Plan

> **For agentic workers:** Use executing-plans inline. Preserve the existing workspace edits and the approved circuit explorer design.

**Goal:** Expand the three guided tours to eight, with five additional bilingual lessons grounded in the actual atlas labels.

**Architecture:** Extend the existing authored YAML catalog. Reuse lesson navigation, linked MRI, clinical profiles, final questions and source disclosures. No new rendering or preprocessing is needed.

**Tech Stack:** Authored YAML, existing vanilla DOM/Three.js viewer, Node tests and Vite.

## Design

The user requested more of the completed guided learning feature. Keep the approved format and add these topics:

| Tour | Landmarks | Learning question |
| --- | --- | --- |
| Hearing | Left inferior colliculus central nucleus, dorsal medial geniculate nucleus, A1 | Which geniculate division did the highlighted teaching solid show? |
| Touch | Left whole thalamus, area 3b, OP1 | Which side of the body is principally represented by left area 3b? |
| Language | Left lateral superior temporal gyrus, middle temporal gyrus, areas 44 and 45 | What does this tour support about language organization? |
| Spatial attention | Right IPS1, FEF, TPOJ1 | Does a right-sided tour imply that the dorsal attention network is exclusively right-sided? |
| Cerebellar output | Left cerebellar cortex, dentate, superior cerebellar peduncle, right thalamus and area 4 | Which thalamic side receives the crossed output from the left dentate? |

These add 18 landmarks and five questions, for 33 landmarks and eight questions in total. Hearing distinguishes the displayed dorsal geniculate division from the ventral relay that is absent as a separate teaching solid. Language and attention are network landmark tours rather than serial fibre pathways. Cerebellar output explicitly changes hemisphere after the superior peduncle crossing. Whole thalamic and cerebellar unions remain labelled as coarse geometry. HCP-MMP parcels are atlas mappings rather than individual functional localizers.

Clinical targets: word deafness, somatosensory loss, aphasia, neglect and cerebellar ataxia. Explain what these links contribute without treating the reference brain as a patient prediction.

The dentate lies inside an opaque cerebellar cortex. Its authored `covering_region` removes that same-side covering solid through existing dissection controls. The catalog rejects self-covering, unknown, cross-atlas or contralateral covering labels. Returning to the cortex landmark reveals it again through normal landmark navigation; MRI retains the source volume.

## Work

- [x] Update `viewer/learning/catalog.test.js` to require all eight tours and validate every landmark on both published brains. Add domain checks for the dorsal geniculate mapping and the cerebellar hemisphere change.
- [x] Run `node --test viewer/learning/catalog.test.js`; confirm failures identify the missing tours.
- [x] Extend `data/circuits.yaml` with the five tours, exact source IDs/names, English/French text, prepared views/planes, final questions and verified references. Preserve the original three tours.
- [x] Run `node --test viewer/learning/*.test.js`, then `npm test` and `npm run build`. Check whitespace with `git diff --check`.
- [x] Update `docs/usage.md` with the eight topics and the new scientific scope notes.
- [x] Inspect one batched browser round: all five new tours, laterality, atlas transitions, final answer feedback, linked MRI, English/French and phone scrolling. Save a preview and report verified totals.

## Sources reviewed

Nilearn's official atlas plotting examples; Bartlett (2013) auditory thalamus; Pickles (2015) auditory pathways; Purves *Neuroscience* somatic sensory cortex and cerebellar organization; Eickhoff et al. (2007) parietal opercular somatotopy; Hickok & Poeppel (2007) and Hickok (2012) speech processing; Corbetta & Shulman (2002) and Shulman et al. (2010) attention; Perrini et al. (2013) human peduncle dissection; Glasser et al. (2016) cortical parcellation. References are linked in the lessons.

## Verification

- Test-first missing-tour and covering-region checks failed before implementation. Final learning suite: 13 passed. Final full suite: 459 passed, zero failures. Production build and whitespace checks passed; the existing BVH chunk-size advisory remains.
- Both published manifests validate all eight tours, 33 exact landmarks, eight questions and clinical targets. Review found no scientific content discrepancies.
- Browser checks visited all 18 new landmarks in AOMIC, crossed the cerebellar hemisphere boundary, switched cortical atlases and verified all five new question explanations in French. English feedback was checked for both incorrect and correct answers.
- Phone checks reached the eighth tour, opened coronal MRI at right thalamus (RAS right 13.5 mm; thalamic label 49), and confirmed no horizontal overflow with 44px answer targets. Language and viewport preferences were restored. Browser error logs were empty.
- Review identified dentate occlusion by cerebellar cortex. The browser reproduced it, the real-model regression failed before the fix, and the prepared view now exposes the nucleus. Returning to the cortex restores the mask; MRI remains complete. Follow-up review found no further material issues.
- Saved `circuit-library-expanded.jpg` in the task visualization directory and retained the local preview. Existing unrelated workspace edits were preserved.
