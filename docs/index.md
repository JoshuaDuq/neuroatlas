# Planum documentation

```{rst-class} hero-lede
Explore an individual brain in the browser, from cortical regions to internal anatomy and diffusion tracts.
```

Planum combines a 3D viewer with a Python pipeline that converts FreeSurfer reconstructions into viewable assets. The published anatomy is MGH CDMD subject `sub_013`. Planum is for research and education; it is **not clinical anatomy**.

## Find your way

[Use the viewer](guides/viewer.md)
: Search and select regions, make sections, and inspect linked MRI.

[Install and build](install.md)
: Run the viewer locally, build an anatomy, or build this documentation.

[Explore the data](concepts/atlases.md)
: Understand the atlases, segmentations, functional layers, and their sources.

[Validation and limits](validation.md)
: Learn what is checked against the source and how to interpret the result.

[Developer reference](api/index.md)
: Browse the Python pipeline API or [embed the viewer components](guides/embedding.md) in a Three.js application.

```{figure} ../.github/assets/neuroatlas-destrieux.png
:alt: Inferior view of Destrieux regions and diffusion tracts in Planum
:class: hero-figure

Destrieux regions and diffusion tracts from CDMD subject `sub_013`.
```

The anatomy represents one individual; its folds and asymmetries are not normative. Atlas projections and segmentations are estimates. See [Anatomies](concepts/anatomies.md) and [References and licensing](reference/references.md) for provenance and data terms.

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

Open the viewer <https://planumatlas.com/>
Source on GitHub <https://github.com/JoshuaDuq/neuroatlas>
```
