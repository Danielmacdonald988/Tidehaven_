import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import * as THREE from "three";
import { buildEnvironment } from "./Environment";
import { buildResidents, buildAvatar } from "./Residents";
import { CoastalAudio } from "./audio";
import { findPath, clearSegment, isWalkable } from "./navigation";
import {
  PLACES,
  pointAtLocation,
  type Point,
  type Quality,
  type Interaction,
} from "./shared";
import type { World, LocationId } from "../contracts";
export interface SceneControl {
  walkTo: (id: LocationId) => void;
  approach: (id: string) => void;
  rotate: (amount: number) => void;
  zoom: (amount: number) => void;
  stop: () => void;
}
export interface PerformanceSample {
  fps: number;
  p95: number;
  draws: number;
  triangles: number;
  renderer: string;
  width: number;
  height: number;
}
interface Props {
  world: World;
  readOnly?: boolean;
  quality: Quality;
  muted: boolean;
  volume: number;
  selected?: string;
  reset: number;
  onStep: (p: Point, seconds: number, moving: boolean) => boolean;
  onInteract: (i: Interaction) => void;
  onHint: (text: string) => void;
  onPerformance: (p: PerformanceSample) => void;
  onReady: () => void;
}
const Scene = forwardRef<SceneControl, Props>(function Scene(props, ref) {
  const mount = useRef<HTMLDivElement>(null),
    current = useRef(props);
  current.current = props;
  const controls = useRef<SceneControl>({
    walkTo: () => {},
    approach: () => {},
    rotate: () => {},
    zoom: () => {},
    stop: () => {},
  });
  const [error, setError] = useState("");
  useImperativeHandle(
    ref,
    () => ({
      walkTo: (id) => controls.current.walkTo(id),
      approach: (id) => controls.current.approach(id),
      rotate: (a) => controls.current.rotate(a),
      zoom: (a) => controls.current.zoom(a),
      stop: () => controls.current.stop(),
    }),
    [],
  );
  useEffect(() => {
    if (!mount.current) return;
    const host = mount.current;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: "high-performance",
      });
    } catch {
      setError(
        "WebGL could not start. Enable hardware acceleration or use the preserved field-desk edition.",
      );
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    host.appendChild(renderer.domElement);
    renderer.domElement.setAttribute(
      "aria-label",
      "Walkable 3D neighborhood. Click ground to walk; click residents to approach.",
    );
    renderer.domElement.tabIndex = 0;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#b8d1d0");
    scene.fog = new THREE.FogExp2("#b8d1d0", 0.007);
    const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 230);
    const hemi = new THREE.HemisphereLight("#dae9ec", "#857358", 2.1);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight("#ffddac", 3.2);
    sun.position.set(-28, 44, 25);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, {
      left: -55,
      right: 55,
      top: 55,
      bottom: -55,
      near: 1,
      far: 130,
    });
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.035;
    scene.add(sun);
    const fill = new THREE.DirectionalLight("#b2d9e8", 0.6);
    fill.position.set(15, 16, -30);
    scene.add(fill);
    const environment = buildEnvironment();
    scene.add(environment.group);
    const residents = buildResidents(current.current.world);
    scene.add(residents.group);
    const avatar = buildAvatar("player", "#d5b87a");
    scene.add(avatar.group);
    let position = { ...current.current.world.spatial!.player };
    if (
      !isWalkable(
        position,
        environment.colliders.filter(
          (c) =>
            !c.exposed ||
            (current.current.world.hour >= 54 && position.z <= 22.6),
        ),
      )
    ) {
      const saved = { ...position };
      for (let radius = 0.1; radius <= 2; radius += 0.1) {
        let found = false;
        for (let j = 0; j < 24; j++) {
          const candidate = {
            x: saved.x + Math.sin((j * Math.PI) / 12) * radius,
            z: saved.z + Math.cos((j * Math.PI) / 12) * radius,
          };
          if (
            isWalkable(
              candidate,
              environment.colliders.filter(
                (c) =>
                  !c.exposed ||
                  (current.current.world.hour >= 54 && position.z <= 22.6),
              ),
            )
          ) {
            position = candidate;
            found = true;
            break;
          }
        }
        if (found) break;
      }
    }
    avatar.group.position.set(position.x, 0, position.z);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.38, 0.48, 40),
      new THREE.MeshBasicMaterial({
        color: "#f3d486",
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.06;
    ring.visible = false;
    scene.add(ring);
    const destination = new THREE.Mesh(
      new THREE.RingGeometry(0.22, 0.36, 32),
      new THREE.MeshBasicMaterial({
        color: "#faf0c4",
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.75,
      }),
    );
    destination.rotation.x = -Math.PI / 2;
    destination.position.y = 0.05;
    destination.visible = false;
    scene.add(destination);
    const audio = new CoastalAudio();
    let path: Point[] = [],
      pending: Interaction | undefined,
      yaw = 0.15,
      distance = 11,
      elapsed = 0,
      stepSeconds = 0,
      frame = 0,
      last = performance.now(),
      lastSample = last,
      samples: number[] = [],
      lastReset = current.current.reset,
      lastQuality = "",
      lastMuted = true,
      lastVolume = -1,
      moving = false;
    let lastStep = { ...current.current.world.spatial!.player };
    let drag:
      | {
          x: number;
          y: number;
          lastX: number;
          lastY: number;
          moved: boolean;
          button: number;
        }
      | undefined;
    const keys = new Set<string>(),
      ray = new THREE.Raycaster(),
      pointer = new THREE.Vector2(),
      ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
      hit = new THREE.Vector3();
    const activeColliders = () =>
      environment.colliders.filter(
        (c) =>
          !c.exposed ||
          (current.current.world.hour >= 54 && position.z <= 22.6),
      );
    const allInteractions = () => [
      ...environment.interactions,
      ...residents.interactions,
    ];
    function flush() {
      if (current.current.readOnly) {
        stepSeconds = 0;
        return;
      }
      if (stepSeconds <= 0.001) return;
      const moved =
        Math.hypot(position.x - lastStep.x, position.z - lastStep.z) > 0.001;
      const active = current.current.world.spatial!.shipments.some(
        (s) => s.status !== "arrived",
      );
      if (moved || active) {
        const accepted = current.current.onStep(
          { ...position },
          Math.min(5, stepSeconds),
          moved,
        );
        if (!accepted) {
          position = { ...current.current.world.spatial!.player };
          path = [];
          pending = undefined;
          destination.visible = false;
        }
      }
      stepSeconds = 0;
      lastStep = { ...position };
    }
    function navigate(target: Point, interaction?: Interaction) {
      if (current.current.readOnly) {
        current.current.onHint("Recorded moment · read only");
        return;
      }
      if (current.current.world.ended) {
        current.current.onHint(
          "The storm has arrived. Rewind a checkpoint at the field desk.",
        );
        return;
      }
      const route = findPath(position, target, activeColliders());
      if (!route.length) {
        current.current.onHint(
          current.current.world.hour >= 54 && target.z > 23
            ? "Floodwater has closed the exposed harbor."
            : "That route is blocked. Try the street or an open doorway.",
        );
        return;
      }
      path = route;
      pending = interaction;
      destination.position.set(route.at(-1)!.x, 0.06, route.at(-1)!.z);
      destination.visible = true;
      current.current.onHint(
        interaction
          ? `Walking to ${interaction.label}`
          : "Walking · click another point to change course",
      );
    }
    controls.current = {
      walkTo(id) {
        const place = PLACES.find((p) => p.id === id)!;
        navigate(pointAtLocation(id), {
          id: `location-${id}`,
          kind: "location",
          label: place.name,
          location: id,
          position: pointAtLocation(id),
        });
      },
      approach(id) {
        const i = residents.interactions.find(
          (i) =>
            i.id === `person:${id}` || i.id === `person-${id}` || i.id === id,
        );
        if (i) {
          const pos = residents.position(id) || i.position;
          navigate({ x: pos.x, z: pos.z + 1.3 }, i);
        }
      },
      rotate(a) {
        yaw += a;
      },
      zoom(a) {
        distance = THREE.MathUtils.clamp(distance + a, 6, 18);
      },
      stop() {
        path = [];
        pending = undefined;
        destination.visible = false;
        flush();
      },
    };
    function interactionAt(e: PointerEvent): Interaction | undefined {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        (-(e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      ray.setFromCamera(pointer, camera);
      const ints = allInteractions();
      const hits = ray.intersectObjects(
        [...residents.group.children, ...environment.group.children],
        true,
      );
      for (const h of hits) {
        let o: THREE.Object3D | null = h.object;
        while (o) {
          const id = o.userData.interactionId;
          if (id) {
            const found = ints.find(
              (i) =>
                i.id === id ||
                i.id === String(id).replace("person:", "person-"),
            );
            if (found) return found;
          }
          o = o.parent;
        }
        if (h.distance > 80) break;
      }
      // Door and supply markers have physical positions even when environment meshes are batched.
      let best: Interaction | undefined,
        bestPx = 23;
      for (const i of ints) {
        const p = new THREE.Vector3(
          i.position.x,
          i.kind === "person" ? 1.1 : 0.9,
          i.position.z,
        ).project(camera);
        if (p.z > 1) continue;
        const d = Math.hypot(
          ((p.x - pointer.x) * rect.width) / 2,
          ((p.y - pointer.y) * rect.height) / 2,
        );
        if (d < bestPx) {
          best = i;
          bestPx = d;
        }
      }
      return best;
    }
    function down(e: PointerEvent) {
      if ((e.target as HTMLElement) !== renderer.domElement) return;
      drag = {
        x: e.clientX,
        y: e.clientY,
        lastX: e.clientX,
        lastY: e.clientY,
        moved: false,
        button: e.button,
      };
      renderer.domElement.setPointerCapture(e.pointerId);
    }
    function move(e: PointerEvent) {
      if (drag) {
        const dx = e.clientX - drag.lastX;
        drag.moved ||= Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 6;
        if (drag.moved) yaw -= dx * 0.006;
        drag.lastX = e.clientX;
        drag.lastY = e.clientY;
        return;
      }
      const i = interactionAt(e);
      renderer.domElement.style.cursor = i ? "pointer" : "crosshair";
      if (i) {
        ring.visible = true;
        ring.position.set(i.position.x, 0.055, i.position.z);
        current.current.onHint(`${i.label} · click to approach`);
      } else ring.visible = false;
    }
    function up(e: PointerEvent) {
      if (!drag) return;
      if (current.current.readOnly) {
        drag = undefined;
        return;
      }
      const wasDrag = drag.moved,
        button = drag.button;
      drag = undefined;
      if (wasDrag || button === 2) return;
      const i = interactionAt(e);
      if (i) {
        const p =
          i.kind === "person"
            ? residents.position(i.id.replace(/^person[:-]/, "")) || i.position
            : i.position;
        const d = Math.hypot(p.x - position.x, p.z - position.z);
        if (d < 2.8) {
          path = [];
          flush();
          current.current.onInteract(i);
          return;
        }
        const dx = position.x - p.x,
          dz = position.z - p.z,
          mag = Math.hypot(dx, dz) || 1;
        navigate({ x: p.x + (dx / mag) * 1.25, z: p.z + (dz / mag) * 1.25 }, i);
      } else if (ray.ray.intersectPlane(ground, hit))
        navigate({ x: hit.x, z: hit.z });
    }
    const context = (e: Event) => e.preventDefault();
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      distance = THREE.MathUtils.clamp(distance + e.deltaY * 0.009, 6, 18);
    };
    const keydown = (e: KeyboardEvent) => {
      if (current.current.readOnly) return;
      if ((e.target as HTMLElement)?.matches("input,textarea,select")) return;
      if (
        [
          "w",
          "a",
          "s",
          "d",
          "ArrowUp",
          "ArrowDown",
          "ArrowLeft",
          "ArrowRight",
        ].includes(e.key)
      ) {
        e.preventDefault();
        keys.add(e.key.toLowerCase());
        path = [];
        pending = undefined;
      }
      if (e.key === "Escape") {
        path = [];
        pending = undefined;
      }
    };
    const keyup = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
    const blur = () => {
      keys.clear();
      drag = undefined;
    };
    renderer.domElement.addEventListener("pointerdown", down);
    renderer.domElement.addEventListener("pointermove", move);
    renderer.domElement.addEventListener("pointerup", up);
    renderer.domElement.addEventListener("contextmenu", context);
    renderer.domElement.addEventListener("wheel", wheel, { passive: false });
    window.addEventListener("keydown", keydown);
    window.addEventListener("keyup", keyup);
    window.addEventListener("blur", blur);
    const resize = () => {
      const width = host.clientWidth,
        height = host.clientHeight;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const resizeObs = new ResizeObserver(resize);
    resizeObs.observe(host);
    resize();
    const gl = renderer.getContext();
    const debug = gl.getExtension("WEBGL_debug_renderer_info");
    const gpu = debug
      ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL))
      : String(gl.getParameter(gl.RENDERER));
    function animate(now: number) {
      frame = requestAnimationFrame(animate);
      const raw = (now - last) / 1000,
        dt = Math.min(0.05, raw);
      last = now;
      if (document.hidden) return;
      elapsed += dt;
      stepSeconds += dt;
      const p = current.current;
      if (lastReset !== p.reset) {
        position = { ...p.world.spatial!.player };
        path = [];
        pending = undefined;
        lastStep = { ...position };
        stepSeconds = 0;
        lastReset = p.reset;
        destination.visible = false;
      }
      if (lastQuality !== p.quality) {
        lastQuality = p.quality;
        renderer.setPixelRatio(
          p.quality === "low" ? 1 : Math.min(devicePixelRatio, 1.5),
        );
        renderer.shadowMap.enabled = p.quality === "high";
        resize();
      }
      if (lastMuted !== p.muted) {
        lastMuted = p.muted;
        audio.setMuted(p.muted);
      }
      if (lastVolume !== p.volume) {
        lastVolume = p.volume;
        audio.setVolume(p.volume);
      }
      if (p.readOnly) {
        keys.clear();
        path = [];
        pending = undefined;
        destination.visible = false;
        position = { ...p.world.spatial!.player };
        lastStep = { ...position };
        stepSeconds = 0;
      }
      const colliders = activeColliders();
      moving = false;
      const old = { ...position };
      let vx = 0,
        vz = 0;
      const forward =
          (keys.has("w") || keys.has("arrowup") ? 1 : 0) -
          (keys.has("s") || keys.has("arrowdown") ? 1 : 0),
        side =
          (keys.has("d") || keys.has("arrowright") ? 1 : 0) -
          (keys.has("a") || keys.has("arrowleft") ? 1 : 0);
      if (!p.readOnly && !p.world.ended && (forward || side)) {
        vx = -Math.sin(yaw) * forward + Math.cos(yaw) * side;
        vz = -Math.cos(yaw) * forward - Math.sin(yaw) * side;
        const len = Math.hypot(vx, vz);
        vx = (vx / len) * 3.2 * dt;
        vz = (vz / len) * 3.2 * dt;
        const next = { x: position.x + vx, z: position.z + vz };
        if (clearSegment(position, next, colliders)) position = next;
        else {
          const x = { x: position.x + vx, z: position.z };
          if (isWalkable(x, colliders)) position = x;
          const z = { x: position.x, z: position.z + vz };
          if (isWalkable(z, colliders)) position = z;
        }
      } else if (!p.readOnly && !p.world.ended && path.length) {
        let movement = dt * 3.2;
        while (movement > 0 && path.length) {
          const dest = path[0],
            d = Math.hypot(dest.x - position.x, dest.z - position.z);
          if (d < 1e-8) {
            position = { ...dest };
            path.shift();
            flush();
            continue;
          }
          const n = Math.min(movement, d),
            next =
              n === d
                ? { ...dest }
                : {
                    x: position.x + ((dest.x - position.x) * n) / d,
                    z: position.z + ((dest.z - position.z) * n) / d,
                  };
          if (!clearSegment(position, next, colliders)) {
            path = [];
            pending = undefined;
            current.current.onHint(
              "The route is blocked. Choose another point.",
            );
            break;
          }
          position = next;
          movement -= n;
          if (n === d) {
            path.shift();
            flush();
          }
        }
      }
      moving = Math.hypot(position.x - old.x, position.z - old.z) > 0.001;
      if (moving) {
        const angle = Math.atan2(position.x - old.x, position.z - old.z);
        avatar.group.rotation.y +=
          Math.atan2(
            Math.sin(angle - avatar.group.rotation.y),
            Math.cos(angle - avatar.group.rotation.y),
          ) * Math.min(1, dt * 14);
      }
      avatar.group.position.set(position.x, 0, position.z);
      avatar.animate(
        elapsed,
        moving ? 3.2 : 0,
        Object.values(p.world.spatial?.carried || {}).some((n) => n > 0),
        !!p.selected,
      );
      if (stepSeconds >= 1) flush();
      if (!path.length) {
        destination.visible = false;
        if (pending) {
          const i = pending;
          pending = undefined;
          flush();
          const personPos =
            i.kind === "person"
              ? residents.position(i.id.replace(/^person[:-]/, ""))
              : i.position;
          if (
            personPos &&
            Math.hypot(personPos.x - position.x, personPos.z - position.z) < 3.6
          )
            p.onInteract(i);
          else p.onHint("They moved on. Approach them again to speak.");
        }
      }
      environment.update(p.world, dt, elapsed, position, p.quality);
      residents.update(p.world, dt, elapsed, position, p.selected);
      audio.update(dt, moving, p.world.hour / 72);
      const storm = Math.min(1, p.world.hour / 72);
      const sky = new THREE.Color("#bad4d5").lerp(
        new THREE.Color("#596f7c"),
        storm * 0.83,
      );
      scene.background = sky;
      (scene.fog as THREE.FogExp2).color.copy(sky);
      (scene.fog as THREE.FogExp2).density = 0.006 + storm * 0.007;
      sun.intensity = 3.2 - storm * 2;
      hemi.intensity = 2.1 - storm * 0.45;
      const inside = PLACES.some(
        (b) =>
          b.id !== "harbor" &&
          Math.abs(position.x - b.center.x) < b.width / 2 &&
          Math.abs(position.z - b.center.z) < b.depth / 2,
      );
      const target = new THREE.Vector3(position.x, 1.1, position.z);
      const desired = new THREE.Vector3(
        position.x + Math.sin(yaw) * distance,
        inside ? 10 : distance * 0.59 + 1.1,
        position.z + Math.cos(yaw) * distance,
      );
      camera.position.lerp(desired, 1 - Math.exp(-dt * 7));
      camera.lookAt(target);
      renderer.render(scene, camera);
      if (raw < 0.2) samples.push(raw * 1000);
      if (now - lastSample >= 2000 && samples.length) {
        const sorted = samples.slice().sort((a, b) => a - b);
        p.onPerformance({
          fps: Math.round(
            1000 / (samples.reduce((a, b) => a + b, 0) / samples.length),
          ),
          p95: Math.round(sorted[Math.floor(sorted.length * 0.95)] * 10) / 10,
          draws: renderer.info.render.calls,
          triangles: renderer.info.render.triangles,
          renderer: gpu,
          width: renderer.domElement.width,
          height: renderer.domElement.height,
        });
        samples = [];
        lastSample = now;
      }
    }
    camera.position.set(
      position.x + Math.sin(yaw) * distance,
      8,
      position.z + Math.cos(yaw) * distance,
    );
    camera.lookAt(position.x, 1, position.z);
    frame = requestAnimationFrame(animate);
    current.current.onReady();
    return () => {
      cancelAnimationFrame(frame);
      resizeObs.disconnect();
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("keyup", keyup);
      window.removeEventListener("blur", blur);
      audio.dispose();
      environment.dispose();
      residents.dispose();
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry?.dispose();
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((m) => m.dispose());
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);
  return (
    <div className="scene-host" ref={mount}>
      {error && (
        <div className="webgl-error">
          {error}
          <a href="?classic">Open field-desk edition</a>
        </div>
      )}
    </div>
  );
});
export default Scene;
