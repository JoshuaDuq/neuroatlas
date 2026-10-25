const normalize = value => value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/** Edits (insertions, deletions, substitutions, adjacent swaps) between two words. */
function editDistance(a, b) {
  const rows = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j += 1) rows[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
    }
  }
  return rows[a.length][b.length];
}

/**
 * The name a query that matched nothing most likely misspells: the closest within one edit per four
 * letters, a tie going to the earlier name; null for a query under four letters or nothing that close.
 */
export function nearest(query, names) {
  const typed = normalize(query);
  if (typed.length < 4) return null;
  let best = null;
  let bestDistance = Math.floor(typed.length / 4) + 1;
  for (const name of names) {
    const distance = editDistance(typed, normalize(name));
    if (distance < bestDistance) {
      best = name;
      bestDistance = distance;
    }
  }
  return best;
}
