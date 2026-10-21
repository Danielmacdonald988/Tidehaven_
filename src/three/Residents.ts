import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { World, LocationId } from "../contracts";
import {
  routeBetweenLocations,
  residentHome,
  type AvatarHandle,
  type ResidentHandle,
  type Point,
  type Interaction,
} from "./shared";

const identities: Record<
  string,
  { skin: string; hair: string; trousers: string; scale: number; gear: string }
> = {
  mara: {
    skin: "#b67d60",
    hair: "#35302e",
    trousers: "#405a62",
    scale: 1,
    gear: "medic",
  },
  eli: {
    skin: "#c69570",
    hair: "#48392e",
    trousers: "#534c42",
    scale: 1.04,
    gear: "apron",
  },
  jo: {
    skin: "#c79270",
    hair: "#373b3d",
    trousers: "#293f51",
    scale: 1.02,
    gear: "captain",
  },
  rosa: {
    skin: "#89563e",
    hair: "#d4d0c5",
    trousers: "#544b62",
    scale: 0.95,
    gear: "glasses",
  },
  sam: {
    skin: "#6d4435",
    hair: "#242428",
    trousers: "#424b54",
    scale: 1.04,
    gear: "headphones",
  },
  inez: {
    skin: "#b47a53",
    hair: "#312c2b",
    trousers: "#3f4651",
    scale: 0.98,
    gear: "toolbelt",
  },
  theo: {
    skin: "#d3a183",
    hair: "#5c4537",
    trousers: "#44555a",
    scale: 1.06,
    gear: "beanie",
  },
  bea: {
    skin: "#a56d51",
    hair: "#3e2d2c",
    trousers: "#66554a",
    scale: 0.98,
    gear: "baker",
  },
  noah: {
    skin: "#ba927a",
    hair: "#8a857b",
    trousers: "#48574d",
    scale: 1.05,
    gear: "toolbelt",
  },
  ada: {
    skin: "#724b3e",
    hair: "#252024",
    trousers: "#365869",
    scale: 1,
    gear: "clipboard",
  },
  luis: {
    skin: "#bb8969",
    hair: "#302a28",
    trousers: "#334b51",
    scale: 1.03,
    gear: "medic",
  },
  kit: {
    skin: "#bf987c",
    hair: "#55453a",
    trousers: "#4b5368",
    scale: 0.91,
    gear: "backpack",
  },
  player: {
    skin: "#bd8a68",
    hair: "#39322f",
    trousers: "#374c5c",
    scale: 1,
    gear: "backpack",
  },
};
const material = (color: string, roughness = 0.85) =>
  new THREE.MeshStandardMaterial({ color, roughness });
const sphere = (radius: number) => new THREE.SphereGeometry(radius, 12, 8);
function lathe(profile: [number, number][], segments = 12) {
  const ordered =
    profile[0][1] > profile.at(-1)![1] ? [...profile].reverse() : profile;
  return new THREE.LatheGeometry(
    ordered.map(([r, y]) => new THREE.Vector2(r, y)),
    segments,
  );
}
function part(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  mat: THREE.Material,
  x: number,
  y: number,
  z: number,
  scale?: [number, number, number],
) {
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.position.set(x, y, z);
  if (scale) mesh.scale.set(...scale);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
function box(
  parent: THREE.Object3D,
  mat: THREE.Material,
  size: [number, number, number],
  position: [number, number, number],
) {
  return part(parent, new THREE.BoxGeometry(...size), mat, ...position);
}
function joint(
  parent: THREE.Object3D,
  name: string,
  x: number,
  y: number,
  z: number,
) {
  const group = new THREE.Group();
  group.name = name;
  group.position.set(x, y, z);
  parent.add(group);
  return group;
}
function tube(
  parent: THREE.Object3D,
  mat: THREE.Material,
  a: THREE.Vector3,
  b: THREE.Vector3,
  r: number,
) {
  const direction = b.clone().sub(a);
  const mesh = part(
    parent,
    new THREE.CylinderGeometry(r, r, direction.length(), 7),
    mat,
    ...(a.clone().add(b).multiplyScalar(0.5).toArray() as [
      number,
      number,
      number,
    ]),
  );
  mesh.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.normalize(),
  );
  return mesh;
}

