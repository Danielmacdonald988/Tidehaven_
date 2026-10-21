import * as THREE from "three";
import { buildEnvironment } from "../three/Environment";
import { createWorld } from "../engine";
import type { Collider } from "../three/shared";
import type { RescueState } from "./engine";

/** Authored, deterministic storm set. Hazards are rendered from authoritative rescue state. */
export function buildRescueWorld() {
  const base = buildEnvironment(false),
    group = new THREE.Group();
  group.name = "The last light — storm rescue";
  group.add(base.group);
  const materials: THREE.Material[] = [],
    geometries: THREE.BufferGeometry[] = [];
  const mat = (color: string, roughness = 0.75, metalness = 0) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness, metalness });
    materials.push(m);
    return m;
  };
  const paint = mat("#64877f"),
    wood = mat("#60483c"),
    metal = mat("#32464d", 0.35, 0.65),
    rust = mat("#9a6347"),
    ivory = mat("#d9cfad"),
    rubber = mat("#202f35");
  const box = new THREE.BoxGeometry(1, 1, 1);
  geometries.push(box);
  function block(
    parent: THREE.Object3D,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    m: THREE.Material,
  ) {
    const o = new THREE.Mesh(box, m);
    o.position.set(x, y, z);
    o.scale.set(w, h, d);
    o.castShadow = o.receiveShadow = true;
    parent.add(o);
    return o;
  }
  function cylinder(
    parent: THREE.Object3D,
    x: number,
    y: number,
    z: number,
    r: number,
    h: number,
    m: THREE.Material,
  ) {
    const geo = new THREE.CylinderGeometry(r, r, h, 10);
    geometries.push(geo);
    const o = new THREE.Mesh(geo, m);
    o.position.set(x, y, z);
    o.castShadow = true;
    parent.add(o);
    return o;
  }
  // Existing architecture is batched. Remove only its actual east wall instance,
  // replacing it with two solid wall sections and an open header, matching navigation.
  const matrix = new THREE.Matrix4(),
    p = new THREE.Vector3(),
    q = new THREE.Quaternion(),
    s = new THREE.Vector3();
  base.group.traverse((o) => {
    if (o instanceof THREE.InstancedMesh)
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, matrix);
        matrix.decompose(p, q, s);
        if (
          Math.abs(p.x - 28.35) < 0.02 &&
          Math.abs(p.z - 10) < 0.02 &&
          Math.abs(s.y - 4.5) < 0.02 &&
          Math.abs(s.z - 10) < 0.02
        ) {
          o.setMatrixAt(i, new THREE.Matrix4().makeScale(0, 0, 0));
          o.instanceMatrix.needsUpdate = true;
        }
      }
  });
  const frontFacade: {
    mesh: THREE.InstancedMesh;
    index: number;
    matrix: THREE.Matrix4;
  }[] = [];
  base.group.traverse((o) => {
    if (o instanceof THREE.InstancedMesh)
      for (let i = 0; i < o.count; i++) {
        o.getMatrixAt(i, matrix);
        matrix.decompose(p, q, s);
        if (
          p.x >= 19.4 &&
          p.x <= 28.6 &&
          p.z >= 14.75 &&
          p.z <= 15.6 &&
          p.y > 0.25
        )
          frontFacade.push({ mesh: o, index: i, matrix: matrix.clone() });
      }
  });
  const hiddenMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
  let facadeCutaway = false;
  const colliders: Collider[] = base.colliders.filter(
    (c) => !(c.id === "radio-side" && c.minX > 28),
  );
  for (const [z, d] of [
    [7, 4],
    [13.5, 3],
  ] as const) {
    block(group, 28.35, 2.25, z, 0.3, 4.5, d, paint);
    colliders.push({
      minX: 28.2,
      maxX: 28.5,
      minZ: z - d / 2,
      maxZ: z + d / 2,
      id: "radio-east-wall",
    });
  }
  block(group, 28.35, 3.85, 10.5, 0.3, 1.3, 3, paint);
  for (const z of [9, 12]) block(group, 28.5, 1.65, z, 0.36, 3.3, 0.14, ivory);
  block(group, 28.5, 3.25, 10.5, 0.4, 0.14, 3.2, ivory);
  // Propped storm door clearly exposes the alternate entrance, rather than a facade.
  const door = block(group, 29.12, 1.45, 11.95, 1.5, 2.9, 0.13, wood);
  door.rotation.y = -0.2;
  const floodMat = new THREE.MeshStandardMaterial({
    color: "#335f67",
    roughness: 0.16,
    metalness: 0.32,
    transparent: true,
    opacity: 0.78,
  });
  materials.push(floodMat);
  const floodGeo = new THREE.PlaneGeometry(26, 13, 36, 18);
  floodGeo.rotateX(-Math.PI / 2);
  geometries.push(floodGeo);
  const flood = new THREE.Mesh(floodGeo, floodMat);
  flood.position.set(24, 0.09, 22.3);
  flood.receiveShadow = true;
  group.add(flood);
  const floodBase = Float32Array.from(
    floodGeo.attributes.position.array as ArrayLike<number>,
  );
  // Reflected highlights, foam and storm drains give water readable motion and depth.
  const foamMat = new THREE.MeshBasicMaterial({
    color: "#bfd6ca",
    transparent: true,
    opacity: 0.22,
  });
  materials.push(foamMat);
  const foam = new THREE.Group();
  group.add(foam);
  for (let i = 0; i < 26; i++) {
    const strip = block(
      foam,
      12 + ((i * 7.17) % 24),
      0.115,
      17 + ((i * 3.17) % 11),
      0.8 + (i % 4) * 0.45,
      0.008,
      0.025,
      foamMat,
    );
    strip.rotation.y = 0.25;
  }
  const beam = new THREE.Group();
  beam.position.set(24, 0, 16);
  group.add(beam);
  const fallen = block(beam, 0, 0.7, 0, 6.1, 0.45, 0.55, wood);
  fallen.rotation.z = 0.12;
  fallen.rotation.y = 0.1;
  for (let i = 0; i < 5; i++) {
    const plank = block(
      beam,
      -2.2 + i * 1.1,
      0.28 + (i % 2) * 0.12,
      0.2 - (i % 3) * 0.3,
      1.5,
      0.12,
      0.2,
      wood,
    );
    plank.rotation.y = i * 0.62;
  }
  for (const x of [-1.8, 1.8]) {
    const brace = block(beam, x, 0.56, 0, 0.16, 1.3, 0.16, metal);
    brace.rotation.z = x > 0 ? 0.9 : -0.8;
  }
  // The dramatic failure is an actual hinged roof assembly; it settles across the
  // front access only when the engine closes that route. East exit stays clear.
  const awning = new THREE.Group();
  awning.position.set(24, 3.5, 14.9);
  group.add(awning);
  block(awning, 0, 0, 1.05, 7.2, 0.16, 2.1, metal);
  for (let i = 0; i < 12; i++)
    block(awning, -3.3 + i * 0.6, 0.1, 1.05, 0.035, 0.07, 2.1, rust);
  for (const x of [-3.25, 3.25])
    block(awning, x, -1.6, 1.95, 0.12, 3.2, 0.12, wood);
  const pole = new THREE.Group();
  pole.position.set(15, 0, 19);
  group.add(pole);
  cylinder(pole, 0, 4.1, 0, 0.18, 8.2, wood);
  block(pole, 0, 7, 0, 2.4, 0.2, 0.22, wood);
  cylinder(pole, 0.25, 6.1, 0.2, 0.48, 1.15, metal);
  for (const x of [-0.9, 0.9])
    for (let i = 0; i < 3; i++)
      cylinder(pole, x, 7.2 + i * 0.12, 0, 0.16 - i * 0.025, 0.08, ivory);
  colliders.push({
    minX: 14.75,
    maxX: 15.25,
    minZ: 18.75,
    maxZ: 19.25,
    id: "transformer-pole",
  });
  const wireGeo = new THREE.BufferGeometry().setFromPoints(
    Array.from(
      { length: 30 },
      (_, i) =>
        new THREE.Vector3(
          15 - i * 1.6,
          7.2 - Math.sin((i / 29) * Math.PI) * 1.3,
          19,
        ),
    ),
  );
  geometries.push(wireGeo);
  const wireMat = new THREE.LineBasicMaterial({ color: "#26373e" });
  materials.push(wireMat);
  group.add(new THREE.Line(wireGeo, wireMat));
  const poweredLights: THREE.PointLight[] = [];
  const bulbMat = new THREE.MeshStandardMaterial({
    color: "#ffe6af",
    emissive: "#ffc36b",
    emissiveIntensity: 2,
  });
  materials.push(bulbMat);
  for (const [x, z] of [
    [24, 15.3],
    [0, -7.5],
    [-22, 15.3],
  ]) {
    block(group, x, 3, z, 0.6, 0.16, 0.25, bulbMat);
    const light = new THREE.PointLight("#ffd19b", 13, 12, 2);
    light.position.set(x, 2.8, z + 0.3);
    group.add(light);
    poweredLights.push(light);
  }
  const emergencyMat = new THREE.MeshStandardMaterial({
    color: "#ef9467",
    emissive: "#ff6839",
    emissiveIntensity: 1.7,
  });
  materials.push(emergencyMat);
  block(group, 27.2, 2.9, 15.35, 0.17, 0.3, 0.1, emergencyMat);
  const windowLight = new THREE.PointLight("#ff8e50", 12, 10, 2);
  windowLight.position.set(25.7, 2.1, 14);
  group.add(windowLight);
  const refuge = new THREE.PointLight("#ffc982", 27, 17, 2);
  refuge.position.set(-22, 3.8, 10);
  group.add(refuge);
  const lantern = mat("#ccad75");
  block(group, -22, 2.7, 14.9, 0.3, 0.4, 0.25, lantern);
  const lampCore = new THREE.MeshBasicMaterial({ color: "#fff0bb" });
  materials.push(lampCore);
  block(group, -22, 2.7, 15.05, 0.2, 0.24, 0.08, lampCore);
  // Quiet shelter staging: cot, blanket and real delivered case remain in aftermath.
  block(group, -24, 0.48, 8, 1.1, 0.16, 2.1, ivory);
  block(group, -24, 0.6, 8.25, 1.05, 0.11, 1.4, paint);
  for (const x of [-24.42, -23.58])
    for (const z of [7.2, 8.8])
      block(group, x, 0.25, z, 0.06, 0.5, 0.06, metal);
  const supplies = new THREE.Group();
  supplies.position.set(-20.3, 0.02, 9);
  group.add(supplies);
  block(supplies, 0, 0.32, 0, 0.8, 0.64, 0.55, ivory);
  block(supplies, 0, 0.65, 0, 0.85, 0.05, 0.6, metal);
  block(supplies, 0, 0.35, 0.28, 0.34, 0.08, 0.02, rust);
  block(supplies, 0, 0.35, 0.29, 0.08, 0.34, 0.02, rust);
  const rainGeo = new THREE.BufferGeometry(),
    rainPositions = new Float32Array(900 * 6);
  rainGeo.setAttribute("position", new THREE.BufferAttribute(rainPositions, 3));
  geometries.push(rainGeo);
  const rainMat = new THREE.LineBasicMaterial({
    color: "#c0d4db",
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
  });
  materials.push(rainMat);
  const rain = new THREE.LineSegments(rainGeo, rainMat);
  rain.frustumCulled = false;
  group.add(rain);
  const sparkGeo = new THREE.BufferGeometry(),
    sparkPositions = new Float32Array(80 * 3);
  sparkGeo.setAttribute(
    "position",
    new THREE.BufferAttribute(sparkPositions, 3),
  );
  geometries.push(sparkGeo);
  const sparkMat = new THREE.PointsMaterial({
    color: "#ffcf75",
    size: 0.13,
    transparent: true,
    opacity: 1,
    depthWrite: false,
  });
  materials.push(sparkMat);
  const sparks = new THREE.Points(sparkGeo, sparkMat);
  sparks.frustumCulled = false;
  group.add(sparks);
  const flash = new THREE.PointLight("#d4edff", 0, 65, 1.5);
  flash.position.set(15, 7, 19);
  group.add(flash);
  const world = createWorld();
  world.inventory = { food: 0, water: 0, medical: 0, fuel: 0 };
  return {
    group,
    colliders,
    update(
      state: RescueState,
      dt: number,
      elapsed: number,
      quality: "high" | "low",
    ) {
      const calm = state.phase === "aftermath";
      world.hour = calm ? 72 : 50;
      world.ended = calm;
      // Use the base wind/water cutaways without its second rain emitter.
      base.update(world, dt, elapsed, state.player, "low");
      const insideRadio =
        Math.abs(state.player.x - 24) < 4.75 &&
        Math.abs(state.player.z - 10) < 5.25;
      if (insideRadio !== facadeCutaway) {
        facadeCutaway = insideRadio;
        for (const piece of frontFacade) {
          piece.mesh.setMatrixAt(
            piece.index,
            insideRadio ? hiddenMatrix : piece.matrix,
          );
          piece.mesh.instanceMatrix.needsUpdate = true;
        }
      }
      awning.visible = !insideRadio || state.collapse > 0;
      // Event time and progress belong to the save/checkpoint, never this render handle.
      const blackout = state.events.find((event) => event.kind === "blackout");
      const age =
        state.power || !blackout
          ? 100
          : Math.max(0, state.elapsed - blackout.at);
      flash.intensity =
        age < 0.15 ? 220 : age < 0.35 ? 0 : age < 0.52 ? 100 : 0;
      poweredLights.forEach((l) => (l.intensity = state.power ? 13 : 0));
      bulbMat.emissiveIntensity = state.power ? 2 : 0;
      sparks.visible = age < 3;
      for (let i = 0; i < 80 && sparks.visible; i++) {
        const t = (age + i * 0.012) % 1.4;
        sparkPositions[i * 3] = 15 + Math.cos(i * 12.7) * t * 2.5;
        sparkPositions[i * 3 + 1] = 6.5 + Math.sin(i * 1.9) * t * 2 - t * t * 4;
        sparkPositions[i * 3 + 2] = 19 + Math.sin(i * 8.3) * t * 2;
      }
      sparkGeo.attributes.position.needsUpdate = true;
      const lift =
        state.passage === "cleared" ? 1 : Math.min(1, state.helping / 9);
      // The lift remains a closed work area until the engine commits completion.
      // Pivot the timber aside late in the lift, then leave it visibly by the wall.
      const swing = THREE.MathUtils.smoothstep(lift, 0.65, 1);
      beam.visible = true;
      beam.position.set(
        24 - swing * 6.2,
        Math.sin(lift * Math.PI) * 0.9,
        16 - swing * 2,
      );
      beam.rotation.y = swing * 1.4;
      beam.rotation.z = Math.sin(lift * Math.PI) * 0.16;
      const fall = THREE.MathUtils.smoothstep(state.collapse, 0, 1);
      awning.rotation.x = fall * 0.72;
      awning.position.y = 3.5 - fall * 2;
      awning.position.z = 14.9 + fall * 0.4;
      windowLight.intensity = calm ? 0 : 10 + Math.sin(elapsed * 2) * 2;
      refuge.intensity = calm ? 35 : 27;
      supplies.visible = state.supplies !== "carried";
      supplies.position.set(
        state.supplies === "inside" ? 25.8 : -20.3,
        0.02,
        state.supplies === "inside" ? 10 : 9,
      );
      // The authored aftermath has receding street water, not a continuing flood.
      flood.position.y = calm ? -0.16 : 0.09;
      foam.visible = !calm;
      rain.visible = !calm;
      rainGeo.setDrawRange(0, quality === "high" ? 1800 : 600);
      for (let i = 0; i < 900; i++) {
        const y = 18 - ((elapsed * 15 + i * 0.71) % 18),
          x = state.player.x + ((i * 13.71) % 58) - 29,
          z = state.player.z + ((i * 7.13) % 48) - 24;
        const j = i * 6;
        rainPositions[j] = x + (18 - y) * 0.5;
        rainPositions[j + 1] = y;
        rainPositions[j + 2] = z;
        rainPositions[j + 3] = rainPositions[j] - 0.45;
        rainPositions[j + 4] = y + 0.9;
        rainPositions[j + 5] = z - 0.12;
      }
      rainGeo.attributes.position.needsUpdate = true;
      const verts = floodGeo.attributes.position;
      for (let i = 0; i < verts.count; i++)
        verts.setY(
          i,
          Math.sin(floodBase[i * 3] * 1.2 + elapsed * 2.1) * 0.025 +
            Math.cos(floodBase[i * 3 + 2] * 2 + elapsed) * 0.018,
        );
      verts.needsUpdate = true;
      foam.position.x = Math.sin(elapsed * 0.65) * 0.32;
      foamMat.opacity = calm ? 0.1 : 0.2 + Math.sin(elapsed) * 0.045;
    },
    dispose() {
      base.dispose();
      materials.forEach((m) => m.dispose());
      geometries.forEach((g) => g.dispose());
    },
  };
}
