import type { Language } from '../../types/index.ts';

export type Translated = Readonly<Record<Language, string>>;

export interface ClinicalGroup {
  id: string;
  name: Translated;
}

export interface ClinicalDeficit {
  id: string;
  name: Translated;
  group: string;
  domain: Translated;
  summary: Translated;
  aliases: Readonly<Record<Language, readonly string[]>>;
}

export interface ClinicalCorrection {
  doi: string;
  summary: Translated;
}

export interface ClinicalReference {
  id: string;
  title: string;
  authors: string;
  year: number;
  journal: string;
  doi: string;
  pmid: string;
  method: 'lesion-mapping' | 'meta-analysis' | 'case-report' | 'case-series';
  scope: 'abstract' | 'full-text';
  population: Translated;
  corrections?: readonly ClinicalCorrection[];
}

export interface ClinicalMapping {
  region: string;
  source_name: string;
}

export interface ClinicalEvidence {
  reference: string;
  role: 'supporting' | 'qualifying';
}

export interface ClinicalAssociation {
  id: string;
  deficit: string;
  title: Translated;
  finding: Translated;
  limitation: Translated;
  network: Translated;
  mapping_note: Translated;
  laterality: 'left' | 'right' | 'bilateral';
  evidence: readonly ClinicalEvidence[];
  mappings: readonly ClinicalMapping[];
}

/** `data/neuropsychology.yaml`, as authored. */
export interface ClinicalData {
  revised: string;
  groups: readonly ClinicalGroup[];
  deficits: readonly ClinicalDeficit[];
  references: readonly ClinicalReference[];
  associations: readonly ClinicalAssociation[];
}
