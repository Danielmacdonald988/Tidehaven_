import * as THREE from "three";
import {
  coastalFrond,
  tropicalCrown,
  mineralFinish,
  coastalWater,
} from "./VisualDetails";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { buildWildlifeWorld } from "../wildlife/World";
import {
  ROAD_ROUTE,
  REGION_SITES,
  surfaceHeight,
  type RegionState,
  type Collider,
  type Quality,
} from "./contracts";

/** Original, metre-scale coastal extension. Static material batches keep the region bounded. */
export function buildRegionWorld() {
  const base = buildWildlifeWorld(),
    group = new THREE.Group();
  group.name = "The connected coast";
  group.add(base.group);
  const colliders: Collider[] = [...base.colliders];
  const geometries: THREE.BufferGeometry[] = [],
    materials: THREE.Material[] = [],
    textures: THREE.Texture[] = [];
  const batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
  function mat(color: string, roughness = 0.85) {
    const m = new THREE.MeshStandardMaterial({ color, roughness });
    materials.push(m);
    return m;
  }
  const M = {
    earth: mat("#9eaa8a"),
    mud: mat("#71846d"),
    sand: mat("#c4b797"),
    road: mat("#414e51", 0.92),
    line: mat("#d1c6a1"),
    stone: mat("#8b9686"),
    wood: mat("#84694d"),
    dark: mat("#3f5550"),
    teal: mat("#528b83"),
    rust: mat("#ae7055"),
    cream: mat("#ded1ac"),
    roof: mat("#667f79"),
    leaf: mat("#426f50"),
    leaf2: mat("#64844d"),
    trunk: mat("#7f7860"),
    water: mat("#568e8b", 0.2),
    brass: mat("#b99d61", 0.5),
  };
  // Salt wear and mineral grain match the original town's muted, weathered surfaces.
  function weathered(
    material: THREE.MeshStandardMaterial,
    seed: number,
    style: "grain" | "wood" | "road",
  ) {
    if (typeof document === "undefined") return;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let rng = seed;
    const random = () => {
      rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0;
      return rng / 4294967296;
    };
    ctx.fillStyle = "#eeeadd";
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 6500; i++) {
      const shade = Math.floor(125 + random() * 100);
      ctx.fillStyle = `rgba(${shade},${shade},${shade},${style === "road" ? 0.32 : 0.2})`;
      ctx.fillRect(
        random() * 256,
        random() * 256,
        1 + random() * 2,
        style === "wood" ? 8 : 1 + random() * 2,
      );
    }
    for (let i = 0; i < 35; i++) {
      ctx.fillStyle = "rgba(75,83,71,.045)";
      ctx.beginPath();
      ctx.ellipse(
        random() * 256,
        random() * 256,
        8 + random() * 45,
        3 + random() * 20,
        random() * 3,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(style === "wood" ? 2 : 5, style === "wood" ? 2 : 5);
    texture.colorSpace = THREE.SRGBColorSpace;
    textures.push(texture);
    material.map = texture;
  }
  weathered(M.road, 41, "road");
  weathered(M.stone, 73, "grain");
  weathered(M.sand, 11, "grain");
  weathered(M.earth, 21, "grain");
  weathered(M.wood, 19, "wood");
  weathered(M.teal, 64, "grain");
  weathered(M.cream, 91, "grain");
  M.leaf.side = M.leaf2.side = THREE.DoubleSide;
  for (const [m, style, seed] of [
    [M.road, "asphalt", 41],
    [M.cream, "plaster", 73],
    [M.wood, "wood", 66],
    [M.roof, "metal", 77],
  ] as const)
    textures.push(mineralFinish(m, style, seed));
  const updateWater = coastalWater(M.water);
  const botanical = tropicalCrown(),
    pinnate = coastalFrond();
  geometries.push(botanical, pinnate);
  const cube = new THREE.BoxGeometry(1, 1, 1),
    cylinder = new THREE.CylinderGeometry(1, 1, 1, 8),
    sphere = new THREE.IcosahedronGeometry(1, 1);
  geometries.push(cube, cylinder, sphere);
  function shape(
    geo: THREE.BufferGeometry,
    m: THREE.Material,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    ry = 0,
    rz = 0,
    parent?: THREE.Object3D,
  ) {
    const o = new THREE.Mesh(geo, m);
    o.position.set(x, y, z);
    o.scale.set(sx, sy, sz);
    o.rotation.set(0, ry, rz);
    o.castShadow = o.receiveShadow = true;
    if (parent) parent.add(o);
    else {
      o.updateMatrix();
      const g = (geo.index ? geo.toNonIndexed() : geo.clone()).applyMatrix4(
        o.matrix,
      );
      const a = batches.get(m) || [];
      a.push(g);
      batches.set(m, a);
    }
    return o;
  }
  const box = (
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    m: THREE.Material,
    ry = 0,
    parent?: THREE.Object3D,
  ) => shape(cube, m, x, y, z, w, h, d, ry, 0, parent);
  const post = (
    x: number,
    y: number,
    z: number,
    r: number,
    h: number,
    m: THREE.Material,
    parent?: THREE.Object3D,
  ) => shape(cylinder, m, x, y, z, r, h, r, 0, 0, parent);
  function solid(x: number, z: number, w: number, d: number, id: string) {
    colliders.push({
      minX: x - w / 2,
      maxX: x + w / 2,
      minZ: z - d / 2,
      maxZ: z + d / 2,
      id,
    });
  }
  function sign(
    text: string,
    x: number,
    y: number,
    z: number,
    w: number,
    ry = 0,
  ) {
    if (typeof document === "undefined") return;
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 128;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#304c47";
    ctx.fillRect(0, 0, 512, 128);
    ctx.strokeStyle = "#c5b88e";
    ctx.lineWidth = 5;
    ctx.strokeRect(10, 10, 492, 108);
    ctx.fillStyle = "#e8ddbe";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "600 34px sans-serif";
    ctx.fillText(text, 256, 66, 475);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    textures.push(t);
    const m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.8 });
    materials.push(m);
    box(x, y, z, w, w / 4, 0.08, m, ry);
  }
  // Ground and ocean continue seamlessly beyond the original district.
  box(-77, -0.29, -1, 62, 0.55, 68, M.earth);
  box(77, -0.29, -1, 62, 0.55, 68, M.sand);
  box(77, -0.04, 7, 62, 0.08, 38, M.stone);
  box(76, -0.35, 44, 72, 0.12, 28, M.water);
  box(-77, -0.15, 30, 62, 0.15, 6, M.mud);
  // Continuous sampled surfaces eliminate intersecting stair-box seams on slopes.
  function terrain(
    minX: number,
    maxX: number,
    minZ: number,
    maxZ: number,
    m: THREE.Material,
    offset = 0,
  ) {
    const geo = new THREE.PlaneGeometry(
      maxX - minX,
      maxZ - minZ,
      Math.ceil((maxX - minX) * 4),
      Math.ceil((maxZ - minZ) * 4),
    );
    geo.rotateX(-Math.PI / 2);
    geo.translate((minX + maxX) / 2, 0, (minZ + maxZ) / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++)
      pos.setY(i, surfaceHeight({ x: pos.getX(i), z: pos.getZ(i) }) + offset);
    geo.computeVertexNormals();
    geometries.push(geo);
    const mesh = new THREE.Mesh(geo, m);
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  function ribbon(
    a: { x: number; z: number },
    b: { x: number; z: number },
    width: number,
    m: THREE.Material,
    offset: number,
    start = 0,
    end = 1,
  ) {
    const dx = b.x - a.x,
      dz = b.z - a.z,
      len = Math.hypot(dx, dz),
      steps = Math.max(1, Math.ceil(len * (end - start) * 3)),
      nx = ((dz / len) * width) / 2,
      nz = ((-dx / len) * width) / 2;
    const positions: number[] = [],
      uv: number[] = [];
    for (let i = 0; i < steps; i++) {
      const t0 = start + ((end - start) * i) / steps,
        t1 = start + ((end - start) * (i + 1)) / steps;
      const corners = [
        [a.x + dx * t0 + nx, a.z + dz * t0 + nz],
        [a.x + dx * t0 - nx, a.z + dz * t0 - nz],
        [a.x + dx * t1 + nx, a.z + dz * t1 + nz],
        [a.x + dx * t1 - nx, a.z + dz * t1 - nz],
      ];
      for (const j of [0, 1, 2, 2, 1, 3]) {
        const [x, z] = corners[j];
        positions.push(x, surfaceHeight({ x, z }) + offset, z);
        uv.push(j % 2, ((j < 2 ? t0 : t1) * len) / 6);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geo.computeVertexNormals();
    geometries.push(geo);
    const mesh = new THREE.Mesh(geo, m);
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  terrain(-108, -87.75, -35, -14.75, M.earth, -0.025);
  for (let n = 1; n < ROAD_ROUTE.length; n++) {
    const a = ROAD_ROUTE[n - 1],
      b = ROAD_ROUTE[n],
      len = Math.hypot(b.x - a.x, b.z - a.z);
    // The recognizable town keeps its original road artwork.
    if (a.x >= -40 && b.x <= 40) continue;
    ribbon(a, b, 6.2, M.road, 0.065);
    for (let d = 0; d < len; d += 4)
      ribbon(a, b, 0.09, M.line, 0.075, d / len, Math.min(1, (d + 1.8) / len));
  }
  ribbon({ x: -40, z: 20.5 }, { x: -38.5, z: 20.5 }, 6.2, M.road, 0.065);
  ribbon({ x: 38.5, z: 20.5 }, { x: 40, z: 20.5 }, 6.2, M.road, 0.065);
  // Marsh channel passes beneath a real raised road deck. Rails leave the road unobstructed.
  box(-52.5, -0.02, 4, 14, 0.08, 27, M.water);
  box(-52.5, -0.02, 28.5, 14, 0.08, 7, M.water);
  solid(-52.5, 4, 14, 27, "tidal-channel");
  solid(-52.5, 28.5, 14, 7, "tidal-channel");
  for (let x = -60; x <= -45; x += 1) {
    const h = surfaceHeight({ x, z: 20.5 });
    for (const z of [17.3, 23.7]) {
      post(x, h + 0.55, z, 0.07, 1.1, M.wood);
      box(x, h + 1, z, 0.98, 0.07, 0.09, M.wood);
    }
  }
  for (const x of [-60, -45]) {
    sign("TIDAL CROSSING", x, 1.7, 16, 3);
    post(x, 1, 16, 0.09, 2, M.wood);
  }
  const regionalRoofs: {
    group: THREE.Group;
    x: number;
    z: number;
    w: number;
    d: number;
  }[] = [];
  // Harbor freight house: open front, sheltered counter and walk-in loading bays.
  function building(
    x: number,
    z: number,
    w: number,
    d: number,
    color: THREE.Material,
    name: string,
  ) {
    box(x, 0.08, z, w, 0.18, d, M.cream);
    box(x, 1.8, z - d / 2, w, 3.6, 0.25, color);
    solid(x, z - d / 2, w, 0.25, name + " back");
    for (const side of [-1, 1]) {
      box(x + (side * w) / 2, 1.8, z, 0.25, 3.6, d, color);
      solid(x + (side * w) / 2, z, 0.25, d, name + " side");
      box(x + side * (w / 2 - 1.5), 1.8, z + d / 2, 3, 3.6, 0.25, color);
      solid(x + side * (w / 2 - 1.5), z + d / 2, 3, 0.25, name + " front");
    }
    // Deep joinery, weatherboard ends and sills share the town's salt-worn treatment.
    for (const side of [-1, 1]) {
      box(
        x + side * (w / 2 - 0.1),
        1.8,
        z + d / 2 + 0.16,
        0.18,
        3.6,
        0.2,
        M.cream,
      );
      box(x + side * (w / 2 - 0.2), 3.55, z, 0.22, 0.18, d + 0.6, M.cream);
      for (let y = 0.25; y < 3.5; y += 0.28)
        box(x + side * (w / 2 + 0.14), y, z, 0.025, 0.025, d, M.dark);
    }
    // Individually cut away the pitched roof when inside, like the original neighborhood.
    const roofGroup = new THREE.Group();
    roofGroup.name = `${name} removable roof`;
    group.add(roofGroup);
    regionalRoofs.push({ group: roofGroup, x, z, w, d });
    // Pitched roof halves keep tall central entrance legible from a follow camera.
    for (const side of [-1, 1])
      shape(
        cube,
        M.roof,
        x + (side * w) / 4,
        3.95,
        z,
        w / 2 + 0.5,
        0.18,
        d + 0.7,
        0,
        side * -0.19,
        roofGroup,
      );
    for (const side of [-1, 1])
      for (let rib = z - d / 2; rib <= z + d / 2; rib += 0.8)
        shape(
          cube,
          M.dark,
          x + (side * w) / 4,
          4.065,
          rib,
          w / 2 + 0.45,
          0.025,
          0.035,
          0,
          side * -0.19,
          roofGroup,
        );
    box(x, 3.99 + w * 0.0475, z, 0.09, 0.12, d + 0.75, M.dark, 0, roofGroup);
    for (let px = x - w / 2 + 0.6; px < x + w / 2; px += 1.1)
      box(px, 1.8, z - d / 2 + 0.15, 0.045, 3.5, 0.04, M.cream);
    if (name !== "TIDEWAY FREIGHT")
      sign(name, x, 3.05, z + d / 2 + 0.18, Math.min(w - 1, 7));
  }
  building(70, 5, 16, 12, M.teal, "TIDEWAY FREIGHT");
  box(65, 1, 6, 3.5, 1.1, 1.1, M.wood);
  solid(65, 6, 3.5, 1.1, "dispatch-counter");
  for (let i = 0; i < 6; i++) {
    box(
      76,
      0.5 + (i % 2),
      1 + Math.floor(i / 2) * 1.5,
      1.2,
      0.95,
      1.1,
      i % 2 ? M.rust : M.cream,
    );
  }
  // Walkway, bay lines and storm drains organize the freight forecourt without blocking its approaches.
  box(70, 0.045, 13.7, 20, 0.09, 1.4, M.cream);
  box(70, 0.045, -3, 20, 0.09, 1.2, M.cream);
  for (let x = 61; x <= 79; x += 1.5)
    box(x, 0.095, 13.7, 0.025, 0.015, 1.35, M.stone);
  for (const x of [72, 76.5]) box(x, 0.065, 15.7, 0.12, 0.025, 3.6, M.line);
  box(74.25, 0.065, 17.5, 4.6, 0.025, 0.12, M.line);
  for (let x = 42; x < 104; x += 8) {
    box(x, 0.07, 26, 1.3, 0.025, 0.45, M.dark);
    for (let j = 0; j < 8; j++)
      box(x - 0.55 + j * 0.16, 0.09, 26, 0.035, 0.02, 0.4, M.stone);
  }
  // Corrugated side panels, shaded clerestories, downpipes and a loading canopy.
  for (const side of [-1, 1]) {
    for (let z = -0.7; z < 11; z += 0.65)
      box(70 + side * 8.14, 1.6, z, 0.05, 3.1, 0.065, M.cream);
    for (const z of [1, 4, 7]) {
      box(70 + side * 8.17, 2.45, z, 0.06, 0.75, 1.8, M.dark);
      box(70 + side * 8.21, 2.45, z, 0.035, 0.64, 1.66, M.water);
      box(70 + side * 8.24, 2.45, z, 0.04, 0.7, 0.06, M.cream);
    }
    post(70 + side * 7.7, 1.5, 11.35, 0.08, 3, M.dark);
  }
  // Thin supported canopy: no visually floating concrete slab or obstructing posts.
  box(70, 3.3, 11.95, 8, 0.055, 1.8, M.dark);
  box(70, 3.23, 12.84, 8, 0.16, 0.06, M.teal);
  for (const x of [66.1, 73.9]) {
    box(x, 2.9, 11.2, 0.1, 0.8, 0.1, M.dark);
    // Braces are baked by shape; sloped beam geometry carries its angle directly.
    const g = new THREE.BoxGeometry(0.075, 0.075, 1.7);
    g.rotateX(-0.3);
    geometries.push(g);
    shape(g, M.dark, x, 3.02, 11.92, 1, 1, 1);
  }
  for (let rib = 0; rib < 10; rib++)
    box(66.15 + rib * 0.85, 3.345, 11.95, 0.035, 0.025, 1.82, M.roof);
  sign("TIDEWAY FREIGHT", 70, 3.58, 12.88, 6.2);
  sign("COLLECTION  /  8 CRATES", 74, 1.6, 11.25, 3.7);
  sign("DISPATCH", 65, 1.8, 6.6, 2.7);
  for (const x of [58, 81]) {
    box(x, 0.15, 15, 2, 0.3, 1.1, M.stone);
    for (let i = 0; i < 5; i++)
      shape(
        sphere,
        i % 2 ? M.leaf : M.leaf2,
        x - 0.8 + i * 0.4,
        0.65,
        15,
        0.4,
        0.5,
        0.4,
      );
    solid(x, 15, 2, 1.1, "harbor-planter");
  }

  for (const [x, z, c] of [
    [88, -11, M.rust],
    [76, -20, M.teal],
    [59, -18, M.cream],
  ] as const) {
    box(x, 1.25, z, 9, 2.5, 4, c);
    solid(x, z, 9, 4, "freight-container");
    for (let xx = x - 4.3; xx < x + 4.4; xx += 0.55)
      box(xx, 1.25, z + 2.025, 0.07, 2.35, 0.04, M.dark);
    box(x, 2.56, z, 9.1, 0.12, 4.1, M.roof);
  }
  // Crane, mooring quay, boatyard and safe rescue pier create a recognizable industrial skyline.
  for (const x of [87, 97]) {
    box(x, 4.1, 30, 0.45, 8.2, 0.5, M.rust);
    solid(x, 30, 0.6, 0.6, "crane-leg");
  }
  box(92, 8.1, 30, 13, 0.5, 0.6, M.rust);
  box(92, 7.7, 30, 0.1, 0.7, 0.1, M.dark);
  post(92, 5.6, 30, 0.045, 4, M.dark);
  for (let x = 42; x < 106; x += 6) {
    post(x, 0.65, 31, 0.16, 1.3, M.dark);
    box(x + 2.7, 0.9, 31, 5.2, 0.07, 0.08, M.wood);
  }
  box(91, 0.055, 25, 13, 0.08, 12, M.water);
  solid(86.5, 25.5, 3, 11, "harbor-slip-water");
  solid(95.5, 25.5, 3, 11, "harbor-slip-water");
  box(84.5, 0.13, 25, 0.35, 0.25, 12, M.stone);
  box(97.5, 0.13, 25, 0.35, 0.25, 12, M.stone);
  for (let z = 19; z <= 29; z += 0.45) box(91, 0.12, z, 5, 0.22, 0.4, M.wood);
  for (const x of [88.6, 93.4])
    for (const z of [19, 24, 29]) post(x, 0.65, z, 0.11, 1.3, M.wood);
  const obstruction = new THREE.Group();
  group.add(obstruction);
  box(90, 0.5, 22, 2.1, 0.65, 0.6, M.wood, 0.6, obstruction);
  box(92, 0.45, 22.3, 1.7, 0.7, 0.6, M.rust, -0.4, obstruction);
  post(84, 0.85, 17.1, 0.1, 1.7, M.wood);
  box(84, 1.2, 17.1, 1, 0.8, 0.08, M.cream);
  const lifeRingGeo = new THREE.TorusGeometry(0.45, 0.1, 8, 20);
  geometries.push(lifeRingGeo);
  shape(lifeRingGeo, M.rust, 84, 1.2, 17, 1, 1, 1);
  sign("SAFE QUAY", 84, 2.1, 17.1, 2.5);
  // Mooring equipment and stacked timber sit beyond the driving lane, each at credible human scale.
  const ropeGeo = new THREE.TorusGeometry(0.42, 0.035, 5, 20);
  ropeGeo.rotateX(Math.PI / 2);
  geometries.push(ropeGeo);
  for (const x of [47, 61, 76, 101]) {
    post(x, 0.23, 28, 0.3, 0.46, M.dark);
    box(x, 0.48, 28, 0.85, 0.12, 0.22, M.dark);
    for (let i = 0; i < 4; i++) {
      shape(
        ropeGeo,
        M.wood,
        x + 0.8,
        0.11 + i * 0.045,
        28,
        1 + i * 0.08,
        1 + i * 0.08,
        1,
      );
    }
  }
  for (let i = 0; i < 5; i++)
    box(55, 0.2 + i * 0.18, 28, 3.2, 0.15, 0.2, M.wood, 0.03 * i);
  for (const [x, z] of [
    [48, 9],
    [52, -7],
    [100, 26],
  ] as const) {
    post(x, 0.5, z, 0.42, 1, M.teal);
    post(x, 0.99, z, 0.44, 0.08, M.dark);
    post(x, 0.1, z, 0.44, 0.08, M.dark);
    solid(x, z, 0.9, 0.9, "quay-barrel");
  }
  const harborFrond = pinnate.clone().rotateX(-Math.PI / 2 + 0.3);
  geometries.push(harborFrond);
  for (const [x, z] of [
    [45, -15],
    [103, 15],
    [55, 1],
  ] as const) {
    post(x, 2.2, z, 0.19, 4.4, M.trunk);
    for (let i = 0; i < 9; i++)
      shape(
        harborFrond,
        i % 2 ? M.leaf : M.leaf2,
        x,
        4.45,
        z,
        1,
        1,
        1,
        (i * Math.PI * 2) / 9,
      );
    solid(x, z, 0.45, 0.45, "harbor-palm");
  }
  sign("HARBOR • 02", 48, 2.4, 16, 4);
  post(48, 1.2, 16, 0.13, 2.4, M.wood);
  // Wetlands station: approachable cabin, rain barrels, collection bench and hanging canopy.
  building(-67, 10, 10, 9, M.wood, "FERN REACH");
  box(-64, 0.8, 10, 2.2, 1.4, 0.8, M.teal);
  solid(-64, 10, 2.2, 0.8, "field-counter");
  for (const x of [-73, -61]) post(x, 0.65, 12, 0.55, 1.3, M.teal);
  sign("FERN REACH • 03", -63, 2.5, 24, 4);
  post(-63, 1.25, 24, 0.13, 2.5, M.wood);
  // Footpath and gate reveal a separate northbound expedition route.
  ribbon({ x: -75, z: 10 }, { x: -81, z: -5 }, 2.3, M.sand, 0.035);
  ribbon({ x: -81, z: -5 }, { x: -92, z: -23 }, 2.4, M.sand, 0.035);
  const gate = new THREE.Group();
  gate.position.set(-81, 0, -5);
  group.add(gate);
  for (let i = 0; i < 3; i++)
    box(0, 0.3 + i * 0.3, 0, 4.2, 0.22, 0.27, M.wood, 0.09 * (i - 1), gate);
  for (const x of [-1.8, 1.8]) post(x, 0.6, 0, 0.1, 1.2, M.wood, gate);
  for (const x of [-85, -77]) {
    solid(x, -5, 4, 0.9, "shortcut-rock-bank");
    for (let i = 0; i < 5; i++)
      shape(
        sphere,
        M.stone,
        x - 1.6 + i * 0.8,
        0.65 + (i % 2) * 0.2,
        -5,
        0.7,
        0.8,
        0.65,
      );
  }
  const clue = new THREE.Group();
  group.add(clue);
  for (let i = 0; i < 9; i++)
    for (const side of [-1, 1])
      shape(
        sphere,
        M.dark,
        -75 - i * 0.55 + side * 0.12,
        0.1,
        10 - i * 0.9,
        0.08,
        0.025,
        0.14,
        0,
        0,
        clue,
      );
  // Ancient tidal observatory: broken stone arcade overlooking the region; elevation follows shared surface.
  for (const x of [-99, -87])
    for (const z of [-27, -20]) {
      const h = surfaceHeight({ x, z });
      post(x, h + 1.7, z, 0.48, 3.4, M.stone);
      post(x, h + 0.15, z, 0.7, 0.3, M.stone);
      post(x, h + 3.2, z, 0.7, 0.3, M.stone);
      solid(x, z, 1, 1, "observatory-column");
    }
  box(-93, 5, -27, 12, 0.55, 1.2, M.stone);
  terrain(-96.5, -89.5, -27.5, -22.5, M.stone, 0.01);
  sign("TIDAL OBSERVATORY", -90, 3.2, -27.65, 4);
  const relic = new THREE.Group();
  relic.position.set(
    REGION_SITES.ruin.x,
    surfaceHeight(REGION_SITES.ruin),
    REGION_SITES.ruin.z,
  );
  group.add(relic);
  shape(lifeRingGeo, M.brass, 0, 0.45, 0, 1, 1, 1, 0, 0, relic);
  post(0, 0.15, 0, 0.3, 0.3, M.stone, relic);
  // Instanced woodland: broad crowns, leaning trunks and low fern clusters, kept off designated roads/paths.
  const trunks: THREE.Matrix4[] = [],
    crowns: THREE.Matrix4[] = [],
    ferns: THREE.Matrix4[] = [];
  const dummy = new THREE.Object3D();
  function instance(
    list: THREE.Matrix4[],
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
  ) {
    dummy.position.set(x, y, z);
    dummy.scale.set(sx, sy, sz);
    dummy.rotation.set(0, x * 0.31, Math.sin(x) * 0.08);
    dummy.updateMatrix();
    list.push(dummy.matrix.clone());
  }
  function nearRoad(x: number, z: number) {
    return ROAD_ROUTE.some((a, i) => {
      const b = ROAD_ROUTE[i + 1];
      if (!b) return false;
      const dx = b.x - a.x,
        dz = b.z - a.z,
        t = Math.max(
          0,
          Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz)),
        );
      return Math.hypot(x - a.x - t * dx, z - a.z - t * dz) < 5;
    });
  }
  for (let i = 0; i < 105; i++) {
    const x = -105 + ((i * 19.73) % 62),
      z = -33 + ((i * 13.87) % 62);
    if (
      nearRoad(x, z) ||
      (x > -77 && x < -58 && z > 3 && z < 17) ||
      (x < -74 && x > -96 && z > -27 && z < 13)
    )
      continue;
    const h = surfaceHeight({ x, z }),
      height = 3.3 + (i % 5) * 0.6;
    instance(trunks, x, h + height / 2, z, 0.23, height, 0.23);
    instance(crowns, x, h + height, z, 1.7 + (i % 3) * 0.3, 1.6, 1.8);
    // Split branches and root buttresses connect the open leaf silhouette to the ground.
    for (const side of [-1, 1])
      shape(
        cylinder,
        M.trunk,
        x + side * 0.35,
        h + height * 0.8,
        z,
        0.11,
        height * 0.45,
        0.11,
        0,
        side * 0.44,
      );
    for (let root = 0; root < 3; root++)
      shape(
        cylinder,
        M.trunk,
        x + Math.sin(root * 2.1) * 0.2,
        h + 0.3,
        z + Math.cos(root * 2.1) * 0.2,
        0.1,
        0.65,
        0.1,
        root * 2.1,
        0.36,
      );
    solid(x, z, 0.55, 0.55, "mangrove");
    for (let j = 0; j < 3; j++)
      instance(
        ferns,
        x + Math.sin(j * 2) * 1.5,
        h + 0.4,
        z + Math.cos(j * 2) * 1.5,
        0.8,
        0.4,
        0.8,
      );
  }
  for (const [geo, m, list] of [
    [cylinder, M.trunk, trunks],
    [botanical, M.leaf, crowns],
    [botanical, M.leaf2, ferns],
  ] as const) {
    const mesh = new THREE.InstancedMesh(geo, m, list.length);
    if (list === crowns) mesh.name = "region-canopy";
    list.forEach((a, i) => mesh.setMatrixAt(i, a));
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
  }
  // Reed beds are batched and animated as one patch rather than thousands of scene objects.
  const reeds = new THREE.Group();
  group.add(reeds);
  for (let i = 0; i < 28; i++) {
    const x = -59 + (i % 7) * 2,
      z = -8 + Math.floor(i / 7) * 6;
    shape(
      sphere,
      M.leaf2,
      x,
      0.65,
      z,
      0.12,
      1.2,
      0.15,
      0,
      Math.sin(i) * 0.2,
      reeds,
    );
  }
  // Base improvement geometry and real delivery cargo remain tied to committed state.
  const cargo = new THREE.Group();
  group.add(cargo);
  cargo.position.set(REGION_SITES.cargo.x, 0, REGION_SITES.cargo.z);
  for (let i = 0; i < 8; i++) {
    box(
      (i % 2) * 0.9,
      0.45 + Math.floor(i / 4) * 0.85,
      Math.floor((i % 4) / 2) * 0.9,
      0.8,
      0.8,
      0.8,
      M.cream,
      0,
      cargo,
    );
    box(
      (i % 2) * 0.9,
      0.45 + Math.floor(i / 4) * 0.85,
      Math.floor((i % 4) / 2) * 0.9,
      0.12,
      0.82,
      0.82,
      M.teal,
      0,
      cargo,
    );
  }
  const homeCargo = cargo.clone(true);
  homeCargo.position.set(-26, 0, 12);
  group.add(homeCargo);
  const shelter = new THREE.Group();
  shelter.name = "cutaway awning creature shelter";
  shelter.position.set(-8.5, 0, -7);
  group.add(shelter);
  for (const x of [-28, -23])
    for (const z of [19, 23]) post(x, 1.2, z, 0.09, 2.4, M.wood, shelter);
  box(-25.5, 2.5, 21, 5.5, 0.15, 4.6, M.teal, 0, shelter);
  for (let i = 0; i < 3; i++)
    shape(
      sphere,
      M.sand,
      -27 + i * 1.5,
      0.2,
      21,
      0.6,
      0.18,
      0.65,
      0,
      0,
      shelter,
    );
  const homeRelic = new THREE.Group();
  group.add(homeRelic);
  box(-24, 0.6, 12, 1.1, 1.2, 1.1, M.stone, 0, homeRelic);
  shape(lifeRingGeo, M.brass, -24, 1.7, 12, 1, 1, 1, 0, 0, homeRelic);
  const bench = new THREE.Group();
  bench.position.set(1, 0, 4);
  group.add(bench);
  box(-26, 0.9, 10, 2.8, 0.17, 1, M.wood, 0, bench);
  for (const x of [-27, -25])
    box(x, 0.45, 10, 0.12, 0.9, 0.8, M.dark, 0, bench);
  box(-26, 1.1, 10, 0.8, 0.25, 0.55, M.teal, 0, bench);
  for (const [id, p] of Object.entries(REGION_SITES)) {
    const marker = new THREE.Object3D();
    marker.position.set(p.x, surfaceHeight(p), p.z);
    marker.userData.regionTarget = id;
    group.add(marker);
  }
  // Deliberate roadside salt gardens stitch the empty transition parcels to existing landmarks.
  // Flat gravel and soft planting stay outside the road ribbon and never change collision.
  for (const [x, z] of [
    [43, 13],
    [48, 12],
    [54, 10],
    [59, 8],
    [98, 10],
    [100, 4],
    [-42, 13],
    [-43, 9],
    [-61, 3],
    [-73, 3],
  ]) {
    const y = surfaceHeight({ x, z });
    shape(sphere, M.sand, x, y + 0.025, z, 2.15, 0.035, 1.15, 0.3);
    for (let i = 0; i < 7; i++) {
      const dx = Math.sin(i * 2.4) * (1 + (i % 2)) * 0.55,
        dz = Math.cos(i * 2.4) * 0.6;
      shape(
        botanical,
        i % 2 ? M.leaf : M.leaf2,
        x + dx,
        y + 0.25,
        z + dz,
        0.42,
        0.4 + (i % 3) * 0.06,
        0.42,
        i * 0.9,
      );
    }
    for (let i = 0; i < 3; i++)
      shape(sphere, M.stone, x - 1 + i, y + 0.12, z + 0.7, 0.3, 0.14, 0.23, i);
  }
  // Merge roof seams per material while retaining each cutaway parent.
  for (const roof of regionalRoofs) {
    const parts = new Map<THREE.Material, THREE.Mesh[]>();
    for (const child of roof.group.children)
      if (child instanceof THREE.Mesh && !Array.isArray(child.material)) {
        const a = parts.get(child.material) || [];
        a.push(child);
        parts.set(child.material, a);
      }
    for (const [m, meshes] of parts) {
      const copies = meshes.map((o) => {
        o.updateMatrix();
        return (
          o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()
        ).applyMatrix4(o.matrix);
      });
      const merged = mergeGeometries(copies);
      copies.forEach((g) => g.dispose());
      if (merged) {
        geometries.push(merged);
        meshes.forEach((o) => roof.group.remove(o));
        const mesh = new THREE.Mesh(merged, m);
        mesh.castShadow = mesh.receiveShadow = true;
        roof.group.add(mesh);
      }
    }
  }
  // Eight authored depressions catch the sky only in actual wet weather, one instanced draw.
  const puddleGeo = new THREE.CircleGeometry(1, 24);
  puddleGeo.rotateX(-Math.PI / 2);
  const pp = puddleGeo.attributes.position;
  for (let i = 1; i < pp.count; i++) {
    const f = 0.86 + Math.sin(i * 2.31) * 0.1;
    pp.setX(i, pp.getX(i) * f);
    pp.setZ(i, pp.getZ(i) * f);
  }
  pp.needsUpdate = true;
  geometries.push(puddleGeo);
  const puddleMat = new THREE.MeshStandardMaterial({
    color: "#284c57",
    roughness: 0.28,
    metalness: 0.12,
    envMapIntensity: 0.18,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });
  materials.push(puddleMat);
  const puddles = new THREE.InstancedMesh(puddleGeo, puddleMat, 8);
  const patches = [
    [-26, 22, 2.1, 0.6],
    [-15, 18.7, 1.4, 0.48],
    [62, 21.7, 2, 0.65],
    [78, 16.5, 1.3, 0.45],
    [82, 10.5, 1.4, 0.55],
    [-64, 21.8, 1.8, 0.55],
    [-44, 22, 1.3, 0.4],
    [8, 22.5, 1.6, 0.5],
  ];
  patches.forEach(([x, z, w, d], i) => {
    dummy.position.set(x, surfaceHeight({ x, z }) + 0.079, z);
    dummy.rotation.set(0, i * 0.64, 0);
    dummy.scale.set(w, 1, d);
    dummy.updateMatrix();
    puddles.setMatrixAt(i, dummy.matrix);
  });
  puddles.receiveShadow = true;
  group.add(puddles);
  for (const [m, gs] of batches) {
    const merged = mergeGeometries(gs);
    gs.forEach((g) => g.dispose());
    if (merged) {
      geometries.push(merged);
      const mesh = new THREE.Mesh(merged, m);
      mesh.castShadow = mesh.receiveShadow = true;
      mesh.userData.visualStatic = true;
      group.add(mesh);
    }
  }
  return {
    group,
    colliders,
    update(s: RegionState, dt: number, time: number, quality: Quality) {
      base.update(s.wildlife, dt, time, quality);
      updateWater(time);
      puddleMat.opacity = THREE.MathUtils.damp(
        puddleMat.opacity,
        s.wildlife.weather === "rain" || s.wildlife.weather === "storm"
          ? 0.42
          : 0.025,
        1.5,
        dt,
      );
      puddles.visible = puddleMat.opacity > 0.03;
      for (const roof of regionalRoofs)
        roof.group.visible = !(
          Math.abs(s.wildlife.player.x - roof.x) < roof.w / 2 &&
          Math.abs(s.wildlife.player.z - roof.z) < roof.d / 2
        );
      cargo.visible =
        s.delivery.status === "accepted" || s.delivery.status === "available";
      homeCargo.visible = s.delivery.status === "complete";
      shelter.visible = s.upgrades.shelter;
      bench.visible = s.upgrades.workbench;
      homeRelic.visible = s.expedition.complete;
      gate.position.x = THREE.MathUtils.damp(
        gate.position.x,
        s.expedition.shortcut ? -84 : -81,
        4,
        dt,
      );
      gate.rotation.y = THREE.MathUtils.damp(
        gate.rotation.y,
        s.expedition.shortcut ? 1.1 : 0,
        4,
        dt,
      );
      clue.visible = !s.expedition.complete;
      relic.visible = !s.expedition.relic;
      relic.rotation.y = time * 0.3;
      obstruction.visible = s.assistance.status !== "complete";
      reeds.rotation.z = Math.sin(time * 1.7) * 0.025;
    },
    dispose() {
      base.dispose();
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
    },
  };
}
