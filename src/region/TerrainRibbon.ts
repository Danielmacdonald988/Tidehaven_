import * as THREE from "three";
import { surfaceHeight, type Point } from "./contracts";

const STEP = 0.25;
/** Interpolate the existing quarter-metre PlaneGeometry triangles, including its cliff edge. */
export function terrainGridHeight(p: Point): number {
  const x = Math.floor(p.x / STEP) * STEP;
  const z = Math.floor(p.z / STEP) * STEP;
  const u = (p.x - x) / STEP,
    v = (p.z - z) / STEP;
  const a = surfaceHeight({ x, z });
  const b = surfaceHeight({ x, z: z + STEP });
  const d = surfaceHeight({ x: x + STEP, z });
  if (u + v <= 1) return a * (1 - u - v) + d * u + b * v;
  const c = surfaceHeight({ x: x + STEP, z: z + STEP });
  return b * (1 - u) + d * (1 - v) + c * (u + v - 1);
}

type Vertex = { x: number; y: number; z: number };
/** Clip each ground triangle to a narrow path footprint; never bridge across terrain facets. */
export function terrainRibbon(
  a: Point,
  b: Point,
  width: number,
  offset: number,
) {
  const dx = b.x - a.x,
    dz = b.z - a.z;
  const length = Math.hypot(dx, dz),
    ux = dx / length,
    uz = dz / length;
  const nx = uz,
    nz = -ux;
  const along = (p: Vertex) => (p.x - a.x) * ux + (p.z - a.z) * uz;
  const across = (p: Vertex) => (p.x - a.x) * nx + (p.z - a.z) * nz;
  const planes = [
    along,
    (p: Vertex) => length - along(p),
    (p: Vertex) => width / 2 - across(p),
    (p: Vertex) => width / 2 + across(p),
  ];
  function clip(polygon: Vertex[], distance: (p: Vertex) => number) {
    const result: Vertex[] = [];
    for (let i = 0; i < polygon.length; i++) {
      const p = polygon[i],
        q = polygon[(i + 1) % polygon.length];
      const dp = distance(p),
        dq = distance(q);
      if (dp >= 0) result.push(p);
      if ((dp >= 0) !== (dq >= 0)) {
        const t = dp / (dp - dq);
        result.push({
          x: p.x + (q.x - p.x) * t,
          y: p.y + (q.y - p.y) * t,
          z: p.z + (q.z - p.z) * t,
        });
      }
    }
    return result;
  }
  const positions: number[] = [],
    uv: number[] = [];
  const minX = Math.floor(
    (Math.min(a.x, b.x) - (Math.abs(nx) * width) / 2) / STEP,
  );
  const maxX = Math.ceil(
    (Math.max(a.x, b.x) + (Math.abs(nx) * width) / 2) / STEP,
  );
  const minZ = Math.floor(
    (Math.min(a.z, b.z) - (Math.abs(nz) * width) / 2) / STEP,
  );
  const maxZ = Math.ceil(
    (Math.max(a.z, b.z) + (Math.abs(nz) * width) / 2) / STEP,
  );
  const vertex = (x: number, z: number): Vertex => ({
    x,
    z,
    y: surfaceHeight({ x, z }),
  });
  for (let ix = minX; ix < maxX; ix++) {
    for (let iz = minZ; iz < maxZ; iz++) {
      const x = ix * STEP,
        z = iz * STEP;
      const corners = [
        vertex(x, z),
        vertex(x, z + STEP),
        vertex(x + STEP, z + STEP),
        vertex(x + STEP, z),
      ];
      for (const indices of [
        [0, 1, 3],
        [1, 2, 3],
      ]) {
        let polygon = indices.map((index) => corners[index]);
        for (const plane of planes) polygon = clip(polygon, plane);
        for (let i = 1; i + 1 < polygon.length; i++) {
          for (const p of [polygon[0], polygon[i], polygon[i + 1]]) {
            positions.push(p.x, p.y + offset, p.z);
            uv.push(across(p) / width + 0.5, along(p) / 6);
          }
        }
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geometry.computeVertexNormals();
  return geometry;
}
