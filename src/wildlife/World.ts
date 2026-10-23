import * as THREE from "three";
import { buildEnvironment } from "../three/Environment";
import { createWorld } from "../engine";
import type { Collider, Quality } from "../three/shared";
import { SITES, REST_SITES, type WildlifeState } from "./contracts";
export function buildWildlifeWorld() {
  const base = buildEnvironment(false, true),
    group = new THREE.Group();
  group.add(base.group);
  const colliders = base.colliders.filter((c) => !c.exposed);
  const geos: THREE.BufferGeometry[] = [],
    mats: THREE.Material[] = [];
  const mat = (color: string, emissive?: string) => {
    const m = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.75,
      emissive: emissive || "#000000",
      emissiveIntensity: emissive ? 0.7 : 0,
    });
    mats.push(m);
    return m;
  };
  const stone = mat("#84958e"),
    wood = mat("#725544"),
    leaf = mat("#648974"),
    sand = mat("#d8c5a6"),
    gold = mat("#c6b176"),
    teal = mat("#80c9b7", "#336e66");
  const box = new THREE.BoxGeometry(1, 1, 1);
  geos.push(box);
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
  function oval(
    parent: THREE.Object3D,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    m: THREE.Material,
  ) {
    const g = new THREE.SphereGeometry(1, 12, 8);
    geos.push(g);
    const o = new THREE.Mesh(g, m);
    o.position.set(x, y, z);
    o.scale.set(sx, sy, sz);
    o.castShadow = true;
    parent.add(o);
    return o;
  }
  // Original procedural shore clues. One instanced mesh per trail keeps the
  // first route readable without adding blockers, lights, or per-frame geometry.
  const printGeo = new THREE.SphereGeometry(1, 8, 6);
  geos.push(printGeo);
  const trailSand = mat("#ead1a3"),
    revealedSand = mat("#d4b474", "#76572e");
  const dummy = new THREE.Object3D();
  function footprint(
    mesh: THREE.InstancedMesh,
    index: number,
    x: number,
    z: number,
    angle: number,
    width = 0.13,
  ) {
    // The authored town has raised curbs; keep clues above their surface.
    const curb = Math.abs(z - 16.9) < 0.7 || Math.abs(z - 24.1) < 0.7;
    dummy.position.set(x, curb ? 0.205 : 0.075, z);
    dummy.rotation.set(0, angle, 0);
    dummy.scale.set(width, 0.018, width * 1.7);
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
  }
  // From the warehouse doorstep, along the open road, then onto tide sand.
  // These are scattered shell impressions rather than an enforced quest line.
  const route = [
    [-22, 15.2],
    [-21.5, 17.5],
    [-12, 17.5],
    [-11, 25],
    [-8.8, 25.8],
  ];
  const approachPrints: { x: number; z: number; angle: number }[] = [];
  for (let segment = 1; segment < route.length; segment++) {
    const [ax, az] = route[segment - 1],
      [bx, bz] = route[segment];
    const length = Math.hypot(bx - ax, bz - az);
    const steps = Math.ceil(length / 0.85);
    const angle = Math.atan2(bx - ax, bz - az);
    for (let i = 0; i < steps; i++) {
      const t = i / steps,
        side = i % 2 ? 0.17 : -0.17;
      approachPrints.push({
        x: ax + (bx - ax) * t + Math.cos(angle) * side,
        z: az + (bz - az) * t - Math.sin(angle) * side,
        angle,
      });
    }
  }
  const approachTrail = new THREE.InstancedMesh(
    printGeo,
    trailSand,
    approachPrints.length,
  );
  approachTrail.name = "shore-shell-discovery-trail";
  approachPrints.forEach((p, i) =>
    footprint(approachTrail, i, p.x, p.z, p.angle),
  );
  approachTrail.receiveShadow = true;
  group.add(approachTrail);
  const sniffRoute = [
    [-9, 26],
    [-13, 25.5],
    [-26, 25.5],
    [-26, 19.6],
  ];
  const sniffClues: { x: number; z: number; angle: number }[] = [];
  for (let segment = 1; segment < sniffRoute.length; segment++) {
    const [ax, az] = sniffRoute[segment - 1],
      [bx, bz] = sniffRoute[segment];
    const steps = Math.ceil(Math.hypot(bx - ax, bz - az) / 1.1);
    for (let i = 0; i < steps; i++)
      sniffClues.push({
        x: ax + ((bx - ax) * i) / steps,
        z: az + ((bz - az) * i) / steps,
        angle: Math.atan2(bx - ax, bz - az),
      });
  }
  const sniffSand = mat("#d7bd90", "#655139");
  const sniffTrail = new THREE.InstancedMesh(
    printGeo,
    sniffSand,
    sniffClues.length,
  );
  sniffTrail.name = "companion-shore-shell-trail";
  sniffClues.forEach((p, i) =>
    footprint(sniffTrail, i, p.x, p.z, p.angle, 0.16),
  );
  group.add(sniffTrail);
  const tracks = new THREE.InstancedMesh(printGeo, revealedSand, 30);
  tracks.name = "brindlefin-revealed-tracks";
  group.add(tracks);
  for (let i = 0; i < 15; i++) {
    const t = i / 14;
    for (let side = 0; side < 2; side++) {
      footprint(
        tracks,
        i * 2 + side,
        -26 - 7 * t + (side ? 0.2 : -0.2),
        19 - t + Math.sin(t * 7) * 0.25,
        -1.7,
        0.16,
      );
    }
  }
  // Compute bounds with every pair present, before the reveal trims draw count.
  for (const trail of [approachTrail, sniffTrail, tracks]) {
    trail.computeBoundingSphere();
    trail.computeBoundingBox();
  }
  // A small shell fan marks the sniffing site before its hidden trail is found.
  const clue = new THREE.Group();
  clue.position.set(SITES.tracks.x, 0.07, SITES.tracks.z + 0.55);
  group.add(clue);
  for (let i = 0; i < 5; i++) {
    const rib = block(clue, (i - 2) * 0.1, 0, 0, 0.075, 0.035, 0.42, sand);
    rib.rotation.y = (i - 2) * 0.22;
  }
  // Protected garden: the only front gap is occupied by the movable driftwood gate.
  function wall(x: number, z: number, w: number, d: number) {
    block(group, x, 0.55, z, w, 1.1, d, stone);
    colliders.push({
      minX: x - w / 2,
      maxX: x + w / 2,
      minZ: z - d / 2,
      maxZ: z + d / 2,
      id: "wildlife-garden-wall",
    });
    for (let i = 0; i < w; i += 0.7)
      oval(group, x - w / 2 + i, 0.95, z, 0.34, 0.25, 0.24, leaf);
  }
  wall(-38, -7, 0.4, 10);
  wall(-30, -7, 0.4, 10);
  wall(-34, -12, 8, 0.4);
  wall(-37, -2, 2, 0.4);
  wall(-31, -2, 2, 0.4);
  const gate = new THREE.Group();
  gate.position.set(-34, 0, -2);
  group.add(gate);
  for (let i = 0; i < 4; i++) {
    const b = block(
      gate,
      0,
      0.22 + i * 0.22,
      (i % 2) * 0.2,
      4.1,
      0.18,
      0.25,
      wood,
    );
    b.rotation.z = (i % 2 ? 1 : -1) * 0.05;
  }
  for (const x of [-1.2, 1.2]) block(gate, x, 0.6, 0, 0.18, 1.3, 0.35, wood);
  const poolMat = new THREE.MeshStandardMaterial({
    color: "#73b7b4",
    metalness: 0.35,
    roughness: 0.12,
    transparent: true,
    opacity: 0.75,
  });
  mats.push(poolMat);
  const poolGeo = new THREE.CircleGeometry(2.2, 48);
  poolGeo.rotateX(-Math.PI / 2);
  geos.push(poolGeo);
  const pool = new THREE.Mesh(poolGeo, poolMat);
  pool.position.set(-34, 0.035, -7);
  group.add(pool);
  for (let i = 0; i < 15; i++) {
    const a = i * 2.4;
    oval(
      group,
      -34 + Math.cos(a) * 2.8,
      0.2,
      -7 + Math.sin(a) * 2.6,
      0.3,
      0.25,
      0.4,
      stone,
    );
    const reed = block(
      group,
      -34 + Math.cos(a) * 2.7,
      0.7,
      -7 + Math.sin(a) * 2.5,
      0.05,
      1.4,
      0.08,
      leaf,
    );
    reed.rotation.z = Math.sin(a) * 0.25;
  }
  // Small lantern grotto beyond the shops; real side/back walls and a light-responsive entrance.
  const grotto = new THREE.Group();
  group.add(grotto);
  for (const [x, z, w, d] of [
    [8, -24.5, 0.5, 7],
    [16, -24.5, 0.5, 7],
    [12, -28, 8, 0.5],
    [9, -21, 2, 0.5],
    [15, -21, 2, 0.5],
  ]) {
    block(grotto, x, 1.1, z, w, 2.2, d, stone);
    colliders.push({
      minX: x - w / 2,
      maxX: x + w / 2,
      minZ: z - d / 2,
      maxZ: z + d / 2,
      id: "grotto-wall",
    });
  }
  const veilMat = new THREE.MeshStandardMaterial({
    color: "#182d3b",
    transparent: true,
    opacity: 0.94,
    roughness: 1,
  });
  mats.push(veilMat);
  const veil = block(grotto, 12, 1.2, -21, 4, 2.4, 0.2, veilMat);
  block(grotto, 12, 2.5, -21, 4.8, 0.45, 0.8, stone).name =
    "cutaway awning grotto lintel";
  for (let i = 0; i < 9; i++)
    oval(
      grotto,
      8.7 + (i % 5) * 1.6,
      0.3,
      -27 + (i % 3) * 1.6,
      0.38,
      0.45,
      0.32,
      stone,
    );
  const reflectionGeo = new THREE.CircleGeometry(2.4, 48);
  reflectionGeo.rotateX(-Math.PI / 2);
  geos.push(reflectionGeo);
  const reflection = new THREE.Mesh(reflectionGeo, poolMat);
  reflection.position.set(12, 0.03, -24.5);
  group.add(reflection);
  const lantern = new THREE.PointLight("#a2ecda", 0, 12, 2);
  lantern.position.set(12, 2, -24);
  group.add(lantern);
  for (const x of [10.2, 13.8])
    oval(group, x, 1.3, -20.5, 0.2, 0.35, 0.2, teal);
  // Three understated weather chimes foreshadow the rare encounter, never a map pin.
  const bell = new THREE.Group();
  bell.position.set(SITES.bell.x, 0, SITES.bell.z);
  group.add(bell);
  block(bell, 0, 0.6, 0, 1.5, 1.2, 1.1, stone);
  for (let i = 0; i < 3; i++) {
    const g = new THREE.TorusGeometry(0.26, 0.035, 8, 32);
    geos.push(g);
    const ring = new THREE.Mesh(g, gold);
    ring.position.set((i - 1) * 0.4, 1.55, 0.03);
    bell.add(ring);
  }
  const bellLight = new THREE.PointLight("#c3c5ef", 0, 16);
  bellLight.position.set(8, 2, 24);
  group.add(bellLight);
  const shell = new THREE.Group();
  shell.position.set(SITES.shell.x, 0.12, SITES.shell.z);
  group.add(shell);
  for (let i = 0; i < 7; i++) {
    const l = oval(
      shell,
      Math.sin(i * 0.35 - 0.95) * 0.25,
      0.04,
      Math.cos(i * 0.35 - 0.95) * 0.2,
      0.075,
      0.1,
      0.28,
      i % 2 ? gold : sand,
    );
    l.rotation.y = i * 0.35 - 0.95;
  }
  // Bench deliberately visible near the first habitat: changing weather is a physical rest action.
  for (const restSite of REST_SITES) {
    const bench = new THREE.Group();
    bench.position.set(restSite.x, 0, restSite.z);
    group.add(bench);
    block(bench, 0, 0.5, 0, 2, 0.16, 0.6, wood);
    block(bench, 0, 1, -0.28, 2, 0.65, 0.12, wood);
    for (const x of [-0.7, 0.7]) block(bench, x, 0.23, 0, 0.1, 0.5, 0.5, stone);
  }
  const rippleMat = new THREE.MeshBasicMaterial({
    color: "#d7eee4",
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
  });
  mats.push(rippleMat);
  const ripples: THREE.Mesh[] = [];
  for (let i = 0; i < 5; i++) {
    const g = new THREE.RingGeometry(0.95, 1, 48);
    g.rotateX(-Math.PI / 2);
    geos.push(g);
    const r = new THREE.Mesh(g, rippleMat);
    r.position.set(-34, 0.045, -7);
    group.add(r);
    ripples.push(r);
  }
  const rareRing = new THREE.Group();
  rareRing.position.set(14, 2, 29);
  group.add(rareRing);
  for (let i = 0; i < 3; i++) {
    const g = new THREE.TorusGeometry(2 + i * 0.25, 0.018, 6, 70);
    geos.push(g);
    const r = new THREE.Mesh(g, teal);
    r.rotation.set(i * 0.65, 0.4 + i * 0.4, 0);
    rareRing.add(r);
  }
  const skyFlash = new THREE.PointLight("#c8ccff", 0, 45);
  skyFlash.position.set(14, 9, 29);
  group.add(skyFlash);
  const fake = createWorld();
  fake.inventory = { food: 0, water: 0, medical: 0, fuel: 0 };
  return {
    group,
    colliders,
    update(s: WildlifeState, dt: number, time: number, quality: Quality) {
      fake.hour =
        s.weather === "fair"
          ? 5
          : s.weather === "rain"
            ? 36
            : s.weather === "dusk"
              ? 46
              : 59;
      fake.ended = false;
      base.update(fake, dt, time, s.player, quality);
      const legacyGate = base.group.getObjectByName("legacy-storm-gate");
      if (legacyGate) legacyGate.visible = false;
      tracks.visible = s.abilities.tracks;
      sniffTrail.visible = s.companion === "brindlefin" && !s.abilities.tracks;
      const trackEvent = s.events.find(
        (event) => event.kind === "ability" && event.species === "brindlefin",
      );
      const revealAge = trackEvent
        ? Math.max(0, s.elapsed - trackEvent.at)
        : 10;
      // Reveal follows the companion's sniff outward; old saves show the full
      // result immediately. count changes only draw range, never saved state.
      tracks.count = Math.min(
        30,
        Math.max(2, Math.ceil((revealAge / 1.8) * 15) * 2),
      );
      revealedSand.emissiveIntensity =
        revealAge < 2.4
          ? 0.7 + Math.sin(Math.min(1, revealAge / 2.4) * Math.PI) * 0.7
          : 0.25;
      shell.visible = !s.foundShell;
      const gateGoal = s.abilities.gate ? -37.3 : -34;
      gate.position.x = THREE.MathUtils.damp(gate.position.x, gateGoal, 4, dt);
      gate.rotation.y = THREE.MathUtils.damp(
        gate.rotation.y,
        s.abilities.gate ? 1.2 : 0,
        4,
        dt,
      );
      veil.visible = !s.abilities.light;
      lantern.intensity = THREE.MathUtils.damp(
        lantern.intensity,
        s.abilities.light ? 20 : 0,
        3,
        dt,
      );
      reflection.visible = s.weather === "dusk" || s.weather === "storm";
      pool.visible = s.weather !== "fair";
      ripples.forEach((r, i) => {
        r.visible = pool.visible;
        const p = (time * 0.3 + i * 0.2) % 1;
        r.scale.setScalar(p * 2.1);
      });
      bellLight.intensity =
        Object.values(s.abilities).filter(Boolean).length * 1.5;
      bell.children.forEach((o, i) => {
        if (i > 0) o.rotation.z = Math.sin(time * 2 + i) * 0.07;
      });
      rareRing.visible = s.rareRevealed && s.weather === "storm";
      rareRing.rotation.y = time * 0.18;
      const reveal = s.events.find((e) => e.kind === "reveal");
      skyFlash.intensity =
        reveal && s.elapsed - reveal.at < 3
          ? Math.max(0, 25 * (1 - (s.elapsed - reveal.at) / 3))
          : 0;
    },
    dispose() {
      base.dispose();
      approachTrail.dispose();
      sniffTrail.dispose();
      tracks.dispose();
      geos.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
    },
  };
}
