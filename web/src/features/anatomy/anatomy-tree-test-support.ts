// Fixture catalog for the anatomy tree tests. Not shipped.
import type { CatalogGroup, CatalogRow } from '../../lib/core/catalog/catalog.ts';
import type { HiddenReason } from '../../lib/core/catalog/visibility.ts';
import type { Region } from '../../lib/types/index.ts';

const row = (
  id: string,
  name: string,
  hemisphere: Region['hemisphere'],
  state: { reason?: HiddenReason; atlas?: string } = {},
): CatalogRow =>
  ({
    region: { id, hemisphere, kind: 'cortex', atlas: state.atlas ?? 'destrieux' },
    label: { name, group: '', code: null, aliases: [] },
    ...(state.reason ? { visible: false, reason: state.reason } : { visible: true, reason: null }),
  }) as unknown as CatalogRow;

/** Cortex with a hemisphere-hidden region, subcortical with a midline part and a removed one, a tissue group. */
export const GROUPS: CatalogGroup[] = [
  {
    name: 'Frontal',
    kind: 'cortex',
    key: 'cortex:Frontal',
    rows: [
      row('d:left:1', 'Precentral gyrus', 'left'),
      row('d:right:1', 'Precentral gyrus', 'right'),
      row('d:right:2', 'Superior frontal gyrus', 'right', { reason: 'hemisphere' }),
    ],
  },
  {
    name: 'Limbic',
    kind: 'cortex',
    key: 'cortex:Limbic',
    rows: [row('d:left:3', 'Cingulate gyrus', 'left')],
  },
  {
    name: 'Basal ganglia',
    kind: 'structure',
    key: 'structure:Basal ganglia',
    rows: [
      row('a:mid:1', 'Third ventricle', 'midline'),
      row('a:left:1', 'Caudate', 'left'),
      row('a:left:2', 'Putamen', 'left', { reason: 'removed' }),
      row('a:left:3', 'Globus pallidus', 'left', { reason: 'other-detail', atlas: 'aseg' }),
    ],
  },
  {
    name: 'Cut labels',
    kind: 'tissue',
    key: 'tissue:Cut labels',
    rows: [
      row('t:left:1', 'Small nucleus', 'left', { reason: 'below-cut-resolution' }),
      row('t:left:2', 'Tissue region', 'left', { reason: 'no-cut' }),
    ],
  },
];
