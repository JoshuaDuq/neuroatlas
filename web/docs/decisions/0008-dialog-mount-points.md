# 0008 Dialog mount points

Status: decided under the delegation on #4 (standards-based). Chunks U5, S5b, H4, G5, T2, I2, I3b.

- Every dialog is a native `<dialog>` opened with `showModal()`: top layer, inert background, Escape closes, focus returns to the opener (HTML standard).
- Feature chunks export the dialog component; **only integration chunks mount it**, as a direct child of the app root after the regions, so stacking and `inert` never depend on region markup.
- I3b mounts the keyboard shortcuts dialog (S5b) and the Provenance dialog (H4). I2 mounts the Linked MRI dialog (G5) and the Diffusion MRI dialog (T2).
- Open/close state lives in the owning feature's store; openers call controller commands, and the focus registry (U2) records the opener.
- The WebGL canvases inside G5 and T2 exist only while open (legacy frees them on close).
