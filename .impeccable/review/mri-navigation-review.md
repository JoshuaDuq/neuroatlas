# Restored MRI navigation review

The restored navigator uses the original SNAIL T1 and FA, zero-based source
voxel coordinates, linked slice planes and cached selected tract lines.

The independent reviewer scored both findings **resolved**, with disposition
**ship** limited to these fixes:

- F1: mouse selection snaps to a source voxel centre. Clicking `[164,128,90]`
  and submitting those unchanged indices produce identical RAS and T1/FA values.
- F2: a 16 px gap separates linked tiles and their orientation markers.
  Desktop, 772 px and 390 px captures show distinct markers for each slice.

Evidence: `mri-navigation-fixes.json`, `mri-navigation-desktop.png`,
`mri-navigation-user-772.png` and the refreshed `mri-navigation-phone.png`.
The documenter also checked the restored navigator against the incumbent
clinical system and found no material documentation mismatch.

This verdict covers F1/F2, not the subsequently generated SNAIL atlas,
its publication or composition with real reconstructed regions.
