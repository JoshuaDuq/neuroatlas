# Pipeline modules

The modules that drive a build, check its output, and read the source configuration.

## `brain_model.build`

Compiles a declared anatomy into the published assets. Its `main()` runs the steps in [Building an anatomy](../guides/building.md#run-the-pipeline).

```{eval-rst}
.. automodule:: brain_model.build
   :members:
```

## `brain_model.validate`

Reads a built anatomy back from disk and checks it against its raw sources. It writes `validation.json`. Its checks are described in [Validation](../validation.md#what-validation-checks).

```{eval-rst}
.. automodule:: brain_model.validate
   :members:
```

## `brain_model.validate_learning`

Independent checks on the learning overview: source membership of each unit, and the exported display geometry.

```{eval-rst}
.. automodule:: brain_model.validate_learning
   :members:
```

## `brain_model.validate_volumes`

Reconciles the transported volumes with their native MRI sources, including the crop and its affine.

```{eval-rst}
.. automodule:: brain_model.validate_volumes
   :members:
```

## `brain_model.validate_segmentation`

How far each brain's NextBrain segmentation agrees with its own FreeSurfer aseg, and FreeSurfer's count of surface defect holes before repair.

```{eval-rst}
.. automodule:: brain_model.validate_segmentation
   :members:
```

## `brain_model.validate_transforms`

Re-derives the annotations projected from `fsaverage` and the tract reference's scanner-to-surface transform from their sources.

```{eval-rst}
.. automodule:: brain_model.validate_transforms
   :members:
```

## `brain_model.sources`

The source configuration and integrity checks. It reads `config/model.yaml` and `data/sources.json`, verifies SHA-256 checksums, and reads the colour tables.

```{eval-rst}
.. automodule:: brain_model.sources
   :members:
```
