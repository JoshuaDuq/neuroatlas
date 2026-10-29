# glTF modules

The quantized mesh encoding and the scene export.

## Encode

`brain_model.gltf.encode`: Quantizes attributes against one range per file and declares `KHR_mesh_quantization`. Bounds are in [Architecture](../concepts/architecture.md#encoding).

```{eval-rst}
.. automodule:: brain_model.gltf.encode
   :members:
```

## Export

`brain_model.gltf.export`: Writes each region as a named mesh with its atlas, hemisphere, source label and stable id.

```{eval-rst}
.. automodule:: brain_model.gltf.export
   :members:
```
