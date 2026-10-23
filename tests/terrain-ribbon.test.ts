import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { terrainRibbon, terrainGridHeight } from "../src/region/TerrainRibbon";
import { REGION_SITES as S, surfaceHeight } from "../src/region/contracts";

test("observatory path follows the actual ground triangles through the cliff edge", () => {
  // Reconstruct the existing World.ts ground mesh as the independent oracle.
  const ground = new THREE.PlaneGeometry(20.25, 20.25, 81, 81);
  ground.rotateX(-Math.PI / 2);
  ground.translate((-108 - 87.75) / 2, 0, (-35 - 14.75) / 2);
  const gp = ground.getAttribute("position");
  for (let i = 0; i < gp.count; i++)
    gp.setY(i, surfaceHeight({ x: gp.getX(i), z: gp.getZ(i) }) - 0.025);
  const groundMesh = new THREE.Mesh(
    ground,
    new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
  );
  groundMesh.updateMatrixWorld();
  const path = terrainRibbon(S.shortcut, S.ruin, 2.4, 0.035);
  const positions = path.getAttribute("position");
  const ray = new THREE.Raycaster();
  const a = new THREE.Vector3(),
    b = new THREE.Vector3(),
    c = new THREE.Vector3(),
    p = new THREE.Vector3();
  let cliffSamples = 0;
  try {
    assert(
      positions.count / 3 < 2500,
      "keep localized path tessellation bounded",
    );
    for (let i = 0; i < positions.count; i += 3) {
      a.fromBufferAttribute(positions, i);
      b.fromBufferAttribute(positions, i + 1);
      c.fromBufferAttribute(positions, i + 2);
      for (const weights of [
        [1 / 3, 1 / 3, 1 / 3],
        [0.6, 0.2, 0.2],
      ]) {
        p.copy(a)
          .multiplyScalar(weights[0])
          .addScaledVector(b, weights[1])
          .addScaledVector(c, weights[2]);
        assert(Math.abs(p.y - terrainGridHeight(p) - 0.035) < 1e-4);
        if (p.x < -88 && p.x > -88.25 && p.z < -15) cliffSamples++;
        if (p.x <= -87.75 && p.z <= -14.75) {
          ray.set(new THREE.Vector3(p.x, 10, p.z), new THREE.Vector3(0, -1, 0));
          const hit = ray.intersectObject(groundMesh)[0];
          assert(hit, "path point must lie over existing ground");
          assert(
            Math.abs(p.y - hit.point.y - 0.06) < 1e-4,
            "path must stay above each actual ground triangle",
          );
        }
      }
    }
    assert(cliffSamples > 10, "test must exercise the formerly clipped seam");
  } finally {
    path.dispose();
    ground.dispose();
    groundMesh.material.dispose();
  }
});
