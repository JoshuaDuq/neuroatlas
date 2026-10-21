# NeuroAtlas

```{rst-class} hero-lede
A source-faithful, selectable 3D brain model for neuroscience teaching and anatomical research.
```

NeuroAtlas is anchored in individual FreeSurfer reconstructions at full native resolution. It combines real-time solid tissue cuts, categorical 3D label sampling, registered T1 material variation, multi-atlas parcellation layers, and linked orthogonal MRI reference sections. The web viewer runs in the browser. The Python pipeline (`brain-model` {{ release }}) compiles each reconstruction into the binary assets the viewer loads.

The viewer is at [joshuaduq.github.io/neuroatlas](https://joshuaduq.github.io/neuroatlas/). The source is at [github.com/JoshuaDuq/neuroatlas](https://github.com/JoshuaDuq/neuroatlas).

```{figure} ../public/preview.png
:alt: A cortical parcellation rendered in the NeuroAtlas viewer
:class: hero-figure

A cortical parcellation in the viewer. Each colour is one region.
```

## Start here

::::{grid} 1 2 3 3
:gutter: 3

:::{grid-item-card} Install
:link: install
:link-type: doc

Set up the web viewer, the Python pipeline, or both.
:::

:::{grid-item-card} Use the viewer
:link: guides/viewer
:link-type: doc

Colour modes, anatomical cuts, the linked MRI, dissection and keyboard controls.
:::

:::{grid-item-card} Embed the API
:link: guides/embedding
:link-type: doc

Drive `BrainAtlas` and `BrainSections` from your own Three.js application.
:::

:::{grid-item-card} Build an anatomy
:link: guides/building
:link-type: doc

Run the pipeline end to end and see what each step writes.
:::

:::{grid-item-card} Atlases and anatomies
:link: concepts/atlases
:link-type: doc

The parcellation layers, the published subjects, and how each was derived.
:::

:::{grid-item-card} Validation and limits
:link: validation
:link-type: doc

What is checked numerically, and what the model does not claim.
:::
::::

## Anatomy at a glance

Eight layers share one spatial frame. Counts describe the default `snail` publication unless noted; the subject manifest is authoritative for the structures actually present.

| Layer | Granularity | Page |
| :--- | :--- | :--- |
| Destrieux cortex (`aparc.a2009s`) | 148 parcels and 2 medial-wall surfaces | [Atlases](concepts/atlases.md#anatomical-cortex-destrieux) |
| HCP-MMP1.0 cortex | 360 multimodal areas | [Atlases](concepts/atlases.md#multimodal-cortex-hcp-mmp10) |
| Learning anatomy | 79 teaching solids in `snail` (82 in `bert`) | [Atlases](concepts/atlases.md#learning-anatomy) |
| FreeSurfer aseg | 32 subcortical structures in `snail` (35 in `bert`) | [Atlases](concepts/atlases.md#subcortical-reference-levels) |
| NextBrain histology | 306 meshes in `snail` (328 in `bert`), 515 ROIs in `bert` | [Atlases](concepts/atlases.md#subcortical-reference-levels) |
| Gyral white matter (`wmparc`) | 68 parcels | [Atlases](concepts/atlases.md#gyral-white-matter-wmparc) |
| Spinal cord | 58 tracts and horns (Z-Anatomy reference) | [Atlases](concepts/atlases.md#spinal-cord-neuroaxis-reference) |
| Yeo 7 networks | 7 resting-state networks | [Atlases](concepts/atlases.md#functional-networks-yeo-7) |

## Published anatomies

The viewer publishes three individual reconstructions. `snail` is the default. Each is one person's brain, so folds, ventricles and asymmetries describe that individual and are **not clinically normative**. See [Anatomies](concepts/anatomies.md) for how each was chosen and under which terms it is distributed.

```{note}
The MRI and FreeSurfer segmentations are 1 mm isotropic. NextBrain labels are estimated on a 0.4 mm grid from that same 1 mm scan. Where neighbouring structures share their T1 contrast, the histological atlas prior, not the scan, places the boundary. The full list of limits is on the [validation](validation.md) page.
```

```{toctree}
:hidden:
:caption: Getting started

install
```

```{toctree}
:hidden:
:caption: Guides

guides/viewer
guides/circuits
guides/tracts
guides/atlas-comparison
guides/embedding
guides/building
```

```{toctree}
:hidden:
:caption: Concepts

concepts/architecture
concepts/atlases
concepts/anatomies
```

```{toctree}
:hidden:
:caption: Validation

validation
```

```{toctree}
:hidden:
:caption: API reference

api/index
```

```{toctree}
:hidden:
:caption: Reference

reference/references
reference/model-design
```

```{toctree}
:hidden:
:caption: Project

Open the viewer <https://joshuaduq.github.io/neuroatlas/>
Source on GitHub <https://github.com/JoshuaDuq/neuroatlas>
```
