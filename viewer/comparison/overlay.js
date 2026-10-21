import { DoubleSide, Group, MeshBasicMaterial } from 'three';

function releaseScene(scene) {
  const geometries = new Set();
  const materials = new Set();
  scene.traverse(object => {
    if (!object.isMesh) return;
    geometries.add(object.geometry);
    for (const material of [object.material].flat()) materials.add(material);
  });
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
  scene.removeFromParent();
}

function prepareMeshes(scene) {
  const meshes = new Map();
  const originals = new Set();
  scene.traverse(mesh => {
    if (!mesh.isMesh) return;
    const id = mesh.userData.overlap_id;
    if (typeof id !== 'string' || !id || meshes.has(id)) {
      throw new Error(`Missing or duplicate overlap identity: ${id}.`);
    }
    meshes.set(id, mesh);
  });
  if (!meshes.size) throw new Error('The atlas comparison has no overlap meshes.');
  for (const mesh of meshes.values()) {
    for (const material of [mesh.material].flat()) originals.add(material);
    // Only the outline mask uses this mesh; atlas colours and depth stay intact.
    mesh.material = new MeshBasicMaterial({
      side: DoubleSide, colorWrite: false, depthWrite: false,
    });
    mesh.visible = false;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
  }
  for (const material of originals) material.dispose();
  return meshes;
}

/** Exact pair intersections used by the existing outline pass, never by picking. */
export function createComparisonOverlay(loadScene) {
  const group = new Group();
  group.name = 'atlas-comparison';
  let meshes = new Map();
  let loading = null;
  let active = null;
  let request = 0;
  let disposed = false;

  function clear() {
    request++;
    active = null;
    for (const mesh of meshes.values()) mesh.visible = false;
  }

  function load() {
    if (!loading) {
      loading = loadScene().then(scene => {
        if (disposed) { releaseScene(scene); return; }
        try { meshes = prepareMeshes(scene); }
        catch (error) { releaseScene(scene); throw error; }
        group.add(scene);
      }).catch(error => {
        loading = null;
        throw error;
      });
    }
    return loading;
  }

  return {
    group,
    get outlined() {
      return active && group.visible ? [meshes.get(active)] : [];
    },
    async highlight(id) {
      if (disposed) throw new Error('The atlas comparison has been disposed.');
      const current = ++request;
      await load();
      if (disposed || request !== current) return false;
      if (!meshes.has(id)) throw new Error(`Unknown overlap: ${id}.`);
      active = id;
      for (const [key, mesh] of meshes) mesh.visible = key === id;
      return true;
    },
    clear,
    setVisible(visible) { group.visible = visible; },
    dispose() {
      disposed = true;
      clear();
      releaseScene(group);
      meshes.clear();
    },
  };
}
