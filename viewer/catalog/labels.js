import { DESTRIEUX_LABELS } from './destrieux-labels.js';
import { DESTRIEUX_LABELS_FR } from './destrieux-labels.fr.js';
import { NEXTBRAIN_LABELS_FR } from './nextbrain-labels.fr.js';
import { STRUCTURE_LABELS } from './structure-groups.js';
import { STRUCTURE_LABELS_FR } from './structure-groups.fr.js';

const UNLABELLED = {
  en: { name: 'Unlabelled', code: null, group: 'Unlabelled', aliases: [] },
  fr: { name: 'Non étiqueté', code: null, group: 'Non étiqueté', aliases: [] },
};

const BUCKETS = ['A–C', 'D–F', 'G–I', 'J–L', 'M–O', 'P–R', 'S–U', 'V–Z'];

/** HCP-MMP codes are cleaned mechanically: `L_V1_ROI` -> `V1`. Never expanded. */
const hcpCode = sourceName => sourceName.replace(/^[LR]_/, '').replace(/_ROI$/, '');

/** Published NextBrain names are snake_case; only the separator is changed. */
const readable = sourceName => sourceName.replaceAll('_', ' ');

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
 * being given invented expansions. NextBrain follows the same rule: its French
 * table is filled in as terms are verified, and every name it does not cover
 * falls back to the published English one.
 */
export function labelOf(region, lang = 'en') {
  const isFr = lang === 'fr';
  if (region.kind === 'non-region') return isFr ? UNLABELLED.fr : UNLABELLED.en;

  // NextBrain names are published for both its solid nuclei and its cut-only
  // regions, so the atlas decides this before the kind does.
  if (region.atlas === 'nextbrain') {
    const entry = isFr ? NEXTBRAIN_LABELS_FR[region.source_name] : undefined;
    const name = entry?.name ?? readable(region.source_name);
    return {
      name,
      code: null,
      group: entry?.group ?? alphabeticalBucket(name),
      aliases: entry?.aliases ?? [],
    };
  }

  if (region.kind === 'structure') {
    const table = isFr ? STRUCTURE_LABELS_FR : STRUCTURE_LABELS;
    const entry = table[region.source_name] ?? STRUCTURE_LABELS[region.source_name];
    if (!entry) return null;
    return { name: entry.name, code: null, group: entry.system, aliases: [] };
  }

  if (region.atlas === 'hcp-mmp') {
    const code = hcpCode(region.source_name);
    return { name: code, code, group: alphabeticalBucket(code), aliases: [] };
  }

  const table = isFr ? DESTRIEUX_LABELS_FR : DESTRIEUX_LABELS;
  const entry = table[region.source_name] ?? DESTRIEUX_LABELS[region.source_name];
  if (!entry) return null;
  return {
    name: entry.name, code: null, group: entry.lobe, aliases: entry.aliases ?? [],
  };
}
