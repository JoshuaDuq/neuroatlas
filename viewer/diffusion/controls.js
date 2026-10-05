export function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined && text !== null) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function download(url, filename) {
  const link = element('a');
  link.href = url; link.download = filename;
  link.click();
}

const SIDES = ['left', 'right'];

/** One row per tract: a bundle's left and right files pair up, numbered segments share a row. */
export function tractRows(bundles) {
  const rows = new Map();
  for (const bundle of bundles) {
    const match = bundle.id.match(/^(.+)-(left|right|\d+)$/);
    if (!match) throw new Error(`Tract bundle ${bundle.id} names neither a side nor a segment.`);
    const [, key, part] = match;
    if (!rows.has(key)) rows.set(key, { key, sided: SIDES.includes(part), members: [] });
    const row = rows.get(key);
    if (row.sided !== SIDES.includes(part)) throw new Error(`Tract ${key} mixes sides and segments.`);
    row.members.push({ bundle, part });
  }
  for (const row of rows.values()) {
    if (row.sided) row.members.sort((a, b) => SIDES.indexOf(a.part) - SIDES.indexOf(b.part));
  }
  return [...rows.values()];
}

/** What the members' names share: the tract before " · side", or before the segment number. */
export function tractRowName(row, lang) {
  const stems = row.members.map(({ bundle }) => {
    const name = bundle.name[lang];
    const cut = name.lastIndexOf(' · ');
    if (cut < 0) throw new Error(`Tract name "${name}" has no qualifier.`);
    return row.sided ? name.slice(0, cut) : name.replace(/\s*\d+$/, '');
  });
  if (new Set(stems).size !== 1) throw new Error(`Tract ${row.key} members disagree on a name: ${stems.join(' / ')}`);
  return stems[0];
}

export function tractRow(row, onVisible) {
  const section = element('section', null, 'diffusion-bundle');
  section.dataset.layout = row.members.length > 2 ? 'segments' : 'sides';
  const head = element('div', null, 'diffusion-bundle-head');
  const name = element('span', null, 'diffusion-bundle-name');
  name.id = `native-tract-row-${row.key}`;
  const parts = element('span', null, 'diffusion-bundle-parts');
  parts.setAttribute('role', 'group');
  parts.setAttribute('aria-labelledby', name.id);
  const metrics = element('div', null, 'diffusion-bundle-metrics');
  for (const { bundle } of row.members) {
    const check = element('input');
    check.id = `native-diffusion-bundle-${bundle.id}`;
    check.type = 'checkbox';
    check.addEventListener('change', () => onVisible(bundle.id, check.checked));
    // The count and lengths describe the checkbox, so they are read after its name.
    const meta = element('p', null, 'diffusion-bundle-meta');
    meta.id = `${check.id}-meta`;
    check.setAttribute('aria-describedby', meta.id);
    const values = element('span', null, 'diffusion-bundle-values');
    values.append(element('span', null, 'diffusion-bundle-count'), ' ',
      element('span', null, 'diffusion-bundle-length'));
    const glyph = element('span', null, 'diffusion-bundle-side');
    glyph.setAttribute('aria-hidden', 'true');
    meta.append(glyph, values);
    const toggle = element('label', null, 'diffusion-part');
    const letter = element('span');
    letter.setAttribute('aria-hidden', 'true');
    toggle.append(check, letter);
    parts.append(toggle);
    metrics.append(meta);
  }
  head.append(name, parts);
  section.append(head, metrics);
  return section;
}

/** Each part's toggle is named in full; the metrics line shows only for a side that is drawn. */
export function updateTractRow(section, row, { lang, loaded, glyphs, text }) {
  section.querySelector('.diffusion-bundle-name').textContent = tractRowName(row, lang);
  let anyVisible = false;
  for (const { bundle, part } of row.members) {
    const metrics = loaded.get(bundle.id);
    const visible = Boolean(metrics?.visible);
    anyVisible ||= visible;
    const check = section.querySelector(`#native-diffusion-bundle-${bundle.id}`);
    const glyph = row.sided ? glyphs[part] : part;
    check.checked = visible;
    check.setAttribute('aria-label', bundle.name[lang]);
    check.nextElementSibling.textContent = glyph;
    check.parentElement.title = bundle.name[lang];
    const meta = section.querySelector(`#native-diffusion-bundle-${bundle.id}-meta`);
    meta.dataset.loaded = String(Boolean(metrics));
    meta.classList.toggle('visually-hidden', !visible);
    meta.querySelector('.diffusion-bundle-side').textContent = glyph;
    const count = meta.querySelector('.diffusion-bundle-count');
    const length = meta.querySelector('.diffusion-bundle-length');
    if (!metrics) {
      count.textContent = text.loadHint;
      length.replaceChildren();
      continue;
    }
    count.textContent = text.streamlines(visible ? metrics.shown : metrics.total, metrics.total);
    // One span per measurement, so a wrapped line breaks between them and never inside one.
    const parts = metrics.shown && visible
      ? [`${text.mean} ${metrics.mean.toFixed(1)} mm`,
        `${text.range} ${metrics.min.toFixed(1)}–${metrics.max.toFixed(1)} mm`]
      : visible ? [text.noShown] : [];
    length.replaceChildren(...parts.flatMap((value, index) => [...(index ? [' '] : []), element('span', value)]));
  }
  section.dataset.visible = String(anyVisible);
  section.dataset.name = [tractRowName(row, lang), ...row.members.map(({ bundle }) => bundle.name[lang])]
    .join(' ').toLocaleLowerCase(lang);
}

export function saveLengths(bundles, minimum) {
  const quote = value => `"${String(value).replace(/"/g, '""')}"`;
  const rows = ['bundle,total_streamlines,enabled_streamlines,minimum_length_mm,mean_length_mm,min_length_mm,max_length_mm'];
  for (const bundle of bundles) {
    const name = /^[=+\-@]/.test(bundle.name) ? `'${bundle.name}` : bundle.name;
    const shown = bundle.visible ? bundle.shown : 0;
    rows.push([quote(name), bundle.total, shown, minimum,
      ...[bundle.mean, bundle.min, bundle.max].map(value => shown ? value : '')].join(','));
  }
  const url = URL.createObjectURL(new Blob([`${rows.join('\n')}\n`], { type: 'text/csv;charset=utf-8' }));
  download(url, 'neuroatlas-streamline-lengths.csv');
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
