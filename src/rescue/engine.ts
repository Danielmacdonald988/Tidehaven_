import { BOUNDS, type Point, type Collider } from "../three/shared";
import { findPath, clearSegment, isWalkable } from "../three/navigation";

export type RescueCommand =
  | { type: "move"; point: Point }
  | { type: "start" }
  | { type: "assist"; mode?: "live" | "demo" | "fallback" }
  | { type: "interact"; target: string }
  | { type: "recover" };
export interface RescueState {
  player: Point;
  companion: Point;
  victim: Point;
  playerSpeed?: number;
  elapsed: number;
  phase:
    | "opening"
    | "blackout"
    | "approach"
    | "helping"
    | "escort"
    | "collapse"
    | "aftermath";
  power: boolean;
  passage: "blocked" | "cleared";
  rescued: boolean;
  supplies: "inside" | "carried" | "shelter";
  events: { id: number; kind: string; at: number; detail: string }[];
  path: Point[];
  companionPath: Point[];
  victimPath: Point[];
  helping: number;
  collapse: number;
  route: "none" | "clear" | "inside";
  checkpoint?: RescueState;
  started: boolean;
  assistMode?: "live" | "demo" | "fallback";
  escortElapsed: number;
  escortStage: number;
  followTimer: number;
}
const BEAM = { x: 24, z: 17.5 },
  SIDE = { x: 30, z: 10 },
  SHELTER = { x: -22, z: 9 };
