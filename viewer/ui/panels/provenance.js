import { t } from '../../i18n/translations.js';
import { domainName } from '../../catalog/neuropsych-domains.js';
import { percent } from '../format.js';

/** A URL as a reader scans it: no scheme, no trailing slash. */
export const shortUrl = url => String(url).replace(/^https?:\/\//, '').replace(/\/$/, '');

const link = href => (href ? { href, text: shortUrl(href) } : null);

/** How much of each lesion-mapped parcel a domain's coloured areas cover, as one note. */
function lesionCheck(checks, lang) {
  const copy = t(lang, 'domains');
  if (!checks.length) return copy.noLesionCheck;
  return copy.lesionCheck(checks.map(check => copy.lesionItem(
    check.deficit_name[lang], check.references.join(', '),
    check.mappings.map(mapping => {
      // Bilateral findings name one parcel twice; the side tells them apart.
      const parcel = `${mapping.source_name} (${t(lang, 'sides').glyphs[mapping.region.split(':')[1]]})`;
      return mapping.coverage === null ? copy.parcelOffSurface(parcel)
        : copy.parcelCoverage(parcel, percent(mapping.coverage, lang));
    }).join(', '),
  )));
}

/**
 * What the loaded anatomy's own published records say about where it came from,
 * as labelled rows. Only fields present in the index entry and manifest appear.
 */
export function provenanceRows(manifest, { lang = 'en', manifestUrl, indexUrl, domains = null } = {}) {
  const copy = t(lang, 'footer');
  const names = t(lang, 'atlases');
  const anatomy = manifest.anatomy ?? {};
  const rows = [];
  const add = (label, items) => {
    const kept = items.filter(Boolean);
    if (kept.length) rows.push({ label, items: kept });
  };

  add(copy.subject, [anatomy.display_name && {
    text: anatomy.display_name,
    note: typeof anatomy.individual === 'boolean' ? copy.kind(anatomy.individual) : null,
  }]);
  add(copy.sourceData, [anatomy.source_url && { link: link(anatomy.source_url) }]);
  add(copy.reconstruction, [anatomy.reconstruction && { text: anatomy.reconstruction, mono: true }]);
  // A licence the manifest publishes beside its own directory; the href resolves `..` when followed.
  const licence = file => file && manifestUrl && {
    link: { href: manifestUrl.replace(/[^/]*$/, '') + file, text: file.split('/').pop(), mono: true },
  };
  add(copy.atlases, (manifest.atlases ?? []).flatMap(atlas => [{
    text: names[atlas.id] ?? atlas.label,
    note: atlas.id === 'hcp-mmp' && anatomy.hcp_projected_from
      ? copy.projectedFrom(anatomy.hcp_projected_from) : null,
    link: link(atlas.citation),
  }, licence(atlas.license_file)]));
  const { networks, cab_np: cabNp } = manifest;
  add(copy.networks, [
    networks?.label && { text: networks.label, link: link(networks.citation) },
    cabNp && { text: cabNp.label, note: cabNp.license, link: link(cabNp.citation) },
    cabNp && licence(cabNp.license_file),
  ]);
  const functional = manifest.functional_regions;
  add(copy.functional, functional ? [
    { text: functional.label },
    ...functional.citations.map(citation => ({ link: link(citation) })),
  ] : []);
  const domainCopy = t(lang, 'domains');
  add(copy.domains, manifest.neuropsych_domains ? [
    {
      text: manifest.neuropsych_domains.label, note: manifest.neuropsych_domains.license,
      link: link(manifest.neuropsych_domains.license_url),
    },
    ...manifest.neuropsych_domains.citations.map(citation => ({ link: link(citation) })),
    // Each domain's term, and how much of each lesion-mapped parcel its coloured areas cover.
    ...(domains?.domains ?? []).map(domain => ({
      text: domainCopy.termOf(domainName(domain, lang), domain.term),
      note: lesionCheck(domains.lesion_checks[domain.id], lang),
    })),
  ] : []);
  add(copy.supplemental, (manifest.supplemental_layers ?? []).map(layer => ({
    text: names[layer.id] ?? layer.label,
    note: [layer.license, layer.attribution].filter(Boolean).join(' · ') || null,
    link: link(layer.citation),
  })));

  const sources = manifest.provenance?.sources ?? [];
  const checksummed = sources.filter(source => source.sha256).length;
  add(copy.files, [
    manifestUrl && {
      link: { href: manifestUrl, text: 'manifest.json', mono: true },
      note: sources.length ? copy.sourceFiles(sources.length, checksummed === sources.length) : null,
    },
    indexUrl && { link: { href: indexUrl, text: 'anatomies.json', mono: true }, note: copy.index },
  ]);
  return rows;
}

/** The tract reference is another subject: its rows come from the tract panel's own links. */
export function referenceRows(reference, lang = 'en') {
  const copy = t(lang, 'footer');
  return [
    { label: copy.tractReference, items: [{ text: reference.label }] },
    ...(reference.links.length ? [{ label: copy.sources, items: reference.links.map(entry => ({ link: entry })) }] : []),
  ];
}

function renderItem(item) {
  const node = document.createElement('div');
  node.className = 'provenance-item';
  const text = item.text && document.createElement('p');
  if (text) {
    text.className = item.mono ? 'provenance-value code' : 'provenance-value';
    text.textContent = item.text;
  }
  const note = item.note && document.createElement('p');
  if (note) {
    note.className = 'provenance-note';
    note.textContent = item.note;
  }
  const anchor = item.link && document.createElement('a');
  if (anchor) {
    anchor.className = item.link.mono ? 'provenance-link code' : 'provenance-link';
    anchor.href = item.link.href;
    anchor.target = '_blank';
    anchor.rel = 'noreferrer';
    anchor.textContent = item.link.text;
  }
  // A bare link is the item's name; beside a name it is the citation under it.
  node.append(...(text ? [text, note, anchor] : [anchor, note]).filter(Boolean));
  return node;
}

/** The provenance sheet: a native modal dialog opened from the status bar or, on phones, the settings menu. */
export function createProvenance({ manifest, manifestUrl, indexUrl, domains, fallbackFocus }) {
  const dialog = document.getElementById('provenance-dialog');
  const title = document.getElementById('provenance-title');
  const close = document.getElementById('provenance-close');
  const facts = document.getElementById('provenance-facts');
  const use = document.getElementById('provenance-use');
  const openers = [...document.querySelectorAll('[data-opens-provenance]')];
  let lang = 'en';
  let reference = null;
  let opener = null;

  function render() {
    const copy = t(lang, 'footer');
    title.textContent = copy.provenance;
    close.textContent = copy.close;
    use.textContent = copy.intendedUse;
    const rows = reference ? referenceRows(reference, lang) : provenanceRows(manifest, { lang, manifestUrl, indexUrl, domains });
    facts.replaceChildren(...rows.flatMap(row => {
      const dt = document.createElement('dt');
      dt.textContent = row.label;
      const dd = document.createElement('dd');
      dd.append(...row.items.map(renderItem));
      return [dt, dd];
    }));
  }

  const show = () => {
    if (dialog.open) return;
    opener = document.activeElement;
    render();
    dialog.showModal();
  };
  const hide = () => dialog.close();
  // The page's own keys (Escape clears the selection, letters change the view) stay out of the dialog.
  const onKeyDown = event => event.stopPropagation();
  const onClose = () => {
    const returned = opener?.isConnected && opener.checkVisibility?.() !== false;
    opener = null;
    if (!returned) fallbackFocus?.focus();
  };

  for (const button of openers) {
    button.addEventListener('click', show);
    button.hidden = false;
  }
  close.addEventListener('click', hide);
  dialog.addEventListener('keydown', onKeyDown);
  dialog.addEventListener('close', onClose);

  return {
    update(nextLang, nextReference) {
      const changed = nextLang !== lang || nextReference?.label !== reference?.label;
      lang = nextLang;
      reference = nextReference;
      for (const button of openers) button.textContent = t(lang, 'footer').provenance;
      if (changed && dialog.open) render();
    },
    dispose() {
      for (const button of openers) button.removeEventListener('click', show);
      close.removeEventListener('click', hide);
      dialog.removeEventListener('keydown', onKeyDown);
      dialog.removeEventListener('close', onClose);
    },
  };
}
