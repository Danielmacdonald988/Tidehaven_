import * as THREE from "three";
import { terrainGridHeight } from "./TerrainRibbon";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  REGION_SITES as S,
  surfaceHeight,
  type Point,
  type RegionState,
} from "./contracts";

/** Original optical brasswork and earned shell inlays. Presentation only; no saved state. */
export function buildExpeditionDetails() {
  const group = new THREE.Group();
  group.name = "companion-observatory-discovery";
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const instances: THREE.InstancedMesh[] = [];
  const brass = new THREE.MeshStandardMaterial({
    color: "#c2a065",
    metalness: 0.65,
    roughness: 0.32,
  });
  const glass = new THREE.MeshStandardMaterial({
    color: "#85cbd0",
    metalness: 0.3,
    roughness: 0.16,
    emissive: "#285159",
    emissiveIntensity: 0.24,
  });
  const stone = new THREE.MeshStandardMaterial({
    color: "#748b83",
    roughness: 0.9,
  });
  const shell = new THREE.MeshStandardMaterial({
    color: "#eddbac",
    roughness: 0.8,
  });
  materials.push(brass, glass, stone, shell);
  const dummy = new THREE.Object3D();
  const shellGeometry = new THREE.SphereGeometry(1, 6, 4);
  geometries.push(shellGeometry);
  const west: Point[] = [
    { x: -26, z: 19 },
    { x: -34, z: 20.5 },
    { x: -60, z: 20.5 },
    { x: -74, z: 20.5 },
    S.clue,
  ];
  const passage = [S.clue, S.shortcut];
  const ascent = [S.shortcut, S.ruin];
  function trail(name: string, route: Point[]) {
    const points: { x: number; z: number; yaw: number }[] = [];
    for (let i = 1; i < route.length; i++) {
      const a = route[i - 1],
        b = route[i];
      const length = Math.hypot(b.x - a.x, b.z - a.z);
      const steps = Math.ceil(length / 1.8);
      const yaw = Math.atan2(b.x - a.x, b.z - a.z);
      for (let j = 0; j < steps; j++) {
        const t = j / steps;
        points.push({
          x: a.x + (b.x - a.x) * t,
          z: a.z + (b.z - a.z) * t,
          yaw,
        });
      }
    }
    const mesh = new THREE.InstancedMesh(
      shellGeometry,
      shell,
      points.length * 2,
    );
    mesh.name = name;
    points.forEach((p, i) => {
      for (let side = 0; side < 2; side++) {
        const offset = side ? 0.18 : -0.18;
        const x = p.x + Math.cos(p.yaw) * offset;
        const z = p.z - Math.sin(p.yaw) * offset;
        dummy.position.set(
          x,
          (name === "expedition-ascent-shells"
            ? terrainGridHeight({ x, z })
            : surfaceHeight({ x, z })) + 0.075,
          z,
        );
        dummy.rotation.set(0, p.yaw, 0);
        dummy.scale.set(0.105, 0.035, 0.19);
        dummy.updateMatrix();
        mesh.setMatrixAt(i * 2 + side, dummy.matrix);
      }
    });
    mesh.computeBoundingBox();
    mesh.computeBoundingSphere();
    mesh.receiveShadow = true;
    group.add(mesh);
    instances.push(mesh);
    return mesh;
  }
  const westTrail = trail("expedition-west-shells", west);
  const passageTrail = trail("expedition-passage-shells", passage);
  const ascentTrail = trail("expedition-ascent-shells", ascent);
  // Return guidance reuses the same physical route, plus the final approach to home.
  const homeTrail = trail("expedition-home-shells", [
    { x: -26, z: 19 },
    S.home,
  ]);
  function merged(
    parts: THREE.BufferGeometry[],
    material: THREE.Material,
    parent: THREE.Group,
  ) {
    const copies = parts.map((part) =>
      part.index ? part.toNonIndexed() : part.clone(),
    );
    const geometry = mergeGeometries(copies);
    copies.forEach((part) => part.dispose());
    parts.forEach((part) => part.dispose());
    if (!geometry) throw new Error("Could not build observatory brasswork");
    geometries.push(geometry);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  const ring = (
    radius: number,
    tube: number,
    x: number,
    y: number,
    z: number,
    tilt = 0,
  ) =>
    new THREE.TorusGeometry(radius, tube, 6, 32)
      .rotateY(tilt)
      .translate(x, y, z);
  const brassParts = [
    ring(0.67, 0.055, 0, 1.35, 0),
    ring(0.53, 0.032, 0, 1.35, 0.025),
    ring(0.76, 0.035, 0, 1.35, 0, Math.PI / 2),
    new THREE.CylinderGeometry(0.045, 0.055, 0.85, 8).translate(-0.55, 0.8, 0),
    new THREE.CylinderGeometry(0.045, 0.055, 0.85, 8).translate(0.55, 0.8, 0),
    new THREE.BoxGeometry(1.3, 0.12, 0.3).translate(0, 0.4, 0),
  ];
  const instrument = new THREE.Group();
  instrument.name = "observatory-optic";
  instrument.position.set(S.ruin.x, surfaceHeight(S.ruin), S.ruin.z);
  merged(brassParts, brass, instrument);
  const glassGeometry = new THREE.CircleGeometry(0.48, 32);
  glassGeometry.translate(0, 1.35, 0.035);
  glass.side = THREE.DoubleSide;
  geometries.push(glassGeometry);
  instrument.add(new THREE.Mesh(glassGeometry, glass));
  group.add(instrument);
  const homeInstrument = instrument.clone();
  homeInstrument.name = "home-observatory-optic";
  homeInstrument.position.set(-24, 1.2, 12);
  group.add(homeInstrument);
  const cradle = new THREE.Group();
  cradle.name = "observatory-empty-cradle";
  cradle.position.copy(instrument.position);
  merged(
    [
      new THREE.CylinderGeometry(0.65, 0.85, 0.22, 12).translate(0, 0.11, 0),
      new THREE.CylinderGeometry(0.28, 0.38, 0.3, 8).translate(0, 0.32, 0),
    ],
    stone,
    cradle,
  );
  group.add(cradle);
  const homePlinth = cradle.clone();
  homePlinth.name = "home-optic-plinth";
  homePlinth.position.set(-24, 1.2, 12);
  group.add(homePlinth);
  return {
    group,
    update(state: RegionState) {
      const e = state.expedition;
      const returning = e.relic && !e.complete;
      westTrail.visible =
        returning || (state.wildlife.abilities.tracks && !e.clue);
      passageTrail.visible = returning || (e.clue && !e.shortcut);
      ascentTrail.visible = returning || (e.shortcut && !e.relic);
      homeTrail.visible = returning;
      instrument.visible = !e.relic;
      homeInstrument.visible = homePlinth.visible = e.complete;
    },
    dispose() {
      instances.forEach((mesh) => mesh.dispose());
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
    },
  };
}
