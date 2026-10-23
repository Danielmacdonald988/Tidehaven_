import * as THREE from "three";
import type { Collider } from "./contracts";

/** Current palms use animated BufferGeometry, not the legacy ShapeGeometry. */
export function isForegroundPalm(
  mesh: THREE.Mesh,
  colliders: Collider[],
): boolean {
  if (mesh instanceof THREE.InstancedMesh || mesh.position.y <= 4) return false;
  return colliders.some(
    (collider) =>
      collider.id === "palm" &&
      Math.abs(mesh.position.x - (collider.minX + collider.maxX) / 2) <= 0.6 &&
      Math.abs(mesh.position.z - (collider.minZ + collider.maxZ) / 2) <= 0.6,
  );
}

/** Five rays protect the body silhouette without sweeping unrelated scenery. */
export const OCCLUSION_SILHOUETTE = [
  [0, -0.6],
  [0, 0],
  [0, 0.7],
  [-0.55, 0],
  [0.55, 0],
] as const;

/** Brief hysteresis bridges gaps between wind-blown leaflets; no camera movement. */
export function retainOcclusionHits(
  holds: Map<string, number>,
  hits: ReadonlySet<string>,
  time: number,
) {
  for (const key of hits) holds.set(key, time + 0.2);
  for (const [key, until] of holds) if (until < time) holds.delete(key);
}
