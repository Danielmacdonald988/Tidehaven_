import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { buildExpeditionDetails } from "../src/region/ExpeditionDetails";
import { createRegion } from "../src/region/engine";
import { surfaceHeight } from "../src/region/contracts";

test("earned expedition presentation survives reload and never changes progress", () => {
  const visuals = buildExpeditionDetails();
  const state = createRegion();
  const names = [
    "expedition-west-shells",
    "expedition-passage-shells",
    "expedition-ascent-shells",
    "expedition-home-shells",
    "observatory-optic",
    "home-observatory-optic",
  ];
  const objects = names.map((name) => visuals.group.getObjectByName(name)!);
  function check(expected: boolean[]) {
    const saved = JSON.stringify(state);
    visuals.update(JSON.parse(saved)); // independent returning-save snapshot each time
    assert.deepEqual(
      objects.map((object) => object.visible),
      expected,
    );
    assert.equal(JSON.stringify(state), saved);
    assert.equal(
      visuals.group.getObjectByName("observatory-empty-cradle")!.visible,
      true,
    );
  }
  try {
    check([false, false, false, false, true, false]);
    state.wildlife.abilities.tracks = true;
    check([true, false, false, false, true, false]);
    state.expedition.clue = true;
    check([false, true, false, false, true, false]);
    state.expedition.shortcut = true;
    check([false, false, true, false, true, false]);
    state.expedition.relic = true;
    check([true, true, true, true, false, false]);
    state.expedition.complete = true;
    check([false, false, false, false, false, true]);
    // Historical companions can reach the passage without first using town tracks.
    state.wildlife.abilities.tracks = false;
    state.expedition = {
      clue: true,
      shortcut: true,
      relic: false,
      complete: false,
    };
    check([false, false, true, false, true, false]);
  } finally {
    visuals.dispose();
  }
});

test("expedition visuals have bounded shared resources and terrain-following trails", () => {
  const visuals = buildExpeditionDetails();
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const meshes: THREE.Mesh[] = [];
  const instances: THREE.InstancedMesh[] = [];
  visuals.group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    meshes.push(object);
    geometries.add(object.geometry);
    for (const material of Array.isArray(object.material)
      ? object.material
      : [object.material])
      materials.add(material);
    assert.equal(object.castShadow, false);
    if (object instanceof THREE.InstancedMesh) instances.push(object);
  });
  assert.equal(meshes.length, 10);
  assert.equal(geometries.size, 4);
  assert.equal(materials.size, 4);
  assert.equal(instances.length, 4);
  const matrix = new THREE.Matrix4(),
    point = new THREE.Vector3();
  let instanceCount = 0;
  for (const mesh of instances) {
    instanceCount += mesh.count;
    assert(mesh.boundingBox && mesh.boundingSphere);
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, matrix);
      point.setFromMatrixPosition(matrix);
      assert(Math.abs(point.y - surfaceHeight(point) - 0.075) < 1e-5);
      assert(mesh.boundingBox.containsPoint(point));
    }
  }
  assert(instanceCount <= 120, `unexpected trail growth: ${instanceCount}`);
  const watched: THREE.EventDispatcher<{ dispose: {} }>[] = [
    ...geometries,
    ...materials,
    ...instances,
  ];
  const disposalCounts = watched.map(() => 0);
  watched.forEach((resource, i) =>
    resource.addEventListener("dispose", () => disposalCounts[i]++),
  );
  const originalResources = meshes.map((mesh) => [
    mesh.geometry,
    mesh.material,
  ]);
  for (let i = 0; i < 300; i++) visuals.update(createRegion());
  meshes.forEach((mesh, i) =>
    assert.deepEqual([mesh.geometry, mesh.material], originalResources[i]),
  );
  visuals.dispose();
  assert(disposalCounts.every((count) => count === 1));
});
