# Surface modules

Cortical geometry, sphere registration, envelopes, ribbons and shading.

## Geometry

`brain_model.surfaces.geometry`: Coordinate conversion, marching cubes, bounded smoothing and the solid misclassification check.

```{eval-rst}
.. automodule:: brain_model.surfaces.geometry
   :members:
```

## Registration

`brain_model.surfaces.registration`: Label transfer through registered spheres, by nearest vertex, never interpolated.

```{eval-rst}
.. automodule:: brain_model.surfaces.registration
   :members:
```

## Solids

`brain_model.surfaces.solids`: Closed native pial and white envelopes for cuts.

```{eval-rst}
.. automodule:: brain_model.surfaces.solids
   :members:
```

## Ribbons

`brain_model.surfaces.ribbons`: Per-vertex labels that close the cortical ribbon into solids.

```{eval-rst}
.. automodule:: brain_model.surfaces.ribbons
   :members:
```

## Shading

`brain_model.surfaces.shading`: Shading fields from source morphometry; positions never change.

```{eval-rst}
.. automodule:: brain_model.surfaces.shading
   :members:
```
