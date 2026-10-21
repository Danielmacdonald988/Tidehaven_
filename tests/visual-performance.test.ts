import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {
  batchStaticVisuals,
  summarizeFrameTimes,
} from "../src/region/visualPerformance";
function piece(material: THREE.Material, x = 0) {
  const m: THREE.Mesh = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    material,
  );
  m.position.x = x;
  m.userData.visualStatic = true;
  return m;
}
test("visual batching preserves movable parent, bounds, metadata and geometry ownership", () => {
  const root = new THREE.Group(),
    roof = new THREE.Group(),
    mat = new THREE.MeshStandardMaterial();
  root.add(roof);
  roof.position.set(10, 5, 0);
  roof.rotation.y = 0.3;
  const a = piece(mat, 1),
    b = piece(mat, 3);
  a.userData.interactionId = b.userData.interactionId = "door";
  a.castShadow = b.castShadow = true;
  roof.add(a, b);
  root.updateMatrixWorld(true);
  const before = new THREE.Box3().setFromObject(root);
  let originalDisposed = false;
  a.geometry.addEventListener("dispose", () => {
    originalDisposed = true;
  });
  const result = batchStaticVisuals(root);
  assert.equal(result.sourceMeshes, 2);
  assert.equal(result.batches, 1);
  assert.equal(root.children[0], roof);
  assert.equal(roof.children.length, 1);
  const merged = roof.children[0] as THREE.Mesh;
  assert.equal(merged.userData.interactionId, "door");
  assert.equal(merged.castShadow, true);
  root.updateMatrixWorld(true);
  const after = new THREE.Box3().setFromObject(root);
  assert.ok(
    before.min.distanceTo(after.min) < 1e-6 &&
      before.max.distanceTo(after.max) < 1e-6,
  );
  roof.visible = false;
  assert.equal(merged.parent!.visible, false);
  result.dispose();
  result.dispose();
  assert.equal(originalDisposed, false);
});
test("batching respects independent visibility, targets, material flags and spatial cells", () => {
  const root = new THREE.Group(),
    mat = new THREE.MeshStandardMaterial();
  const meshes = Array.from({ length: 6 }, (_, i) => piece(mat, i));
  meshes[0].visible = false;
  meshes[1].userData.interactionId = "one";
  meshes[2].userData.interactionId = "two";
  meshes[3].castShadow = true;
  meshes[4].position.x = 30;
  meshes[5].position.x = 60;
  root.add(...meshes);
  const result = batchStaticVisuals(root);
  assert.equal(result.batches, 0);
  assert.equal(root.children.length, 6);
});
test("animated, transparent, instanced and unapproved meshes remain separate", () => {
  const root = new THREE.Group(),
    mat = new THREE.MeshStandardMaterial();
  const a = piece(mat),
    b = piece(mat, 1);
  delete a.userData.visualStatic;
  delete b.userData.visualStatic;
  const instanced = new THREE.InstancedMesh(a.geometry, mat, 3);
  instanced.userData.visualStatic = true;
  const glass = new THREE.MeshStandardMaterial({
    transparent: true,
    opacity: 0.5,
  });
  const c = piece(glass),
    d = piece(glass, 1),
    e = piece(mat, 2),
    f = piece(mat, 3);
  e.onBeforeRender = () => {};
  f.geometry.morphAttributes.position = [
    f.geometry.attributes.position.clone(),
  ];
  root.add(a, b, instanced, c, d, e, f);
  assert.equal(batchStaticVisuals(root).batches, 0);
});
test("indexed and nonindexed geometry merge without losing triangles", () => {
  const root = new THREE.Group(),
    mat = new THREE.MeshStandardMaterial();
  const a = piece(mat),
    b = piece(mat, 2);
  b.geometry = b.geometry.toNonIndexed();
  root.add(a, b);
  batchStaticVisuals(root);
  const merged = root.children[0] as THREE.Mesh;
  assert.equal(merged.geometry.attributes.position.count, 72);
});
test("frame summary reports uncapped stalls and nearest-rank percentiles", () => {
  const summary = summarizeFrameTimes([
    ...Array(94).fill(16),
    ...Array(5).fill(34),
    250,
    NaN,
    0,
  ]);
  assert.equal(summary.p95Ms, 34);
  assert.equal(summary.p99Ms, 34);
  assert.ok(summary.meanMs > 19);
  assert.ok(summary.fps < 53);
  assert.equal(summarizeFrameTimes([]).fps, 0);
});
