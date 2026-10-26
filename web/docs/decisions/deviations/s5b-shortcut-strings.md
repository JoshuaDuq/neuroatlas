# Shortcut list strings

Chunk: S5b (the strings are C1's, `web/src/lib/core/i18n/areas/shortcuts.ts`)
Status: fix (standard cited); approved as conductor decision 24 on #4

| #   | Legacy                                                                                                      | New                                                                    | Standard                                                                            |
| --- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| D1  | FR Escape row: "...puis la sélection, puis le déficit" (translations.js:919); EN says "function or deficit" | FR: "...puis la fonction ou le déficit"                                | The cascade closes functions too (app.js:1912-1914); content parity between locales |
| D2  | `M` row says "linked MRI slices" only; in Tracts `m` opens the diffusion MRI (app.js:1949-1953)             | "Open or close linked MRI slices; in Tracts, the diffusion MRI" (+ FR) | Help text must match behaviour                                                      |
| D3  | FR cap "Esc" is not localised though "Entrée" and "Début Fin" are                                           | "Échap"                                                                | Caps name the key as printed on the keyboard; the ported i18n test must accept it   |
| D4  | A range is a bare "–" between two caps, which screen readers often skip: "1 6"                              | The dash is `aria-hidden` and a visually hidden "to" / "à" follows it  | WCAG 1.3.1 Info and Relationships, 3.3.2 Labels or Instructions                     |

Status: D1, D3 and D4 are in `areas/shortcuts.ts` (`rangeTo` is D4's string). D2 is not applied: the new row would say the diffusion MRI is opened _or closed_ in Tracts, but a second `M` does nothing while it is open (`keymap.ts` returns early on `diffusionMriOpen`), and `M` does nothing on the tract reference. The row stays as legacy until the wording describes that exactly.
