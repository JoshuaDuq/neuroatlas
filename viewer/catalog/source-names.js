/**
 * FreeSurfer 5 wrote `_and_` where 6 writes `&`: `G_and_S_frontomargin`
 * against `G&S_frontomargin`, `S_intrapariet_and_P_trans` against
 * `S_intrapariet&P_trans`. Same parcel, same label id, same atlas — which
 * spelling a brain carries is a fact about the recon that produced it, not
 * about the anatomy.
 *
 * Anything that matches a Destrieux region by name compares these instead of
 * the raw string, so a second reconstruction does not read as a different
 * atlas. `source_name` itself is left alone: it keeps what that brain's own
 * annotation said.
 */
export const canonicalSourceName = name => name.replaceAll('&', '_and_');
