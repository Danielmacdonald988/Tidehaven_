import type { World } from "../contracts";
import type { ResidentState, Point, Collider } from "./contracts";
import { REGION_BOUNDS, REGION_SITES } from "./contracts";
import { findPath, clearSegment } from "../three/navigation";
const anchors: Point[] = [
  { x: 8, z: 11 },
  REGION_SITES.market,
  REGION_SITES.rescue,
  { x: -18, z: 9 },
  { x: -67, z: 16 },
  REGION_SITES.dispatch,
  { x: -64, z: 23 },
  { x: 65, z: 24 },
  { x: 11, z: 21 },
  { x: -20, z: 24 },
  { x: 78, z: 22 },
  { x: -72, z: 19 },
];
export function createPopulation(w: World): ResidentState[] {
  return w.characters.map((c, i) => ({
    id: c.id,
    position: { ...anchors[i % anchors.length] },
    home: { ...anchors[i % anchors.length] },
    destination: { ...anchors[i % anchors.length] },
    path: [],
    pause: 5 + i,
    routine: 0,
  }));
}
export function walkPath(
  position: Point,
  path: Point[],
  distance: number,
  colliders: Collider[],
) {
  let p = position,
    remaining = path;
  while (remaining.length && distance > 0) {
    const goal = remaining[0],
      d = Math.hypot(goal.x - p.x, goal.z - p.z),
      next =
        d <= distance
          ? goal
          : {
              x: p.x + ((goal.x - p.x) * distance) / d,
              z: p.z + ((goal.z - p.z) * distance) / d,
            };
    if (!clearSegment(p, next, colliders, REGION_BOUNDS))
      return { position: p, path: [] };
    p = next;
    if (d <= distance) {
      remaining = remaining.slice(1);
      distance -= d;
    } else break;
  }
  return { position: p, path: remaining };
}
export function tickPopulation(
  residents: ResidentState[],
  dt: number,
  colliders: Collider[],
): ResidentState[] {
  return residents.map((r) => {
    if (["inez", "eli", "sam", "jo"].includes(r.id)) return r;
    const next = { ...r };
    if (next.pause > 0) {
      next.pause = Math.max(0, next.pause - dt);
      return next;
    }
    if (!next.path.length) {
      next.routine++;
      next.destination =
        next.routine % 2
          ? { x: next.home.x + 3, z: next.home.z - 2 }
          : { ...next.home };
      next.path = findPath(
        next.position,
        next.destination,
        colliders,
        REGION_BOUNDS,
      );
      if (!next.path.length) {
        next.pause = 12;
        return next;
      }
    }
    Object.assign(
      next,
      walkPath(next.position, next.path, dt * 1.1, colliders),
    );
    if (!next.path.length) next.pause = 8 + (next.routine % 3) * 4;
    return next;
  });
}
