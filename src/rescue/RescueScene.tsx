import { useEffect, useRef } from "react";
import * as THREE from "three";
import { buildRescueWorld } from "./World";
import { buildRescueActors } from "./Actors";
import { RescueSound } from "./Sound";
import { rescueTargets, type RescueState, type RescueCommand } from "./engine";
import type { Collider, Quality } from "../three/shared";

export interface RescueMetrics {
  fps: number;
  p95: number;
  draws: number;
  triangles: number;
  renderer: string;
}
interface Props {
  state: RescueState;
  getState: () => RescueState;
  paused: boolean;
  muted: boolean;
  volume: number;
  quality: Quality;
  shake: boolean;
  sensitivity: number;
  onTick: (dt: number, colliders: Collider[]) => void;
  onCommand: (cmd: RescueCommand, colliders: Collider[]) => void;
  onReady: (colliders: Collider[]) => void;
  onMetrics: (metrics: RescueMetrics) => void;
  onTarget: (id: string) => void;
}
export default function RescueScene(props: Props) {
  const host = useRef<HTMLDivElement>(null),
    latest = useRef(props);
  latest.current = props;
  useEffect(() => {
    const mount = host.current!;
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);
    renderer.domElement.tabIndex = 0;
    renderer.domElement.setAttribute(
      "aria-label",
      "Storm rescue. Click the ground to walk or an illuminated action to approach. WASD also moves.",
    );
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#314b56");
    scene.fog = new THREE.FogExp2("#314b56", 0.012);
    const camera = new THREE.PerspectiveCamera(46, 1, 0.15, 180);
    const sky = new THREE.HemisphereLight("#91b8ca", "#263130", 1.4);
    scene.add(sky);
    const sun = new THREE.DirectionalLight("#b4d4e1", 2);
    sun.position.set(-24, 45, -10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, {
      left: -50,
      right: 50,
      top: 45,
      bottom: -45,
      near: 1,
      far: 120,
    });
    sun.shadow.normalBias = 0.04;
    scene.add(sun);
    const warm = new THREE.DirectionalLight("#e9b477", 0.45);
    warm.position.set(-30, 10, 22);
    scene.add(warm);
    const world = buildRescueWorld();
    scene.add(world.group);
    const actors = buildRescueActors();
    scene.add(actors.group);
    const sound = new RescueSound();
    const unlock = () => sound.unlock();
    document.addEventListener("pointerdown", unlock);
    const ray = new THREE.Raycaster(),
      pointer = new THREE.Vector2(),
      plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
      hit = new THREE.Vector3();
    const focus = new THREE.Vector3(
      latest.current.state.player.x,
      1,
      latest.current.state.player.z,
    );
    let yaw = 0.12,
      distance = 15,
      dragging = false,
      startX = 0,
      startY = 0,
      lastX = 0,
      moved = 0,
      last = performance.now(),
      elapsed = 0,
      frame = 0,
      lastSample = 0;
    const frames: number[] = [];
    let stopped = false;
    const keys = new Set<string>();
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.42, 0.52, 48),
      new THREE.MeshBasicMaterial({
        color: "#edd9a0",
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.04;
    ring.visible = false;
    scene.add(ring);
    const lights = new Map<string, THREE.Mesh>();
    const resize = () => {
      renderer.setPixelRatio(
        latest.current.quality === "low" ? 1 : Math.min(devicePixelRatio, 1.5),
      );
      renderer.setSize(mount.clientWidth, mount.clientHeight);
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    const down = (event: PointerEvent) => {
      sound.unlock();
      renderer.domElement.focus();
      dragging = true;
      startX = lastX = event.clientX;
      startY = event.clientY;
      moved = 0;
      renderer.domElement.setPointerCapture(event.pointerId);
    };
    const move = (event: PointerEvent) => {
      if (!dragging) return;
      moved = Math.max(
        moved,
        Math.hypot(event.clientX - startX, event.clientY - startY),
      );
      if (moved > 5)
        yaw -= (event.clientX - lastX) * 0.003 * latest.current.sensitivity;
      lastX = event.clientX;
    };
    const up = (event: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      if (
        moved > 5 ||
        latest.current.paused ||
        latest.current.state.phase === "opening"
      )
        return;
      const bounds = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        (-(event.clientY - bounds.top) / bounds.height) * 2 + 1,
      );
      ray.setFromCamera(pointer, camera);
      const targets = rescueTargets(latest.current.state);
      let targetId = "";
      let closest = 42;
      for (const target of targets) {
        const p = new THREE.Vector3(
          target.position.x,
          1,
          target.position.z,
        ).project(camera);
        const d = Math.hypot(
          ((p.x - pointer.x) * bounds.width) / 2,
          ((p.y - pointer.y) * bounds.height) / 2,
        );
        if (p.z < 1 && d < closest) {
          closest = d;
          targetId = target.id;
        }
      }
      if (targetId) {
        latest.current.onTarget(targetId);
        return;
      }
      if (ray.ray.intersectPlane(plane, hit)) {
        ring.position.set(hit.x, 0.05, hit.z);
        ring.visible = true;
        latest.current.onCommand(
          { type: "move", point: { x: hit.x, z: hit.z } },
          world.colliders,
        );
      }
    };
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      distance = THREE.MathUtils.clamp(distance + event.deltaY * 0.012, 13, 26);
    };
    const keydown = (e: KeyboardEvent) => {
      if (
        [
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
    latest.current.onReady(world.colliders);
    const render = () => {
      if (stopped) return;
      frame = requestAnimationFrame(render);
      const now = performance.now(),
        raw = (now - last) / 1000,
        dt = Math.min(raw, 0.05);
      last = now;
      elapsed += dt;
      const p = latest.current;
      if (!p.paused && !document.hidden) {
        if (keys.size) {
          const x =
              Number(keys.has("KeyD") || keys.has("ArrowRight")) -
              Number(keys.has("KeyA") || keys.has("ArrowLeft")),
            z =
              Number(keys.has("KeyS") || keys.has("ArrowDown")) -
              Number(keys.has("KeyW") || keys.has("ArrowUp"));
          if (x || z) {
            const size = Math.hypot(x, z),
              dx = (x * Math.cos(yaw) + z * Math.sin(yaw)) / size,
              dz = (-x * Math.sin(yaw) + z * Math.cos(yaw)) / size;
            p.onCommand(
              {
                type: "move",
                point: {
                  x: p.getState().player.x + dx * 0.5,
                  z: p.getState().player.z + dz * 0.5,
                },
              },
              world.colliders,
            );
          }
        }
        p.onTick(dt, world.colliders);
      }
      const state = latest.current.getState();
      world.update(state, dt, elapsed, p.quality);
      actors.update(state, dt, elapsed);
      sound.set(p.muted, p.volume);
      sound.update(state, p.paused ? 0 : dt);
      renderer.shadowMap.enabled = p.quality === "high";
      if (
        renderer.getPixelRatio() !==
        (p.quality === "low" ? 1 : Math.min(devicePixelRatio, 1.5))
      )
        resize();
      const opening = state.phase === "opening" || state.phase === "blackout";
      const desired = new THREE.Vector3(state.player.x, 1.2, state.player.z);
      if (opening) desired.set(6, 1, 13);
      focus.lerp(desired, 1 - Math.exp(-dt * 5));
      const d = opening ? 37 : distance;
      const targetCam = new THREE.Vector3(
        focus.x + Math.sin(yaw) * d,
        focus.y + d * 0.72,
        focus.z + Math.cos(yaw) * d,
      );
      // Fixed elevated follow; a steep sightline and local roofs cut away keep the player readable.
      camera.position.lerp(targetCam, 1 - Math.exp(-dt * 5));
      camera.lookAt(focus);
      const recent = state.events.at(-1);
      if (
        p.shake &&
        recent &&
        (recent.kind.includes("collapse") ||
          recent.kind.includes("blackout")) &&
        state.elapsed - recent.at < 0.8
      ) {
        const amount = 0.08 * (1 - (state.elapsed - recent.at) / 0.8);
        camera.position.x += Math.sin(elapsed * 90) * amount;
        camera.position.y += Math.sin(elapsed * 113) * amount;
      }
      const after = state.phase === "aftermath";
      const color = new THREE.Color(after ? "#8bacae" : "#314b56");
      (scene.background as THREE.Color).lerp(color, dt * 0.7);
      (scene.fog as THREE.FogExp2).color.copy(scene.background as THREE.Color);
      sky.intensity = after ? 2 : 1.25;
      sun.intensity = after ? 2.2 : 0.85;
      const targets = rescueTargets(state);
      for (const [id, mesh] of lights)
        mesh.visible = targets.some((t) => t.id === id);
      for (const t of targets) {
        let marker = lights.get(t.id);
        if (!marker) {
          marker = new THREE.Mesh(
            new THREE.RingGeometry(0.35, 0.43, 40),
            new THREE.MeshBasicMaterial({
              color: "#ffd58a",
              transparent: true,
              opacity: 0.65,
              depthWrite: false,
            }),
          );
          marker.rotation.x = -Math.PI / 2;
          scene.add(marker);
          lights.set(t.id, marker);
        }
        marker.position.set(t.position.x, 0.06, t.position.z);
        marker.scale.setScalar(1 + Math.sin(elapsed * 2) * 0.08);
      }
      if (
        ring.visible &&
        Math.hypot(
          state.player.x - ring.position.x,
          state.player.z - ring.position.z,
        ) < 0.7
      )
        ring.visible = false;
      renderer.render(scene, camera);
      frames.push(raw * 1000);
      if (now - lastSample > 2000) {
        const sorted = frames.slice().sort((a, b) => a - b);
        p.onMetrics({
          fps: Math.round(
            1000 / (frames.reduce((a, b) => a + b, 0) / frames.length),
          ),
          p95:
            Math.round((sorted[Math.floor(sorted.length * 0.95)] || 0) * 10) /
            10,
          draws: renderer.info.render.calls,
          triangles: renderer.info.render.triangles,
          renderer: renderer
            .getContext()
            .getParameter(renderer.getContext().RENDERER),
        });
        frames.length = 0;
        lastSample = now;
      }
    };
    camera.position.set(8, 30, 48);
    render();
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      renderer.domElement.removeEventListener("pointerdown", down);
      renderer.domElement.removeEventListener("pointermove", move);
      renderer.domElement.removeEventListener("pointerup", up);
      renderer.domElement.removeEventListener("wheel", wheel);
      renderer.domElement.removeEventListener("keydown", keydown);
      window.removeEventListener("keyup", keyup);
      window.removeEventListener("blur", blur);
      document.removeEventListener("pointerdown", unlock);
      sound.dispose();
      world.dispose();
      actors.dispose();
      ring.geometry.dispose();
      (ring.material as THREE.Material).dispose();
      lights.forEach((m) => {
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
      });
      renderer.dispose();
      mount.replaceChildren();
    };
  }, []);
  return <div className="rescue-canvas" ref={host} />;
}
