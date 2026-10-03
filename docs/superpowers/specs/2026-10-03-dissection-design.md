# Selective anatomical dissection

Approved by the user on 2026-10-03: reversibly hide lobes and individual
regions, undo changes and restore hidden parts. The user subsequently removed
the insula-specific preset from scope; all controls are manual.

Add eye controls to the existing anatomy tree. Group controls operate on
the left and right sides separately; individual controls operate on one region.
Hidden entries remain in the tree and search with an explicit hidden state.
Add Hide selected to the inspector and compact dissection controls to the
explorer: Undo and Restore all.

The model owns explicitly hidden region identifiers and dissection history.
Each group change is one undoable action. Hiding an isolated region releases
isolation. Undo restores the previous mask and selection/isolation when compatible
with the current atlas, detail and display settings. It preserves the camera orbit.
Restore all clears only the dissection mask.
Reset view clears both the mask and history.

Apply the mask to surfaces, geometric caps, sampled MRI cuts and picking.
Do not modify source geometry, labels or MRI data. Preserve the mask across
atlas switches and include it in shared URLs. Clear it when switching subjects.
Explicit anatomical links reveal their requested region. Use the English/French
strings, design tokens, keyboard controls and phone layout.

Verify picking through removed surfaces, batched undo, selection, isolation,
invalid identifiers, reset, atlas changes, cut/palette invalidation,
cut picking and URL round trips. Run the full frontend suite and production
build, then inspect desktop and phone interactions in the browser.

Preserve the existing uncommitted UI work in the current workspace.
