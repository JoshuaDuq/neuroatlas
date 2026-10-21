# glTF modules

The quantized encoding of the published meshes, and the scene export that names each region and records its source.

## `brain_model.gltf.encode`

Container re-encoding for the published glTF meshes. It quantizes the attributes against one range per file, so a parcel's values stay comparable with every other parcel's. It also writes the decode ranges and the `KHR_mesh_quantization` declaration. The bounds are in [Architecture](../concepts/architecture.md#quantization-and-encoding).

```{eval-rst}
.. automodule:: brain_model.gltf.encode
   :members:
```

## `brain_model.gltf.export`

Named regions, shared-frame geometry and source metadata. Each region becomes a named mesh with its atlas, hemisphere, source label and stable identifier.

```{eval-rst}
.. automodule:: brain_model.gltf.export
   :members:
```
