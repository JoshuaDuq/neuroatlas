import { expect, it } from 'vitest';
import { readRepoJson, readRepoYaml, repoRoot } from './repo.ts';

it('reads the repository files the data-contract tests check', () => {
  expect(repoRoot.endsWith('/')).toBe(true);
  const published = readRepoJson<{ default: string; anatomies: { id: string }[] }>(
    'public/models/anatomies.json',
  );
  expect(published.anatomies.map(({ id }) => id)).toContain(published.default);
  const model = readRepoYaml<{ anatomy: string }>('config/model.yaml');
  expect(model.anatomy).toBe(published.default);
});
