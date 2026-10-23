import {
  SPECIES,
  SITES,
  REST_SITES,
  type WildlifeState,
  type WildlifeCommand,
  type CreatureState,
  type Weather,
} from "./contracts";
import { clearSegment, findPath, isWalkable } from "../three/navigation";
import { BOUNDS } from "../three/shared";
import type { NavigationBounds } from "../three/navigation";
import type { Point, Collider } from "../three/shared";
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);
const weather: Weather[] = ["fair", "rain", "dusk", "storm"];
export function createWildlife(): WildlifeState {
  return {
    version: 1,
    player: { x: -12, z: 25 },
    path: [],
    speed: 0,
    elapsed: 0,
    weather: "fair",
    weatherTime: 0,
    creatures: SPECIES.map((s, i) => ({
      id: s.id,
      position: { ...s.position },
      home: { ...s.position },
      path: [],
      mood: "idle",
      phase: i * 0.63,
      alarm: 0,
      trust: 0,
      discovered: false,
      bonded: false,
      variant: i % 3,
      attention: false,
      available: !["pluvlet", "glasswhorl", "tempestray"].includes(s.id),
    })),
    companion: null,
    companionPosition: { x: -12, z: 25 },
    companionPath: [],
    selected: null,
    assistance: true,
    abilities: { tracks: false, gate: false, light: false },
    bellRung: false,
    rareRevealed: false,
    events: [],
    pulse: null,
    foundShell: false,
  };
}
function event(
  s: WildlifeState,
  kind: string,
  detail: string,
  species?: CreatureState["id"],
) {
  s.events = [
    ...s.events,
    {
      id: (s.events.at(-1)?.id ?? 0) + 1,
      at: s.elapsed,
      kind,
      species,
      detail,
    },
  ].slice(-160);
}
export function wildlifeColliders(s: WildlifeState): Collider[] {
  return [
    ...(!s.abilities.gate
      ? [
          {
            id: "wildlife-garden-gate",
            minX: -36,
            maxX: -32,
            minZ: -2.2,
            maxZ: -1.8,
          },
        ]
      : []),
    ...(!s.abilities.light
      ? [
          {
            id: "wildlife-dark-veil",
            minX: 10,
            maxX: 14,
            minZ: -21.2,
            maxZ: -20.8,
          },
        ]
      : []),
  ];
}
function available(s: WildlifeState, c: CreatureState) {
  switch (c.id) {
    case "pluvlet":
      return (
        s.abilities.gate && (s.weather === "rain" || s.weather === "storm")
      );
    case "glasswhorl":
      return (
        s.abilities.light && (s.weather === "dusk" || s.weather === "storm")
      );
    case "tempestray":
      return (
        s.abilities.tracks &&
        s.abilities.gate &&
        s.abilities.light &&
        s.weather === "storm" &&
        s.bellRung
      );
    default:
      return true;
  }
}
export function receptive(s: WildlifeState, c: CreatureState) {
  return (
    c.available &&
    !c.bonded &&
    c.attention &&
    c.alarm <= 0 &&
    (s.assistance || c.phase % 4 < 1.6)
  );
}
function bond(s: WildlifeState, c: CreatureState) {
  if (c.bonded) return;
  c.bonded = true;
  c.trust = 1;
  c.mood = "bonding";
  c.bondAt = s.elapsed;
  c.path = [];
  event(
    s,
    "bond",
    `${SPECIES.find((x) => x.id === c.id)!.name} trusts you.`,
    c.id,
  );
  if (!s.companion) {
    s.companion = c.id;
    s.companionPosition = { ...c.position };
    s.companionPath = [];
  }
}
export function wildlifeCommand(
  input: WildlifeState,
  command: WildlifeCommand,
  base: Collider[] = [],
  bounds: NavigationBounds = BOUNDS,
): { state: WildlifeState; ok: boolean; reason?: string } {
  const s = structuredClone(input),
    colliders = [...base, ...wildlifeColliders(s)];
  const fail = (reason: string) => ({ state: input, ok: false, reason });
  const c = s.creatures.find((x) => x.id === s.selected);
  switch (command.type) {
    case "move": {
      if (
        !Number.isFinite(command.point.x) ||
        !Number.isFinite(command.point.z)
      )
        return fail("Choose a spot on the ground.");
      const path = findPath(s.player, command.point, colliders, bounds);
      if (!path.length) return fail("That route is blocked.");
      s.path = path;
      break;
    }
    case "select": {
      const target = s.creatures.find((x) => x.id === command.id);
      if (
        !target ||
        !target.available ||
        target.bonded ||
        distance(s.player, target.position) > 12 ||
        !clearSegment(s.player, target.position, colliders, bounds)
      )
        return fail("Find the creature nearby.");
      s.selected = target.id;
      target.discovered = true;
      break;
    }
    case "attention": {
      if (
        !c ||
        !c.available ||
        c.bonded ||
        distance(s.player, c.position) > 5 ||
        !clearSegment(s.player, c.position, colliders, bounds)
      )
        return fail("Come a little closer.");
      if (c.alarm > 0) return fail("Give it a moment to settle.");
      if (c.id === "cairnback" && !s.foundShell)
        return fail("Something striped is missing from its nest.");
      if (c.id === "sailpip" && c.phase % 8 > 3)
        return fail("Greet it when it hovers.");
      c.attention = true;
      c.path = [];
      c.mood = "curious";
      s.path = [];
      event(s, "attention", "An invitation, gently offered.", c.id);
      break;
    }
    case "pulse": {
      const target = s.creatures.find((x) => x.id === command.id);
      if (
        !target ||
        target.id !== s.selected ||
        !target.available ||
        target.bonded ||
        distance(s.player, target.position) > 5 ||
        !clearSegment(s.player, target.position, colliders, bounds)
      )
        return fail("Aim at a nearby creature.");
      const success = receptive(s, target);
      s.pulse = {
        at: s.elapsed,
        from: { ...s.player },
        to: { ...target.position },
        success,
      };
      if (success) bond(s, target);
      else {
        event(
          s,
          "pulse",
          "The pulse fades. Try its next open moment.",
          target.id,
        );
      }
      break;
    }
    case "companion": {
      const target = s.creatures.find((x) => x.id === command.id);
      if (!target?.bonded) return fail("Befriend this creature first.");
      s.companion = target.id;
      s.companionPosition = { ...target.position };
      s.companionPath = [];
      event(s, "companion", "A familiar companion joins you.", target.id);
      break;
    }
    case "ability": {
      const species = SPECIES.find((x) => x.id === s.companion);
      if (!species || species.ability !== command.target)
        return fail("A different companion can help here.");
      if (s.abilities[command.target])
        return fail("Your companion already helped here.");
      if (
        distance(s.player, SITES[command.target]) > 6 ||
        distance(s.player, s.companionPosition) > 6 ||
        !clearSegment(s.player, s.companionPosition, colliders, bounds)
      )
        return fail("Bring your companion close to this spot.");
      s.abilities[command.target] = true;
      event(
        s,
        "ability",
        command.target === "tracks"
          ? "Brindlefin uncovers a hidden trail of shell prints."
          : command.target === "gate"
            ? "The garden entrance rolls clear."
            : "Living light opens the reflection passage.",
        s.companion!,
      );
      s.companionPath = [];
      break;
    }
    case "weather":
      if (!REST_SITES.some((p) => distance(s.player, p) <= 5))
        return fail("Rest at the weather bench.");
      s.weather = weather[(weather.indexOf(s.weather) + 1) % 4];
      s.weatherTime = 0;
      event(s, "weather", s.weather);
      break;
    case "bell":
      if (distance(s.player, SITES.bell) > 5)
        return fail("Approach the wind bell.");
      s.bellRung = true;
      event(s, "bell", "A low note travels over the water.");
      break;
    case "shell":
      if (s.foundShell) return fail("The shell is already safe.");
      if (distance(s.player, SITES.shell) > 3)
        return fail("Come closer to the striped shell.");
      s.foundShell = true;
      event(s, "shell", "The little striped shell is safe.");
      break;
    case "assistTiming":
      s.assistance = command.enabled;
      break;
  }
  for (const creature of s.creatures)
    creature.available = available(s, creature);
  if (
    !s.rareRevealed &&
    s.creatures.find((x) => x.id === "tempestray")!.available
  ) {
    s.rareRevealed = true;
    event(s, "reveal", "The storm answers the wind bell.", "tempestray");
  }
  return { state: s, ok: true };
}
function walk(
  position: Point,
  path: Point[],
  amount: number,
  colliders: Collider[],
  bounds: NavigationBounds = BOUNDS,
): { position: Point; path: Point[] } {
  let p = position,
    remaining = path;
  while (remaining.length && amount > 0) {
    const goal = remaining[0],
      d = distance(p, goal);
    const next =
      d <= amount
        ? goal
        : {
            x: p.x + ((goal.x - p.x) * amount) / d,
            z: p.z + ((goal.z - p.z) * amount) / d,
          };
    if (!clearSegment(p, next, colliders, bounds))
      return { position: p, path: [] };
    p = next;
    if (d <= amount) {
      remaining = remaining.slice(1);
      amount -= d;
    } else break;
  }
  return { position: p, path: remaining };
}
export function tickWildlife(
  input: WildlifeState,
  delta: number,
  base: Collider[] = [],
  bounds: NavigationBounds = BOUNDS,
): WildlifeState {
  const dt = Math.max(0, Math.min(0.1, Number.isFinite(delta) ? delta : 0));
  if (!dt) return input;
  const s = {
    ...input,
    creatures: input.creatures.map((c) => ({ ...c })),
    elapsed: input.elapsed + dt,
    weatherTime: input.weatherTime + dt,
  };
  const colliders = [...base, ...wildlifeColliders(s)];
  if (s.weatherTime >= 120) {
    s.weather = weather[(weather.indexOf(s.weather) + 1) % 4];
    s.weatherTime = 0;
    event(s, "weather", s.weather);
  }
  const stepped = walk(s.player, s.path, dt * 2.6, colliders, bounds);
  s.speed = distance(s.player, stepped.position) / dt;
  s.player = stepped.position;
  s.path = stepped.path;
  for (const c of s.creatures) {
    c.phase += dt;
    c.alarm = Math.max(0, c.alarm - dt);
    c.available = available(s, c);
    if (!c.available && !c.bonded) continue;
    if (c.bonded) {
      if (s.elapsed - (c.bondAt ?? 0) < 2) {
        c.mood = "bonding";
        continue;
      }
      c.mood = "companion";
      continue;
    }
    const d = distance(s.player, c.position),
      seen = d < 12 && clearSegment(s.player, c.position, colliders, bounds);
    if (seen && !c.discovered) {
      c.discovered = true;
      event(
        s,
        "discovery",
        `${SPECIES.find((x) => x.id === c.id)!.name} spotted.`,
        c.id,
      );
    }
    if (d < 1.3 && !c.attention && c.alarm === 0) {
      c.alarm = 2;
      event(s, "alert", "A little space helps.", c.id);
    }
    if (c.alarm > 0) {
      c.mood = "alert";
      continue;
    }
    if (c.attention && d > 8) c.attention = false;
    if (c.attention) {
      c.mood = receptive(s, c) ? "receptive" : "curious";
      continue;
    }
    const range =
      c.id === "sailpip"
        ? 2.3
        : c.id === "tempestray"
          ? 1.8
          : c.id === "cairnback"
            ? 0.18
            : 0.6;
    if (c.id === "sailpip" && c.phase % 8 <= 3) {
      c.mood = "idle";
      continue;
    }
    const goal = {
      x: c.home.x + Math.sin(c.phase * 0.45) * range,
      z: c.home.z + Math.cos(c.phase * 0.45) * range * 0.55,
    };
    if (
      isWalkable(goal, colliders, 0.38, bounds) &&
      clearSegment(c.position, goal, colliders, bounds)
    ) {
      const d = distance(c.position, goal),
        step = Math.min(d, dt * (c.id === "sailpip" ? 1.8 : 0.55));
      if (d > 0.01)
        c.position = {
          x: c.position.x + ((goal.x - c.position.x) * step) / d,
          z: c.position.z + ((goal.z - c.position.z) * step) / d,
        };
      c.mood =
        c.id === "sailpip" && c.phase % 8 > 3
          ? "travel"
          : d > 0.15
            ? "travel"
            : "idle";
    } else c.mood = "idle";
  }
  if (s.companion) {
    const c = s.creatures.find((c) => c.id === s.companion)!;
    if (s.elapsed - (c.bondAt ?? -10) >= 2) {
      const d = distance(s.companionPosition, s.player);
      if (
        d > 1.8 &&
        (!s.companionPath.length ||
          Math.floor(s.elapsed) !== Math.floor(input.elapsed))
      ) {
        const offset = {
          x: s.player.x + ((s.companionPosition.x - s.player.x) / d) * 1.4,
          z: s.player.z + ((s.companionPosition.z - s.player.z) / d) * 1.4,
        };
        s.companionPath = findPath(
          s.companionPosition,
          isWalkable(offset, colliders, 0.38, bounds) ? offset : s.player,
          colliders,
          bounds,
        );
      }
      if (d <= 1.5) s.companionPath = [];
      const next = walk(
        s.companionPosition,
        s.companionPath,
        dt * 3.6,
        colliders,
        bounds,
      );
      s.companionPosition = next.position;
      s.companionPath = next.path;
      c.position = { ...next.position };
      c.mood = "companion";
    }
  }
  if (
    !s.rareRevealed &&
    s.creatures.find((x) => x.id === "tempestray")!.available
  ) {
    s.rareRevealed = true;
    event(s, "reveal", "The storm answers the wind bell.", "tempestray");
  }
  return s;
}
export function validateWildlife(
  v: unknown,
  bounds: NavigationBounds = BOUNDS,
): v is WildlifeState {
  if (!v || typeof v !== "object") return false;
  const s = v as WildlifeState;
  const point = (p: unknown): p is Point =>
    !!p &&
    typeof p === "object" &&
    Number.isFinite((p as Point).x) &&
    Number.isFinite((p as Point).z) &&
    (p as Point).x >= bounds.minX &&
    (p as Point).x <= bounds.maxX &&
    (p as Point).z >= bounds.minZ &&
    (p as Point).z <= bounds.maxZ;
  const num = (n: unknown) =>
    typeof n === "number" && Number.isFinite(n) && n >= 0;
  const path = (p: unknown) =>
    Array.isArray(p) && p.length < 300 && p.every(point);
  if (
    s.version !== 1 ||
    !point(s.player) ||
    !point(s.companionPosition) ||
    !path(s.path) ||
    !path(s.companionPath) ||
    !num(s.elapsed) ||
    !num(s.weatherTime) ||
    !num(s.speed) ||
    !weather.includes(s.weather) ||
    typeof s.assistance !== "boolean" ||
    typeof s.foundShell !== "boolean" ||
    typeof s.bellRung !== "boolean" ||
    typeof s.rareRevealed !== "boolean"
  )
    return false;
  if (
    !s.abilities ||
    !["tracks", "gate", "light"].every(
      (k) => typeof s.abilities[k as keyof typeof s.abilities] === "boolean",
    )
  )
    return false;
  if (
    !Array.isArray(s.creatures) ||
    s.creatures.length !== 6 ||
    new Set(s.creatures.map((c) => c.id)).size !== 6
  )
    return false;
  if (
    !s.creatures.every(
      (c) =>
        SPECIES.some((x) => x.id === c.id) &&
        point(c.position) &&
        point(c.home) &&
        path(c.path) &&
        num(c.phase) &&
        num(c.alarm) &&
        num(c.trust) &&
        c.trust <= 1 &&
        Number.isInteger(c.variant) &&
        c.variant >= 0 &&
        c.variant <= 2 &&
        [
          "idle",
          "travel",
          "alert",
          "curious",
          "receptive",
          "bonding",
          "companion",
        ].includes(c.mood) &&
        ["discovered", "bonded", "attention", "available"].every(
          (k) => typeof c[k as keyof CreatureState] === "boolean",
        ) &&
        (c.bondAt === undefined || num(c.bondAt)),
    )
  )
    return false;
  if (
    s.companion !== null &&
    !s.creatures.some((c) => c.id === s.companion && c.bonded)
  )
    return false;
  if (s.selected !== null && !s.creatures.some((c) => c.id === s.selected))
    return false;
  if (
    !Array.isArray(s.events) ||
    s.events.length > 160 ||
    !s.events.every(
      (e) =>
        Number.isInteger(e.id) &&
        e.id > 0 &&
        num(e.at) &&
        typeof e.kind === "string" &&
        typeof e.detail === "string" &&
        e.detail.length < 1000 &&
        (e.species === undefined || SPECIES.some((c) => c.id === e.species)),
    )
  )
    return false;
  if (
    s.pulse !== null &&
    (!s.pulse ||
      !num(s.pulse.at) ||
      !point(s.pulse.from) ||
      !point(s.pulse.to) ||
      typeof s.pulse.success !== "boolean")
  )
    return false;
  return true;
}
