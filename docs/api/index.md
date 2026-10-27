# Python API

The pipeline is the `brain_model` package, run from the repository root through `uv run`. These pages are generated from the docstrings.

```bash
uv run python -m brain_model.build --anatomy cdmd
uv run python -m brain_model.validate --anatomy cdmd
uv run python -m brain_model.layers.comparison --anatomy cdmd
```

Source files are read through `brain_model.sources`, which checks each SHA-256 first. Coordinates are surface RAS millimetres unless named otherwise; glTF is in metres ([Architecture](../concepts/architecture.md#coordinate-frames)). Scripts under `scripts/` are tools, not library code, and are described in [Building an anatomy](../guides/building.md).

```{toctree}
:maxdepth: 1

pipeline
surfaces
gltf
labels
layers
```
