import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  PLACES,
  type EnvironmentHandle,
  type Collider,
  type Interaction,
  type Point,
} from "./shared";

/** Original procedural architecture. Dimensions use metres, Y is up. */
export function buildEnvironment(
  campaignEnabled = true,
  wildlifeHabitats = false,
): EnvironmentHandle {
  const group = new THREE.Group();
  group.name = "Bellwether neighborhood";
  const colliders: Collider[] = [];
  const interactions: Interaction[] = [];
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const textures: THREE.Texture[] = [];
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  geometries.push(boxGeo);
  const material = (color: string, roughness = 0.86) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness });
    materials.push(m);
    return m;
  };
  const M = {
    sand: material("#d5c5a0"),
    ground: material("#9eae91"),
    road: material("#78817b"),
    curb: material("#dcd8c2"),
    cream: material("#e2d8bc"),
    white: material("#f3ebd5"),
    wood: material("#886f51"),
    darkWood: material("#5a6251"),
    teal: material("#5c8980"),
    darkTeal: material("#315d57"),
    coral: material("#bb765c"),
    roof: material("#727e76"),
    glass: material("#426d72", 0.32),
    metal: material("#5e706b", 0.5),
    brass: material("#b6a473", 0.5),
    leaf: material("#758b61"),
    leafLight: material("#92a078"),
    trunk: material("#95846b"),
    shadow: material("#596c5b"),
    food: material("#b7a16f"),
    water: material("#7da6a4"),
    medical: material("#ded7c4"),
    fuel: material("#bb7c51"),
  };
  // Original deterministic material studies: broad wear remains legible at the distant camera,
  // while fine mineral grain breaks up close surfaces. Generated once, never per frame.
  function weathered(
    mat: THREE.MeshStandardMaterial,
    seed: number,
    repeat: number,
    style: "stone" | "earth" | "paint" | "wood",
  ) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext("2d")!;
    let rng = seed;
    const random = () => {
      rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0;
      return rng / 4294967296;
    };
    ctx.fillStyle = "#f1f0e8";
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 70; i++) {
      ctx.fillStyle =
        style === "earth" ? "rgba(104,104,76,.045)" : "rgba(63,69,66,.035)";
      const x = random() * 256,
        y = random() * 256,
        radius = 12 + random() * 45;
      ctx.beginPath();
      ctx.ellipse(
        x,
        y,
        radius,
        radius * (0.3 + random() * 0.7),
        random() * 3,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    for (let i = 0; i < 11000; i++) {
      const shade = Math.floor(150 + random() * 105);
      ctx.fillStyle = `rgba(${shade},${shade},${shade},${style === "paint" ? 0.15 : 0.36})`;
      ctx.fillRect(
        random() * 256,
        random() * 256,
        1 + random() * 2,
        style === "wood" ? 7 : 1 + random() * 2,
      );
    }
    if (style === "paint") {
      // Salt-stained bottom edge and fine vertical runoff, no fake damage state.
      for (let i = 0; i < 30; i++) {
        ctx.fillStyle = "rgba(110,100,78,.035)";
        ctx.fillRect(
          random() * 256,
          170 + random() * 80,
          0.5 + random() * 2,
          70,
        );
      }
      ctx.strokeStyle = "rgba(86,83,69,.18)";
      ctx.lineWidth = 1;
      ctx.strokeRect(6, 6, 244, 244);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeat, repeat);
    texture.colorSpace = THREE.SRGBColorSpace;
    textures.push(texture);
    mat.map = texture;
    if (style === "stone" || style === "earth") {
      mat.bumpMap = texture;
      mat.bumpScale = style === "stone" ? 0.035 : 0.05;
    }
  }
  weathered(M.ground, 26, 7, "earth");
  weathered(M.sand, 42, 6, "earth");
  weathered(M.road, 85, 8, "stone");
  weathered(M.wood, 71, 2, "wood");
  weathered(M.cream, 199, 1, "paint");
  weathered(M.teal, 291, 1, "paint");
  weathered(M.white, 744, 1, "paint");
  const buckets = new Map<THREE.Material, THREE.Matrix4[]>();
  function block(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    mat: THREE.Material,
    rotation = 0,
  ) {
    const matrix = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 1, 0),
        rotation,
      ),
      new THREE.Vector3(w, h, d),
    );
    if (!buckets.has(mat)) buckets.set(mat, []);
    buckets.get(mat)!.push(matrix);
  }
  function collider(x: number, z: number, w: number, d: number, id?: string) {
    colliders.push({
      minX: x - w / 2,
      maxX: x + w / 2,
      minZ: z - d / 2,
      maxZ: z + d / 2,
      id,
    });
  }
  function mesh(
    geometry: THREE.BufferGeometry,
    mat: THREE.Material,
    parent: THREE.Object3D = group,
  ) {
    const m = new THREE.Mesh(geometry, mat);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  function cylinder(
    x: number,
    y: number,
    z: number,
    r: number,
    height: number,
    mat: THREE.Material,
    segments = 8,
  ) {
    const geo = new THREE.CylinderGeometry(r, r, height, segments);
    geometries.push(geo);
    const m = mesh(geo, mat);
    m.position.set(x, y, z);
    return m;
  }
  function sign(
    text: string,
    sub: string,
    x: number,
    y: number,
    z: number,
    width: number,
    color = "#315d57",
    height = 0.95,
  ) {
    const canvas = document.createElement("canvas");
    canvas.width = 768;
    canvas.height = 192;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 768, 192);
    ctx.strokeStyle = "#e9ddbc";
    ctx.lineWidth = 3;
    ctx.strokeRect(14, 14, 740, 164);
    ctx.fillStyle = "#f4ebce";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "600 54px Georgia";
    ctx.fillText(text, 384, sub ? 75 : 98, 700);
    if (sub) {
      ctx.font = "21px sans-serif";
      ctx.fillText(sub, 384, 133, 700);
    }
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    textures.push(t);
    const mat = new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 });
    materials.push(mat);
    const geo = new THREE.PlaneGeometry(width, height);
    geometries.push(geo);
    const m = mesh(geo, mat);
    m.position.set(x, y, z);
    return m;
  }
  function plankFloor(x: number, z: number, w: number, d: number) {
    block(x, 0.09, z, w, 0.18, d, M.wood);
    for (let i = -w / 2 + 0.4; i < w / 2; i += 0.7)
      block(x + i, 0.19, z, 0.025, 0.014, d - 0.1, M.darkWood);
  }
  // The shore curves around a walkable, gently worn town square.
  block(0, -0.32, 0, 100, 0.6, 66, M.ground);
  block(0, -0.12, 30, 100, 0.25, 8, M.sand);
  block(0, -0.015, 1.2, 78, 0.12, 9.5, M.road);
  block(0, -0.015, 20.5, 78, 0.12, 6, M.road);
  block(-11, -0.01, 9, 6, 0.12, 43, M.road);
  block(13, -0.01, 9, 5.5, 0.12, 43, M.road);
  for (const z of [-3.8, 6.2, 16.9, 24.1]) {
    block(0, 0.09, z, 78, 0.18, 1.3, M.curb);
    for (let x = -38; x < 39; x += 2)
      block(x, 0.188, z, 0.024, 0.008, 1.25, M.road);
  }
  for (let x = -35; x < 39; x += 6) {
    block(x, 0.056, 1.3, 2.7, 0.012, 0.1, M.cream);
    block(x, 0.056, 20.5, 2.7, 0.012, 0.08, M.cream);
  }
  // Painted crossing, drainage grates and curb cuts are visual grounding details.
  for (let i = 0; i < 7; i++)
    block(-11, 0.067, -2 + i * 0.95, 3.8, 0.013, 0.38, M.white);
  for (const x of [-34, -17, 8, 34]) {
    block(x, 0.19, 5.9, 1, 0.02, 0.38, M.metal);
    for (let j = 0; j < 6; j++)
      block(x - 0.4 + j * 0.16, 0.208, 5.9, 0.045, 0.015, 0.4, M.darkTeal);
  }
  const roofs: {
    object: THREE.Group;
    occluders: THREE.Group;
    center: Point;
    w: number;
    d: number;
  }[] = [];
  function building(
    id: string,
    x: number,
    z: number,
    w: number,
    d: number,
    color: THREE.Material,
    roofMat: THREE.Material,
  ) {
    const h = id === "warehouse" ? 5 : 4.5;
    const front = z + d / 2,
      back = z - d / 2;
    const opening = id === "warehouse" ? 4.8 : 3.2;
    const wall = 0.3;
    const frontOccluders = new THREE.Group();
    frontOccluders.name = `${id} interior cutaway header`;
    group.add(frontOccluders);
    const cutawayBlock = (
      bx: number,
      by: number,
      bz: number,
      bw: number,
      bh: number,
      bd: number,
      mat: THREE.Material,
    ) => {
      const piece = mesh(boxGeo, mat, frontOccluders);
      piece.position.set(bx, by, bz);
      piece.scale.set(bw, bh, bd);
      piece.userData.wallId = `${id}-front-header`;
      return piece;
    };
    block(x, 0.025, z, w, 0.1, d, M.cream);
    // Real door gaps: the avatar can enter every featured building.
    for (const sx of [-1, 1]) {
      block(
        x + sx * (w / 4 + opening / 4),
        h / 2,
        front,
        (w - opening) / 2,
        h,
        wall,
        color,
      );
      collider(
        x + sx * (w / 4 + opening / 4),
        front,
        (w - opening) / 2,
        wall,
        `${id}-front`,
      );
      block(x + sx * (w / 2 - 0.15), h / 2, z, wall, h, d, color);
      collider(x + sx * (w / 2 - 0.15), z, wall, d, `${id}-side`);
    }
    block(x, h / 2, back, w, h, wall, color);
    collider(x, back, w, wall, `${id}-back`);
    cutawayBlock(x, h - 0.4, front, opening, 0.8, wall, color);
    for (const sx of [-1, 1]) {
      block(
        x + sx * (opening / 2 + 0.08),
        1.6,
        front + 0.18,
        0.17,
        3.2,
        0.2,
        M.white,
      );
      block(x + sx * (w / 2 - 0.12), h / 2, front + 0.2, 0.2, h, 0.2, M.white);
    }
    cutawayBlock(x, 3.2, front + 0.18, opening + 0.34, 0.2, 0.25, M.white);
    block(x, 0.08, front + 0.35, opening, 0.15, 0.9, M.wood);
    // Horizontal coastal weatherboarding; narrow grooves use shared instancing.
    for (let y = 0.5; y < h; y += 0.52) {
      block(x, y, back - 0.17, w, 0.025, 0.02, M.darkWood);
      for (const sx of [-1, 1])
        block(
          x + sx * (w / 4 + opening / 4),
          y,
          front + 0.17,
          (w - opening) / 2,
          0.024,
          0.02,
          M.white,
        );
    }
    for (const sx of [-1, 1]) {
      const wx = x + sx * (opening / 2 + (w - opening) / 4);
      block(wx, 2.15, front + 0.19, 1.8, 1.7, 0.08, M.white);
      block(wx, 2.15, front + 0.25, 1.5, 1.4, 0.07, M.glass);
      block(wx, 2.15, front + 0.3, 0.08, 1.45, 0.08, M.white);
      block(wx, 2.15, front + 0.3, 1.55, 0.08, 0.08, M.white);
      block(wx, 1.27, front + 0.35, 2, 0.13, 0.42, M.white);
      for (const side of [-1, 1]) {
        block(wx + side * 1.08, 2.15, front + 0.23, 0.38, 1.7, 0.1, M.darkTeal);
        for (let q = 0; q < 6; q++)
          block(
            wx + side * 1.08,
            1.48 + q * 0.25,
            front + 0.3,
            0.35,
            0.05,
            0.07,
            M.teal,
          );
      }
    }
    // Pitched hip-like roofs, not flat boxes; full assembly hides inside.
    const roof = new THREE.Group();
    roof.name = `${id} removable roof`;
    group.add(roof);
    const pitch = 0.3,
      rise = (w / 2) * Math.tan(pitch);
    for (const side of [-1, 1]) {
      const g = new THREE.BoxGeometry(w / 2 + 0.55, 0.18, d + 0.9);
      geometries.push(g);
      const r = mesh(g, roofMat, roof);
      r.position.set(x + (side * w) / 4, h + rise / 2, z);
      r.rotation.z = -side * pitch;
      for (let stripe = 0; stripe < d; stripe += 0.65) {
        const seam = new THREE.BoxGeometry(w / 2 + 0.55, 0.04, 0.035);
        geometries.push(seam);
        const sm = mesh(seam, M.metal, roof);
        sm.position.set(
          x + (side * w) / 4,
          h + rise / 2 + 0.13,
          z - d / 2 + stripe,
        );
        sm.rotation.z = -side * pitch;
      }
    }
    const ridgeGeo = new THREE.CylinderGeometry(0.12, 0.12, d + 1, 6);
    geometries.push(ridgeGeo);
    const ridge = mesh(ridgeGeo, M.metal, roof);
    ridge.position.set(x, h + rise, z);
    ridge.rotation.x = Math.PI / 2;
    const gableShape = new THREE.Shape();
    gableShape.moveTo(-w / 2, 0);
    gableShape.lineTo(w / 2, 0);
    gableShape.lineTo(0, rise);
    gableShape.closePath();
    const gableGeo = new THREE.ShapeGeometry(gableShape);
    geometries.push(gableGeo);
    for (const end of [-1, 1]) {
      const gable = mesh(gableGeo, color, roof);
      gable.position.set(x, h, z + end * (d / 2 + 0.02));
      if (end < 0) gable.rotation.y = Math.PI;
    }
    roofs.push({
      object: roof,
      occluders: frontOccluders,
      center: { x, z },
      w,
      d,
    });
    const locationSign = sign(
      PLACES.find((p) => p.id === id)?.name || id,
      id === "warehouse"
        ? "BELLWETHER · RELIEF & RECOVERY"
        : id === "market"
          ? "PROVISIONS · WATER · GOOD NEIGHBORS"
          : id === "clinic"
            ? "CARE FOR EVERY NEIGHBOR"
            : "MERCY BAY",
      x,
      h - 0.56,
      front + 0.35,
      Math.min(w - 1, 7),
      "#315d57",
      0.78,
    );
    locationSign.userData.interactionId = `location-${id}`;
    frontOccluders.add(locationSign);
    const place = PLACES.find((p) => p.id === id)!;
    interactions.push({
      id: `location-${id}`,
      kind: "location",
      label: place.name,
      position: { x, z: front + 0.8 },
      location: place.id,
    });
    return { front, back, h, opening };
  }
  for (const p of PLACES.filter((p) => p.id !== "harbor"))
    building(
      p.id,
      p.center.x,
      p.center.z,
      p.width,
      p.depth,
      p.id === "warehouse"
        ? M.teal
        : p.id === "clinic"
          ? M.white
          : p.id === "market"
            ? M.cream
            : p.id === "heights"
              ? M.coral
              : M.cream,
      p.id === "heights" ? M.teal : p.id === "warehouse" ? M.roof : M.coral,
    );
  // Warehouse: steel shelving, workbench, noticeboard and honest resource crates.
  for (const x of [-27, -17]) {
    for (const z of [5, 8, 11]) {
      block(x, 0.75, z, 2.4, 0.13, 1.8, M.wood);
      block(x, 2.1, z, 2.4, 0.13, 1.8, M.wood);
    }
    for (const xx of [x - 1.1, x + 1.1])
      for (const zz of [4.2, 11.8])
        block(xx, 1.3, zz, 0.11, 2.6, 0.11, M.metal);
    collider(x, 8, 2.5, 8, "warehouse-shelves");
  }
  block(-22, 0.95, 4.1, 4, 1.9, 1.2, M.wood);
  block(-22, 1.94, 4.1, 4.2, 0.12, 1.4, M.cream);
  collider(-22, 4.1, 4.2, 1.4, "warehouse-desk");
  sign(
    "RESPONSE COORDINATION",
    "EVERY PROMISE MATTERS",
    -22,
    2.7,
    3.22,
    4,
    "#886f51",
    1.1,
  );
  const supplyGroups: Record<string, THREE.Group> = {};
  const crateMeshes: Record<string, THREE.Object3D[]> = {};
  for (const [r, index] of ["food", "water", "medical", "fuel"].map(
    (r, i) => [r, i] as const,
  )) {
    const resourceGroup = new THREE.Group();
    group.add(resourceGroup);
    supplyGroups[r] = resourceGroup;
    resourceGroup.userData.interactionId = "warehouse-supplies";
    crateMeshes[r] = [];
    for (let i = 0; i < 16; i++) {
      const crate = new THREE.Group();
      resourceGroup.add(crate);
      const body = mesh(boxGeo, M[r as keyof typeof M], crate);
      body.scale.set(0.78, 0.68, 0.75);
      for (const dz of [-0.39, 0.39]) {
        const strap = mesh(boxGeo, M.white, crate);
        strap.scale.set(0.1, 0.7, 0.02);
        strap.position.z = dz;
      }
      crate.position.set(
        -27 + (index % 2) * 10 + ((i % 3) - 1) * 0.8,
        0.42 + Math.floor(i / 6) * 0.74,
        4.8 + Math.floor(index / 2) * 3.6 + Math.floor((i % 6) / 3) * 0.85,
      );
      crateMeshes[r].push(crate);
    }
  }
  interactions.push({
    id: "warehouse-supplies",
    kind: "supply",
    label: "Check warehouse supplies",
    position: { x: -25, z: 12.8 },
    location: "warehouse",
  });
  // Market striped awning and stocked interior; stock belongs to local merchants.
  const marketCutaway = roofs.find(
    (r) => r.object.name === "market removable roof",
  )!.occluders;
  for (let color = 0; color < 2; color++) {
    const awning = new THREE.InstancedMesh(
      boxGeo,
      color ? M.white : M.coral,
      6,
    );
    awning.name = "Market cutaway awning";
    for (let stripe = 0; stripe < 6; stripe++) {
      const i = stripe * 2 + color;
      awning.setMatrixAt(
        stripe,
        new THREE.Matrix4().compose(
          new THREE.Vector3(-5.5 + i, 3.1, -6.9),
          new THREE.Quaternion(),
          new THREE.Vector3(0.96, 0.1, 2.4),
        ),
      );
    }
    awning.castShadow = true;
    awning.receiveShadow = true;
    awning.computeBoundingSphere();
    marketCutaway.add(awning);
  }
  for (const x of [-5.7, 5.7])
    block(x, 1.55, -5.7, 0.09, 3.1, 0.09, M.darkTeal);
  for (const z of [-18.6, -16]) {
    block(0, 1, z, 9, 2, 0.8, M.wood);
    block(0, 2.08, z, 9.2, 0.12, 1, M.cream);
    collider(0, z, 9.2, 1, "market-counter");
    for (let i = 0; i < 18; i++) {
      block(
        -4 + i * 0.47,
        2.35,
        z,
        0.28,
        0.45,
        0.32,
        i % 3 === 0 ? M.water : i % 3 === 1 ? M.food : M.medical,
      );
    }
  }
  for (const x of [-5, 5]) {
    block(x, 0.5, -11, 1.5, 1, 1.3, M.wood);
    collider(x, -11, 1.5, 1.3, "produce");
    for (let j = 0; j < 9; j++)
      block(
        x - 0.5 + (j % 3) * 0.5,
        1.1,
        -11 - 0.4 + Math.floor(j / 3) * 0.4,
        0.3,
        0.23,
        0.25,
        j % 2 ? M.coral : M.leafLight,
      );
  }
  // Bought goods wait visibly at the shop until a recruited worker carries them home.
  const stagedCrates: Record<string, THREE.Object3D[]> = {};
  for (const [index, resource] of [
    "food",
    "water",
    "medical",
    "fuel",
  ].entries()) {
    const x = -4.5 + index * 3,
      z = -5.3;
    block(x, 0.11, z, 1.65, 0.22, 1.3, M.wood);
    for (const dx of [-0.65, 0, 0.65])
      block(x + dx, 0.25, z, 0.12, 0.08, 1.3, M.darkWood);
    stagedCrates[resource] = [];
    for (let i = 0; i < 8; i++) {
      const g = new THREE.Group();
      g.userData.interactionId = "market-purchased-supplies";
      group.add(g);
      g.position.set(
        x + ((i % 2) - 0.5) * 0.73,
        0.62 + Math.floor(i / 4) * 0.75,
        z + ((Math.floor(i / 2) % 2) - 0.5) * 0.55,
      );
      const c = mesh(boxGeo, M[resource as keyof typeof M], g);
      c.scale.set(0.65, 0.65, 0.5);
      const strap = mesh(boxGeo, M.white, g);
      strap.position.z = 0.26;
      strap.scale.set(0.09, 0.66, 0.025);
      stagedCrates[resource].push(g);
    }
  }
  interactions.push({
    id: "market-purchased-supplies",
    kind: "supply",
    label: "Supplies awaiting collection",
    position: { x: 0, z: -4.5 },
    location: "market",
  });
  // Clinic beds, privacy dividers and medical cabinet.
  for (const x of [18, 26]) {
    block(x, 0.5, -16, 2, 0.3, 3.1, M.metal);
    block(x, 0.78, -16, 2, 0.26, 3.1, M.white);
    block(x, 1.01, -15.4, 2, 0.13, 1.8, M.teal);
    block(x, 1.03, -17, 0.95, 0.2, 0.6, M.cream);
    collider(x, -16, 2, 3.1, "clinic-bed");
    for (const xx of [x - 0.8, x + 0.8])
      for (const z of [-17.3, -14.7])
        block(xx, 0.24, z, 0.08, 0.5, 0.08, M.metal);
  }
  block(22, 1.15, -18.9, 2.6, 2.3, 0.65, M.white);
  collider(22, -18.9, 2.6, 0.65, "medicine-cabinet");
  block(22, 1.5, -18.54, 0.8, 0.12, 0.03, M.coral);
  block(22, 1.5, -18.53, 0.12, 0.8, 0.04, M.coral);
  // House porch, chairs, garden beds and a second residential cottage.
  plankFloor(-23, -9.7, 12, 2.5);
  for (const x of [-28.5, -17.5]) {
    block(x, 1.55, -8.8, 0.14, 3.1, 0.14, M.white);
    block(x, 0.8, -9.7, 0.1, 1.5, 2.2, M.white);
  }
  for (const x of [-27, -19]) {
    block(x, 0.45, -9.8, 1.3, 0.13, 1.1, M.wood);
    block(x, 0.9, -10.3, 1.3, 1, 0.12, M.wood);
    collider(x, -9.8, 1.3, 1.1, "porch-chair");
  }
  // A small inaccessible background cottage enriches the inhabited street.
  block(34, 1.7, -23, 7, 3.4, 7, M.cream);
  collider(34, -23, 7, 7, "cottage");
  block(34, 3.5, -23, 8, 0.35, 8, M.teal);
  block(34, 1.9, -19.45, 2, 1.6, 0.08, M.glass);
  block(34, 1.9, -19.38, 0.1, 1.7, 0.08, M.white);
  block(30.8, 1.4, -19.4, 1.2, 2.8, 0.08, M.darkTeal);
  plankFloor(34, -18.5, 8, 2);
  block(37.5, 1.1, -18.7, 0.12, 2.2, 0.12, M.white);
  // Radio room, external aerial and resilient neighborhood details.
  block(24, 1, 6.5, 5, 2, 1.2, M.wood);
  collider(24, 6.5, 5, 1.2, "radio-desk");
  for (const x of [22.8, 24.5]) {
    block(x, 2.2, 6.5, 1, 0.65, 0.6, M.darkTeal);
    block(x, 2.2, 6.82, 0.65, 0.25, 0.03, M.water);
  }
  cylinder(28, 6, 7, 0.05, 12, M.metal);
  for (const y of [8, 10]) block(28, y, 7, 3, 0.05, 0.06, M.metal);
  // Waterfront: timber pier, quay, mooring ropes, boat launch and warning boundary.
  block(5, 0.03, 29.5, 30, 0.3, 7, M.cream);
  plankFloor(5, 33, 10, 5.5);
  for (const x of [-0.1, 10.1])
    for (const z of [30.5, 33, 35.5]) cylinder(x, 0.45, z, 0.14, 1.3, M.wood);
  for (let x = -36; x <= 37; x += 5) {
    if (x > -1 && x < 11) continue;
    cylinder(x, 0.55, 33, 0.14, 1.2, M.metal);
    if (x < 36) block(x + 2.5, 0.95, 33, 4.8, 0.065, 0.065, M.wood);
  }
  colliders.push({
    minX: -40,
    maxX: 40,
    minZ: 23,
    maxZ: 40,
    id: "harbor-storm-zone",
    exposed: true,
  });
  interactions.push({
    id: "location-harbor",
    kind: "location",
    label: "Old Harbor · transport",
    position: { x: 5, z: 27 },
    location: "harbor",
  });
  sign(
    "OLD HARBOR",
    "BELLWETHER MUNICIPAL QUAY",
    -4,
    2.1,
    28.4,
    5,
    "#886f51",
    0.9,
  ).userData.interactionId = "location-harbor";
  for (const x of [-6.6, -1.4]) block(x, 1.25, 28.25, 0.1, 2.5, 0.1, M.wood);
  const stormGate = new THREE.Group();
  stormGate.name = "legacy-storm-gate";
  group.add(stormGate);
  for (const x of [-1, 11]) {
    const post = mesh(boxGeo, M.coral, stormGate);
    post.position.set(x, 0.7, 25);
    post.scale.set(0.15, 1.4, 0.15);
  }
  const gateRail = mesh(boxGeo, M.white, stormGate);
  gateRail.position.set(5, 1.05, 25);
  gateRail.scale.set(12, 0.22, 0.1);
  for (let x = 0; x < 11; x += 1.4) {
    const stripe = mesh(boxGeo, M.coral, stormGate);
    stripe.position.set(x, 1.05, 25.06);
    stripe.scale.set(0.55, 0.22, 0.02);
  }
  const closedSign = sign(
    "QUAY CLOSED",
    "STORM SURGE · KEEP BACK",
    5,
    1.7,
    25.12,
    3.2,
    "#a35e49",
    0.7,
  );
  group.remove(closedSign);
  stormGate.add(closedSign);
  stormGate.visible = false;
  const boats: THREE.Group[] = [];
  function boat(x: number, z: number, color: THREE.Material) {
    const b = new THREE.Group();
    group.add(b);
    b.position.set(x, -0.25, z);
    b.rotation.y = 0.2;
    const shape = new THREE.Shape();
    shape.moveTo(-1.3, -2.8);
    shape.lineTo(1.3, -2.8);
    shape.quadraticCurveTo(1.6, 1.7, 0, 3.5);
    shape.quadraticCurveTo(-1.6, 1.7, -1.3, -2.8);
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.75,
      bevelEnabled: true,
      bevelSize: 0.2,
      bevelThickness: 0.15,
      bevelSegments: 1,
      steps: 1,
    });
    geometries.push(geo);
    const hull = mesh(geo, color, b);
    hull.rotation.x = Math.PI / 2;
    const cabin = mesh(boxGeo, M.white, b);
    cabin.scale.set(1.4, 1.3, 1.6);
    cabin.position.set(0, 0.7, -0.8);
    const wind = mesh(boxGeo, M.glass, b);
    wind.scale.set(1.2, 0.55, 0.04);
    wind.position.set(0, 0.86, 0.03);
    const rail = mesh(boxGeo, M.wood, b);
    rail.scale.set(1.8, 0.12, 0.6);
    rail.position.set(0, 0.2, 1.6);
    // Working-boat details on every visible face; batch the fittings by material.
    const fittings = new Map<THREE.Material, THREE.Matrix4[]>();
    const fitting = (
      px: number,
      py: number,
      pz: number,
      w: number,
      h: number,
      d: number,
      mat: THREE.Material,
    ) => {
      if (!fittings.has(mat)) fittings.set(mat, []);
      fittings
        .get(mat)!
        .push(
          new THREE.Matrix4().compose(
            new THREE.Vector3(px, py, pz),
            new THREE.Quaternion(),
            new THREE.Vector3(w, h, d),
          ),
        );
    };
    fitting(0, 1.39, -0.8, 1.65, 0.12, 1.9, color);
    fitting(0, 0.95, -1.625, 1.13, 0.51, 0.035, M.glass);
    fitting(0, 0.95, -1.65, 0.055, 0.55, 0.035, M.white);
    fitting(0, 0.86, 0.065, 0.055, 0.59, 0.03, M.white);
    for (const side of [-1, 1]) {
      for (const z of [-1.2, -0.4]) {
        fitting(side * 0.715, 0.96, z, 0.035, 0.48, 0.64, M.glass);
        fitting(side * 0.74, 0.96, z, 0.03, 0.5, 0.035, M.white);
      }
      fitting(side * 0.74, 0.65, -0.8, 0.055, 0.06, 1.64, M.teal);
      for (const z of [0.5, 1.4, 2.25])
        fitting(side * 1.05, 0.5, z, 0.045, 0.6, 0.045, M.metal);
      fitting(side * 1.05, 0.8, 1.4, 0.05, 0.045, 2.0, M.metal);
      fitting(side * 0.65, 0.14, 1.1, 0.075, 0.04, 2.3, M.wood);
    }
    fitting(0, 2.02, -0.8, 0.055, 1.22, 0.055, M.metal);
    fitting(0, 2.47, -0.8, 0.95, 0.045, 0.045, M.metal);
    fitting(0, 2.68, -0.8, 0.1, 0.14, 0.1, M.brass);
    for (const [mat, transforms] of fittings) {
      const batch = new THREE.InstancedMesh(boxGeo, mat, transforms.length);
      transforms.forEach((matrix, i) => batch.setMatrixAt(i, matrix));
      batch.castShadow = true;
      batch.receiveShadow = true;
      batch.computeBoundingSphere();
      b.add(batch);
    }
    const ropeGeometry = new THREE.TorusGeometry(0.26, 0.035, 5, 16);
    geometries.push(ropeGeometry);
    const coil = mesh(ropeGeometry, M.wood, b);
    coil.rotation.x = Math.PI / 2;
    coil.position.set(0.45, 0.18, 2.2);
    const ringGeometry = new THREE.TorusGeometry(0.2, 0.055, 6, 16);
    geometries.push(ringGeometry);
    const lifeRing = mesh(ringGeometry, M.coral, b);
    lifeRing.position.set(0.45, 0.45, -1.66);
    boats.push(b);
  }
  boat(-5, 38, M.coral);
  boat(15, 37, M.teal);
  boat(30, 44, M.white);
  const waterGeo = new THREE.PlaneGeometry(160, 100, 64, 40);
  waterGeo.rotateX(-Math.PI / 2);
  geometries.push(waterGeo);
  const waterMat = new THREE.MeshStandardMaterial({
    color: "#548f8b",
    roughness: 0.36,
    metalness: 0.16,
  });
  materials.push(waterMat);
  const water = mesh(waterGeo, waterMat);
  water.position.set(0, -0.38, 82);
  water.receiveShadow = true;
  water.castShadow = false;
  const waterBase = Float32Array.from(waterGeo.attributes.position.array);
  // Light truck is a physical transport landmark; engine determines availability.
  const truck = new THREE.Group();
  truck.userData.interactionId = "transport-truck";
  group.add(truck);
  truck.position.set(16, 0.05, 26.5);
  const tm = (
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    mat: THREE.Material,
  ) => {
    const o = mesh(boxGeo, mat, truck);
    o.position.set(x, y, z);
    o.scale.set(w, h, d);
    return o;
  };
  tm(0, 0.72, 0, 2.8, 0.5, 5.8, M.darkTeal);
  tm(0, 1.5, 1.7, 2.8, 1.3, 2.1, M.teal);
  tm(0, 1.68, 2.77, 2.3, 0.7, 0.04, M.glass);
  tm(0, 1.6, -0.8, 2.8, 1.2, 3.2, M.cream);
  tm(0, 0.73, 2.94, 2.9, 0.14, 0.18, M.metal);
  for (const x of [-1.35, 1.35])
    for (const z of [-1.8, 1.8]) {
      const g = new THREE.CylinderGeometry(0.5, 0.5, 0.28, 12);
      geometries.push(g);
      const wheel = mesh(g, M.darkWood, truck);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, 0.5, z);
    }
  collider(16, 26.5, 3, 6, "relief-truck");
  interactions.push({
    id: "transport-truck",
    kind: "vehicle",
    label: "Relief transport",
    position: { x: 13.5, z: 27.5 },
    location: "harbor",
  });
  // Campaign props remain physical and silent until authoritative project state changes.
  // Each approach point is deliberately outside its collider and on existing navigation ground.
  const campaignObjects = new THREE.Group();
  campaignObjects.name = "The last good road";
  group.add(campaignObjects);
  function prop(
    parent: THREE.Object3D,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    mat: THREE.Material,
  ) {
    const piece = mesh(boxGeo, mat, parent);
    piece.position.set(x, y, z);
    piece.scale.set(w, h, d);
    return piece;
  }
  function station(
    id: string,
    label: string,
    x: number,
    z: number,
    location: Interaction["location"],
    object: THREE.Object3D,
  ) {
    object.traverse((o) => (o.userData.interactionId = id));
    if (!campaignEnabled) return;
    interactions.push({
      id,
      kind: "supply",
      label,
      position: { x, z },
      location,
      object,
    });
  }
  const van = new THREE.Group();
  campaignObjects.add(van);
  van.position.set(-17.7, 0, 20.6);
  van.rotation.y = -0.13;
  prop(van, 0, 0.62, 0, 2.3, 0.38, 4.8, M.darkTeal);
  prop(van, 0, 1.55, -0.65, 2.28, 1.65, 3, M.cream);
  prop(van, 0, 1.58, 1.13, 2.22, 1.5, 1.08, M.teal);
  prop(van, 0, 2.36, -0.12, 2.34, 0.13, 4.05, M.white);
  // Door recesses, rain gutters and wheel-height scuff rails make the body read as sheet metal.
  for (const side of [-1, 1]) {
    prop(van, side * 1.15, 1.55, -0.72, 0.028, 1.35, 0.025, M.metal);
    prop(van, side * 1.16, 1.55, -1.9, 0.03, 1.35, 0.025, M.metal);
    prop(van, side * 1.17, 2.22, -0.7, 0.045, 0.035, 2.45, M.metal);
    prop(van, side * 1.17, 0.88, -0.5, 0.045, 0.09, 2.8, M.darkTeal);
    prop(van, side * 1.18, 1.6, -0.83, 0.045, 0.055, 0.22, M.darkWood);
    prop(van, side * 1.3, 1.8, 1.62, 0.18, 0.28, 0.13, M.metal);
    prop(van, side * 0.94, 1.16, -2.17, 0.18, 0.35, 0.05, M.coral);
  }
  for (let i = 0; i < 5; i++)
    prop(van, 0, 0.97 + i * 0.045, 2.29, 1.1, 0.018, 0.03, M.metal);
  const windshield = prop(van, 0, 1.94, 1.69, 1.95, 0.63, 0.07, M.glass);
  windshield.rotation.x = -0.1;
  prop(van, 0, 1.94, 1.75, 0.07, 0.66, 0.04, M.white);
  prop(van, 0, 0.8, 2.32, 2.35, 0.2, 0.17, M.metal);
  prop(van, 0, 1.06, 2.25, 1.12, 0.26, 0.05, M.darkTeal);
  for (const side of [-1, 1]) {
    prop(van, side * 0.89, 1.06, 2.28, 0.34, 0.25, 0.07, M.white);
    prop(van, side * 1.16, 1.86, 1.13, 0.03, 0.62, 0.8, M.glass);
    prop(van, side * 1.18, 1.2, -0.4, 0.035, 0.16, 3.35, M.coral);
    prop(van, side * 1.18, 1.45, 0.66, 0.04, 0.055, 0.2, M.metal);
    for (const z of [-1.45, 1.5]) {
      const geo = new THREE.CylinderGeometry(0.43, 0.43, 0.22, 16);
      geometries.push(geo);
      const wheel = mesh(geo, M.darkWood, van);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(side * 1.12, 0.45, z);
      const hub = mesh(geo, M.metal, van);
      hub.rotation.z = Math.PI / 2;
      hub.position.set(side * 1.25, 0.45, z);
      hub.scale.set(0.48, 0.35, 0.48);
    }
  }
  const hood = new THREE.Group();
  van.add(hood);
  hood.position.set(0, 1.25, 1.65);
  prop(hood, 0, 0, 0.32, 2.18, 0.09, 0.73, M.teal);
  prop(van, 0, 1.1, 1.96, 1.45, 0.22, 0.52, M.metal);
  const vanTools = new THREE.Group();
  campaignObjects.add(vanTools);
  // A visible socket case and jack sit on the safe roadside, away from the interaction endpoint.
  prop(vanTools, -15.8, 0.18, 20.8, 0.65, 0.28, 0.43, M.coral);
  prop(vanTools, -15.8, 0.34, 20.8, 0.54, 0.035, 0.35, M.darkWood);
  for (let i = 0; i < 4; i++)
    prop(vanTools, -16 + i * 0.12, 0.39, 20.8, 0.055, 0.08, 0.13, M.metal);
  prop(vanTools, -16.2, 0.1, 21.4, 0.45, 0.15, 0.6, M.darkTeal);
  prop(vanTools, -16.2, 0.3, 21.4, 0.08, 0.4, 0.08, M.metal);
  const vanCargo = new THREE.Group();
  campaignObjects.add(vanCargo);
  for (let i = 0; i < 3; i++) {
    prop(
      vanCargo,
      -20 + (i % 2) * 0.7,
      0.42 + Math.floor(i / 2) * 0.65,
      19.5,
      0.65,
      0.6,
      0.65,
      M.medical,
    );
    prop(
      vanCargo,
      -20 + (i % 2) * 0.7,
      0.42 + Math.floor(i / 2) * 0.65,
      19.84,
      0.1,
      0.62,
      0.025,
      M.coral,
    );
  }
  const vanSign = sign(
    "BELLWETHER RELIEF",
    "MEDICAL SUPPLIES · KEEP DRY",
    -17.7,
    1.7,
    18.13,
    1.8,
    "#315d57",
    0.52,
  );
  vanSign.rotation.y = Math.PI;
  campaignObjects.add(vanSign);
  if (campaignEnabled) collider(-17.7, 20.6, 2.9, 5.2, "campaign-van");
  station(
    "relief-van",
    "Inspect the stranded relief van",
    -15,
    18,
    "warehouse",
    van,
  );
  vanCargo.traverse((o) => (o.userData.interactionId = "relief-van"));
  // Folded frames are visibly unprepared; deployed cots and stored food only follow committed work.
  const shelterBare = new THREE.Group(),
    shelterCots = new THREE.Group(),
    shelterStock = new THREE.Group();
  campaignObjects.add(shelterBare, shelterCots, shelterStock);
  for (const x of [-26.2, -19.8])
    for (const z of [-16, -19.4]) {
      prop(shelterBare, x, 0.4, z, 0.45, 0.8, 1.9, M.metal);
      prop(shelterBare, x, 0.9, z, 0.38, 0.14, 1.9, M.teal);
      prop(shelterCots, x, 0.55, z, 1.55, 0.13, 2.6, M.metal);
      prop(shelterCots, x, 0.67, z, 1.5, 0.14, 2.5, M.cream);
      prop(shelterCots, x, 0.8, z + 0.3, 1.5, 0.09, 1.8, M.teal);
      prop(shelterCots, x, 0.85, z - 0.8, 0.8, 0.19, 0.45, M.white);
      for (const dx of [-0.65, 0.65])
        for (const dz of [-1.1, 1.1])
          prop(shelterCots, x + dx, 0.26, z + dz, 0.065, 0.52, 0.065, M.metal);
    }
  for (let i = 0; i < 4; i++)
    prop(
      shelterStock,
      -27 + i * 0.8,
      0.4,
      -21.6,
      0.7,
      0.7,
      0.6,
      i % 2 ? M.water : M.food,
    );
  const shelterBoard = sign(
    "CYPRESS HOUSE",
    "NEIGHBORHOOD STORM SHELTER",
    -23,
    2.1,
    -22.72,
    4,
    "#886f51",
    0.9,
  );
  campaignObjects.add(shelterBoard);
  station(
    "shelter-work",
    "Prepare Cypress House shelter",
    -23,
    -13,
    "heights",
    shelterBare,
  );
  shelterCots.traverse((o) => (o.userData.interactionId = "shelter-work"));
  shelterStock.traverse((o) => (o.userData.interactionId = "shelter-work"));
  // Freight obstruction is to the side of the pedestrian route, which remains usable.
  const debris = new THREE.Group();
  campaignObjects.add(debris);
  for (let i = 0; i < 7; i++) {
    const plank = prop(
      debris,
      -8 + (i % 3) * 0.5,
      0.2 + (i % 2) * 0.18,
      3.3 + (i % 2) * 0.6,
      2.5,
      0.13,
      0.22,
      M.wood,
    );
    plank.rotation.y = i * 0.7;
  }
  const barricade = new THREE.Group();
  campaignObjects.add(barricade);
  for (const x of [-8.8, -6.2])
    prop(barricade, x, 0.6, 2.5, 0.13, 1.2, 0.15, M.metal);
  prop(barricade, -7.5, 0.95, 2.5, 3, 0.35, 0.15, M.white);
  for (let i = 0; i < 5; i++)
    prop(barricade, -8.7 + i * 0.6, 0.95, 2.59, 0.27, 0.36, 0.04, M.coral);
  station(
    "road-debris",
    "Inspect the blocked freight lane",
    -10,
    3,
    "warehouse",
    barricade,
  );
  debris.traverse((o) => (o.userData.interactionId = "road-debris"));
  const ledger = new THREE.Group();
  campaignObjects.add(ledger);
  prop(ledger, 2.1, 0.85, -10, 1.25, 0.12, 0.7, M.wood);
  for (const x of [1.6, 2.6])
    prop(ledger, x, 0.4, -10, 0.08, 0.8, 0.5, M.darkWood);
  prop(ledger, 2.1, 0.94, -10, 0.55, 0.04, 0.4, M.cream);
  for (let i = 0; i < 4; i++)
    prop(ledger, 2.1, 0.966, -10.13 + i * 0.07, 0.39, 0.008, 0.015, M.darkTeal);
  station(
    "market-ledger",
    "Negotiate the neighborhood reserve",
    0,
    -10,
    "market",
    ledger,
  );
  const sharedReserve = new THREE.Group();
  campaignObjects.add(sharedReserve);
  prop(sharedReserve, 3.5, 0.5, -9.7, 0.8, 0.85, 0.8, M.food);
  prop(sharedReserve, 3.5, 0.94, -9.7, 0.82, 0.06, 0.83, M.white);
  // Architectural identity: industrial brick plinth, clinic canopy and civic shelter flag.
  for (let i = 0; i < 16; i++) {
    if (Math.abs(-28.4 + i * 0.81 + 22) > 2.8)
      block(-28.4 + i * 0.81, 0.3, 15.18, 0.77, 0.4, 0.08, M.darkTeal);
    if (Math.abs(16.4 + i * 0.7 - 22) > 1.9)
      block(16.4 + i * 0.7, 0.33, -7.8, 0.65, 0.42, 0.08, M.cream);
  }
  for (const x of [18, 26]) block(x, 3.2, -7.3, 2.5, 0.12, 1.5, M.teal);
  // Street-level repair patches and worn parking bay markings replace featureless asphalt.
  for (const [x, z, w, d] of [
    [-3, 2.7, 5, 2],
    [19, 20.5, 6, 2],
    [-11, 11, 2, 3],
  ])
    block(x, 0.058, z, w, 0.008, d, M.metal);
  for (const x of [-25, -20, -15])
    block(x, 0.07, 22.3, 0.07, 0.01, 2.8, M.cream);
  const aftermathDebris = new THREE.Group();
  group.add(aftermathDebris);
  for (let i = 0; i < 12; i++) {
    const piece = prop(
      aftermathDebris,
      -31 + i * 5.4,
      0.15,
      25 + Math.sin(i) * 0.7,
      1.2,
      0.09,
      0.22,
      M.darkWood,
    );
    piece.rotation.y = i * 1.7;
  }
  // Repeated planted details are instanced into material batches.
  const fronds: {
    mesh: THREE.Mesh;
    restX: number;
    restZ: number;
    phase: number;
  }[] = [];
  function palm(x: number, z: number, height = 6) {
    const trunk = cylinder(x, height / 2, z, 0.19, height, M.trunk, 7);
    trunk.rotation.z = 0.07;
    collider(x, z, 0.5, 0.5, "palm");
    for (let k = 0; k < 7; k++) {
      const angle = (k / 7) * Math.PI * 2;
      const shape = new THREE.Shape();
      shape.moveTo(0, 0);
      shape.quadraticCurveTo(0.65, 1.4, 0.05, 3.3);
      shape.quadraticCurveTo(-0.6, 1.4, 0, 0);
      const geo = new THREE.ShapeGeometry(shape);
      geometries.push(geo);
      const leafMat = (k % 2 ? M.leaf : M.leafLight).clone();
      leafMat.side = THREE.DoubleSide;
      materials.push(leafMat);
      const leaf = mesh(geo, leafMat);
      leaf.position.set(x + 0.35, height, z);
      leaf.rotation.set(-Math.PI / 2 + 0.35, 0, angle);
      fronds.push({
        mesh: leaf,
        restX: leaf.rotation.x,
        restZ: leaf.rotation.z,
        phase: x * 0.13 + z * 0.19 + k * 0.8,
      });
    }
  }
  for (const [x, z, h] of [
    [-35, 9, 7],
    [-33, -24, 6],
    [34, 8, 7.5],
    [34, 28, 6],
    [-31, 27, 7],
    [-5, 26, 6],
    [8, -24, 7],
  ] as number[][])
    palm(x, z, h);
  const bushGeo = new THREE.IcosahedronGeometry(1, 1);
  geometries.push(bushGeo);
  const bushMatrices: THREE.Matrix4[] = [];
  for (const [x, z] of [
    [-35, -6],
    [-31, -7],
    [34, -5],
    [30, 18],
    [-29, -25],
    [-16, -25],
    [16, -23],
    [-35, 26],
    [30, 30],
    [-4, 10],
    [3, 9],
  ]) {
    if (wildlifeHabitats && ((x < -30 && z < 0) || (x === 16 && z === -23)))
      continue;
    for (let i = 0; i < 4; i++) {
      const y = 0.45 + (i % 2) * 0.16;
      const mat = new THREE.Matrix4().compose(
        new THREE.Vector3(x + i * 0.55, y, z + Math.sin(i) * 0.4),
        new THREE.Quaternion(),
        new THREE.Vector3(0.7, 0.6, 0.7),
      );
      bushMatrices.push(mat);
    }
    block(x + 0.8, 0.22, z, 3, 0.3, 1.8, M.wood);
  }
  const bushes = new THREE.InstancedMesh(bushGeo, M.leaf, bushMatrices.length);
  bushMatrices.forEach((m, i) => bushes.setMatrixAt(i, m));
  bushes.castShadow = true;
  bushes.receiveShadow = true;
  group.add(bushes);
  function bench(x: number, z: number) {
    for (const dz of [-0.3, 0, 0.3])
      block(x, 0.65, z + dz, 2.8, 0.12, 0.23, M.wood);
    for (const y of [1, 1.3]) block(x, y, z - 0.45, 2.8, 0.2, 0.1, M.wood);
    for (const dx of [-1, 1]) {
      block(x + dx, 0.32, z, 0.12, 0.64, 0.7, M.metal);
      block(x + dx, 0.95, z - 0.45, 0.1, 0.9, 0.1, M.metal);
    }
    collider(x, z, 2.8, 1, "bench");
  }
  for (const [x, z] of [
    [-5, 6],
    [8, 6],
    [-31, 24.8],
    [26, 24.8],
  ])
    bench(x, z);
  for (const x of [-33, -6, 10, 34]) {
    cylinder(x, 2.35, 5.5, 0.075, 4.7, M.metal);
    block(x + 0.4, 4.68, 5.5, 0.9, 0.08, 0.1, M.metal);
    block(x + 0.8, 4.57, 5.5, 0.55, 0.16, 0.45, M.brass);
    block(x + 0.8, 4.47, 5.5, 0.45, 0.03, 0.35, M.white);
    collider(x, 5.5, 0.25, 0.25, "streetlamp");
  }
  for (const x of [-36, 36]) {
    cylinder(x, 4, -4, 0.12, 8, M.wood);
    collider(x, -4, 0.4, 0.4, "utility-pole");
  }
  const lineCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-36, 7.7, -4),
    new THREE.Vector3(0, 6.8, -4),
    new THREE.Vector3(36, 7.7, -4),
  ]);
  const wireGeo = new THREE.TubeGeometry(lineCurve, 30, 0.025, 4, false);
  geometries.push(wireGeo);
  mesh(wireGeo, M.darkWood);
  // A single instanced draw for late-storm rain; reduced quality keeps only the wind motion.
  const rainGeometry = new THREE.BoxGeometry(0.018, 0.6, 0.018);
  geometries.push(rainGeometry);
  const rainMaterial = new THREE.MeshBasicMaterial({
    color: "#d2e0dc",
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
  });
  materials.push(rainMaterial);
  const rain = new THREE.InstancedMesh(rainGeometry, rainMaterial, 160);
  rain.name = "Late-storm rain";
  rain.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  rain.frustumCulled = false;
  rain.visible = false;
  group.add(rain);
  const rainDummy = new THREE.Object3D();
  rainDummy.rotation.set(0.1, 0, 0.22);
  // Merge fittings within each independently visible assembly, retaining hood and state pivots.
  function batchDetails(parent: THREE.Object3D) {
    for (const child of [...parent.children])
      if (child.children.length) batchDetails(child);
    const sets = new Map<THREE.Material, THREE.Mesh[]>();
    for (const child of parent.children)
      if (child instanceof THREE.Mesh && !Array.isArray(child.material)) {
        const set = sets.get(child.material) || [];
        set.push(child);
        sets.set(child.material, set);
      }
    for (const [mat, pieces] of sets) {
      if (pieces.length < 2) continue;
      const copies = pieces.map((piece) => {
        piece.updateMatrix();
        return piece.geometry.clone().applyMatrix4(piece.matrix);
      });
      const merged = mergeGeometries(copies, false);
      copies.forEach((g) => g.dispose());
      if (!merged) continue;
      geometries.push(merged);
      pieces.forEach((piece) => parent.remove(piece));
      const batch = mesh(merged, mat, parent);
      batch.userData.interactionId = parent.userData.interactionId;
    }
  }
  batchDetails(campaignObjects);
  batchDetails(aftermathDebris);
  for (const roof of roofs) batchDetails(roof.object);
  // Batch architectural components into a handful of GPU submissions.
  for (const [mat, matrices] of buckets) {
    const batch = new THREE.InstancedMesh(boxGeo, mat, matrices.length);
    matrices.forEach((matrix, i) => batch.setMatrixAt(i, matrix));
    batch.castShadow = true;
    batch.receiveShadow = true;
    batch.computeBoundingSphere();
    group.add(batch);
  }
  return {
    group,
    colliders,
    interactions,
    update(world, dt, elapsed, player, quality) {
      for (const roof of roofs) {
        const inside =
          Math.abs(player.x - roof.center.x) < roof.w / 2 + 0.25 &&
          Math.abs(player.z - roof.center.z) < roof.d / 2 + 0.25;
        roof.object.visible = !inside;
        roof.occluders.visible = !inside;
      }
      for (const resource of ["food", "water", "medical", "fuel"] as const) {
        const count = Math.min(16, Math.ceil(world.inventory[resource] / 10));
        crateMeshes[resource].forEach((c, i) => (c.visible = i < count));
        const staged = Math.min(
          8,
          Math.ceil((world.spatial?.staged[resource] || 0) / 10),
        );
        stagedCrates[resource].forEach((c, i) => (c.visible = i < staged));
      }
      const campaign = world.campaign;
      campaignObjects.visible = Boolean(campaign);
      hood.rotation.x = campaign?.van === "repaired" ? 0 : -1.12;
      vanCargo.visible = campaign?.van === "stranded";
      vanTools.visible = campaign?.van === "stranded";
      shelterBare.visible = campaign?.shelter === "bare";
      shelterCots.visible = Boolean(campaign && campaign.shelter !== "bare");
      shelterStock.visible = campaign?.shelter === "stocked";
      debris.visible = campaign?.route === "blocked";
      barricade.visible = campaign?.route === "blocked";
      sharedReserve.visible = Boolean(
        campaign && campaign.cooperation !== "none",
      );
      aftermathDebris.visible = Boolean(world.ended);
      truck.visible = true;
      truck.userData.hired = world.transport > 0;
      stormGate.visible = world.hour >= 54;
      const rough = world.ended
        ? 0.2
        : world.hour >= 48
          ? 1
          : world.hour >= 24
            ? 0.55
            : 0.25;
      waterMat.color.set(world.hour >= 48 ? "#527c7b" : "#548f8b");
      if (quality === "high") {
        const a = waterGeo.attributes.position;
        for (let i = 0; i < a.count; i++) {
          const x = waterBase[i * 3],
            z = waterBase[i * 3 + 2];
          a.setY(
            i,
            Math.sin(x * 0.22 + elapsed * 1.2) * rough * 0.2 +
              Math.cos(z * 0.3 + elapsed * 0.7) * rough * 0.18,
          );
        }
        a.needsUpdate = true;
      }
      boats.forEach((b, i) => {
        b.position.y = -0.2 + Math.sin(elapsed * 0.9 + i) * rough * 0.18;
        b.rotation.z = Math.sin(elapsed * 0.7 + i) * rough * 0.045;
      });
      const breeze = 0.018 + rough * 0.065;
      for (const frond of fronds) {
        frond.mesh.rotation.x =
          frond.restX +
          Math.sin(elapsed * (1 + rough * 0.8) + frond.phase) * breeze;
        frond.mesh.rotation.z =
          frond.restZ +
          Math.sin(elapsed * 0.7 + frond.phase * 0.6) * breeze * 0.55;
      }
      const indoors = roofs.some(
        (r) =>
          Math.abs(player.x - r.center.x) < r.w / 2 &&
          Math.abs(player.z - r.center.z) < r.d / 2,
      );
      rain.visible =
        !world.ended && world.hour >= 48 && quality === "high" && !indoors;
      if (rain.visible) {
        rainMaterial.opacity = 0.17 + ((world.hour - 48) / 24) * 0.18;
        for (let i = 0; i < 160; i++) {
          const x = ((i * 73.17) % 32) - 16,
            z = ((i * 41.31) % 32) - 16,
            y = 20 - ((elapsed * (9 + rough * 3) + i * 3.31) % 20);
          rainDummy.position.set(
            player.x + x + (20 - y) * 0.18,
            y,
            player.z + z,
          );
          rainDummy.updateMatrix();
          rain.setMatrixAt(i, rainDummy.matrix);
        }
        rain.instanceMatrix.needsUpdate = true;
      }

      void dt;
    },
    dispose() {
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
      for (const t of textures) t.dispose();
    },
  };
}
