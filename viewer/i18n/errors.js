import { t } from './translations.js';

/** Download failures: the network's or a newer deploy's, never a link's. */
export const ASSET_CODES = new Set(['asset-fetch', 'asset-updated']);

/**
 * What the reader is told about a failure, as `{ text, action }`. Asset errors
 * say what happened by their code; anything else says which operation failed.
 * `action` is 'reload' when only a reload can help. The raw error belongs in the console.
 */
export function failureNotice(error, lang, operation, subject) {
  const copy = t(lang, 'errors');
  if (error?.code === 'asset-updated') return { text: copy.updated, action: 'reload' };
  const said = copy.operations[operation];
  if (said === undefined) throw new Error(`No failure text for ${operation}`);
  const text = typeof said === 'function' ? said(subject) : said;
  return { text: error?.code === 'asset-fetch' ? `${text} ${copy.download}` : text, action: null };
}

/** The notice for link parameters that were not applied, in the order given. */
export function linkNotice(params, lang) {
  const copy = t(lang, 'link');
  // A step means nothing without its circuit: naming both says "circuit" twice.
  const said = params.includes('circuit') ? params.filter(param => param !== 'step') : params;
  const names = [...new Set(said)].map(param => copy.fields[param] ?? param);
  return { text: copy.notApplied(new Intl.ListFormat(lang, { type: 'conjunction' }).format(names)), action: null };
}

/**
 * A failed start, worded for the reader, with its button. Anything but a
 * download failure may come from the link that opened the page, so the retry
 * then opens Planum without it (`dropLink`).
 */
export function startFailure(error, lang, linked) {
  const copy = t(lang, 'errors');
  const retry = t(lang, 'viewport').retry;
  if (ASSET_CODES.has(error?.code) || !linked) {
    const { text, action } = failureNotice(error, lang, 'start');
    return { text, button: action === 'reload' ? copy.reload : retry, dropLink: false };
  }
  return { text: `${copy.operations.link} ${copy.linkRetry}`, button: retry, dropLink: true };
}
