# NeuroAtlas

```{rst-class} hero-lede
Source-faithful brain anatomy in the browser, for neuroscience teaching and anatomical research.
```

NeuroAtlas renders individual FreeSurfer reconstructions at native resolution, with their cortical atlases, internal structures and linked MRI. A Python pipeline (`brain-model` {{ release }}) compiles each reconstruction into the files the viewer loads. It is not clinical anatomy.

```{figure} ../public/preview.png
:alt: A cortical parcellation rendered in the NeuroAtlas viewer
:class: hero-figure

A cortical parcellation in the viewer. Each colour is one region.
```

## Start here

[Use the viewer](guides/viewer.md)
: The masthead, the five panel tabs, sections, linked MRI and keyboard control.

[Install](install.md)
: Run the viewer locally, or set up the pipeline to build an anatomy.

[Embed the API](guides/embedding.md)
: Load an anatomy and cut it from your own Three.js code.

[Validation and limits](validation.md)
: What is checked against the source, and what the model does not claim.

## Published anatomies

| Subject | Source | Licence |
| :--- | :--- | :--- |
| `snail` (default) | SNAIL subject 1, the tract dataset's own T1, FreeSurfer 8.2 | CC0 1.0 |
| `bert` | FreeSurfer's worked example, FreeSurfer 5.2.0 | FreeSurfer Software License |
| `aomic` | AOMIC-PIOP1 `sub-0022`, FreeSurfer 6.0.1 | CC0 1.0 |

Each is one person's brain. Folds, ventricles and asymmetries belong to that individual and are not normative. See [Anatomies](concepts/anatomies.md).

```{toctree}
:hidden:
:caption: Get started

install
```

```{toctree}
:hidden:
:caption: Guides

guides/viewer
guides/functions-and-deficits
guides/circuits
guides/tracts
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
```

```{toctree}
:hidden:
:caption: Project

Open the viewer <https://joshuaduq.github.io/neuroatlas/>
Source on GitHub <https://github.com/JoshuaDuq/neuroatlas>
```
