# Guided circuits and pathways

The **Circuits** tab contains five anatomical pathway and loop-branch tours, with 25 landmarks. Choose a tour and a landmark, or use the arrows in the location bar to step through it.

| Tour | Anatomical subject | Main qualification |
| --- | --- | --- |
| Visual pathway | Optic chiasm, optic tract, lateral geniculate nucleus and V1 | The retinal input, optic nerves and optic radiations are omitted. |
| Hippocampal–diencephalic pathway | Hippocampal formation, fornix, mammillary bodies, mammillothalamic tract and anteroventral thalamic nucleus | A selected branch within a wider memory network. The anteromedial and anterodorsal nuclei are drawn only on cut faces; this is not a complete or uniquely necessary serial Papez circuit. |
| Basal ganglia motor loops | Selected direct and indirect motor-loop components | The stepper visits branches, not one continuous linear route. Nigral, dopamine and hyperdirect components are omitted. |
| Cerebellar output and crossing | A dentate output branch crossing past the opposite red nucleus toward the thalamus and motor cortex | Input and return pathways are omitted. The whole thalamus stands in for its cerebellar-recipient territory. Nonhuman-primate tracing, human histology and human anatomical landmarks retain their separate evidence roles. |
| Corticospinal descent and crossing | Cortical origin, brainstem descent, medullary crossing and opposite spinal cord, with this brain’s tracked left corticospinal tract on the first three landmarks | The streamlines are diffusion-MRI estimates that stop near the caudal medulla, before the crossing. Broad brainstem landmarks do not isolate the fibres. |

```{figure} ../../.github/assets/readme/circuits.webp
:alt: The memory pathway on its first landmark, the left hippocampal formation, outlined among the structures around it

The hippocampal–diencephalic pathway on its first landmark, revealed and framed with its neighbours.
```

Each landmark opens its source atlas, reveals the relevant anatomy and frames it. **Focus** or **Return to landmark** restores that framing. **Linked MRI** centres the sections on the landmark centroid; a centroid can fall outside a curved structure. Region details link back to associated landmarks. A shared URL retains the tour and landmark when its ID is still published.

A landmark can also draw one of this brain’s own tracts, alone and coloured by local streamline direction. Stretches hidden behind or inside the anatomy are drawn faint rather than left out. The streamlines go away on any landmark without a tract, and when the tour ends.

The tours teach literature-supported anatomical relationships. Apart from the corticospinal streamlines, they do not measure connectivity in this individual. No tour reconstructs axons or establishes a necessary and sufficient lesion pattern for a deficit. Their notes identify the species, anatomical approximations and omitted components relevant to interpretation. Active lessons and mappings are in [`data/circuits.yaml`](https://github.com/JoshuaDuq/neuroatlas/blob/main/data/circuits.yaml).

Every tour’s Sources panel distinguishes **Deficit evidence** from **Circuit background**. A patient lesion study can support a region–deficit association without establishing the connections of the pathway taught. Sources retain their study-specific limits. Clinical accuracy has not been validated.

## Withdrawn tours

On 31 October 2026, 31 network/function and clinical landmark tours were removed from this category. Three more—auditory, somatosensory and reward/valuation—were withheld pending anatomical rework.

All 34 withdrawn tours remain in the [source archive](https://github.com/JoshuaDuq/neuroatlas/blob/main/data/archived-circuit-tours.yaml), with bilingual descriptions and citations. The archive is not loaded by the viewer. Their associated deficit evidence and functional maps remain in the existing **Deficits** and **Functions** sections. Archived citations and atlas labels remain subject to automated checks.

A link to a withdrawn circuit ID reports unsupported circuit/step parameters and retains the other valid scene fields. It does not open a different tour under the old ID.

The [29-tour evidence audit](../reference/circuit-evidence.md) and [full-text review log](../reference/full-text-review.md) retain their historical scope; their earlier counts do not describe the current active catalogue.