const BLOCK: Collider = {
  minX: 21,
  maxX: 27,
  minZ: 15,
  maxZ: 17,
  id: "rescue-beam",
};
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);
function event(s: RescueState, kind: string, detail: string) {
  s.events = [
    ...s.events,
    { id: (s.events.at(-1)?.id ?? 0) + 1, kind, at: s.elapsed, detail },
  ];
}
function snapshot(s: RescueState): RescueState {
  return structuredClone({ ...s, checkpoint: undefined });
}
export function createRescue(): RescueState {
  const s: RescueState = {
    player: { x: -12, z: 19 },
    companion: { x: -10, z: 18 },
    victim: { x: 24, z: 10 },
    playerSpeed: 0,
    elapsed: 0,
    phase: "opening",
    power: true,
    passage: "blocked",
    rescued: false,
    supplies: "inside",
    events: [],
    path: [],
    companionPath: [],
    victimPath: [],
    helping: 0,
    collapse: 0,
    route: "none",
    started: false,
    escortElapsed: 0,
    escortStage: 0,
    followTimer: 0,
  };
  s.checkpoint = snapshot(s);
  return s;
}
export function rescueColliders(s: RescueState): Collider[] {
  return s.passage === "blocked" || s.collapse > 0
    ? [{ ...BLOCK, id: s.collapse > 0 ? "rescue-collapse" : BLOCK.id }]
    : [];
}
export function rescueTargets(
  s: RescueState,
): { id: string; label: string; position: Point }[] {
  if (s.rescued)
    return s.supplies === "carried"
      ? [
          {
            id: "shelter",
            label: "Set down the emergency supplies",
            position: SHELTER,
          },
        ]
      : [];
  return [
    ...(s.passage === "blocked" && s.collapse === 0 && s.phase !== "helping"
      ? [
          {
            id: "beam",
            label: "Lift the fallen beam with Inez",
            position: BEAM,
          },
        ]
      : []),
    ...(s.escortStage === 0
      ? [
          {
            id: "side-door",
            label: "Use the east service entrance",
            position: SIDE,
          },
          { id: "victim", label: "Help Jo reach shelter", position: s.victim },
        ]
      : []),
    ...(s.supplies === "inside"
      ? [
          {
            id: "supplies",
            label: "Carry the emergency case",
            position: { x: 25.8, z: 10 },
          },
        ]
      : []),
    ...(s.escortStage > 0
      ? [
          {
            id: "shelter",
            label: "Bring Jo into the relief warehouse",
            position: SHELTER,
          },
        ]
      : []),
  ];
}
export function objective(s: RescueState): string {
  if (s.rescued)
    return s.supplies === "shelter"
      ? "Jo and the emergency supplies are safe. Stay a moment."
      : "Jo is safe. The storm is passing.";
  if (!s.started) return "A last light on the waterfront.";
  if (s.phase === "opening") return "Follow the street toward Bay Radio.";
  if (s.phase === "blackout")
    return "The waterfront has lost power. Someone is calling from Bay Radio.";
  if (s.phase === "helping")
    return s.helping > 0
      ? "Lift together. Keep the passage clear."
      : "Inez is coming to help.";
  if (s.escortStage > 0)
    return s.collapse > 0
      ? "The front awning has fallen. Bring Jo west to the lit warehouse."
      : s.supplies === "carried"
        ? "Stay with Jo. Get through the east door."
        : "Lead Jo through the east door. Take the emergency case if you can.";
  return s.passage === "cleared"
    ? "The entrance is clear. Reach Jo inside."
    : "Someone is trapped at Bay Radio.";
}
export function command(
  state: RescueState,
  cmd: RescueCommand,
  base: Collider[] = [],
): { state: RescueState; ok: boolean; reason?: string } {
  const fail = (reason: string) => ({ state, ok: false, reason });
  if (cmd.type === "recover") {
    if (!state.checkpoint || !validateRescueState(state.checkpoint))
      return fail("No checkpoint is available.");
    const s = snapshot(state.checkpoint);
    s.checkpoint = snapshot(state.checkpoint);
    event(s, "recovered", "Returned to the last safe checkpoint.");
    return { state: s, ok: true };
  }
  const s = { ...state };
  const colliders = [...base, ...rescueColliders(s)];
  if (cmd.type === "start") {
    if (s.started) return fail("The rescue is already underway.");
    s.started = true;
    event(s, "started", "Entered the waterfront as the storm arrived.");
    return { state: s, ok: true };
  }
  if (!s.started) return fail("Begin the rescue first.");
  if (cmd.type === "move") {
    if (!Number.isFinite(cmd.point.x) || !Number.isFinite(cmd.point.z))
      return fail("Choose a reachable place.");
    s.path = findPath(s.player, cmd.point, colliders);
    if (!s.path.length)
      return fail("That route is blocked. Try a clear section of ground.");
    return { state: s, ok: true };
  }
  if (
    cmd.type === "assist" ||
    (cmd.type === "interact" && cmd.target === "beam")
  ) {
    if (
      s.passage !== "blocked" ||
      s.collapse > 0 ||
      s.phase === "helping" ||
      s.escortStage > 0
    )
      return fail("There is no beam to lift now.");
    if (distance(s.player, BEAM) > 7)
      return fail(
        "Get closer to the fallen beam so Inez can see what you need.",
      );
    const path = findPath(s.companion, BEAM, colliders);
    if (!path.length) return fail("Inez cannot reach the beam from here.");
    s.companionPath = path;
    s.phase = "helping";
    s.assistMode = cmd.type === "assist" ? (cmd.mode ?? "demo") : "demo";
    s.helping = 0;
    event(
      s,
      "assist",
      `Inez accepted the beam-lifting task (${s.assistMode}); she must reach the beam and work before it opens.`,
    );
    return { state: s, ok: true };
  }
  if (cmd.type !== "interact") return fail("Unsupported action.");
  const target = rescueTargets(s).find((t) => t.id === cmd.target);
  if (!target) return fail("That action is not available now.");
  if (
    distance(s.player, target.position) > 2.8 ||
    !clearSegment(s.player, target.position, colliders)
  )
    return fail("Move closer with a clear line of reach.");
  if (cmd.target === "side-door") {
    s.path = findPath(s.player, { x: 26.5, z: 10 }, colliders);
    s.route = s.route === "none" ? "inside" : s.route;
    event(
      s,
      "side-route",
      "Found the open east service entrance; the fallen beam remains in place.",
    );
  } else if (cmd.target === "supplies") {
    s.supplies = "carried";
    event(
      s,
      "supplies-carried",
      "Picked up the single emergency case from Bay Radio.",
    );
  } else if (cmd.target === "victim") {
    s.phase = "escort";
    s.escortStage = 1;
    s.escortElapsed = 0;
    s.route = s.route === "none" ? "inside" : s.route;
    s.victimPath = findPath(s.victim, SIDE, colliders);
    s.playerSpeed = 0;
    s.path = [];
    s.companionPath = [];
    event(
      s,
      "escort-started",
      "Jo accepted physical help. The east doorway is the safe exit.",
    );
    s.checkpoint = snapshot(s);
  } else if (cmd.target === "shelter") {
    if (s.supplies === "carried") {
      s.supplies = "shelter";
      event(
        s,
        "supplies-delivered",
        "The emergency case was placed inside the relief warehouse.",
      );
    }
    if (!s.rescued)
      event(
        s,
        "shelter-wait",
        "The shelter is open; Jo must physically reach it to complete the rescue.",
      );
  }
  return { state: s, ok: true };
}
/** Positions and route arrays are copied only when moving. No frame-by-frame snapshot cloning. */
function move(
  point: Point,
  path: Point[],
  seconds: number,
  speed: number,
  colliders: Collider[],
): [Point, Point[]] {
  if (!path.length) return [point, path];
  let p = { ...point },
    remaining = seconds * speed,
    i = 0;
  while (remaining > 0 && i < path.length) {
    const goal = path[i],
      d = distance(p, goal),
      step = Math.min(d, remaining);
    const next =
      d < 1e-6
        ? goal
        : {
            x: p.x + ((goal.x - p.x) * step) / d,
            z: p.z + ((goal.z - p.z) * step) / d,
          };
    if (!clearSegment(p, next, colliders)) return [p, []];
    p = next;
    remaining -= step;
    if (d <= step + 1e-6) i++;
    else break;
  }
  return [p, i ? path.slice(i) : path];
}
export function tick(
  state: RescueState,
  seconds: number,
  base: Collider[] = [],
): RescueState {
  if (!state.started || !Number.isFinite(seconds) || seconds <= 0) return state;
  const dt = Math.min(seconds, 0.25),
    s = { ...state, elapsed: state.elapsed + dt };
  const colliders = [...base, ...rescueColliders(s)];
  // Integrate a short linear acceleration ramp analytically, preserving frame-rate independence.
  const speed = s.path.length ? (s.playerSpeed ?? 0) : 0;
  const acceleration = 3.35 / 0.18;
  const rampTime = Math.min(dt, Math.max(0, (3.35 - speed) / acceleration));
  const travel =
    speed * rampTime +
    0.5 * acceleration * rampTime * rampTime +
    3.35 * (dt - rampTime);
  s.playerSpeed = s.path.length ? Math.min(3.35, speed + acceleration * dt) : 0;
  [s.player, s.path] = move(s.player, s.path, dt, travel / dt, colliders);
  if (s.power && s.elapsed >= 5) {
    s.power = false;
    s.phase = s.phase === "opening" ? "blackout" : s.phase;
    event(s, "blackout", "The transformer failed. Street lights lost power.");
  }
  if (s.phase === "blackout" && s.elapsed >= 10) {
    s.phase = "approach";
    event(s, "help-call", "Jo called from inside Bay Radio.");
    s.checkpoint = snapshot(s);
  }
  [s.companion, s.companionPath] = move(
    s.companion,
    s.companionPath,
    dt,
    3.1,
    colliders,
  );
  if (s.phase === "helping" && distance(s.companion, BEAM) < 0.7) {
    s.helping += dt;
    if (s.helping >= 9) {
      s.passage = "cleared";
      s.phase = "approach";
      s.route = "clear";
      event(
        s,
        "beam-cleared",
        "Inez reached the beam and lifted it clear. The front passage is now physically open.",
      );
      s.checkpoint = snapshot(s);
    }
  }
  s.followTimer -= dt;
  if (s.escortStage > 0 && !s.rescued) {
    s.escortElapsed += dt;
    if (s.escortStage === 3 && distance(s.victim, s.player) < 1.6)
      s.victimPath = [];
    [s.victim, s.victimPath] = move(
      s.victim,
      s.victimPath,
      dt,
      2.15,
      colliders,
    );
    if (s.escortStage === 1 && distance(s.victim, SIDE) < 0.8) {
      s.escortStage = 2;
      s.victimPath = findPath(s.victim, { x: 31, z: 20 }, colliders);
    }
    if (s.escortStage === 2 && distance(s.victim, { x: 31, z: 20 }) < 0.8)
      s.escortStage = 3;
    if (
      s.escortElapsed >= 8 &&
      s.collapse === 0 &&
      [s.player, s.victim, s.companion].every((p) =>
        isWalkable(p, [BLOCK], 0.7),
      )
    ) {
      s.collapse = 0.001;
      s.phase = "collapse";
      s.path = [];
      s.companionPath = [];
      event(
        s,
        "collapse-started",
        "The front awning is failing. The east service exit remains open.",
      );
    }
    if (s.collapse > 0 && s.collapse < 1) {
      s.collapse = Math.min(1, s.collapse + dt / 2.5);
      if (s.collapse >= 1) {
        event(
          s,
          "collapse",
          "The awning fell across the front passage. That route is now blocked.",
        );
        s.phase = "escort";
        s.path = [];
        s.companionPath = [];
        s.victimPath = [];
      }
    }
    if (
      distance(s.victim, SHELTER) <= 2.5 &&
      distance(s.player, SHELTER) <= 4
    ) {
      s.rescued = true;
      s.phase = "aftermath";
      s.victimPath = [];
      s.companionPath = findPath(s.companion, { x: -20, z: 10 }, colliders);
      if (s.supplies === "carried") s.supplies = "shelter";
      event(
        s,
        "rescued",
        `Jo reached shelter on foot. Emergency case: ${s.supplies === "shelter" ? "delivered" : "left inside Bay Radio"}.`,
      );
      s.checkpoint = snapshot(s);
    }
  }
  if (s.followTimer <= 0) {
    s.followTimer = 0.6;
    if (
      s.phase !== "helping" &&
      !s.rescued &&
      distance(s.companion, s.player) > 3.2
    )
      s.companionPath = findPath(
        s.companion,
        { x: s.player.x + 1.2, z: s.player.z + 0.5 },
        [...base, ...rescueColliders(s)],
      );
    if (s.escortStage === 3 && !s.rescued && distance(s.victim, s.player) > 1.7)
      s.victimPath = findPath(s.victim, s.player, [
        ...base,
        ...rescueColliders(s),
      ]);
    // A new obstruction invalidates an old route; recover through the still-open east door.
    if (s.escortStage === 1 && !s.victimPath.length)
      s.victimPath = findPath(s.victim, SIDE, [...base, ...rescueColliders(s)]);
    if (s.escortStage === 2 && !s.victimPath.length)
      s.victimPath = findPath(s.victim, { x: 31, z: 20 }, [
        ...base,
        ...rescueColliders(s),
      ]);
  }
  if (!s.path.length) s.playerSpeed = 0;
  return s;
}