/** Batch static details within each articulation node, retaining independent limb pivots. */
function mergeStaticParts(parent: THREE.Object3D) {
  for (const child of [...parent.children])
    if (child.children.length) mergeStaticParts(child);
  const sets = new Map<THREE.Material, THREE.Mesh[]>();
  for (const child of parent.children)
    if (
      child instanceof THREE.Mesh &&
      !child.children.length &&
      !child.userData.articulated &&
      !Array.isArray(child.material)
    ) {
      const list = sets.get(child.material) || [];
      list.push(child);
      sets.set(child.material, list);
    }
  for (const [mat, meshes] of sets) {
    if (meshes.length < 2) continue;
    const copies = meshes.map((mesh) => {
      mesh.updateMatrix();
      return mesh.geometry.clone().applyMatrix4(mesh.matrix);
    });
    const merged = mergeGeometries(copies, false);
    copies.forEach((g) => g.dispose());
    if (!merged) continue;
    const batch = new THREE.Mesh(merged, mat);
    batch.name = "batched-detail";
    batch.castShadow = true;
    batch.receiveShadow = true;
    for (const mesh of meshes) {
      parent.remove(mesh);
      mesh.geometry.dispose();
    }
    parent.add(batch);
  }
}

/** Handmade articulated silhouettes: shaped garments and facial features, never capsule proxies. */
export function buildAvatar(id: string, color: string): AvatarHandle {
  const identity = identities[id] || identities.player;
  const group = new THREE.Group();
  group.name = `resident-${id}`;
  group.scale.setScalar(identity.scale);
  const body = joint(group, "body", 0, -0.04, 0);
  const cloth = material(color),
    skin = material(identity.skin),
    hair = material(identity.hair),
    pants = material(identity.trousers),
    shoe = material("#292c2b"),
    cream = material("#e6dfc9"),
    dark = material("#242b30"),
    white = material("#f1e7d7");
  const torso = part(
    body,
    lathe([
      [0.14, 0.83],
      [0.19, 0.91],
      [0.19, 1.12],
      [0.245, 1.34],
      [0.2, 1.4],
      [0.105, 1.43],
    ]),
    cloth,
    0,
    0,
    0,
    [1, 0.99, 0.65],
  );
  torso.name = "tailored-torso";
  torso.userData.articulated = true;
  // Front placket, folded collar and sleeve seams make clothing legible at close range.
  box(body, cream, [0.028, 0.36, 0.012], [0, 1.17, 0.145]);
  for (const side of [-1, 1]) {
    const collar = box(
      body,
      cream,
      [0.095, 0.085, 0.025],
      [side * 0.062, 1.365, 0.115],
    );
    collar.rotation.z = side * 0.35;
  }
  box(body, dark, [0.32, 0.035, 0.23], [0, 0.87, 0]);
  part(
    body,
    new THREE.CylinderGeometry(0.075, 0.08, 0.13, 10),
    skin,
    0,
    1.46,
    0,
  );
  const head = joint(body, "head", 0, 1.6, 0);
  part(head, sphere(0.15), skin, 0, 0, 0, [0.86, 1.16, 0.87]);
  // Sculpted nose, ears, brow ridge, cheek and eyes all face positive Z.
  part(head, sphere(0.035), skin, 0, -0.005, 0.126, [0.6, 0.85, 1.12]);
  for (const side of [-1, 1]) {
    part(head, sphere(0.033), skin, side * 0.127, -0.006, 0, [0.5, 0.85, 0.7]);
    part(
      head,
      sphere(0.024),
      white,
      side * 0.05,
      0.035,
      0.112,
      [1, 0.65, 0.35],
    );
    part(head, sphere(0.012), dark, side * 0.05, 0.035, 0.121, [0.6, 0.9, 0.4]);
    const brow = box(
      head,
      hair,
      [0.047, 0.011, 0.012],
      [side * 0.05, 0.069, 0.119],
    );
    brow.rotation.z = side * -0.12;
  }
  box(head, material("#905746"), [0.048, 0.009, 0.012], [0, -0.063, 0.124]);
  // Hair cap shaped around the crown, with individual clumps at the fringe.
  part(
    head,
    new THREE.SphereGeometry(0.154, 12, 8, 0, Math.PI * 2, 0, 1.55),
    hair,
    0,
    0.015,
    0,
    [0.9, 1.12, 0.91],
  );
  for (let i = 0; i < 5; i++)
    part(
      head,
      sphere(0.045),
      hair,
      (i - 2) * 0.046,
      0.105 + (i % 2) * 0.014,
      0.092,
      [1, 0.65, 0.65],
    );
  if (["mara", "inez", "bea"].includes(id))
    part(head, sphere(0.077), hair, 0, 0.06, -0.14, [0.9, 1, 0.8]);
  if (id === "ada")
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      part(
        head,
        sphere(0.065),
        hair,
        Math.cos(a) * 0.12,
        0.105 + Math.sin(a) * 0.025,
        Math.sin(a) * 0.09,
        [1, 1, 0.9],
      );
    }
  if (id === "theo" || id === "eli")
    part(
      head,
      new THREE.SphereGeometry(
        0.14,
        10,
        6,
        0,
        Math.PI * 2,
        Math.PI * 0.5,
        Math.PI * 0.5,
      ),
      hair,
      0,
      -0.015,
      0,
      [0.92, 0.65, 0.97],
    );
  const hips = joint(body, "hips", 0, 0.83, 0);
  const legs: THREE.Group[] = [],
    knees: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const leg = joint(
      hips,
      side < 0 ? "left-hip" : "right-hip",
      side * 0.105,
      0,
      0,
    );
    legs.push(leg);
    part(
      leg,
      lathe([
        [0.078, 0],
        [0.087, -0.08],
        [0.075, -0.25],
        [0.061, -0.37],
      ]),
      pants,
      0,
      0,
      0,
    );
    const knee = joint(leg, "knee", 0, -0.37, 0);
    knees.push(knee);
    part(
      knee,
      lathe([
        [0.061, 0],
        [0.066, -0.07],
        [0.047, -0.29],
        [0.047, -0.35],
      ]),
      pants,
      0,
      0,
      0,
    );
    part(knee, sphere(0.085), shoe, 0, -0.365, 0.035, [0.79, 0.62, 1.5]);
    box(knee, dark, [0.13, 0.025, 0.22], [0, -0.405, 0.035]);
  }
  const arms: THREE.Group[] = [],
    elbows: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const arm = joint(
      body,
      side < 0 ? "left-shoulder" : "right-shoulder",
      side * 0.224,
      1.33,
      0,
    );
    arms.push(arm);
    part(
      arm,
      lathe([
        [0.079, 0],
        [0.084, -0.08],
        [0.062, -0.24],
      ]),
      cloth,
      0,
      0,
      0,
      [1, 1, 0.95],
    );
    const elbow = joint(arm, "elbow", 0, -0.24, 0);
    elbows.push(elbow);
    part(
      elbow,
      lathe([
        [0.058, 0],
        [0.052, -0.13],
        [0.034, -0.24],
      ]),
      skin,
      0,
      0,
      0,
    );
    part(elbow, sphere(0.047), skin, 0, -0.267, 0.008, [0.78, 1.28, 0.66]);
    part(
      elbow,
      sphere(0.023),
      skin,
      side * -0.028,
      -0.25,
      0.023,
      [0.75, 1, 0.8],
    );
  }
  const gear = identity.gear;
  if (gear === "apron" || gear === "baker") {
    const apronMat = material(gear === "baker" ? "#e7d8b7" : "#b8aa84");
    part(
      body,
      lathe(
        [
          [0.205, 0.73],
          [0.204, 0.9],
          [0.2, 1.13],
          [0.145, 1.25],
        ],
        12,
      ),
      apronMat,
      0,
      0,
      0.018,
      [1, 1, 0.7],
    );
    box(body, cloth, [0.16, 0.11, 0.025], [0, 0.96, 0.167]);
  }
  if (gear === "medic") {
    box(body, white, [0.12, 0.14, 0.025], [0.12, 1.24, 0.14]);
    box(body, material("#b95945"), [0.075, 0.023, 0.007], [0.12, 1.24, 0.157]);
    box(body, material("#b95945"), [0.023, 0.075, 0.008], [0.12, 1.24, 0.159]);
    tube(
      body,
      dark,
      new THREE.Vector3(-0.08, 1.4, 0.14),
      new THREE.Vector3(-0.12, 1.16, 0.16),
      0.012,
    );
    tube(
      body,
      dark,
      new THREE.Vector3(0.08, 1.4, 0.14),
      new THREE.Vector3(0.12, 1.16, 0.16),
      0.012,
    );
    part(
      body,
      sphere(0.029),
      material("#abb9b5", 0.35),
      -0.12,
      1.14,
      0.165,
      [1, 1, 0.35],
    );
  }
  if (gear === "captain" || gear === "beanie" || gear === "baker") {
    const hatMat =
      gear === "captain" ? cream : gear === "baker" ? white : cloth;
    part(
      head,
      lathe([
        [0.15, 0.1],
        [0.153, 0.14],
        [0.14, 0.19],
        [0.09, 0.22],
        [0, 0.225],
      ]),
      hatMat,
      0,
      0,
      0,
    );
    if (gear === "captain")
      part(
        head,
        new THREE.CylinderGeometry(0.17, 0.17, 0.025, 16),
        dark,
        0,
        0.1,
        0.025,
        [1, 1, 1.1],
      );
    if (gear === "baker")
      for (let i = 0; i < 4; i++)
        part(
          head,
          sphere(0.075),
          white,
          ((i % 2) - 0.5) * 0.11,
          0.2,
          -0.045 + Math.floor(i / 2) * 0.09,
        );
  }
  if (gear === "glasses") {
    for (const side of [-1, 1]) {
      part(
        head,
        new THREE.TorusGeometry(0.034, 0.006, 5, 12),
        dark,
        side * 0.052,
        0.035,
        0.133,
      );
    }
    box(head, dark, [0.04, 0.007, 0.008], [0, 0.035, 0.136]);
  }
  if (gear === "headphones") {
    const band = part(
      head,
      new THREE.TorusGeometry(0.162, 0.014, 6, 16, Math.PI),
      dark,
      0,
      0.02,
      0,
    );
    band.rotation.z = 0;
    for (const side of [-1, 1])
      part(head, sphere(0.054), dark, side * 0.147, 0.02, 0, [0.45, 1, 0.85]);
  }
  if (gear === "toolbelt") {
    for (const side of [-1, 1])
      box(
        body,
        material("#82623f"),
        [0.085, 0.12, 0.1],
        [side * 0.17, 0.84, 0.075],
      );
    box(
      body,
      material("#949d9c", 0.35),
      [0.022, 0.19, 0.025],
      [0.17, 0.88, 0.135],
    );
    box(
      body,
      material("#949d9c", 0.35),
      [0.07, 0.024, 0.025],
      [0.17, 0.975, 0.135],
    );
  }
  if (gear === "backpack") {
    part(
      body,
      sphere(0.19),
      material("#bf8650"),
      0,
      1.15,
      -0.17,
      [0.9, 1.2, 0.55],
    );
    for (const side of [-1, 1])
      box(body, cream, [0.035, 0.39, 0.025], [side * 0.13, 1.2, 0.135]);
    box(body, cream, [0.16, 0.08, 0.025], [0, 1.09, -0.28]);
  }
  if (gear === "clipboard") {
    const clipboard = box(
      elbows[0],
      material("#9f7d51"),
      [0.18, 0.24, 0.025],
      [0, -0.15, 0.06],
    );
    clipboard.rotation.x = 0.3;
    box(clipboard, cream, [0.145, 0.19, 0.008], [0, 0, 0.018]);
  }
  // Crate appears only for an authoritative active shipment or explicit player carry state.
  const cargo = joint(body, "carried-supply", 0, 1.05, 0.37);
  cargo.visible = false;
  box(cargo, material("#9d7750"), [0.39, 0.27, 0.31], [0, 0, 0]);
  for (const y of [-0.085, 0.085])
    box(cargo, cream, [0.4, 0.028, 0.012], [0, y, 0.162]);
  box(cargo, cream, [0.1, 0.09, 0.012], [0, 0, 0.163]);
  mergeStaticParts(group);
  let phase = 0,
    lastElapsed: number | undefined;
  return {
    group,
    animate(elapsed, speed, carrying = false, talking = false) {
      const dt =
        lastElapsed === undefined
          ? 0
          : Math.min(0.1, Math.max(0, elapsed - lastElapsed));
      lastElapsed = elapsed;
      phase += dt * Math.max(0, speed) * 5.3;
      const gait = Math.min(1, Math.max(0, speed) / 1.25),
        wave = Math.sin(phase);
      body.position.y =
        -0.04 +
        Math.abs(Math.sin(phase)) * gait * 0.022 +
        Math.sin(elapsed * 1.7) * 0.005;
      torso.scale.y = 0.99 + Math.sin(elapsed * 1.7) * 0.008;
      legs[0].rotation.x = wave * 0.48 * gait;
      legs[1].rotation.x = -wave * 0.48 * gait;
      knees[0].rotation.x = Math.max(0, -wave) * 0.65 * gait;
      knees[1].rotation.x = Math.max(0, wave) * 0.65 * gait;
      arms.forEach((arm, i) => {
        const side = i === 0 ? -1 : 1;
        arm.rotation.x = carrying ? -0.65 : -wave * side * 0.4 * gait;
        arm.rotation.z = side * (carrying ? 0.18 : 0.07);
        elbows[i].rotation.x = carrying ? -1.05 : -0.08;
        if (talking && !carrying && gait < 0.1) {
          arm.rotation.x = -0.2 - Math.sin(elapsed * 2.2 + i) * 0.12;
          elbows[i].rotation.x = -0.35 - Math.sin(elapsed * 2 + i) * 0.18;
        }
      });
      head.rotation.y = talking
        ? Math.sin(elapsed * 0.9) * 0.055
        : Math.sin(elapsed * 0.35 + id.length) * 0.085;
      head.rotation.x = talking ? Math.sin(elapsed * 2) * 0.03 : 0;
      cargo.visible = carrying;
    },
  };
}

