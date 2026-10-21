# Python API

The pipeline is the `brain_model` package in the repository. It is run from the repository root, through `uv run`. The pages in this section are generated from the module docstrings and the function signatures, so they describe the code as it stands.

The package has four groups of modules, one page each:

- [Pipeline](pipeline.md): the build and its checks (`build`, `validate`, `validate_learning`, `validate_volumes`) and the source configuration (`sources`).
- [Surfaces](surfaces.md): cortical geometry, registration between spheres, closed envelopes, ribbon labels and shading.
- [glTF](gltf.md): quantized encoding and the scene export.
- [Labels](labels.md): volumetric label grids, the tissue labels, gyral white matter and the NextBrain labels.
- [Layers](layers.md): the derived layers that are not parcellations of the cortex: the Yeo networks, the learning overview, the spinal cord and the atlas comparison.

## Command-line entry points

These modules run as commands with `python -m`. Each accepts `--anatomy` to choose a declared anatomy:

```bash
uv run python -m brain_model.build --anatomy bert
uv run python -m brain_model.validate --anatomy bert
uv run python -m brain_model.layers.comparison --anatomy snail
```

The scripts under `scripts/` are command-line tools rather than library code, so they are not documented here. Their purpose is described in [Building an anatomy](../guides/building.md#optional-scripts).

## Conventions

- Source files are read through `brain_model.sources`, which checks each file's SHA-256 against `data/sources.json` before use.
- Coordinates are in surface RAS millimetres unless a name says otherwise. The glTF output is in metres. See [Architecture](../concepts/architecture.md#coordinate-frames).
- Regions are identified by an atlas, a hemisphere, and a source label. Their published identifiers are described under [Atlases](../concepts/atlases.md).

## Modules

```{toctree}
:maxdepth: 1

pipeline
surfaces
gltf
labels
layers
```