/** Reject malformed or oversized local saves before any renderer or navigation code sees them.
 * Optional speed keeps pre-acceleration rescue checkpoints compatible. Checkpoints are one level deep. */
export function validateRescueState(value: unknown): value is RescueState {
  const record = (v: unknown): v is Record<string, unknown> =>
    !!v && typeof v === "object" && !Array.isArray(v);
  const num = (v: unknown, min: number, max: number) =>
    typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
  const point = (v: unknown) =>
    record(v) &&
    num(v.x, BOUNDS.minX, BOUNDS.maxX) &&
    num(v.z, BOUNDS.minZ, BOUNDS.maxZ);
  function valid(v: unknown, nested = false): boolean {
    if (!record(v)) return false;
    if (![v.player, v.companion, v.victim].every(point)) return false;
    if (
      ![v.path, v.companionPath, v.victimPath].every(
        (path) =>
          Array.isArray(path) && path.length <= 2000 && path.every(point),
      )
    )
      return false;
    if (
      !num(v.elapsed, 0, 31536000) ||
      !num(v.helping, 0, 10) ||
      !num(v.collapse, 0, 1) ||
      !num(v.escortElapsed, 0, 31536000) ||
      !num(v.followTimer, -0.25, 0.6)
    )
      return false;
    if (
      !num(v.escortStage, 0, 3) ||
      !Number.isInteger(v.escortStage) ||
      (v.playerSpeed !== undefined && !num(v.playerSpeed, 0, 3.35))
    )
      return false;
    if (![v.started, v.power, v.rescued].every((x) => typeof x === "boolean"))
      return false;
    if (
      ![
        "opening",
        "blackout",
        "approach",
        "helping",
        "escort",
        "collapse",
        "aftermath",
      ].includes(v.phase as string) ||
      !["blocked", "cleared"].includes(v.passage as string) ||
      !["inside", "carried", "shelter"].includes(v.supplies as string) ||
      !["none", "clear", "inside"].includes(v.route as string)
    )
      return false;
    if (
      v.assistMode !== undefined &&
      !["live", "demo", "fallback"].includes(v.assistMode as string)
    )
      return false;
    if (v.rescued !== (v.phase === "aftermath")) return false;
    if (!Array.isArray(v.events) || v.events.length > 10000) return false;
    let previousId = 0;
    for (const e of v.events) {
      if (
        !record(e) ||
        !num(e.id, 1, Number.MAX_SAFE_INTEGER) ||
        !Number.isInteger(e.id) ||
        (e.id as number) <= previousId ||
        !num(e.at, 0, v.elapsed as number) ||
        typeof e.kind !== "string" ||
        !e.kind.length ||
        e.kind.length > 100 ||
        typeof e.detail !== "string" ||
        e.detail.length > 4000
      )
        return false;
      previousId = e.id as number;
    }
    return v.checkpoint === undefined || (!nested && valid(v.checkpoint, true));
  }
  return valid(value);
}
