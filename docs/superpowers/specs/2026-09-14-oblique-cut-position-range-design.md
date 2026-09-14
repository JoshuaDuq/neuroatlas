# Oblique Cut Position Range Design

## Problem

Orthogonal cuts use bounds from the anatomical axis they move along. Oblique
cuts instead use the largest absolute coordinate as a symmetric range. That
range is not the projection of the anatomy onto the oblique plane normal: it
contains large empty spans and can stop before the distal spinal cord for some
angles.

## Considered approaches

1. Expand the existing symmetric limit to the bounding-box diagonal. This
   guarantees coverage but increases empty slider space and preserves the root
   cause: the range still ignores the current normal.
2. Restrict oblique positions to the MRI volume. This gives useful brain
   navigation but makes supplemental anatomy unreachable.
3. Project the complete anatomical bounds onto the current normal. This is the
   selected approach because it gives the smallest interval that contains the
   modeled anatomy for every orientation.

## Design

For an oblique cut, enumerate the eight corners of the combined MRI and
supplemental axis-aligned bounds. Compute each corner's dot product with the
unit plane normal. The smallest and largest projections become the position
range.

Sagittal, coronal, axial, crosshair, clipping, reverse-side, and sampling
behavior remain unchanged. Because the range is derived when read, changing
tilt or azimuth immediately gives controls the interval for the new normal.

The calculation remains in `BrainSections`, which owns cut coordinates and
anatomical bounds. Invalid or unavailable geometry is not hidden by a fallback;
manifest validation continues to surface malformed supplemental bounds.

## Verification

Add a regression test using the published spinal-cord bounds and an orientation
whose minimum projection is below -720 mm. Assert that both returned endpoints
equal independently calculated corner projections. Retain the existing tests
for orthogonal limits, fractional coordinates, reverse clipping, and distant
crosshairs. Run the complete JavaScript test suite and production build.
