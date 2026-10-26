export const PUBLISHED_TREES: string[];
export function publishedRecord(
  publicDirectory: string,
  path: string,
): {
  version: string;
  sha256: string;
  size: number;
  gunzipped?: { sha256: string; size: number };
};
export function publishedFiles(publicDirectory: string): Record<
  string,
  {
    version: string;
    sha256: string;
    size: number;
    gunzipped?: { sha256: string; size: number };
  }
>;
