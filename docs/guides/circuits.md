# Guided circuits

The **Circuits** tab holds eight bilingual tours with 33 landmarks: vision, memory, basal ganglia motor loops, hearing, touch, language, spatial attention and cerebellar output. Choose a tour, then a numbered landmark, or step with the “n of N” arrows in the location bar.

Each landmark opens its source atlas, reveals its anatomy and frames it.

- **Focus** returns to that framing; **Return to landmark** does so after you select another region.
- **Linked MRI** centres the sections on this brain's landmark centroid and cuts on the authored plane. The centroid can fall outside a curved structure such as the fornix.

A region's detail lists the landmarks that involve it under **In guided circuits**. The link records the tour and landmark, so a reload or shared link returns to it.

## What the tours claim

The notes at the foot of each lesson separate teaching relationships from the source geometry and from the published evidence. The tours do not measure connectivity or reconstruct axons. Some simplify on purpose:

- Memory stops at a coarse thalamic union.
- Motor switches explicitly from the direct to the indirect branch.
- Hearing shows the **dorsal** geniculate division, distinct from the ventral relay to A1.
- Language and attention visit interacting territories, not a serial chain.
- The cerebellar tour crosses from left dentate to right thalamus and motor cortex; its dentate step hides the cerebellar cortex.

Lessons, mappings and sources are in [`data/circuits.yaml`](https://github.com/JoshuaDuq/neuroatlas/blob/main/data/circuits.yaml). A landmark missing from any published anatomy, or a missing translation, fails the tests.
