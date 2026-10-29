import { DoubleSide, Group, MeshBasicMaterial } from 'three';
import type { BufferGeometry, Material, Mesh, Object3D } from 'three';

/** A mask-only mesh for one atlas pair; `userData.overlap_id` names the pair. */
export type OverlapMesh = Mesh<BufferGeometry, MeshBasicMaterial>;

const isMesh = (object: Object3D): object is Mesh => 'isMesh' in object && object.isMesh === true;

function releaseScene(scene: Object3D): void {
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  scene.traverse((object) => {
    if (!isMesh(object)) return;
    geometries.add(object.geometry);
    for (const material of [object.material].flat()) materials.add(material);
  });
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
  scene.removeFromParent();
}

function prepareMeshes(scene: Object3D): Map<string, OverlapMesh> {
  const meshes = new Map<string, OverlapMesh>();
  const originals = new Set<Material>();
  scene.traverse((mesh) => {
    if (!isMesh(mesh)) return;
    const id: unknown = mesh.userData.overlap_id;
    if (typeof id !== 'string' || !id || meshes.has(id)) {
      throw new Error(`Missing or duplicate overlap identity: ${String(id)}.`);
    }
    meshes.set(id, mesh as OverlapMesh);
  });
  if (!meshes.size) throw new Error('The atlas comparison has no overlap meshes.');
  for (const mesh of meshes.values()) {
    for (const material of [mesh.material].flat()) originals.add(material);
    // Only the outline mask uses this mesh; atlas colours and depth stay intact.
    mesh.material = new MeshBasicMaterial({
      side: DoubleSide,
      colorWrite: false,
      depthWrite: false,
    });
    mesh.visible = false;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
  }
  for (const material of originals) material.dispose();
  return meshes;
}

export interface ComparisonOverlay {
  readonly group: Group;
  /** The highlighted pair's mesh, for the outline pass; empty while cleared or hidden. */
  readonly outlined: OverlapMesh[];
  /** Resolves false when a newer request, a clear or a disposal superseded this one. */
  highlight(id: string, source?: string): Promise<boolean>;
  clear(): void;
  setVisible(visible: boolean): void;
  dispose(): void;
}

/** Exact pair intersections used by the existing outline pass, never by picking. */
export function createComparisonOverlay(loadScene: () => Promise<Object3D>): ComparisonOverlay {
  const group = new Group();
  group.name = 'atlas-comparison';
  let meshes = new Map<string, OverlapMesh>();
  let loading: Promise<void> | null = null;
  let active: string | null = null;
  let request = 0;
  let disposed = false;
  let source = '';
  let generation = 0;

  function clear() {
    request++;
    active = null;
    for (const mesh of meshes.values()) mesh.visible = false;
  }

  function load(): Promise<void> {
    if (!loading) {
      const currentGeneration = generation;
      loading = loadScene()
        .then((scene) => {
          if (disposed || currentGeneration !== generation) {
            releaseScene(scene);
            return;
          }
          try {
            meshes = prepareMeshes(scene);
          } catch (error) {
            releaseScene(scene);
            throw error;
          }
          group.add(scene);
        })
        .catch((error: unknown) => {
          if (currentGeneration === generation) loading = null;
          throw error;
        });
    }
    return loading;
  }

  return {
    group,
    get outlined() {
      return active && group.visible ? [meshes.get(active)!] : [];
    },
    async highlight(id, nextSource = '') {
      if (disposed) throw new Error('The atlas comparison has been disposed.');
      if (source !== nextSource) {
        clear();
        generation++;
        // Each release removes the scene from the group.
        while (group.children.length) releaseScene(group.children[0]!);
        meshes.clear();
        loading = null;
        source = nextSource;
      }
      const current = ++request;
      await load();
      if (disposed || request !== current) return false;
      if (!meshes.has(id)) throw new Error(`Unknown overlap: ${id}.`);
      active = id;
      for (const [key, mesh] of meshes) mesh.visible = key === id;
      return true;
    },
    clear,
    setVisible(visible) {
      group.visible = visible;
    },
    dispose() {
      disposed = true;
      clear();
      releaseScene(group);
      meshes.clear();
    },
  };
}
