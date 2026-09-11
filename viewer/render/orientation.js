/**
 * Anatomical direction letters for the four viewport edges.
 *
 * The manifest's coordinate system is x = right, y = superior, z = posterior,
 * so each signed world axis names one anatomical direction. An edge is
 * labelled with the direction a viewer moves toward as they travel to it,
 * which is the convention every medical imaging viewer uses.
 *
 * Deriving the letters from the camera's own basis, rather than tabulating
 * them per named view, means a freely orbited camera stays correct and there
 * is no table to fall out of step with the view presets.
 */
const AXES = [
  { letter: 'R', axis: 0, sign: 1 },
  { letter: 'L', axis: 0, sign: -1 },
  { letter: 'S', axis: 1, sign: 1 },
  { letter: 'I', axis: 1, sign: -1 },
  { letter: 'P', axis: 2, sign: 1 },
  { letter: 'A', axis: 2, sign: -1 },
];

const OPPOSITE = { R: 'L', L: 'R', S: 'I', I: 'S', P: 'A', A: 'P' };

/** The world-space basis vector of a camera column, from its world matrix. */
function basis(camera, column) {
  const m = camera.matrixWorld.elements;
  const offset = column * 4;
  const [x, y, z] = [m[offset], m[offset + 1], m[offset + 2]];
  const length = Math.hypot(x, y, z) || 1;
  return [x / length, y / length, z / length];
}

/** The anatomical letter for the axis most closely aligned with a direction. */
function letterFor([x, y, z]) {
  const components = [x, y, z];
  let best = AXES[0];
  let bestDot = -Infinity;
  for (const candidate of AXES) {
    const dot = components[candidate.axis] * candidate.sign;
    if (dot > bestDot) {
      bestDot = dot;
      best = candidate;
    }
  }
  return best.letter;
}

const FR_LETTERS = { R: 'D', L: 'G', S: 'S', I: 'I', P: 'P', A: 'A' };

export function edgeLabels(camera, lang = 'en') {
  const right = letterFor(basis(camera, 0));
  const top = letterFor(basis(camera, 1));
  const raw = { right, left: OPPOSITE[right], top, bottom: OPPOSITE[top] };
  if (lang === 'fr') {
    return {
      right: FR_LETTERS[raw.right],
      left: FR_LETTERS[raw.left],
      top: FR_LETTERS[raw.top],
      bottom: FR_LETTERS[raw.bottom],
    };
  }
  return raw;
}
