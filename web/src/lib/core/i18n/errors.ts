import type { Notice } from '../../types/index.ts';
import { t } from './index.ts';

/** Download failures: the network's or a newer deploy's, never a link's. */
export const ASSET_CODES: ReadonlySet<unknown> = new Set(['asset-fetch', 'asset-updated']);

/** The `code` of an error that carries one (AssetError). */
const codeOf = (error: unknown): unknown =>
  typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined;

/**
 * What the reader is told about a failure, as `{ text, action }`. Asset errors
 * say what happened by their code; anything else says which operation failed.
 * `action` is 'reload' when only a reload can help. The raw error belongs in the console.
 */
export function failureNotice(
  error: unknown,
  lang: string,
  operation: string,
  subject?: string,
): Notice {
  const copy = t(lang, 'errors');
  const code = codeOf(error);
  if (code === 'asset-updated') return { text: copy.updated, action: 'reload' };
  const operations: Record<string, string | ((subject: string) => string) | undefined> =
    copy.operations;
  const said = operations[operation];
  if (said === undefined) throw new Error(`No failure text for ${operation}`);
  let text: string;
  if (typeof said === 'function') {
    if (subject === undefined) throw new Error(`${operation} failure text needs a subject`);
    text = said(subject);
  } else {
    text = said;
  }
  return { text: code === 'asset-fetch' ? `${text} ${copy.download}` : text, action: null };
}

/** The notice for link parameters that were not applied, in the order given. */
export function linkNotice(params: readonly string[], lang: string): Notice {
  const copy = t(lang, 'link');
  const fields: Record<string, string | undefined> = copy.fields;
  // A step means nothing without its circuit: naming both says "circuit" twice.
  const said = params.includes('circuit') ? params.filter((param) => param !== 'step') : params;
  const names = [...new Set(said)].map((param) => fields[param] ?? param);
  return {
    text: copy.notApplied(new Intl.ListFormat(lang, { type: 'conjunction' }).format(names)),
    action: null,
  };
}

/**
 * A failed start, worded for the reader, with its button. Anything but a
 * download failure may come from the link that opened the page, so the retry
 * then opens Planum without it (`dropLink`).
 */
export function startFailure(
  error: unknown,
  lang: string,
  linked: boolean,
): { text: string; button: string; dropLink: boolean } {
  const copy = t(lang, 'errors');
  const retry = t(lang, 'viewport').retry;
  if (ASSET_CODES.has(codeOf(error)) || !linked) {
    const { text, action } = failureNotice(error, lang, 'start');
    return { text, button: action === 'reload' ? copy.reload : retry, dropLink: false };
  }
  return { text: `${copy.operations.link} ${copy.linkRetry}`, button: retry, dropLink: true };
}
