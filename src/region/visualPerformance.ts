import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export interface StaticBatchResult {
  sourceMeshes: number;
  batches: number;
  /** Only merged geometries are owned here. Existing source assets remain caller-owned. */
  dispose(): void;
}

/** Opt-in sibling batching: never flattens a roof, door, vehicle or wind pivot.
 * Set visualStatic on individual immutable meshes, or supply a reviewed predicate.
 * Small spatial cells preserve useful frustum culling in the connected region.
 * Run once at construction, before material cloning or collecting raycast handles.
 */
export function batchStaticVisuals(
  root: THREE.Object3D,
  eligible: (mesh: THREE.Mesh) => boolean = (mesh) =>
    mesh.userData.visualStatic === true,
  cellSize = 12,
): StaticBatchResult {
  if (!(cellSize > 0 && Number.isFinite(cellSize)))
    throw new Error("Invalid visual batch cell size");
  const owned: THREE.BufferGeometry[] = [];
  let sourceMeshes = 0;
  let batches = 0;
  function visit(parent: THREE.Object3D) {
    for (const child of [...parent.children])
      if (child.children.length) visit(child);
    const groups = new Map<string, THREE.Mesh[]>();
    for (const object of parent.children) {
      if (
        !(object instanceof THREE.Mesh) ||
        object instanceof THREE.InstancedMesh ||
        object instanceof THREE.SkinnedMesh ||
        object.children.length ||
        !object.visible ||
        !eligible(object)
      )
        continue;
      if (
        Array.isArray(object.material) ||
        object.material.transparent ||
        object.material.opacity < 1 ||
        Object.keys(object.geometry.morphAttributes).length ||
        object.morphTargetInfluences ||
        object.geometry.drawRange.start !== 0 ||
        object.geometry.drawRange.count !== Infinity ||
        object.onBeforeRender !== THREE.Object3D.prototype.onBeforeRender
      )
        continue;
      object.updateMatrix();
      // Mirrored geometry requires winding correction, so retain the original mesh.
      if (object.matrix.determinant() <= 0) continue;
      let metadata: string;
      try {
        metadata = JSON.stringify(object.userData);
      } catch {
        continue;
      }
      const attrs = Object.entries(
        object.geometry.attributes as Record<
          string,
          THREE.BufferAttribute | THREE.InterleavedBufferAttribute
        >,
      )
        .map(
          ([key, attribute]) =>
            `${key}:${attribute.itemSize}:${attribute.normalized}:${attribute.array.constructor.name}`,
        )
        .sort()
        .join("|");
      const key = [
        object.material.uuid,
        object.name,
        object.castShadow,
        object.receiveShadow,
        object.renderOrder,
        object.layers.mask,
        object.frustumCulled,
        metadata,
        attrs,
        Math.floor(object.position.x / cellSize),
        Math.floor(object.position.z / cellSize),
      ].join(";");
      const pieces = groups.get(key) || [];
      pieces.push(object);
      groups.set(key, pieces);
    }
    for (const pieces of groups.values()) {
      if (pieces.length < 2) continue;
      const copies = pieces.map((piece) => {
        const copy = piece.geometry.index
          ? piece.geometry.toNonIndexed()
          : piece.geometry.clone();
        return copy.applyMatrix4(piece.matrix);
      });
      const merged = mergeGeometries(copies, false);
      copies.forEach((copy) => copy.dispose());
      if (!merged) continue;
      merged.computeBoundingBox();
      merged.computeBoundingSphere();
      const original = pieces[0];
      const mesh = new THREE.Mesh(merged, original.material);
      mesh.name = original.name;
      mesh.castShadow = original.castShadow;
      mesh.receiveShadow = original.receiveShadow;
      mesh.renderOrder = original.renderOrder;
      mesh.layers.mask = original.layers.mask;
      mesh.frustumCulled = original.frustumCulled;
      mesh.userData = { ...original.userData };
      parent.add(mesh);
      pieces.forEach((piece) => parent.remove(piece));
      sourceMeshes += pieces.length;
      batches++;
      owned.push(merged);
    }
  }
  visit(root);
  return {
    sourceMeshes,
    batches,
    dispose() {
      owned.forEach((geometry) => geometry.dispose());
      owned.length = 0;
    },
  };
}

/** Raw presentation frame intervals, separate from simulation's clamped timestep. */
export function summarizeFrameTimes(samples: readonly number[]) {
  const valid = samples.filter((value) => Number.isFinite(value) && value > 0);
  if (!valid.length) return { fps: 0, meanMs: 0, p95Ms: 0, p99Ms: 0 };
  const sorted = [...valid].sort((a, b) => a - b);
  const meanMs = valid.reduce((sum, value) => sum + value, 0) / valid.length;
  const percentile = (p: number) =>
    sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)];
  return {
    fps: 1000 / meanMs,
    meanMs,
    p95Ms: percentile(0.95),
    p99Ms: percentile(0.99),
  };
}
