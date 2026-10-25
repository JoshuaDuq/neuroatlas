import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { test } from 'vitest';
import { readRepoJson, readRepoYaml, repoRoot } from '../../../../test/repo.ts';
import type { ClinicalData } from '../clinical/types.ts';
import type { CircuitData } from './catalog.ts';

interface Work {
  doi: string;
  title: string;
  authors: string[];
  editors?: string[];
  year: number;
  pmid?: string;
  pubdate: string;
  book?: string;
  nbk?: string;
  pmcid?: string;
  corrections: { doi: string }[];
}
interface Source {
  pmid: string;
  doi: string;
  citation: string;
}

// Every citation is checked against data/reference-records.json, which
// scripts/fetch_references.py writes from PubMed, Bookshelf and Crossref. A
// citation must name the work its identifier points to: a real but wrong PMID fails.
const { records } = readRepoJson<{ records: Record<string, Work> }>('data/reference-records.json');
const clinical = readRepoYaml<ClinicalData>('data/neuropsychology.yaml');
const circuits = readRepoYaml<CircuitData>('data/circuits.yaml');
const functional = readRepoYaml<{ sources: Record<string, Source> }>(
  'config/functional-regions.yaml',
);
const domains = readRepoYaml<{ sources: Record<string, Source> }>('config/neuropsych-domains.yaml');
const bibliography = readFileSync(resolve(repoRoot, 'docs/reference/references.md'), 'utf8');

/** Case, accents and punctuation are ignored; any other difference is a different work. */
const plain = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
/** "Van Valin RD Jr" and "Van Valin" both give "van valin": PubMed abbreviates initials inconsistently. */
const surname = (author: string) => plain(author.replace(/ [A-Z]{1,4}( Jr)?$/, ''));

const bibliographyEntries = bibliography.split('\n').filter((line) => line.includes('[doi:'));

function record(key: string) {
  assert.ok(
    Object.hasOwn(records, key),
    `${key} has no fetched record; run scripts/fetch_references.py`,
  );
  return records[key];
}

/** The year convention: PubMed's journal-issue PubDate year, not the online-first year. */
function issueYear(work: Work) {
  if (work.nbk) return work.year;
  assert.equal(
    work.year,
    Number(work.pubdate.slice(0, 4)),
    `${work.pmid}: year is not the PubDate year`,
  );
  return work.year;
}

function uncorrected(work: Work, context: string) {
  assert.deepEqual(work.corrections, [], `${context} has a published correction; record it`);
}

test('clinical references name the work their PMID and DOI identify, with its PubMed issue year', () => {
  for (const reference of clinical.references) {
    const work = record(`pmid:${reference.pmid}`);
    assert.equal(reference.doi.toLowerCase(), work.doi, `${reference.id}: DOI`);
    assert.equal(plain(reference.title), plain(work.title), `${reference.id}: title`);
    assert.deepEqual(
      reference.authors.split(', ').map(surname),
      work.authors.map(surname),
      `${reference.id}: authors`,
    );
    assert.equal(reference.year, issueYear(work), `${reference.id}: year`);
    assert.deepEqual(
      (reference.corrections ?? []).map((c) => c.doi),
      work.corrections.map((c) => c.doi),
      `${reference.id}: corrections`,
    );
  }
});

test('circuit references name the article or Bookshelf chapter their identifiers resolve to', () => {
  for (const reference of circuits.references) {
    const work = record(reference.nbk ? `nbk:${reference.nbk}` : `pmid:${reference.pmid}`);
    const url = reference.nbk
      ? `https://www.ncbi.nlm.nih.gov/books/${reference.nbk}/`
      : reference.pmcid
        ? `https://pmc.ncbi.nlm.nih.gov/articles/${reference.pmcid}/`
        : `https://pubmed.ncbi.nlm.nih.gov/${reference.pmid}/`;
    assert.equal(reference.url, url, `${reference.id}: URL`);
    if (reference.pmcid) assert.equal(reference.pmcid, work.pmcid, `${reference.id}: PMCID`);
    const [authors, container, year] = reference.citation.split(' · ');
    assert.equal(plain(reference.title), plain(work.title), `${reference.id}: title`);
    assert.equal(
      surname(authors.split(/,| & | et al\./)[0]),
      surname((work.authors ?? work.editors)[0]),
      `${reference.id}: first author`,
    );
    assert.equal(Number(year), issueYear(work), `${reference.id}: year`);
    if (work.book) assert.equal(plain(container), plain(work.book), `${reference.id}: book`);
    uncorrected(work, reference.id);
  }
});

test('functional-region and domain sources cite their PMID’s DOI, title, first author and issue year', () => {
  for (const [id, source] of Object.entries({ ...functional.sources, ...domains.sources })) {
    const work = record(`pmid:${source.pmid}`);
    assert.equal(source.doi.toLowerCase(), `https://doi.org/${work.doi}`, `${id}: DOI`);
    assert.ok(plain(source.citation).includes(plain(work.title)), `${id}: title`);
    assert.ok(plain(source.citation).startsWith(plain(work.authors[0])), `${id}: first author`);
    const year = Number(source.citation.match(/\((\d{4})\)/)![1]);
    assert.equal(year, issueYear(work), `${id}: year`);
    uncorrected(work, id);
  }
});

test('the bibliography names the work each PMID and DOI identify, with its issue year', () => {
  assert.ok(bibliographyEntries.length >= 12, 'the bibliography’s DOI lines were found');
  for (const line of bibliographyEntries) {
    const [, authors, year, rest] = line.match(/^\s*(.+?) \((\d{4})\)\. (.+)$/)!;
    const [, title] = rest.match(/^(.+?)[.?] \*/)!;
    const [, doi] = line.match(/\[doi:(10\.[^\]]+)\]/)!;
    const pmid = line.match(/\bPMID (\d+)\b/)?.[1];
    assert.ok(pmid, `${doi}: references.md gives no PMID`);
    const work = record(`pmid:${pmid}`);
    assert.equal(doi.toLowerCase(), work.doi, `${pmid}: DOI`);
    assert.equal(plain(title), plain(work.title), `${pmid}: title`);
    assert.equal(
      surname(authors.split(', ')[0]),
      surname(work.authors[0]),
      `${pmid}: first author`,
    );
    assert.equal(Number(year), issueYear(work), `${pmid}: year`);
    uncorrected(work, pmid);
  }
});

test('the records file holds exactly the cited works', () => {
  const cited = new Set([
    ...clinical.references.map((reference) => `pmid:${reference.pmid}`),
    ...circuits.references.map((reference) =>
      reference.nbk ? `nbk:${reference.nbk}` : `pmid:${reference.pmid}`,
    ),
    ...Object.values(functional.sources).map((source) => `pmid:${source.pmid}`),
    ...Object.values(domains.sources).map((source) => `pmid:${source.pmid}`),
    ...bibliographyEntries.map((line) => `pmid:${line.match(/\bPMID (\d+)\b/)?.[1]}`),
  ]);
  assert.deepEqual([...cited].sort(), Object.keys(records).sort());
});
