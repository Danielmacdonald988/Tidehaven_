import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { CreatureMood, SpeciesId } from "./contracts";

export interface CreatureRig {
  group: THREE.Group;
  animate(
    mood: CreatureMood,
    elapsed: number,
    speed: number,
    phase: number,
  ): void;
  dispose(): void;
}
/** Original coastal bestiary. All rigs face +Z; the root never moves the simulation. */
export function buildCreature(id: SpeciesId, variant = 0): CreatureRig {
  const group = new THREE.Group();
  group.name = `creature-${id}`;
  group.userData.species = id;
  const body = new THREE.Group();
  group.add(body);
  const geometries = new Set<THREE.BufferGeometry>(),
    materials = new Set<THREE.Material>();
  const palette = {
    brindlefin: ["#c97e49", "#f5d8a3", "#4e7975"],
    cairnback: ["#707f70", "#c9c2a0", "#3d5152"],
    pluvlet: ["#4d9a9a", "#c5e9ba", "#e8cb68"],
    sailpip: ["#a87183", "#ead4bf", "#506984"],
    glasswhorl: ["#98b5cc", "#e3ddd2", "#6776a9"],
    tempestray: ["#485a88", "#e1bfd7", "#8ed5d0"],
  }[id];
  const skinColor = new THREE.Color(palette[0]);
  skinColor.offsetHSL(
    ((variant % 5) - 2) * 0.009,
    0,
    ((variant % 3) - 1) * 0.025,
  );
  const material = (
    color: THREE.ColorRepresentation,
    extra: THREE.MeshStandardMaterialParameters = {},
  ) => {
    const m = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.65,
      metalness: 0.03,
      ...extra,
    });
    materials.add(m);
    return m;
  };
  const skin = material(skinColor, {
      roughness: id === "pluvlet" ? 0.32 : id === "cairnback" ? 0.91 : 0.7,
    }),
    cream = material(palette[1]),
    accent = material(palette[2]),
    dark = material("#142e38", { roughness: 0.2 }),
    white = material("#fff5dc", { roughness: 0.2 }),
    glow = material(palette[1], {
      emissive: palette[1],
      emissiveIntensity: 0.45,
    });
  const mesh = (
    g: THREE.BufferGeometry,
    m: THREE.Material,
    parent: THREE.Object3D,
    x = 0,
    y = 0,
    z = 0,
  ) => {
    geometries.add(g);
    const o = new THREE.Mesh(g, m);
    o.position.set(x, y, z);
    o.castShadow = true;
    o.receiveShadow = true;
    o.userData.species = id;
    parent.add(o);
    return o;
  };
  const oval = (
    p: THREE.Object3D,
    m: THREE.Material,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
  ) => {
    const o = mesh(new THREE.SphereGeometry(1, 16, 12), m, p, x, y, z);
    o.scale.set(sx, sy, sz);
    return o;
  };
  const tube = (
    p: THREE.Object3D,
    m: THREE.Material,
    points: number[][],
    radius = 0.025,
  ) =>
    mesh(
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(points.map((a) => new THREE.Vector3(...a))),
        12,
        radius,
        5,
        false,
      ),
      m,
      p,
    );
  const fin = (
    p: THREE.Object3D,
    m: THREE.Material,
    points: number[][],
    depth = 0.025,
  ) => {
    const shape = new THREE.Shape();
    points.forEach(([x, y], i) =>
      i ? shape.lineTo(x, y) : shape.moveTo(x, y),
    );
    shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.018,
      bevelThickness: 0.012,
    });
    return mesh(g, m, p);
  };
  const joint = (p: THREE.Object3D, x: number, y: number, z: number) => {
    const j = new THREE.Group();
    j.position.set(x, y, z);
    p.add(j);
    return j;
  };
  const eyes: THREE.Mesh[] = [],
    limbs: THREE.Group[] = [],
    wings: THREE.Group[] = [],
    feelers: THREE.Group[] = [];
  const head = joint(body, 0, 0, 0),
    tail = joint(body, 0, 0, 0);
  const eye = (
    p: THREE.Object3D,
    x: number,
    y: number,
    z: number,
    size = 0.07,
  ) => {
    oval(p, cream, x, y, z, size * 1.35, size * 1.25, size * 0.8);
    const e = oval(
      p,
      dark,
      x,
      y,
      z + size * 0.5,
      size,
      size * 1.05,
      size * 0.7,
    );
    eyes.push(e);
    oval(
      p,
      white,
      x - size * 0.25,
      y + size * 0.3,
      z + size * 1.1,
      size * 0.22,
      size * 0.24,
      size * 0.12,
    );
  };
  const foot = (x: number, z: number, width = 0.12, length = 0.2) => {
    const j = joint(body, x, 0.23, z);
    oval(j, skin, 0, -0.07, 0, width, 0.16, width);
    oval(j, accent, 0, -0.18, 0.045, width * 1.2, 0.055, length);
    limbs.push(j);
    return j;
  };
  if (id === "brindlefin") {
    oval(body, skin, 0, 0.43, -0.08, 0.38, 0.31, 0.49);
    oval(body, cream, 0, 0.31, 0.04, 0.3, 0.21, 0.41);
    head.position.set(0, 0.44, 0.38);
    oval(head, skin, 0, 0, 0, 0.31, 0.25, 0.28);
    oval(head, cream, 0, -0.09, 0.19, 0.23, 0.12, 0.12);
    eye(head, -0.18, 0.06, 0.205);
    eye(head, 0.18, 0.06, 0.205);
    // Deliberate cheek freckles and swept whiskers make the starter expressive up close.
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        oval(
          head,
          accent,
          side * (0.14 + i * 0.035),
          -0.055 - i * 0.014,
          0.28 - i * 0.02,
          0.012,
          0.012,
          0.008,
        );
        tube(
          head,
          cream,
          [
            [side * 0.19, -0.07, 0.26],
            [side * 0.29, -0.045 + i * 0.035, 0.28],
            [side * 0.39, -0.04 + i * 0.055, 0.25],
          ],
          0.007,
        );
      }
      tube(
        head,
        accent,
        [
          [side * 0.105, 0.14, 0.18],
          [side * 0.18, 0.16, 0.2],
          [side * 0.24, 0.125, 0.17],
        ],
        0.018,
      );
    }
    oval(head, accent, 0, -0.035, 0.295, 0.055, 0.035, 0.025);
    for (const s of [-1, 1]) {
      const j = joint(head, s * 0.23, 0.13, -0.06);
      const f = fin(j, accent, [
        [0, 0],
        [s * 0.13, 0.27],
        [s * 0.36, 0.13],
        [s * 0.32, -0.1],
        [s * 0.08, -0.12],
      ]);
      f.rotation.y = s * 0.25;
      feelers.push(j);
      for (let n = 0; n < 3; n++)
        tube(
          j,
          cream,
          [
            [s * 0.03, 0, 0.04],
            [s * (0.1 + n * 0.07), 0.16 - n * 0.07, 0.04],
          ],
          0.012,
        );
    }
    foot(-0.24, 0.18);
    foot(0.24, 0.18);
    foot(-0.26, -0.35);
    foot(0.26, -0.35);
    tail.position.set(0, 0.42, -0.48);
    tube(
      tail,
      skin,
      [
        [0, 0, 0],
        [0, 0.05, -0.23],
        [0, 0.13, -0.35],
      ],
      0.09,
    );
    const f = fin(tail, accent, [
      [-0.04, 0],
      [-0.29, 0.18],
      [-0.25, 0.39],
      [0, 0.3],
      [0.25, 0.39],
      [0.29, 0.18],
      [0.04, 0],
    ]);
    f.rotation.x = -Math.PI / 2;
    f.position.z = -0.3;
    for (const s of [-1, 1])
      for (let n = 0; n < 3; n++) {
        const mark = oval(
          body,
          accent,
          s * 0.34,
          0.48,
          -0.22 + n * 0.15,
          0.028,
          0.1,
          0.03,
        );
        mark.rotation.z = s * -0.3;
      }
  } else if (id === "cairnback") {
    oval(body, skin, 0, 0.44, 0, 0.48, 0.35, 0.61);
    oval(body, cream, 0, 0.31, 0.12, 0.36, 0.19, 0.48);
    // Overlapping rounded stone scutes form a scalloped, recognisable shield silhouette.
    for (let row = 0; row < 3; row++)
      for (let col = -1; col <= 1; col++) {
        const scute = mesh(
          new THREE.DodecahedronGeometry(0.26, 0),
          col === 0 ? accent : skin,
          body,
          col * 0.25,
          0.64 - Math.abs(col) * 0.065,
          -0.37 + row * 0.3,
        );
        scute.scale.set(1, 0.55, 1);
        scute.rotation.y = row * 0.3;
      }
    head.position.set(0, 0.39, 0.6);
    oval(head, skin, 0, 0, 0, 0.25, 0.22, 0.24);
    oval(head, cream, 0, -0.07, 0.16, 0.2, 0.11, 0.17);
    eye(head, -0.15, 0.05, 0.17, 0.06);
    eye(head, 0.15, 0.05, 0.17, 0.06);
    for (const s of [-1, 1]) {
      const e = joint(head, s * 0.2, 0.14, -0.08);
      oval(e, accent, 0, 0.04, 0, 0.075, 0.14, 0.04);
      feelers.push(e);
      tube(
        head,
        cream,
        [
          [s * 0.19, -0.08, 0.19],
          [s * 0.24, -0.03, 0.27],
          [s * 0.21, 0.04, 0.28],
        ],
        0.03,
      );
    }
    foot(-0.37, 0.36, 0.15, 0.2);
    foot(0.37, 0.36, 0.15, 0.2);
    foot(-0.36, -0.36, 0.16, 0.19);
    foot(0.36, -0.36, 0.16, 0.19);
    tail.position.set(0, 0.32, -0.56);
    tube(
      tail,
      skin,
      [
        [0, 0, 0],
        [0, -0.08, -0.23],
        [0.08, -0.1, -0.31],
      ],
      0.055,
    );
  } else if (id === "pluvlet") {
    oval(body, skin, 0, 0.4, 0, 0.25, 0.27, 0.36);
    oval(body, cream, 0, 0.3, 0.12, 0.19, 0.19, 0.24);
    head.position.set(0, 0.55, 0.22);
    oval(head, skin, 0, 0, 0, 0.31, 0.2, 0.23);
    eye(head, -0.2, 0.12, 0.11, 0.095);
    eye(head, 0.2, 0.12, 0.11, 0.095);
    tube(
      head,
      accent,
      [
        [-0.13, -0.06, 0.22],
        [0, -0.09, 0.25],
        [0.13, -0.06, 0.22],
      ],
      0.013,
    );
    for (const s of [-1, 1]) {
      const j = joint(body, s * 0.2, 0.26, -0.18);
      oval(j, skin, s * 0.1, -0.02, 0, 0.17, 0.15, 0.22);
      tube(
        j,
        accent,
        [
          [s * 0.12, 0, 0],
          [s * 0.29, -0.18, 0.04],
          [s * 0.25, -0.2, 0.26],
        ],
        0.035,
      );
      for (let t = 0; t < 3; t++)
        tube(
          j,
          cream,
          [
            [s * 0.25, -0.2, 0.24],
            [s * (0.15 + t * 0.1), -0.22, 0.4],
          ],
          0.018,
        );
      limbs.push(j);
      const arm = foot(s * 0.17, 0.27, 0.055, 0.11);
      for (let t = 0; t < 3; t++)
        tube(
          arm,
          cream,
          [
            [0, -0.18, 0.1],
            [(t - 1) * 0.07, -0.2, 0.2],
          ],
          0.014,
        );
    }
    for (const s of [-1, 1]) {
      const j = joint(head, s * 0.25, 0.03, -0.09);
      for (let t = 0; t < 3; t++)
        tube(
          j,
          glow,
          [
            [0, 0, 0],
            [s * 0.13, 0.07 + t * 0.06, -0.04],
            [s * 0.2, 0.08 + t * 0.06, -0.08],
          ],
          0.018,
        );
      feelers.push(j);
    }
    tail.position.set(0, 0.35, -0.28);
    tube(
      tail,
      skin,
      [
        [0, 0, 0],
        [0, 0.03, -0.28],
        [0, 0.18, -0.42],
      ],
      0.065,
    );
    oval(tail, glow, 0, 0.18, -0.42, 0.07, 0.09, 0.04);
    for (let i = 0; i < 5; i++)
      oval(
        body,
        glow,
        i % 2 ? -0.12 : 0.12,
        0.57,
        -0.24 + i * 0.1,
        0.035,
        0.025,
        0.04,
      );
  } else if (id === "sailpip") {
    oval(body, skin, 0, 0.42, 0, 0.19, 0.2, 0.36);
    oval(body, cream, 0, 0.39, 0.15, 0.14, 0.15, 0.22);
    head.position.set(0, 0.49, 0.32);
    oval(head, skin, 0, 0, 0, 0.23, 0.19, 0.2);
    eye(head, -0.13, 0.035, 0.15, 0.07);
    eye(head, 0.13, 0.035, 0.15, 0.07);
    oval(head, accent, 0, -0.04, 0.23, 0.045, 0.035, 0.06);
    for (const s of [-1, 1]) {
      const j = joint(body, s * 0.13, 0.48, 0);
      const wing = fin(
        j,
        skin,
        [
          [0, 0],
          [s * 0.36, 0.35],
          [s * 0.9, 0.14],
          [s * 0.73, -0.28],
          [s * 0.28, -0.38],
          [s * 0.14, -0.12],
        ],
        0.018,
      );
      wing.rotation.x = -Math.PI / 2;
      for (let n = 0; n < 3; n++)
        tube(
          j,
          cream,
          [
            [0, 0, 0],
            [s * (0.3 + n * 0.25), 0.025, -0.3 + n * 0.1],
            [s * (0.3 + n * 0.22), 0.025, 0.27],
          ],
          0.014,
        );
      wings.push(j);
      const ear = joint(head, s * 0.16, 0.14, -0.05);
      fin(ear, accent, [
        [0, 0],
        [s * 0.02, 0.23],
        [s * 0.13, 0.1],
        [s * 0.08, -0.03],
      ]);
      feelers.push(ear);
      foot(s * 0.1, -0.15, 0.04, 0.07);
    }
    tail.position.set(0, 0.42, -0.3);
    tube(
      tail,
      skin,
      [
        [0, 0, 0],
        [0, -0.04, -0.35],
        [0, 0.04, -0.57],
      ],
      0.04,
    );
    const f = fin(tail, cream, [
      [0, 0],
      [-0.16, 0.23],
      [0, 0.16],
      [0.16, 0.23],
    ]);
    f.rotation.x = Math.PI / 2;
    f.position.z = -0.55;
  } else if (id === "glasswhorl") {
    const glass = material("#a9c7d5", {
      transparent: true,
      opacity: 0.55,
      roughness: 0.18,
      metalness: 0.12,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    oval(body, glass, 0, 0.4, 0, 0.23, 0.24, 0.41);
    oval(body, cream, 0, 0.31, 0.06, 0.12, 0.1, 0.3);
    const coil: number[][] = [];
    for (let i = 0; i <= 42; i++) {
      const a = (i / 42) * Math.PI * 4.5,
        r = 0.035 + (i / 42) * 0.28;
      coil.push([Math.cos(a) * r, 0.54 + Math.sin(a) * r, -0.1]);
    }
    tube(body, accent, coil, 0.035);
    oval(body, glass, 0, 0.54, -0.12, 0.31, 0.31, 0.14);
    head.position.set(0, 0.39, 0.34);
    oval(head, glass, 0, 0, 0, 0.21, 0.17, 0.2);
    eye(head, -0.11, 0.03, 0.16, 0.055);
    eye(head, 0.11, 0.03, 0.16, 0.055);
    for (const s of [-1, 1]) {
      const j = joint(head, s * 0.12, 0.13, -0.02);
      tube(
        j,
        accent,
        [
          [0, 0, 0],
          [s * 0.1, 0.25, 0.02],
          [s * 0.05, 0.38, 0.06],
        ],
        0.025,
      );
      oval(j, glow, s * 0.05, 0.38, 0.06, 0.045, 0.06, 0.04);
      feelers.push(j);
      const w = joint(body, s * 0.13, 0.36, 0);
      fin(
        w,
        glass,
        [
          [0, 0],
          [s * 0.43, 0.2],
          [s * 0.53, -0.08],
          [s * 0.26, -0.24],
          [0, -0.1],
        ],
        0.012,
      );
      wings.push(w);
    }
    tail.position.set(0, 0.31, -0.32);
    tube(
      tail,
      glass,
      [
        [0, 0, 0],
        [0, 0.03, -0.25],
        [0.12, 0.1, -0.4],
      ],
      0.045,
    );
  } else {
    oval(body, skin, 0, 0.45, 0, 0.31, 0.17, 0.56);
    oval(body, cream, 0, 0.35, 0.06, 0.25, 0.07, 0.43);
    head.position.set(0, 0.44, 0.43);
    oval(head, skin, 0, 0, 0, 0.31, 0.17, 0.26);
    eye(head, -0.2, 0.035, 0.17, 0.085);
    eye(head, 0.2, 0.035, 0.17, 0.085);
    for (const s of [-1, 1]) {
      const j = joint(body, s * 0.22, 0.44, 0);
      const w = fin(
        j,
        skin,
        [
          [0, 0.05],
          [s * 0.5, 0.49],
          [s * 1.15, 0.35],
          [s * 1.42, -0.04],
          [s * 0.88, -0.39],
          [s * 0.35, -0.3],
          [0, -0.16],
        ],
        0.035,
      );
      w.rotation.x = -Math.PI / 2;
      for (let n = 0; n < 3; n++)
        tube(
          j,
          glow,
          [
            [s * 0.14, 0.02, 0],
            [s * (0.46 + n * 0.26), 0.025, -0.25 + n * 0.12],
            [s * (0.63 + n * 0.25), 0.025, 0.25],
          ],
          0.018,
        );
      wings.push(j);
      const horn = joint(head, s * 0.18, 0.07, 0.15);
      tube(
        horn,
        cream,
        [
          [0, 0, 0],
          [s * 0.11, 0.08, 0.2],
          [s * 0.05, 0.19, 0.32],
        ],
        0.03,
      );
      feelers.push(horn);
    }
    tail.position.set(0, 0.43, -0.48);
    tube(
      tail,
      accent,
      [
        [0, 0, 0],
        [0.09, -0.02, -0.5],
        [-0.15, 0.12, -1],
        [0.1, 0.18, -1.55],
      ],
      0.038,
    );
    for (const s of [-1, 1])
      tube(
        tail,
        glow,
        [
          [0, 0, -0.1],
          [s * 0.25, -0.05, -0.65],
          [s * 0.14, 0.07, -1.05],
        ],
        0.018,
      );
    oval(tail, glow, 0.1, 0.18, -1.55, 0.065, 0.035, 0.13);
  }
  // Batch static sculpting within each articulated joint. Eyes remain separate for blinking.
  const joints: THREE.Object3D[] = [];
  body.traverse((o) => {
    if (o instanceof THREE.Group) joints.push(o);
  });
  for (const node of joints) {
    const batches = new Map<THREE.Material, THREE.Mesh[]>();
    for (const child of [...node.children])
      if (
        child instanceof THREE.Mesh &&
        !eyes.includes(child) &&
        !Array.isArray(child.material)
      ) {
        const list = batches.get(child.material) ?? [];
        list.push(child);
        batches.set(child.material, list);
      }
    for (const [mat, list] of batches)
      if (list.length > 1) {
        const pieces = list.map((o) => {
          o.updateMatrix();
          const g = o.geometry.clone().applyMatrix4(o.matrix);
          if (!g.index) return g;
          const flat = g.toNonIndexed();
          g.dispose();
          return flat;
        });
        const merged = mergeGeometries(pieces, false);
        pieces.forEach((g) => g.dispose());
        if (merged) {
          mesh(merged, mat, node);
          list.forEach((o) => node.remove(o));
        }
      }
  }
  const limbHeights = limbs.map((limb) => limb.position.y);
  const baseHeadY = head.position.y,
    baseBodyY = body.position.y;
  let disposed = false,
    gaitPhase = 0,
    lastElapsed: number | undefined,
    gaitBlend = 0;
  return {
    group,
    animate(mood, elapsed, speed, phase) {
      if (disposed) return;
      const dt =
        lastElapsed === undefined
          ? 0
          : Math.min(0.1, Math.max(0, elapsed - lastElapsed));
      lastElapsed = elapsed;
      const stride = id === "cairnback" ? 7.5 : id === "pluvlet" ? 9 : 9.8;
      gaitPhase += Math.max(0, speed) * dt * stride;
      gaitBlend +=
        (Math.min(1, Math.max(0, speed) * 2) - gaitBlend) *
        (1 - Math.exp(-dt * 12));
      const t = elapsed + phase * 1.7,
        walking = mood === "travel" || (mood === "companion" && speed > 0.1),
        flying = id === "sailpip" || id === "tempestray" || id === "glasswhorl";
      const alert = mood === "alert",
        bond = mood === "bonding",
        curious = mood === "curious" || mood === "receptive";
      body.position.y =
        baseBodyY +
        (flying
          ? Math.sin(t * 2) * 0.055
          : walking
            ? Math.abs(Math.sin(gaitPhase)) *
              (id === "pluvlet" ? 0.085 : 0.018) *
              gaitBlend
            : Math.sin(t * 2.2) * 0.012) +
        (bond ? Math.abs(Math.sin(t * 5)) * 0.23 : 0);
      body.rotation.z = alert
        ? Math.sin(t * 25) * 0.035
        : bond
          ? Math.sin(t * 5) * 0.17
          : walking
            ? Math.sin(gaitPhase) * 0.018 * gaitBlend
            : 0;
      body.rotation.x = alert ? 0.12 : curious ? -0.045 : 0;
      head.rotation.y = curious
        ? Math.sin(t * 1.4) * 0.16
        : alert
          ? Math.sin(t * 6) * 0.18
          : Math.sin(t * 0.7) * 0.065;
      head.rotation.z = curious ? Math.sin(t * 1.7) * 0.1 : 0;
      head.position.y = baseHeadY + (curious ? 0.035 : 0);
      tail.rotation.y =
        Math.sin(t * (bond ? 8 : walking ? 7 : 2.5)) * (bond ? 0.5 : 0.22);
      tail.rotation.x = alert ? 0.3 : Math.sin(t * 2) * 0.06;
      limbs.forEach((j, i) => {
        const step = gaitPhase + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI : 0);
        // Short grounded steps, with a distinct crouch-and-spring rhythm for the rain amphibian.
        j.rotation.x = walking
          ? Math.sin(step) * (id === "cairnback" ? 0.27 : 0.4) * gaitBlend
          : bond
            ? -0.15
            : 0;
        j.position.y =
          limbHeights[i] +
          (walking ? Math.max(0, Math.cos(step)) * 0.035 * gaitBlend : 0);
      });
      wings.forEach((j, i) => {
        const sign = i % 2 ? 1 : -1;
        j.rotation.z =
          sign *
          (Math.sin(t * (id === "sailpip" ? 5 : 2.4)) *
            (walking || flying ? 0.2 : 0.08) +
            (alert ? 0.35 : 0));
      });
      feelers.forEach(
        (j, i) =>
          (j.rotation.z =
            Math.sin(t * 3 + i) * 0.07 + (alert ? (i % 2 ? 0.3 : -0.3) : 0)),
      );
      const blink = Math.sin(t * 0.83) > 0.996 ? 0.14 : 1;
      eyes.forEach(
        (e) =>
          (e.scale.y =
            (id === "pluvlet"
              ? 0.095
              : id === "tempestray"
                ? 0.085
                : id === "glasswhorl"
                  ? 0.055
                  : id === "cairnback"
                    ? 0.06
                    : 0.07) *
            1.05 *
            blink),
      );
      glow.emissiveIntensity =
        mood === "receptive"
          ? 1.25 + Math.sin(t * 4) * 0.25
          : bond
            ? 1.8
            : 0.45 + Math.sin(t * 2) * 0.12;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      group.removeFromParent();
    },
  };
}
