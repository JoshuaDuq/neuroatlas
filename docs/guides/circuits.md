# Guided circuits

The **Circuits** tab contains thirty-five tours: sensory systems (vision, visual motion, colour, objects, visual extinction, hearing, cortical deafness, voice recognition, sound localization, touch, pain, insular taste deficits, olfactory recognition), movement (basal ganglia motor loops, corticospinal descent, pontine injury in locked-in syndrome, cerebellar output, praxis, oral apraxia, reaching, gaze) and cognition (memory, navigation, language, reading, number, spatial attention, cognitive control, faces and emotion, reward and valuation, speech apraxia, spelling memory, figure copying, music perception, affective theory of mind). Choose a tour and a landmark, or use the arrows in the location bar to step through it.

```{figure} ../../.github/assets/readme/circuits.webp
:alt: The memory tour on its first landmark, the left hippocampal formation, outlined among the structures around it

The memory tour on its first landmark, the left hippocampal formation, revealed and framed with its neighbours.
```

Each landmark opens its source atlas, reveals the relevant anatomy and frames it. **Focus** or **Return to landmark** restores that framing. **Linked MRI** centres the sections on the landmark centroid; a centroid can fall outside a curved structure. Region details link back to associated landmarks, and a shared URL retains the tour and landmark.

The tours illustrate teaching relationships; they do not measure connectivity or reconstruct axons. Their notes identify simplifications and sources. Lessons and mappings are in [`data/circuits.yaml`](https://github.com/JoshuaDuq/neuroatlas/blob/main/data/circuits.yaml).

Every tour’s Sources panel now distinguishes **Deficit evidence** from **Circuit background**. A source’s role does not grade its certainty: a case report, a case series and a lesion meta-analysis have different limits. Published corrections are listed with the affected source. The [catalogue-wide evidence audit](../reference/circuit-evidence.md) records provenance for the first 29 tours and the remaining review work; the six newest tours are not yet in it. Clinical accuracy has not been validated.

## Lesion evidence for the additional tours

The twelve additional tours contain 30 landmarks selected from patient lesion findings. The catalogue totals 35 tours and 115 landmarks. General activation studies are not used to establish deficit links in these additions.

These findings support **region–deficit associations**, not a proven serial chain between the displayed landmarks. An atlas parcel is an anatomical approximation, not a reconstructed patient lesion. None of these tours establishes that damaging any point in a displayed sequence necessarily produces the same deficit.

| Tour | Patient evidence and selected landmarks | Limits of the evidence |
| --- | --- | --- |
| Speech apraxia | [Dronkers (1996)](https://pubmed.ncbi.nlm.nih.gov/8906789/), [Hillis et al. (2004)](https://pubmed.ncbi.nlm.nih.gov/15090478/), [Graff-Radford et al. (2014)](https://pmc.ncbi.nlm.nih.gov/articles/PMC4004427/): left anterior insular, posterior inferior frontal and motor/premotor landmarks. | Localization remains disputed across cohorts, stroke stages and associated aphasia. The tour compares competing lesion findings; it does not present one settled speech-planning pathway. |
| Spelling memory | [Rapp et al. (2016)](https://pmc.ncbi.nlm.nih.gov/articles/PMC4805091/): left ventral temporal and posterior inferior frontal landmarks for orthographic long-term memory; intraparietal landmark for orthographic working memory. | Frontal and temporal injury occurred in different patient subgroups. The selected cohort does not establish every motor handwriting disorder. The middle frontal landmark, supported here by an activation meta-analysis, was removed. |
| Music perception | [Sihvonen et al. (2016)](https://pmc.ncbi.nlm.nih.gov/articles/PMC6601900/): right Heschl’s, superior temporal, insular and striatal landmarks. | The evidence concerns acquired scale/rhythm impairments after stroke, not all musical abilities. Broad insular and putaminal landmarks do not isolate independently necessary sites or establish a serial chain. |
| Insular taste deficits | [Pritchard et al. (1999)](https://pubmed.ncbi.nlm.nih.gov/10495075/): bilateral insular references for six patients with unilateral lesions. | The short gyri are broad references, not proven boundaries of gustatory lesions. The small series cannot establish universal laterality. The orbital landmark, supported here by activation evidence, was removed. |
| Olfactory recognition | [Jones-Gotman & Zatorre (1988)](https://pubmed.ncbi.nlm.nih.gov/3374800/), [Jones-Gotman & Zatorre (1993)](https://pubmed.ncbi.nlm.nih.gov/8373572/): left/right orbital references for identification and right orbital recognition-memory findings. | Temporal excisions also produced deficits. Detection, identification and recognition memory are distinct outcomes. The piriform and amygdalar activation landmarks were removed from this deficit tour. |
| Affective theory of mind | [Shamay-Tsoory & Aharon-Peretz (2007)](https://pubmed.ncbi.nlm.nih.gov/17640690/): left/right gyrus rectus as broad ventromedial frontal references. | Affective findings are stronger than separate cognitive localization. Small groups, ceiling effects and task-dependent laterality limit the dissociation; participant totals conflict within the paper. Gyrus rectus itself was not isolated as necessary. Angular and superior frontal landmarks, supported here by activation evidence, were removed. |

The source table is a qualitative scientific audit. The automated checks separately verify exact atlas labels, bilingual completeness, reference identities and that each new tour cites patient lesion evidence already supporting the same deficit and at least one visited region in the clinical catalogue. Passing those checks does not prove a biological pathway or remove the study limitations above.
