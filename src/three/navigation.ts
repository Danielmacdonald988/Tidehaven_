import { BOUNDS, type Point, type Collider } from "./shared";
export const PLAYER_RADIUS = 0.38;
export function isWalkable(
  p: Point,
  colliders: Collider[],
  radius = PLAYER_RADIUS,
): boolean {
  return (
    Number.isFinite(p.x) &&
    Number.isFinite(p.z) &&
    p.x >= BOUNDS.minX + radius &&
    p.x <= BOUNDS.maxX - radius &&
    p.z >= BOUNDS.minZ + radius &&
    p.z <= BOUNDS.maxZ - radius &&
    !colliders.some(
      (c) =>
        p.x > c.minX - radius &&
        p.x < c.maxX + radius &&
        p.z > c.minZ - radius &&
        p.z < c.maxZ + radius,
    )
  );
}
export function clearSegment(
  a: Point,
  b: Point,
  colliders: Collider[],
): boolean {
  if (!isWalkable(b, colliders)) return false;
  const dx = b.x - a.x,
    dz = b.z - a.z;
  for (const c of colliders) {
    let lo = 0,
      hi = 1;
    const bounds = [
      [a.x, dx, c.minX - PLAYER_RADIUS, c.maxX + PLAYER_RADIUS],
      [a.z, dz, c.minZ - PLAYER_RADIUS, c.maxZ + PLAYER_RADIUS],
    ];
    let intersects = true;
    for (const [start, delta, min, max] of bounds) {
      if (Math.abs(delta) < 1e-9) {
        if (start <= min || start >= max) {
          intersects = false;
          break;
        }
      } else {
        const t1 = (min - start) / delta,
          t2 = (max - start) / delta;
        lo = Math.max(lo, Math.min(t1, t2));
        hi = Math.min(hi, Math.max(t1, t2));
        if (lo >= hi) {
          intersects = false;
          break;
        }
      }
    }
    if (intersects && hi > 1e-7 && lo < 1) return false;
  }
  return true;
}
/** Small fixed-grid A*: deterministic, collision-inflated, diagonal corner-safe. */
export function findPath(
  start: Point,
  goal: Point,
  colliders: Collider[],
): Point[] {
  const size = 0.7,
    ox = BOUNDS.minX,
    oz = BOUNDS.minZ;
  const key = (x: number, z: number) => `${x},${z}`;
  const pos = (x: number, z: number): Point => ({
    x: ox + x * size,
    z: oz + z * size,
  });
  const cell = (p: Point) => [
    Math.round((p.x - ox) / size),
    Math.round((p.z - oz) / size),
  ];
  if (!isWalkable(goal, colliders)) {
    let best: Point | undefined;
    let d = Infinity;
    for (let r = 1; r <= 7 && !best; r++)
      for (let i = 0; i < 24; i++) {
        const p = {
          x: goal.x + Math.sin((i * Math.PI) / 12) * r * 0.5,
          z: goal.z + Math.cos((i * Math.PI) / 12) * r * 0.5,
        };
        const v = Math.hypot(p.x - start.x, p.z - start.z);
        if (isWalkable(p, colliders) && v < d) {
          best = p;
          d = v;
        }
      }
    if (!best) return [];
    goal = best;
  }
  if (clearSegment(start, goal, colliders)) return [goal];
  let [sx, sz] = cell(start);
  const [gx, gz] = cell(goal);
  let bestStart = Infinity;
  const originalX = sx,
    originalZ = sz;
  for (let dx = -2; dx <= 2; dx++)
    for (let dz = -2; dz <= 2; dz++) {
      const candidate = pos(originalX + dx, originalZ + dz);
      const d = Math.hypot(candidate.x - start.x, candidate.z - start.z);
      if (
        d < bestStart &&
        isWalkable(candidate, colliders) &&
        clearSegment(start, candidate, colliders)
      ) {
        sx = originalX + dx;
        sz = originalZ + dz;
        bestStart = d;
      }
    }
  if (!Number.isFinite(bestStart)) return [];
  const open: { x: number; z: number; g: number; f: number }[] = [
      { x: sx, z: sz, g: 0, f: 0 },
    ],
    cost = new Map<string, number>([[key(sx, sz), 0]]),
    parent = new Map<string, string>(),
    closed = new Set<string>();
  let end = "";
  for (let iterations = 0; open.length && iterations < 14000; iterations++) {
    let at = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[at].f) at = i;
    const cur = open.splice(at, 1)[0],
      k = key(cur.x, cur.z);
    if (closed.has(k)) continue;
    closed.add(k);
    if (
      Math.abs(cur.x - gx) + Math.abs(cur.z - gz) <= 1 &&
      clearSegment(pos(cur.x, cur.z), goal, colliders)
    ) {
      end = k;
      break;
    }
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ]) {
      const x = cur.x + dx,
        z = cur.z + dz,
        nk = key(x, z),
        p = pos(x, z);
      if (
        closed.has(nk) ||
        !isWalkable(p, colliders) ||
        !clearSegment(pos(cur.x, cur.z), p, colliders)
      )
        continue;
      const g = cur.g + Math.hypot(dx, dz);
      if (g >= (cost.get(nk) ?? Infinity)) continue;
      cost.set(nk, g);
      parent.set(nk, k);
      open.push({ x, z, g, f: g + Math.hypot(x - gx, z - gz) });
    }
  }
  if (!end) return [];
  const path: Point[] = [goal];
  let k = end;
  while (parent.has(k)) {
    const [x, z] = k.split(",").map(Number);
    path.unshift(pos(x, z));
    k = parent.get(k)!;
  }
  path.unshift(pos(sx, sz));
  const result: Point[] = [];
  let anchor = start;
  for (let i = 0; i < path.length; i++) {
    if (i < path.length - 1 && clearSegment(anchor, path[i + 1], colliders))
      continue;
    result.push(path[i]);
    anchor = path[i];
  }
  return result;
}
