import type { Collider, Point } from "../three/shared";
import { clearSegment, findPath, isWalkable } from "../three/navigation";
/** Choose an approach point the explorer can reach and greet from, including around doorways. */
export function findCreatureApproach(
  player: Point,
  target: Point,
  colliders: Collider[],
): Point | null {
  if (
    !Number.isFinite(player.x) ||
    !Number.isFinite(player.z) ||
    !Number.isFinite(target.x) ||
    !Number.isFinite(target.z)
  )
    return null;
  if (
    !isWalkable(target, colliders) ||
    !findPath(player, target, colliders).length
  )
    return null;
  const angle = Math.atan2(player.z - target.z, player.x - target.x);
  let best: Point | null = null,
    bestDistance = Infinity;
  // A full ring avoids choosing a point on the far side of a wall merely because
  // it is close in straight-line distance. Smaller rings fit constrained habitats.
  for (const radius of [3.1, 2.5, 1.9])
    for (let i = 0; i < 24; i++) {
      const offset =
        i === 0 ? 0 : (Math.ceil(i / 2) * (i % 2 ? 1 : -1) * Math.PI) / 12;
      const candidate = {
        x: target.x + Math.cos(angle + offset) * radius,
        z: target.z + Math.sin(angle + offset) * radius,
      };
      if (
        Math.hypot(candidate.x - player.x, candidate.z - player.z) +
          (3.1 - radius) * 0.2 >=
        bestDistance
      )
        continue;
      if (
        !isWalkable(candidate, colliders) ||
        !clearSegment(candidate, target, colliders)
      )
        continue;
      const path = findPath(player, candidate, colliders);
      if (!path.length) continue;
      let length = 0,
        previous = player;
      for (const p of path) {
        length += Math.hypot(p.x - previous.x, p.z - previous.z);
        previous = p;
      }
      // A mild preference for breathing room when route lengths are almost equal.
      const score = length + (3.1 - radius) * 0.2;
      if (score < bestDistance) {
        bestDistance = score;
        best = candidate;
      }
    }
  return best;
}
