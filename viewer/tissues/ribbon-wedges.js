import { BufferAttribute, BufferGeometry } from 'three';

/** The most common label on a triangle; the lowest wins a tie, as the build does. */
function owner(labels, a, b, c) {
  if (labels[a] === labels[b] || labels[a] === labels[c]) return labels[a];
  if (labels[b] === labels[c]) return labels[b];
  return Math.min(labels[a], labels[b], labels[c]);
}

/**
 * One closed solid per parcel: its pial patch, its white patch reversed, and a
 * wall joining the two along the patch boundary.
 *
 * A wall triangle has to traverse its shared edge opposite to the patch that
 * owns it. Mirror the two wall triangles and every wedge comes out winding
 * inconsistent, which the stencil counts as a hole rather than a solid.
 */
function wedge(triangles, pial, white) {
  const local = new Map();
  const patch = new Uint32Array(triangles.length);
  for (const [at, source] of triangles.entries()) {
    let index = local.get(source);
    if (index === undefined) local.set(source, (index = local.size));
    patch[at] = index;
  }

  const count = local.size;
  const position = new Float32Array(count * 6);
  for (const [source, index] of local) {
    for (let axis = 0; axis < 3; axis++) {
      position[index * 3 + axis] = pial[source * 3 + axis];
      position[(count + index) * 3 + axis] = white[source * 3 + axis];
    }
  }

  const directed = new Set();
  for (let i = 0; i < patch.length; i += 3) {
    directed.add(patch[i] * count + patch[i + 1]);
    directed.add(patch[i + 1] * count + patch[i + 2]);
    directed.add(patch[i + 2] * count + patch[i]);
  }

  const index = [];
  for (let i = 0; i < patch.length; i += 3) {
    const [a, b, c] = [patch[i], patch[i + 1], patch[i + 2]];
    index.push(a, b, c, c + count, b + count, a + count);
    for (const [start, end] of [[a, b], [b, c], [c, a]]) {
      if (directed.has(end * count + start)) continue;
      index.push(end, start, start + count, end, start + count, end + count);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(position, 3));
  geometry.setIndex(index);
  geometry.computeBoundingBox();
  return geometry;
}

/**
 * Close the cortical ribbon into one solid per parcel.
 *
 * Pial and white share triangles and vertex indexing, so a patch taken from one
 * is the same patch on the other and the wall is a quad per boundary edge. The
 * parcel boundary is therefore geometry, not a sampled 1 mm grid.
 */
export function buildRibbonWedges({ faces, pial, white, labels }) {
  if (pial.length !== white.length || pial.length !== labels.length * 3) {
    throw new Error('Ribbon surfaces must share one labelled vertex set.');
  }
  const parcels = new Map();
  for (let i = 0; i < faces.length; i += 3) {
    const label = owner(labels, faces[i], faces[i + 1], faces[i + 2]);
    let triangles = parcels.get(label);
    if (!triangles) parcels.set(label, (triangles = []));
    triangles.push(faces[i], faces[i + 1], faces[i + 2]);
  }
  return new Map(
    [...parcels].map(([label, triangles]) => [label, wedge(triangles, pial, white)]),
  );
}
