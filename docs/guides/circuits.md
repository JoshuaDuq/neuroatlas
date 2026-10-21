# Guided circuits

Choose the **Circuits** tab beside **Anatomy** and **Deficits**. Eight bilingual tours cover vision, memory, basal ganglia motor loops, hearing, touch, language, spatial attention and cerebellar output. Together they offer 33 landmarks.

Choose a tour, then select a numbered landmark, or step with the arrows beside the landmark count at the top of the lesson. On a phone, selecting a tour opens the lesson in the sheet. Scroll the sheet to reach the notes.

## What a landmark does

Each landmark opens its source atlas, reveals its anatomy and prepares an orientation.

- The landmark's own **Focus** returns to that prepared framing.
- Its **Linked MRI** centres the linked sections on that brain's actual landmark centroid, cuts the model on the authored plane and opens that plane on phones. MRI volume labels may use a different or finer atlas than the selected teaching solid, and the centroid can fall outside a curved structure such as the fornix.
- After you select another region, **Return to landmark** restores the prepared view.

## What the lesson claims

**Connections and scope**, **What this atlas shows**, **Clinical context** and **Sources** separate teaching relationships from the actual source geometry and from the published evidence.

The tours do not measure functional connectivity and do not reconstruct axons. Some tours state their simplifications on purpose:

- The memory tour stops at a coarse thalamic union.
- The motor tour explicitly changes from the direct to the indirect branch.
- The hearing tour identifies the displayed **dorsal** geniculate division and distinguishes it from the ventral relay to A1.
- The touch tour separates a whole thalamic union from the specific sensory relays within it.
- The language and attention tours visit interacting network territories rather than implying a serial chain. The right attention landmarks do not make the dorsal network exclusively right-sided.
- The cerebellar tour changes from left dentate and superior peduncle to right thalamus and motor cortex after the explained crossing. Its dentate step hides the covering cerebellar cortex to expose the deep nucleus. Returning to the cortex landmark restores that layer. Linked MRI always keeps the complete source volume.

## Progress and language

Starting a tour again resets the landmarks it marks as seen. Reloading the page or switching brains resets learning progress. The anatomical URL still records the selected region and display state.

English and French are available through the language control. In Circuits, **/** focuses the tour list, and **↑** and **↓** move between its buttons.

## Where the content lives

Lesson text, mappings, source links, orientations and context margin are in [`data/circuits.yaml`](https://github.com/JoshuaDuq/neuroatlas/blob/main/data/circuits.yaml). The catalog checks each landmark's exact source name against every published anatomy. A missing landmark or translation is an error, never a silent substitution. The catalog tests read each published manifest in turn.
