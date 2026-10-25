# C1 · Four grammar fixes in the French diffusion MRI dialog

**Legacy behaviour.** `diffusion/navigation-ui.js:19-28`, moved verbatim into `areas/mri.ts` apart from these two strings:

- hint: "Cliquer une coupe pour placer le réticule. Défiler pour parcourir les coupes ; les flèches déplacent d’un voxel."
- voxel: "Voxel source (indice 0)"

**New behaviour.**

- hint: "Cliquer sur une coupe pour placer le réticule. Faire défiler pour parcourir les coupes ; les touches fléchées déplacent le réticule d’un voxel."
- voxel: "Voxel source (indices à partir de 0)"

**Why.** _Cliquer_ takes _sur_; _défiler_ is intransitive, so the user's action is _faire défiler_; _déplacer_ had no object (the crosshair); "indice 0" reads as "the voxel at index 0", not "zero-based". These are grammar and clarity fixes under the fix-don't-port rule (conductor ruling on PR #72, review item 7). Standard: standard French usage of these verb constructions (Banque de dépannage linguistique, Office québécois de la langue française).
