import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { PLACES } from "../three/shared";
import { surfaceHeight, type RegionState } from "./contracts";

export function isSheltered(x: number, z: number, creatureShelter = false) {
  return (
    PLACES.some(
      (p) =>
        p.id !== "harbor" &&
        Math.abs(x - p.center.x) < p.width / 2 &&
        Math.abs(z - p.center.z) < p.depth / 2,
    ) ||
    (x > 62 && x < 78 && z > -1 && z < 11) ||
    (x > -72 && x < -62 && z > 5.5 && z < 14.5) ||
    (creatureShelter && x > -36.75 && x < -31.25 && z > 11.7 && z < 16.3)
  );
}
/** Bounded lighting and contact cues. No simulation state is changed here. */
export function createPresentation(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, 0.06);
  room.dispose();
  pmrem.dispose();
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.38;
  const ambient = new THREE.HemisphereLight("#dcecff", "#615448", 0.45);
  scene.add(ambient);
  const fills = [
    [-22, 3.2, 11],
    [0, 3, -12],
    [70, 3, 9],
    [-67, 2.7, 13],
  ].map(([x, y, z]) => {
    const light = new THREE.PointLight("#ffc888", 12, 11, 2);
    light.position.set(x, y, z);
    scene.add(light);
    return light;
  });
  const contactCanvas = document.createElement("canvas");
  contactCanvas.width = contactCanvas.height = 64;
  const ctx = contactCanvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(32, 32, 2, 32, 32, 31);
  gradient.addColorStop(0, "rgba(12,21,25,.48)");
  gradient.addColorStop(0.4, "rgba(12,21,25,.25)");
  gradient.addColorStop(1, "rgba(12,21,25,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  const contactTex = new THREE.CanvasTexture(contactCanvas);
  const contactMat = new THREE.MeshBasicMaterial({
    map: contactTex,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });
  const contactGeo = new THREE.PlaneGeometry(1, 1);
  const contacts = new THREE.InstancedMesh(contactGeo, contactMat, 24);
  contacts.frustumCulled = false;
  scene.add(contacts);
  const dummy = new THREE.Object3D();
  dummy.rotation.x = -Math.PI / 2;
  const rainGeo = new THREE.BufferGeometry();
  const rainPositions = new Float32Array(240 * 6);
  rainGeo.setAttribute("position", new THREE.BufferAttribute(rainPositions, 3));
  const rainMat = new THREE.LineBasicMaterial({
    color: "#c5dfed",
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
  });
  const rain = new THREE.LineSegments(rainGeo, rainMat);
  rain.frustumCulled = false;
  scene.add(rain);

  const splashGeo = new THREE.RingGeometry(0.08, 0.11, 12);
  splashGeo.rotateX(-Math.PI / 2);
  const splashMat = new THREE.MeshBasicMaterial({
    color: "#d4e5e8",
    transparent: true,
    opacity: 0.2,
    depthWrite: false,
  });
  const splashes = new THREE.InstancedMesh(splashGeo, splashMat, 28);
  splashes.frustumCulled = false;
  scene.add(splashes);
  const splashDummy = new THREE.Object3D();
  let elapsed = 0;
  return {
    update(s: RegionState, dt: number, low: boolean) {
      elapsed += dt;
      const wet =
        s.wildlife.weather === "rain" || s.wildlife.weather === "storm";
      const dusk = s.wildlife.weather === "dusk";
      scene.environmentIntensity = THREE.MathUtils.damp(
        scene.environmentIntensity,
        wet ? 0.32 : dusk ? 0.26 : 0.48,
        2,
        dt,
      );
      fills.forEach((l) => {
        l.visible =
          Math.hypot(
            l.position.x - s.wildlife.player.x,
            l.position.z - s.wildlife.player.z,
          ) < 26;
        l.intensity = wet || dusk ? 20 : 10;
      });
      const positions = [
        ...(!s.vehicle.occupied ? [{ ...s.wildlife.player, size: 0.95 }] : []),
        ...s.residents.map((r) => ({ ...r.position, size: 0.8 })),
        ...s.wildlife.creatures
          .filter((c) => c.available && !c.bonded)
          .map((c) => ({ ...c.position, size: 1.1 })),
        ...(s.wildlife.companion && !s.vehicle.occupied
          ? [{ ...s.wildlife.companionPosition, size: 1.15 }]
          : []),
        { ...s.vehicle.position, size: 3.1 },
      ];
      let count = 0;
      for (const p of positions) {
        if (count === 24) break;
        dummy.position.set(p.x, surfaceHeight(p) + 0.035, p.z);
        dummy.scale.set(p.size, p.size * 0.75, 1);
        dummy.updateMatrix();
        contacts.setMatrixAt(count++, dummy.matrix);
      }
      contacts.count = count;
      contacts.instanceMatrix.needsUpdate = true;
      rain.visible = wet;
      splashes.visible = wet;
      if (wet) {
        const n = low ? 90 : 240;
        rainGeo.setDrawRange(0, n * 2);
        for (let i = 0; i < n; i++) {
          const y =
            12 -
            ((elapsed * (s.wildlife.weather === "storm" ? 16 : 11) +
              i * 0.319) %
              12);
          const x =
              s.wildlife.player.x + ((i * 7.173) % 30) - 15 + (12 - y) * 0.12,
            z = s.wildlife.player.z + ((i * 13.719) % 28) - 14;
          const hidden = isSheltered(x, z, s.upgrades.shelter);
          const at = i * 6;
          rainPositions.set(
            [
              x,
              hidden ? -100 : y + surfaceHeight({ x, z }),
              z,
              x + 0.04,
              hidden ? -100 : y + 0.65 + surfaceHeight({ x, z }),
              z + 0.04,
            ],
            at,
          );
        }
        rainGeo.attributes.position.needsUpdate = true;
        for (let i = 0; i < 28; i++) {
          const x = s.wildlife.player.x + ((i * 7.13) % 20) - 10,
            z = s.wildlife.player.z + ((i * 3.71) % 18) - 9;
          splashDummy.position.set(
            x,
            isSheltered(x, z, s.upgrades.shelter)
              ? -100
              : surfaceHeight({ x, z }) + 0.04,
            z,
          );
          splashDummy.scale.setScalar(
            0.3 + ((elapsed * 1.5 + i * 0.73) % 1) * 2,
          );
          splashDummy.updateMatrix();
          splashes.setMatrixAt(i, splashDummy.matrix);
        }
        splashes.instanceMatrix.needsUpdate = true;
      }
    },
    dispose() {
      if (scene.environment === environment.texture) scene.environment = null;
      environment.dispose();
      contactTex.dispose();
      contactGeo.dispose();
      contactMat.dispose();
      rainGeo.dispose();
      rainMat.dispose();
      splashGeo.dispose();
      splashMat.dispose();
      [ambient, ...fills, contacts, rain, splashes].forEach((o) =>
        scene.remove(o),
      );
    },
  };
}
