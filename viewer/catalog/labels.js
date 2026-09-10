import { DESTRIEUX_LABELS } from './destrieux-labels.js';
import { STRUCTURE_LABELS } from './structure-groups.js';

const UNLABELLED = { name: 'Unlabelled', code: null, group: 'Unlabelled', aliases: [] };

const BUCKETS = ['A–C', 'D–F', 'G–I', 'J–L', 'M–O', 'P–R', 'S–U', 'V–Z'];

/** HCP-MMP codes are cleaned mechanically: `L_V1_ROI` -> `V1`. Never expanded. */
const hcpCode = sourceName => sourceName.replace(/^[LR]_/, '').replace(/_ROI$/, '');

function alphabeticalBucket(code) {
  const first = code[0].toUpperCase();
  if (first >= '0' && first <= '9') return '0–9';
  const index = Math.floor((first.charCodeAt(0) - 65) / 3);
  return BUCKETS[index] ?? BUCKETS.at(-1);
}

/**
 * A region's display name, short code, navigation group and search aliases.
 *
 * Destrieux and aseg names come from curated tables. HCP-MMP has no name table
 * in this repository, so its areas keep their published codes rather than
 * being given invented expansions.
 */
export function labelOf(region) {
  if (region.kind === 'non-region') return UNLABELLED;

  if (region.kind === 'structure') {
    const entry = STRUCTURE_LABELS[region.source_name];
    if (!entry) return null;
    return { name: entry.name, code: null, group: entry.system, aliases: [] };
  }

  if (region.atlas === 'hcp-mmp') {
    const code = hcpCode(region.source_name);
    return { name: code, code, group: alphabeticalBucket(code), aliases: [] };
  }

  const entry = DESTRIEUX_LABELS[region.source_name];
  if (!entry) return null;
  return {
    name: entry.name, code: null, group: entry.lobe, aliases: entry.aliases ?? [],
  };
}
