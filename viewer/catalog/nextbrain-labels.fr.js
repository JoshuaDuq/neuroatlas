/**
 * NextBrain structures in French anatomical nomenclature.
 *
 * Keyed by `source_name`: the published name with its laterality prefix and its
 * vestigial `ctx-rh-` fragment removed, so one entry serves both hemispheres.
 *
 * Entries are added as they are verified. Anything absent falls back to the
 * published English name rather than an invented translation, so this table can
 * be incomplete without being wrong — the same reason HCP-MMP areas keep their
 * published codes. `group` overrides the alphabetical bucket a name would
 * otherwise be filed under.
 */
export const NEXTBRAIN_LABELS_FR = {};
