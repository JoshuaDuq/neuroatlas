import type { Paint, Rgb } from '../../types/index.ts';
import { FINDING_COLORS } from '../clinical/catalog.ts';

/** `neuropsych-domains.json`, as far as the lesion reads it: each function's group, each area's functions. */
interface Domains {
  domains: readonly { id: string; group: string }[];
  regions: Readonly<Record<string, readonly { domain: string }[]>>;
}

type Shares = ReadonlyMap<string, { inside: number; whole: number }>;

export interface FunctionReach {
  id: string;
  group: string;
  /** mm³ of the function's territory inside the lesion, and the territory's whole size. */
  inside: number;
  whole: number;
  share: number;
  /** How many of its areas the lesion reaches. */
  areas: number;
}

const sideOf = (id: string) => id.split(':')[1]!;

/**
 * Each function whose territory the lesion reaches, largest share first. A territory is the areas and
 * structures where the function's consistency map reaches the published threshold, on the sides the
 * lesion reaches: a left lesion is weighed against the left territory, not against both.
 */
export function functionReach(
  domains: Domains,
  regions: Shares,
  sizes: ReadonlyMap<string, number>,
): FunctionReach[] {
  const sides = new Set([...regions.keys()].map(sideOf));
  sides.add('midline');
  const territories = new Map<string, string[]>();
  for (const [area, members] of Object.entries(domains.regions)) {
    if (!sides.has(sideOf(area))) continue;
    for (const { domain } of members)
      territories.set(domain, [...(territories.get(domain) ?? []), area]);
  }
  const reach: FunctionReach[] = [];
  for (const { id, group } of domains.domains) {
    const areas = territories.get(id) ?? [];
    const reached = areas.filter((area) => regions.has(area));
    if (!reached.length) continue;
    const whole = areas.reduce((sum, area) => {
      const size = sizes.get(area);
      if (size === undefined) throw new Error(`No label volume sizes ${area}, part of ${id}.`);
      return sum + size;
    }, 0);
    const inside = reached.reduce((sum, area) => sum + regions.get(area)!.inside, 0);
    reach.push({ id, group, inside, whole, share: inside / whole, areas: reached.length });
  }
  return reach.sort((a, b) => b.share - a.share);
}

export interface ProfileGroup<F, R> {
  group: string;
  functions: F[];
  deficits: { deficit: string; findings: R[]; share: number }[];
  /** The largest share any of its functions or cited regions has inside the lesion. */
  strength: number;
}

/**
 * The functions and deficits a lesion reaches, under the groups the Functions and Deficits tabs share,
 * strongest group first. A deficit stands for its findings, at the largest share any of them reaches.
 */
export function lesionProfile<
  F extends { group: string; share: number },
  R extends { association: { deficit: string }; share: number },
>(
  groups: readonly string[],
  functions: readonly F[],
  findings: readonly R[],
  deficitGroup: (deficit: string) => string,
): ProfileGroup<F, R>[] {
  return groups
    .map((group) => {
      const deficits = new Map<string, R[]>();
      for (const finding of findings) {
        const { deficit } = finding.association;
        if (deficitGroup(deficit) !== group) continue;
        deficits.set(deficit, [...(deficits.get(deficit) ?? []), finding]);
      }
      const listed = functions.filter((row) => row.group === group);
      const rows = [...deficits].map(([deficit, cited]) => ({
        deficit,
        findings: cited,
        share: Math.max(...cited.map((finding) => finding.share)),
      }));
      const strength = Math.max(
        0,
        ...listed.map((row) => row.share),
        ...rows.map((row) => row.share),
      );
      return { group, functions: listed, deficits: rows, strength };
    })
    .filter((entry) => entry.functions.length || entry.deficits.length)
    .sort((a, b) => b.strength - a.strength);
}

/**
 * The leading functions' whole territories on the brain, in the finding colours by rank: each area in
 * the colour of the first function that claims it. `key` names the placement, so a new one repaints.
 */
export function functionsPaint(
  domains: Domains,
  reach: readonly FunctionReach[],
  key: string,
): { paint: Paint; rows: { id: string; color: Rgb }[] } {
  const rows = reach.slice(0, FINDING_COLORS.length).map((row, index) => ({
    id: row.id,
    color: FINDING_COLORS[index]!,
  }));
  const colors = new Map<string, Rgb>();
  for (const { id, color } of rows) {
    for (const [area, members] of Object.entries(domains.regions)) {
      if (!colors.has(area) && members.some((member) => member.domain === id))
        colors.set(area, color);
    }
  }
  return { paint: { id: `lesion:functions:${key}`, colors }, rows };
}
