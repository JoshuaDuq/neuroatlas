// The session the composing chunk owns, as plain data, for the workspace tests.
import type { ContextSelection } from '../../lib/core/workspace.ts';
import type { Explorer, Language, Notice } from '../../lib/types/index.ts';

export interface World {
  lang: Language;
  explorer: Explorer;
  selectedRegion: { id: string } | null;
  selectedFunction: string | null;
  selectedDeficit: string | null;
  lesson: { circuit: string | null };
  anatomy: string;
  referenceAnatomy: string;
  selection: ContextSelection;
  place: string | null;
  notice: Notice | null;
  shell: 'rails' | 'sheet';
}

export const newWorld = (fields: Partial<World> = {}): World => ({
  lang: 'en',
  explorer: 'anatomy',
  selectedRegion: null,
  selectedFunction: null,
  selectedDeficit: null,
  lesson: { circuit: null },
  anatomy: 'bert',
  referenceAnatomy: 'bert',
  selection: {},
  place: null,
  notice: null,
  shell: 'rails',
  ...fields,
});

export const REGIONS = ['left:1', 'left:2', 'left:3'];
export const GROUPS = [
  {
    name: 'Frontal',
    key: 'cortex:Frontal',
    kind: 'cortex',
    rows: REGIONS.map((id) => ({ region: { id, kind: 'cortex' as const, atlas: 'destrieux' } })),
  },
];
