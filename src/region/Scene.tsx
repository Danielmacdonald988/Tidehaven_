import { useEffect, useRef } from "react";
import * as THREE from "three";
import { buildRegionWorld } from "./World";
import { buildVehicle } from "./Vehicle";
import { DriveSound } from "./DriveSound";
import { trafficPositions } from "./engine";
import { surfaceHeight, type RegionState, type DriveInput } from "./contracts";
import { buildCreature } from "../wildlife/Creatures";
import { buildAvatar } from "../three/Residents";
import { WildlifeSound } from "../wildlife/Sound";
import { receptive } from "../wildlife/engine";
import {
  SPECIES,
  SITES,
  type WildlifeState,
  type WildlifeCommand,
  type SpeciesId,
} from "../wildlife/contracts";
import type { Collider, Quality } from "../three/shared";
export interface Metrics {
  fps: number;
  p95: number;
  draws: number;
  triangles: number;
  geometries: number;
  textures: number;
}
interface Props {
  getRegion: () => RegionState;
  onInteract: (id: string) => void;
  onDriveTarget: (p: { x: number; z: number }) => void;
  driveInput: DriveInput;
  getState: () => WildlifeState;
  paused: boolean;
  muted: boolean;
  volume: number;
  quality: Quality;
  sensitivity: number;
  reaction: { id: SpeciesId; until: number; kind: string } | null;
  onTick: (dt: number, base: Collider[], input: DriveInput) => void;
  onCommand: (cmd: WildlifeCommand, base: Collider[]) => void;
  onCreature: (id: SpeciesId) => void;
  onReady: (base: Collider[]) => void;
  onMetrics: (m: Metrics) => void;
}
export default function RegionScene(props: Props) {
  const host = useRef<HTMLDivElement>(null),
    current = useRef(props);
  current.current = props;
  useEffect(() => {
    const mount = host.current!;
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    mount.appendChild(renderer.domElement);
    renderer.domElement.tabIndex = 0;
    renderer.domElement.setAttribute(
      "aria-label",
      "Living coast. Click ground to walk; click a creature to approach. Click an attentive creature again to release resonance.",
    );
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#bad0ce");
    scene.fog = new THREE.FogExp2("#bad0ce", 0.008);
    const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 260);
    const sky = new THREE.HemisphereLight("#d6eee8", "#8a7861", 2.2);
    scene.add(sky);
    const sun = new THREE.DirectionalLight("#ffe0b3", 2.8);
    sun.position.set(-25, 45, 24);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, {
      left: -50,
      right: 50,
      top: 50,
      bottom: -50,
      near: 1,
      far: 120,
    });
    sun.shadow.normalBias = 0.04;
    scene.add(sun);
    scene.add(sun.target);
    const world = buildRegionWorld();
    scene.add(world.group);
    const car = buildVehicle();
    car.group.userData.regionTarget = "vehicle";
    scene.add(car.group);
    const people = new Map(
      current.current.getRegion().residents.map((r) => {
        const c = current.current
          .getRegion()
          .campaign.characters.find((c) => c.id === r.id);
        const a = buildAvatar(r.id, c?.color || "#879e99");
        a.group.userData.regionTarget = "resident-" + r.id;
        scene.add(a.group);
        return [r.id, a] as const;
      }),
    );
    const traffic = [buildVehicle(), buildVehicle()];
    traffic.forEach((t) => scene.add(t.group));
    const pasture = new Map(
      SPECIES.map((sp, i) => {
        const m = buildCreature(sp.id, i);
        m.group.scale.setScalar(0.72);
        m.group.position.set(-35.5 + (i % 3) * 1.5, 0, 13 + Math.floor(i / 3) * 2);
        scene.add(m.group);
        return [sp.id, m] as const;
      }),
    );
    const driveSound = new DriveSound();

    // Fade only foreground roofs and palm fronds; collision stays authoritative.
    const occluders: {
      mesh: THREE.Mesh;
      key: string;
      materials: THREE.Material[];
      original: THREE.Material | THREE.Material[];
      opacity: number[];
    }[] = [];
    world.group.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      let ancestor: THREE.Object3D | null = o,
        roof: THREE.Object3D | null = null;
      while (ancestor) {
        if (/removable roof|cutaway awning/i.test(ancestor.name)) {
          roof = ancestor;
          break;
        }
        ancestor = ancestor.parent;
      }
      const frond =
        o.geometry instanceof THREE.ShapeGeometry && o.position.y > 4;
      if (!roof && !frond) return;
      const original = o.material,
        source = Array.isArray(original) ? original : [original];
      const clones = source.map((m) => {
        const clone = m.clone();
        clone.transparent = true;
        return clone;
      });
      o.material = Array.isArray(original) ? clones : clones[0];
      occluders.push({
        mesh: o,
        key: roof
          ? roof.uuid
          : `palm-${o.position.x.toFixed(2)}-${o.position.z.toFixed(2)}`,
        materials: clones,
        original,
        opacity: source.map((m) => m.opacity),
      });
    });
    const canopy: THREE.InstancedMesh[] = [];
    world.group.traverse((o) => {
      if (o instanceof THREE.InstancedMesh && o.name === "region-canopy")
        canopy.push(o);
    });
    const hiddenCrowns = new Map<
      string,
      { mesh: THREE.InstancedMesh; index: number; matrix: THREE.Matrix4 }
    >();
    const zeroCrown = new THREE.Matrix4().makeScale(0, 0, 0);
    const occlusionRay = new THREE.Raycaster(),
      occluderMeshes = occluders.map((o) => o.mesh),
      occluderKeys = new Map(occluders.map((o) => [o.mesh.uuid, o.key]));
    const avatar = buildAvatar("player", "#cba974");
    scene.add(avatar.group);
    const models = new Map(
      SPECIES.map((s) => {
        const c = current.current
          .getState()
          .creatures.find((c) => c.id === s.id);
        const m = buildCreature(s.id, c?.variant ?? 0);
        m.group.userData.species = s.id;
        scene.add(m.group);
        return [s.id, m] as const;
      }),
    );
    const sound = new WildlifeSound();
    const unlock = () => {
      sound.unlock();
      driveSound.unlock();
    };
    document.addEventListener("pointerdown", unlock);
    const ray = new THREE.Raycaster(),
      pointer = new THREE.Vector2(),
      plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
      hit = new THREE.Vector3();
    let yaw = 0.1,
      distance = mount.clientWidth < 600 ? 19 : 13,
      dragging = false,
      startX = 0,
      startY = 0,
      lastX = 0,
      moved = 0,
      elapsed = 0,
      last = performance.now(),
      raf = 0,
      lastSample = 0;
    const frames: number[] = [];
    const keys = new Set<string>();
    const focus = new THREE.Vector3(
      current.current.getState().player.x,
      0.8,
      current.current.getState().player.z,
    );
    camera.position.set(focus.x + 1, 11, focus.z + 13);
    const facing = new Map<string, number>(),
      lastPositions = new Map<string, { x: number; z: number }>();
    const ringMat = new THREE.MeshBasicMaterial({
      color: "#b6e3da",
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
    });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 0.9, 64), ringMat);
    ring.rotation.x = -Math.PI / 2;
    scene.add(ring);
    const pulseMat = new THREE.MeshBasicMaterial({
      color: "#b8f3db",
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    const pulse = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 16, 10),
      pulseMat,
    );
    scene.add(pulse);
    const wave = new THREE.Mesh(
      new THREE.TorusGeometry(0.7, 0.02, 8, 64),
      pulseMat,
    );
    scene.add(wave);
    const hearts = new THREE.Group();
    scene.add(hearts);
    const petalGeo = new THREE.OctahedronGeometry(0.09);
    for (let i = 0; i < 12; i++) {
      const mesh = new THREE.Mesh(
        petalGeo,
        new THREE.MeshBasicMaterial({
          color: i % 2 ? "#f4da9b" : "#a6dfcd",
          transparent: true,
          opacity: 0.8,
        }),
      );
      hearts.add(mesh);
    }
    const resize = () => {
      renderer.setPixelRatio(
        current.current.quality === "low" ? 1 : Math.min(devicePixelRatio, 1.5),
      );
      renderer.setSize(mount.clientWidth, mount.clientHeight);
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    const visibilityRay = new THREE.Raycaster();
    const pickCreature = (
      clientX: number,
      clientY: number,
    ): SpeciesId | null => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1,
      );
      ray.setFromCamera(pointer, camera);
      const exact = ray.intersectObjects(
        [...models.values()].filter((m) => m.group.visible).map((m) => m.group),
        true,
      )[0];
      if (exact) {
        let node: THREE.Object3D | null = exact.object;
        while (node && !node.userData.species) node = node.parent;
        if (node?.userData.species) return node.userData.species as SpeciesId;
      }
      // A small screen-space catchment keeps moving wings and small silhouettes easy to touch.
      const state = current.current.getState(),
        radius = rect.width < 700 ? 50 : 45;
      let nearest: SpeciesId | null = null,
        best = radius;
      for (const creature of state.creatures) {
        const model = models.get(creature.id)!;
        if (!model.group.visible || !creature.available || creature.bonded)
          continue;
        const center = model.group.position.clone();
        center.y += 0.55;
        const projected = center.clone().project(camera);
        if (
          projected.z < -1 ||
          projected.z > 1 ||
          Math.abs(projected.x) > 1 ||
          Math.abs(projected.y) > 1
        )
          continue;
        const screenX = rect.left + ((projected.x + 1) * rect.width) / 2,
          screenY = rect.top + ((1 - projected.y) * rect.height) / 2;
        const separation = Math.hypot(clientX - screenX, clientY - screenY);
        if (separation >= best) continue;
        const direction = center.clone().sub(camera.position);
        visibilityRay.set(camera.position, direction.clone().normalize());
        visibilityRay.far = Math.max(0, direction.length() - 0.45);
        const obscured = visibilityRay
          .intersectObject(world.group, true)
          .some((hit) => {
            let ancestor: THREE.Object3D | null = hit.object;
            while (ancestor) {
              if (!ancestor.visible) return false;
              ancestor = ancestor.parent;
            }
            if (!(hit.object instanceof THREE.Mesh)) return false;
            const material = hit.object.material,
              materials = Array.isArray(material) ? material : [material];
            return materials.some(
              (m) => m.visible && (!m.transparent || m.opacity > 0.25),
            );
          });
        if (obscured) continue;
        nearest = creature.id;
        best = separation;
      }
      return nearest;
    };
    const down = (e: PointerEvent) => {
      unlock();
      mount.querySelector("canvas")?.focus();
      dragging = true;
      startX = lastX = e.clientX;
      startY = e.clientY;
      moved = 0;
      renderer.domElement.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (dragging) {
        moved = Math.max(
          moved,
          Math.hypot(e.clientX - startX, e.clientY - startY),
        );
        if (moved > 5)
          yaw -= (e.clientX - lastX) * 0.003 * current.current.sensitivity;
        lastX = e.clientX;
      } else {
        renderer.domElement.style.cursor = pickCreature(e.clientX, e.clientY)
          ? "pointer"
          : "crosshair";
      }
    };
    const up = (e: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      if (moved > 5 || current.current.paused) return;
      const picked = pickCreature(e.clientX, e.clientY);
      const target = ray.intersectObjects(
        [car.group, ...Array.from(people.values()).map((p) => p.group)],
        true,
      )[0];
      if (target && !current.current.getRegion().vehicle.occupied) {
        let o: THREE.Object3D | null = target.object;
        while (o && !o.userData.regionTarget) o = o.parent;
        if (o) {
          current.current.onInteract(o.userData.regionTarget);
          return;
        }
      }
      if (picked) {
        current.current.onCreature(picked);
        return;
      }
      if (!ray.ray.intersectPlane(plane, hit)) return;
      for (let i = 0; i < 4; i++)
        ray.ray.intersectPlane(
          new THREE.Plane(new THREE.Vector3(0, 1, 0), -surfaceHeight(hit)),
          hit,
        );
      if (current.current.getRegion().vehicle.occupied) {
        current.current.onDriveTarget({ x: hit.x, z: hit.z });
        return;
      }
      current.current.onCommand(
        { type: "move", point: { x: hit.x, z: hit.z }, quiet: true },
        world.colliders,
      );
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      distance = THREE.MathUtils.clamp(distance + e.deltaY * 0.01, 9, 23);
    };
    const keydown = (e: KeyboardEvent) => {
      if (
        [
          "KeyB",
          "KeyW",
          "KeyA",
          "KeyS",
          "KeyD",
          "ArrowUp",
          "ArrowDown",
          "ArrowLeft",
          "ArrowRight",
        ].includes(e.code)
      ) {
        e.preventDefault();
        keys.add(e.code);
      }
    };
    const keyup = (e: KeyboardEvent) => keys.delete(e.code);
    const blur = () => keys.clear();
    renderer.domElement.addEventListener("pointerdown", down);
    renderer.domElement.addEventListener("pointermove", move);
    renderer.domElement.addEventListener("pointerup", up);
    renderer.domElement.addEventListener("wheel", wheel, { passive: false });
    renderer.domElement.addEventListener("keydown", keydown);
    window.addEventListener("keyup", keyup);
    window.addEventListener("blur", blur);
    current.current.onReady(world.colliders);
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const now = performance.now(),
        raw = (now - last) / 1000,
        dt = Math.min(raw, 0.05);
      last = now;
      elapsed += dt;
      const p = current.current;
      let s = p.getState();
      if (!p.paused && !document.hidden) {
        if (keys.size && !p.getRegion().vehicle.occupied) {
          const x =
              Number(keys.has("KeyD") || keys.has("ArrowRight")) -
              Number(keys.has("KeyA") || keys.has("ArrowLeft")),
            z =
              Number(keys.has("KeyS") || keys.has("ArrowDown")) -
              Number(keys.has("KeyW") || keys.has("ArrowUp"));
          if (x || z) {
            const n = Math.hypot(x, z);
            p.onCommand(
              {
                type: "move",
                point: {
                  x:
                    s.player.x +
                    ((x * Math.cos(yaw) + z * Math.sin(yaw)) / n) * 0.6,
                  z:
                    s.player.z +
                    ((-x * Math.sin(yaw) + z * Math.cos(yaw)) / n) * 0.6,
                },
                quiet: true,
              },
              world.colliders,
            );
          }
        }
        const driving = p.getRegion().vehicle.occupied;
        const input: DriveInput = {
          throttle:
            p.driveInput.throttle +
            (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) -
            (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0),
          steer:
            p.driveInput.steer +
            (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0) -
            (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0),
          brake: p.driveInput.brake || keys.has("KeyB"),
        };
        p.onTick(
          dt,
          world.colliders,
          driving ? input : { throttle: 0, steer: 0, brake: false },
        );
        s = p.getState();
      }
      const region = p.getRegion();
      sun.position.set(s.player.x - 25, 45, s.player.z + 24);
      sun.target.position.set(s.player.x, 0, s.player.z);
      world.update(region, dt, elapsed, p.quality);
      car.update(region.vehicle, dt);
      avatar.group.visible = !region.vehicle.occupied;
      driveSound.set(p.muted, p.volume);
      driveSound.update(region.vehicle, dt);
      for (const person of region.residents) {
        const r =
          person.id === "jo"
            ? { ...person, position: region.assistance.position }
            : person;
        const a = people.get(r.id);
        if (!a) continue;
        const prev = lastPositions.get("resident-" + r.id) || r.position;
        const v =
          Math.hypot(r.position.x - prev.x, r.position.z - prev.z) /
          Math.max(0.001, dt);
        a.group.position.set(
          r.position.x,
          surfaceHeight(r.position),
          r.position.z,
        );
        if (v > 0.05)
          a.group.rotation.y = Math.atan2(
            r.position.x - prev.x,
            r.position.z - prev.z,
          );
        a.animate(elapsed, Math.min(3, v));
        lastPositions.set("resident-" + r.id, { ...r.position });
      }
      trafficPositions(region).forEach((t, i) => {
        if (!traffic[i]) return;
        traffic[i].update(
          {
            ...region.vehicle,
            position: t.position,
            yaw: t.yaw,
            speed: 3,
            occupied: false,
            cargo: 0,
          },
          dt,
        );
      });
      for (const [id, m] of pasture) {
        m.group.visible =
          s.creatures.some((c) => c.id === id && c.bonded) &&
          s.companion !== id &&
          Math.hypot(s.player.x + 22, s.player.z - 9) < 65;
        m.animate("idle", elapsed, 0, 0);
      }

      sound.set(p.muted, p.volume);
      sound.update(s, p.paused ? 0 : dt);
      const pal =
        s.weather === "fair"
          ? ["#b8d5d0", "#ffe0b0", 2.2, 2.8]
          : s.weather === "rain"
            ? ["#779d9e", "#c0d9d9", 1.8, 1.4]
            : s.weather === "dusk"
              ? ["#655c81", "#efb6a2", 1.1, 0.8]
              : ["#3a576a", "#bbc8e5", 1.25, 0.7];
      (scene.background as THREE.Color).lerp(
        new THREE.Color(pal[0] as string),
        dt * 0.8,
      );
      (scene.fog as THREE.FogExp2).color.copy(scene.background as THREE.Color);
      sun.color.set(pal[1] as string);
      sky.intensity = THREE.MathUtils.damp(
        sky.intensity,
        pal[2] as number,
        2,
        dt,
      );
      sun.intensity = THREE.MathUtils.damp(
        sun.intensity,
        pal[3] as number,
        2,
        dt,
      );
      const pp = lastPositions.get("player") || s.player,
        ps =
          Math.hypot(s.player.x - pp.x, s.player.z - pp.z) /
          Math.max(dt, 0.001);
      avatar.group.position.set(
        s.player.x,
        surfaceHeight(s.player),
        s.player.z,
      );
      if (ps > 0.1) {
        const goal = Math.atan2(s.player.x - pp.x, s.player.z - pp.z);
        avatar.group.rotation.y +=
          Math.atan2(
            Math.sin(goal - avatar.group.rotation.y),
            Math.cos(goal - avatar.group.rotation.y),
          ) *
          (1 - Math.exp(-dt * 12));
      }
      avatar.animate(elapsed, Math.min(ps, 3));
      lastPositions.set("player", { ...s.player });
      const recentAbility = s.events
        .slice()
        .reverse()
        .find((e) => e.kind === "ability" && s.elapsed - e.at < 2.4);
      for (const c of s.creatures) {
        const spec = SPECIES.find((x) => x.id === c.id)!,
          model = models.get(c.id)!;
        const companion = c.bonded && s.companion === c.id;
        model.group.visible =
          (c.available && !c.bonded) ||
          (companion && !region.vehicle.occupied) ||
          c.mood === "bonding";
        if (!model.group.visible) continue;
        const pos = companion ? s.companionPosition : c.position;
        const prev = lastPositions.get(c.id) || pos;
        const speed = Math.min(
          4,
          Math.hypot(pos.x - prev.x, pos.z - prev.z) / Math.max(dt, 0.001),
        );
        model.group.position.set(
          pos.x,
          surfaceHeight(pos) +
            spec.height +
            (spec.height > 0 ? Math.sin(elapsed * 1.6) * 0.12 : 0),
          pos.z,
        );
        let angle = facing.get(c.id) || 0;
        if (speed > 0.06) angle = Math.atan2(pos.x - prev.x, pos.z - prev.z);
        else if (c.attention || companion)
          angle = Math.atan2(s.player.x - pos.x, s.player.z - pos.z);
        const helping =
          companion && recentAbility?.species === c.id && spec.ability !== null;
        const helpAge = helping ? s.elapsed - recentAbility!.at : 0;
        if (helping && spec.ability) {
          const site = SITES[spec.ability];
          angle = Math.atan2(site.x - pos.x, site.z - pos.z);
        }
        facing.set(c.id, angle);
        model.group.rotation.y +=
          Math.atan2(
            Math.sin(angle - model.group.rotation.y),
            Math.cos(angle - model.group.rotation.y),
          ) *
          (1 - Math.exp(-dt * 6));
        let mood = c.mood;
        if (companion && c.mood !== "bonding") mood = "companion";
        if (p.reaction?.id === c.id && performance.now() < p.reaction.until)
          mood = p.reaction.kind === "play" ? "bonding" : "curious";
        if (helping) mood = spec.ability === "light" ? "receptive" : "curious";
        model.animate(mood, elapsed, speed, c.phase);
        // Helping poses never change engine-owned creature position.
        const effort = helping
          ? Math.sin(Math.min(1, helpAge / 2.4) * Math.PI)
          : 0;
        model.group.rotation.x =
          spec.ability === "tracks"
            ? effort * 0.28
            : spec.ability === "gate"
              ? effort * 0.18
              : 0;
        model.group.rotation.z =
          helping && spec.ability === "gate"
            ? Math.sin(helpAge * 17) * 0.035 * effort
            : 0;
        lastPositions.set(c.id, { ...pos });
      }
      const selected = s.creatures.find(
        (c) => c.id === s.selected && !c.bonded && c.available,
      );
      ring.visible = !!selected;
      if (selected) {
        ring.position.set(selected.position.x, 0.05, selected.position.z);
        ringMat.color.set(
          receptive(s, selected)
            ? "#ffe09b"
            : selected.alarm > 0
              ? "#da998d"
              : "#a9d9cf",
        );
        ring.scale.setScalar(
          selected.attention ? 1 + Math.sin(elapsed * 3) * 0.15 : 1,
        );
      }
      const pulseAge = s.pulse ? s.elapsed - s.pulse.at : 10;
      pulse.visible = !!s.pulse && pulseAge < 0.55;
      wave.visible = !!s.pulse && pulseAge < 1.4;
      if (s.pulse) {
        const t = Math.min(1, pulseAge / 0.55);
        pulse.position.set(
          THREE.MathUtils.lerp(s.pulse.from.x, s.pulse.to.x, t),
          0.8 + Math.sin(t * Math.PI) * 0.4,
          THREE.MathUtils.lerp(s.pulse.from.z, s.pulse.to.z, t),
        );
        wave.position.set(s.pulse.to.x, 0.8, s.pulse.to.z);
        wave.rotation.copy(camera.rotation);
        wave.scale.setScalar(0.4 + pulseAge * 1.5);
        pulseMat.color.set(s.pulse.success ? "#d1f4bd" : "#d8b3a3");
        pulseMat.opacity = Math.max(0, 1 - pulseAge / 1.4);
      }
      const bonding = s.creatures.find(
        (c) => c.bondAt !== undefined && s.elapsed - c.bondAt < 2.5,
      );
      hearts.visible = !!bonding;
      if (bonding) {
        const age = s.elapsed - bonding.bondAt!;
        hearts.position.set(bonding.position.x, 0, bonding.position.z);
        hearts.children.forEach((o, i) => {
          const a = (i / 12) * Math.PI * 2 + age;
          o.position.set(
            Math.cos(a) * (0.5 + age * 0.3),
            0.5 + age * 0.6 + Math.sin(i) * 0.2,
            Math.sin(a) * (0.5 + age * 0.3),
          );
          o.rotation.y = elapsed * 2;
        });
      }
      const desired = new THREE.Vector3(
        s.player.x,
        1 + surfaceHeight(s.player),
        s.player.z,
      );
      const framed =
        selected ||
        (mount.clientWidth < 600
          ? s.creatures.find(
              (c) =>
                c.available &&
                !c.bonded &&
                Math.hypot(
                  c.position.x - s.player.x,
                  c.position.z - s.player.z,
                ) < 6,
            )
          : undefined);
      if (
        framed &&
        Math.hypot(
          framed.position.x - s.player.x,
          framed.position.z - s.player.z,
        ) < 8
      ) {
        desired.x += (framed.position.x - s.player.x) * 0.4;
        desired.z += (framed.position.z - s.player.z) * 0.4;
      }
      focus.lerp(desired, 1 - Math.exp(-dt * 6));
      if (region.vehicle.occupied) {
        const goal =
          region.vehicle.yaw + (region.vehicle.speed < -0.3 ? 0 : Math.PI);
        yaw +=
          Math.atan2(Math.sin(goal - yaw), Math.cos(goal - yaw)) *
          (1 - Math.exp(-dt * 2));
      }
      const cameraDistance = region.vehicle.occupied
        ? Math.max(distance, 15)
        : distance;
      const cam = new THREE.Vector3(
        focus.x + Math.sin(yaw) * cameraDistance,
        focus.y + cameraDistance * (region.vehicle.occupied ? 0.48 : 0.75),
        focus.z + Math.cos(yaw) * cameraDistance,
      );
      camera.position.lerp(cam, 1 - Math.exp(-dt * 7));
      camera.lookAt(focus);
      renderer.shadowMap.enabled = p.quality === "high";
      if (
        renderer.getPixelRatio() !==
        (p.quality === "low" ? 1 : Math.min(devicePixelRatio, 1.5))
      )
        resize();
      for (const h of hiddenCrowns.values()) {
        h.mesh.setMatrixAt(h.index, h.matrix);
        h.mesh.instanceMatrix.needsUpdate = true;
      }
      hiddenCrowns.clear();
      scene.updateMatrixWorld(true);
      const faded = new Set<string>(),
        targets = [new THREE.Vector3(s.player.x, 0.9, s.player.z)];
      if (selected)
        targets.push(
          new THREE.Vector3(
            selected.position.x,
            SPECIES.find((c) => c.id === selected.id)!.height + 0.55,
            selected.position.z,
          ),
        );
      for (const target of targets)
        for (const offset of [-0.5, 0, 0.5]) {
          const point = target.clone();
          point.x += Math.cos(yaw) * offset;
          point.z -= Math.sin(yaw) * offset;
          const direction = point.sub(camera.position);
          occlusionRay.set(camera.position, direction.clone().normalize());
          occlusionRay.far = Math.max(0, direction.length() - 0.25);
          for (const hit of occlusionRay.intersectObjects(
            [...occluderMeshes, ...canopy],
            false,
          )) {
            if (!hit.object.visible) continue;
            if (
              hit.object instanceof THREE.InstancedMesh &&
              hit.instanceId !== undefined
            ) {
              const mesh = hit.object,
                index = hit.instanceId,
                key = mesh.uuid + index;
              if (!hiddenCrowns.has(key)) {
                const matrix = new THREE.Matrix4();
                mesh.getMatrixAt(index, matrix);
                hiddenCrowns.set(key, { mesh, index, matrix });
                mesh.setMatrixAt(index, zeroCrown);
                mesh.instanceMatrix.needsUpdate = true;
              }
              continue;
            }
            const key = occluderKeys.get(hit.object.uuid);
            if (key) faded.add(key);
          }
        }
      for (const o of occluders)
        o.materials.forEach((m, i) => {
          const goal = faded.has(o.key) ? 0.12 : o.opacity[i];
          m.opacity = THREE.MathUtils.damp(m.opacity, goal, 10, dt);
          m.depthWrite = m.opacity > 0.95;
        });
      renderer.render(scene, camera);
      frames.push(raw * 1000);
      if (now - lastSample > 2000) {
        const sorted = frames.slice().sort((a, b) => a - b);
        p.onMetrics({
          fps: Math.round(
            1000 / (frames.reduce((a, b) => a + b, 0) / frames.length),
          ),
          p95: Math.round(sorted[Math.floor(sorted.length * 0.95)] * 10) / 10,
          draws: renderer.info.render.calls,
          triangles: renderer.info.render.triangles,
          geometries: renderer.info.memory.geometries,
          textures: renderer.info.memory.textures,
        });
        frames.length = 0;
        lastSample = now;
      }
    };
    loop();
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      document.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keyup", keyup);
      window.removeEventListener("blur", blur);
      sound.dispose();
      driveSound.dispose();
      car.dispose();
      traffic.forEach((t) => t.dispose());
      people.forEach((a) =>
        a.group.traverse((o) => {
          if (o instanceof THREE.Mesh) {
            o.geometry.dispose();
            (Array.isArray(o.material) ? o.material : [o.material]).forEach(
              (m) => m.dispose(),
            );
          }
        }),
      );
      pasture.forEach((m) => m.dispose());
      occluders.forEach((o) => {
        o.mesh.material = o.original;
        o.materials.forEach((m) => m.dispose());
      });
      world.dispose();
      models.forEach((m) => m.dispose());
      avatar.group.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          const ms = Array.isArray(o.material) ? o.material : [o.material];
          ms.forEach((m) => m.dispose());
        }
      });
      ring.geometry.dispose();
      ringMat.dispose();
      pulse.geometry.dispose();
      wave.geometry.dispose();
      pulseMat.dispose();
      petalGeo.dispose();
      hearts.children.forEach((o) =>
        ((o as THREE.Mesh).material as THREE.Material).dispose(),
      );
      renderer.dispose();
      mount.replaceChildren();
    };
  }, []);
  return <div ref={host} className="wildlife-canvas" />;
}
