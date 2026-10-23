import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { coastalWater } from "../src/region/VisualDetails";
import { createCoastalAtmosphere } from "../src/region/Atmosphere";

test("region atmosphere preserves assets and restores shared water callbacks", () => {
  const water = new THREE.MeshStandardMaterial({ color: "#548f8b" });
  coastalWater(water);
  const compile = water.onBeforeCompile,
    key = water.customProgramCacheKey;
  const wall = new THREE.MeshStandardMaterial();
  const group = new THREE.Group();
  const geometry = new THREE.BoxGeometry();
  group.add(
    new THREE.Mesh(geometry, water),
    new THREE.Mesh(geometry, [water, wall]),
  );
  const color = water.color.clone(),
    roughness = water.roughness;
  const atmosphere = createCoastalAtmosphere(group);
  assert.equal(group.children.length, 2);
  assert.equal(water.roughness, roughness);
  assert.ok(water.color.equals(color));
  assert.equal(wall.onBeforeCompile, THREE.Material.prototype.onBeforeCompile);
  assert.equal(
    water.customProgramCacheKey(),
    "tidehaven-region-coastal-breeze-v1",
  );
  atmosphere.dispose();
  atmosphere.dispose();
  assert.equal(water.onBeforeCompile, compile);
  assert.equal(water.customProgramCacheKey, key);
  geometry.dispose();
  water.dispose();
  wall.dispose();
});

test("water breeze clock freezes while paused/reduced motion and caps long frames", () => {
  const material = new THREE.MeshStandardMaterial();
  coastalWater(material);
  const group = new THREE.Group();
  const geometry = new THREE.PlaneGeometry();
  group.add(new THREE.Mesh(geometry, material));
  const atmosphere = createCoastalAtmosphere(group);
  const shader = {
    uniforms: {},
    vertexShader: "#include <worldpos_vertex>",
    fragmentShader:
      "#include <color_fragment>\n#include <normal_fragment_maps>",
  } as THREE.WebGLProgramParametersWithUniforms;
  material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
  atmosphere.update(0.02, false, false);
  assert.equal(shader.uniforms.coastalBreezeTime.value, 0.02);
  atmosphere.update(0.04, true, false);
  atmosphere.update(0.04, false, true);
  assert.equal(shader.uniforms.coastalBreezeTime.value, 0.02);
  atmosphere.update(10, false, false);
  assert.equal(shader.uniforms.coastalBreezeTime.value, 0.07);
  assert.match(shader.vertexShader, /coastalSurface = step/);
  assert.match(shader.fragmentShader, /mat3\(viewMatrix\)/);
  atmosphere.dispose();
  geometry.dispose();
  material.dispose();
});