function route(
  from: Point,
  fromLocation: LocationId,
  to: Point,
  toLocation: LocationId,
): Point[] {
  const waypoints = routeBetweenLocations(fromLocation, toLocation);
  // Reach the center line while still inside before passing the doorway.
  return [{ x: waypoints[0].x, z: from.z }, ...waypoints, to];
}
export function buildResidents(world: World): ResidentHandle {
  const group = new THREE.Group();
  group.name = "town-residents";
  const interactions: Interaction[] = [];
  const entries = world.characters.map((c) => {
    const avatar = buildAvatar(c.id, c.color);
    const home = residentHome(world, c.id);
    const shipment = world.spatial?.shipments
      .filter(
        (s) =>
          s.workerId === c.id &&
          (s.status !== "arrived" || c.location === "warehouse"),
      )
      .at(-1);
    const initial = shipment?.position || home;
    avatar.group.position.set(initial.x, 0, initial.z);
    group.add(avatar.group);
    avatar.group.traverse((o) => (o.userData.interactionId = `person:${c.id}`));
    const interaction: Interaction = {
      id: `person:${c.id}`,
      kind: "person",
      label: c.name,
      position: { ...initial },
      location: c.location,
      object: avatar.group,
    };
    interactions.push(interaction);
    return {
      id: c.id,
      avatar,
      interaction,
      home,
      location: c.location,
      path: [] as Point[],
      lastMotion: -1,
    };
  });
  return {
    group,
    interactions,
    position(id) {
      const e = entries.find((e) => e.id === id);
      return e ? { ...e.interaction.position } : undefined;
    },
    update(next, dt, elapsed, player, selected) {
      interactions.length = 0;
      for (const e of entries) {
        const c = next.characters.find((c) => c.id === e.id);
        if (!c) continue;
        const goal = residentHome(next, e.id);
        const shipment = next.spatial?.shipments
          .filter(
            (s) =>
              s.workerId === e.id &&
              (s.status !== "arrived" || c.location === "warehouse"),
          )
          .at(-1);
        let speed = 0;
        const position = e.avatar.group.position;
        if (shipment) {
          const dx = shipment.position.x - position.x,
            dz = shipment.position.z - position.z;
          if (Math.hypot(dx, dz) > 0.001) {
            e.avatar.group.rotation.y = Math.atan2(dx, dz);
            e.lastMotion = elapsed;
          }
          position.x = shipment.position.x;
          position.z = shipment.position.z;
          e.location = c.location;
          e.home = goal;
          e.path = [];
          speed =
            shipment.status !== "arrived" && elapsed - e.lastMotion < 0.3
              ? 2
              : 0;
        } else {
          if (
            c.location !== e.location ||
            Math.hypot(goal.x - e.home.x, goal.z - e.home.z) > 0.15
          ) {
            e.path = route(
              e.interaction.position,
              e.location,
              goal,
              c.location,
            );
            e.home = goal;
            e.location = c.location;
          }
        }
        if (!shipment && e.path.length) {
          const target = e.path[0],
            dx = target.x - position.x,
            dz = target.z - position.z,
            distance = Math.hypot(dx, dz),
            step = Math.min(distance, Math.max(0, dt) * 1.15);
          if (distance < 0.08) e.path.shift();
          else {
            position.x += (dx / distance) * step;
            position.z += (dz / distance) * step;
            e.avatar.group.rotation.y = Math.atan2(dx, dz);
            speed = 1.15;
          }
        }
        if (
          speed === 0 &&
          (selected === e.id || selected === `person:${e.id}`)
        ) {
          const angle = Math.atan2(
              player.x - position.x,
              player.z - position.z,
            ),
            delta = Math.atan2(
              Math.sin(angle - e.avatar.group.rotation.y),
              Math.cos(angle - e.avatar.group.rotation.y),
            );
          e.avatar.group.rotation.y += delta * Math.min(1, dt * 5);
        }
        e.interaction.position.x = position.x;
        e.interaction.position.z = position.z;
        e.interaction.location = c.location;
        // A routine commuter is visible but cannot be addressed at a logical destination before arriving.
        if (!e.path.length && (!shipment || shipment.status === "arrived"))
          interactions.push(e.interaction);
        e.avatar.animate(
          elapsed,
          speed,
          shipment?.status === "carrying",
          (selected === e.id || selected === `person:${e.id}`) &&
            Math.hypot(player.x - position.x, player.z - position.z) < 4,
        );
      }
    },
    dispose() {
      const geometries = new Set<THREE.BufferGeometry>(),
        materials = new Set<THREE.Material>();
      group.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          geometries.add(o.geometry);
          for (const m of Array.isArray(o.material) ? o.material : [o.material])
            materials.add(m);
        }
      });
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      group.clear();
    },
  };
}
