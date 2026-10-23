# Pipeline modules

Build, validation and source configuration.

## `brain_model.build`

Compiles a declared anatomy into its published files.

```{eval-rst}
.. automodule:: brain_model.build
   :members:
```

## `brain_model.validate`

Reads a build back against its sources and writes `validation.json`. See [Validation](../validation.md#what-is-checked).

```{eval-rst}
.. automodule:: brain_model.validate
   :members:
```

## `brain_model.validate_learning`

Source membership and display geometry of the teaching set.

```{eval-rst}
.. automodule:: brain_model.validate_learning
   :members:
```

## `brain_model.validate_volumes`

Published volumes against their native sources, crop and affine included.

```{eval-rst}
.. automodule:: brain_model.validate_volumes
   :members:
```

## `brain_model.validate_segmentation`

NextBrain agreement with the subject's aseg, and FreeSurfer's pre-repair defect count.

```{eval-rst}
.. automodule:: brain_model.validate_segmentation
   :members:
```

## `brain_model.validate_transforms`

Re-derives projected annotations and the tract reference transform.

```{eval-rst}
.. automodule:: brain_model.validate_transforms
   :members:
```

## `brain_model.sources`

Reads `config/model.yaml` and `data/sources.json` and verifies SHA-256 checksums.

```{eval-rst}
.. automodule:: brain_model.sources
   :members:
```
