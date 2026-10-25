# C1 · Four grammar fixes in the French diffusion MRI dialog

**Legacy behaviour.** `diffusion/navigation-ui.js:19-28`, moved verbatim into `areas/mri.ts` apart from these two strings:

- hint: "Cliquer une coupe pour placer le réticule. Défiler pour parcourir les coupes ; les flèches déplacent d’un voxel."
- voxel: "Voxel source (indice 0)"

**New behaviour.**

- hint: "Cliquer sur une coupe pour placer le réticule. Faire défiler pour parcourir les coupes ; les touches fléchées déplacent le réticule d’un voxel."
- voxel: "Voxel source (indices à partir de 0)"

**Why.** Clarity and usual French usage (conductor ruling on PR #72, review item 7): _cliquer sur_ is the usual construction (OQLF, Banque de dépannage linguistique); _faire défiler_ is the OQLF Grand dictionnaire terminologique's term for "scroll"; _déplacer_ needs an object (the crosshair); "indice 0" reads as "the voxel at index 0", not "zero-based".
