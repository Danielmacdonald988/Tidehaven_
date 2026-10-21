import { createWorld } from "../engine";
import { validateWorld } from "../persistence";
import {
  createWildlife,
  wildlifeCommand,
  tickWildlife,
  validateWildlife,
} from "../wildlife/engine";
import type { WildlifeState } from "../wildlife/contracts";
import type { World } from "../contracts";
import {
  createVehicle,
  tickVehicle,
  safeExit,
  recoverVehicle,
} from "./Vehicle";
import { createPopulation, tickPopulation, walkPath } from "./population";
import { findPath, clearSegment } from "../three/navigation";
import {
  REGION_BOUNDS,
  REGION_SITES as P,
  districtAt,
  type RegionState,
  type RegionCommand,
  type RegionInteraction,
  type Collider,
  type Point,
  type DriveInput,
} from "./contracts";
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);
export function createRegion(
  wildlife?: WildlifeState,
  campaign?: World,
): RegionState {
  const w = structuredClone(wildlife ?? createWildlife());
  w.player = { ...P.home };
  w.path = [];
  w.speed = 0;
  w.companionPosition = { x: P.home.x + 1, z: P.home.z };
  w.companionPath = [];
  const c = structuredClone(campaign ?? createWorld());
  return {
    version: 1,
    wildlife: w,
    campaign: c,
    vehicle: createVehicle(),
    residents: createPopulation(c),
    elapsed: 0,
    trafficTime: [0, 22],
    district: "town",
    discovered: ["home", "town"],
    waypoint: null,
    delivery: { status: "available", goods: 8, reward: 300, promised: false },
    assistance: { status: "waiting", position: { ...P.rescue }, path: [] },
    expedition: { clue: false, shortcut: false, relic: false, complete: false },
    upgrades: { shelter: false, workbench: false },
    events: [],
    nextEvent: 1,
  };
}
function record(
  s: RegionState,
  kind: string,
  actor: string,
  detail: string,
  facts: string[] = [],
  trust = 0,
) {
  const id = `region-${s.nextEvent++}`;
  s.events = [
    ...s.events,
    { id, at: s.elapsed, kind, actor, detail, facts },
  ].slice(-180);
  s.campaign.events.push({
    id,
    hour: s.campaign.hour,
    kind,
    title: detail,
    description: detail,
    actor,
    facts,
    constraints: [
      "Physical proximity and prerequisites validated by region engine.",
    ],
    effects: [detail],
  });
  const c = s.campaign.characters.find((c) => c.id === actor);
  const witness = s.residents.find((r) => r.id === actor);
  const relayed = [
    "delivery-complete",
    "delivery-abandoned",
    "expedition-complete",
  ].includes(kind);
  if (relayed) {
    s.events
      .at(-1)!
      .facts.push("Receipt communicated by the local dispatch radio.");
  }
  if (
    c &&
    (relayed ||
      (witness && distance(witness.position, s.wildlife.player) <= 12))
  ) {
    c.trust = Math.max(0, Math.min(100, c.trust + trust));
    c.memories.push({
      eventId: id,
      hour: s.campaign.hour,
      text: detail,
      tags: ["region", kind],
    });
    c.knowledge = [...new Set([...c.knowledge, id])];
  }
  // Preserve imported campaign history and all commitment sources. Regional
  // chatter is a bounded rolling history, not an ever-growing transcript.
  const protectedIds = new Set(s.campaign.commitments.map((c) => c.eventId));
  for (const e of s.campaign.events)
    if (
      [
        "delivery-complete",
        "expedition-complete",
        "rescue-complete",
        "upgrade",
      ].includes(e.kind)
    )
      protectedIds.add(e.id);
  const recentIds = new Set(
    s.campaign.events
      .filter((e) => e.id.startsWith("region-"))
      .slice(-180)
      .map((e) => e.id),
  );
  s.campaign.events = s.campaign.events.filter(
    (e) =>
      !e.id.startsWith("region-") ||
      recentIds.has(e.id) ||
      protectedIds.has(e.id),
  );
  const retained = new Set(s.campaign.events.map((e) => e.id));
  for (const person of s.campaign.characters) {
    const recentMemories = new Set(
      person.memories
        .filter((m) => m.eventId.startsWith("region-"))
        .slice(-32)
        .map((m) => m.eventId),
    );
    person.memories = person.memories.filter(
      (m) =>
        !m.eventId.startsWith("region-") ||
        (retained.has(m.eventId) &&
          (recentMemories.has(m.eventId) || protectedIds.has(m.eventId))),
    );
    person.knowledge = person.knowledge.filter(
      (k) => !k.startsWith("region-") || retained.has(k),
    );
  }
  return id;
}
export function trafficPositions(
  s: RegionState,
): { position: Point; yaw: number }[] {
  return [0, 1].map((i) => {
    const phase = (((s.trafficTime?.[i] ?? s.elapsed + i * 22) % 44) + 44) % 44;
    const outward = phase < 22;
    const progress = outward
      ? Math.min(18, Math.max(0, phase - 2))
      : Math.min(18, Math.max(0, phase - 24));
    return {
      position: {
        x: outward ? 44 + progress : 62 - progress,
        z: i ? 23.2 : 17.8,
      },
      yaw: outward ? Math.PI / 2 : -Math.PI / 2,
    };
  });
}
export function regionColliders(s: RegionState): Collider[] {
  return [
    ...(!s.expedition.shortcut
      ? [
          {
            id: "region-shortcut",
            minX: -83,
            maxX: -79,
            minZ: -5.3,
            maxZ: -4.7,
          },
        ]
      : []),
    ...trafficPositions(s).map((v, i) => ({
      id: `region-traffic-${i}`,
      minX: v.position.x - 2.2,
      maxX: v.position.x + 2.2,
      minZ: v.position.z - 0.9,
      maxZ: v.position.z + 0.9,
    })),
  ];
}
/** A short union of rotated slices follows the body more tightly than one large AABB.
 * Only walkers use these; vehicle physics and boarding must not collide with itself. */
export function parkedVehicleColliders(s: RegionState): Collider[] {
  if (s.vehicle.occupied) return [];
  const v = s.vehicle,
    sin = Math.sin(v.yaw),
    cos = Math.cos(v.yaw),
    length = 4.4 / 9;
  return Array.from({ length: 9 }, (_, i) => {
    const along = -2.2 + length * (i + 0.5),
      x = v.position.x + sin * along,
      z = v.position.z + cos * along;
    const ex = Math.abs(cos) * 0.94 + (Math.abs(sin) * length) / 2,
      ez = Math.abs(sin) * 0.94 + (Math.abs(cos) * length) / 2;
    return {
      id: `region-owned-vehicle-${i}`,
      minX: x - ex,
      maxX: x + ex,
      minZ: z - ez,
      maxZ: z + ez,
    };
  });
}
export function regionInteractions(s: RegionState): RegionInteraction[] {
  const sites: RegionInteraction[] = [
    {
      id: "vehicle",
      label: s.vehicle.occupied ? "Park & step out" : "Enter Coast Runner",
      position: s.vehicle.position,
      radius: 3.5,
      kind: "vehicle",
    },
    {
      id: "home",
      label:
        s.delivery.status === "loaded"
          ? "Unload supplies"
          : s.expedition.relic && !s.expedition.complete
            ? "Place recovered relic"
            : "Warehouse · home base",
      position: P.home,
      radius: 4,
      kind: "site",
    },
    {
      id: "dispatch",
      label:
        s.delivery.status === "available" || s.delivery.status === "abandoned"
          ? "Ask about a delivery"
          : "Harbor dispatch",
      position: P.dispatch,
      radius: 4,
      kind: "site",
    },
    {
      id: "cargo",
      label:
        s.delivery.status === "accepted"
          ? "Load eight supply crates"
          : "Harbor supply crates",
      position: P.cargo,
      radius: 4,
      kind: "site",
    },
    {
      id: "clue",
      label: "Inspect unusual tracks",
      position: P.clue,
      radius: 4,
      kind: "site",
    },
    {
      id: "shortcut",
      label: s.expedition.shortcut
        ? "Wetland passage open"
        : "Ask companion to find a passage",
      position: P.shortcut,
      radius: 5,
      kind: "site",
    },
    {
      id: "ruin",
      label: s.expedition.relic
        ? "Old coastal observatory"
        : "Recover the brass lens",
      position: P.ruin,
      radius: 4,
      kind: "site",
    },
    {
      id: "rescue",
      label:
        s.assistance.status === "waiting"
          ? "Help stranded dock worker"
          : s.assistance.status === "escorting"
            ? "Guide Jo to the life ring"
            : "Worker safe",
      position: s.assistance.position,
      radius: 4,
      kind: "site",
    },
    {
      id: "upgrade-shelter",
      label: s.upgrades.shelter
        ? "Creature shelter ready"
        : "Build creature shelter · $500",
      position: P.upgrade,
      radius: 4,
      kind: "site",
    },
    {
      id: "upgrade-workbench",
      label: s.upgrades.workbench
        ? "Loading bench ready"
        : "Build loading bench · $350",
      position: { x: P.upgrade.x + 3, z: P.upgrade.z },
      radius: 4,
      kind: "site",
    },
    {
      id: "mission",
      label: "Choose a story or rescue mission",
      position: P.mission,
      radius: 3,
      kind: "mission",
    },
  ];
  return [
    ...sites,
    ...s.residents.map((r) => ({
      id: `resident-${r.id}`,
      label: `Speak to ${s.campaign.characters.find((c) => c.id === r.id)?.name ?? r.id}`,
      position: r.position,
      radius: 4,
      kind: "resident" as const,
    })),
  ];
}
export function regionCommand(
  input: RegionState,
  cmd: RegionCommand,
  base: Collider[] = [],
): { state: RegionState; ok: boolean; reason?: string } {
  const s = structuredClone(input),
    colliders = [...base, ...regionColliders(s)],
    near = (p: Point, r = 4) => distance(s.wildlife.player, p) <= r,
    fail = (reason: string) => ({ state: input, ok: false, reason });
  if (cmd.type === "wildlife") {
    if (s.vehicle.occupied && cmd.command.type === "move")
      return fail("Park before exploring on foot.");
    const result = wildlifeCommand(
      s.wildlife,
      cmd.command,
      [...colliders, ...parkedVehicleColliders(s)],
      REGION_BOUNDS,
    );
    if (!result.ok) return fail(result.reason ?? "Try from closer by.");
    s.wildlife = result.state;
    return { state: s, ok: true };
  }
  if (cmd.type === "enter") {
    if (
      s.vehicle.occupied ||
      !near(s.vehicle.position, 3.5) ||
      !clearSegment(
        s.wildlife.player,
        s.vehicle.position,
        colliders,
        REGION_BOUNDS,
      ) ||
      s.assistance.status === "escorting"
    )
      return fail(
        "Meet the vehicle on foot. Finish escorting your neighbor first.",
      );
    s.vehicle.occupied = true;
    s.wildlife.path = [];
    s.wildlife.selected = null;
    s.wildlife.companionPath = [];
  } else if (cmd.type === "exit") {
    if (!s.vehicle.occupied || Math.abs(s.vehicle.speed) > 0.5)
      return fail("Brake to a stop first.");
    const p = safeExit(s.vehicle, [
      ...colliders,
      ...parkedVehicleColliders({
        ...s,
        vehicle: { ...s.vehicle, occupied: false },
      }),
    ]);
    if (!p) return fail("No safe exit here. Move into an open space.");
    s.vehicle.occupied = false;
    s.vehicle.target = null;
    s.vehicle.speed = 0;
    s.wildlife.player = p;
    s.wildlife.path = [];
    s.wildlife.companionPosition = { ...p };
    s.wildlife.companionPath = [];
  } else if (cmd.type === "recover") {
    if (!s.vehicle.occupied)
      return fail("Enter your vehicle before recovering it.");
    const recovered = recoverVehicle(s.vehicle, colliders);
    if (!recovered)
      return fail(
        "No clear roadside recovery point nearby. Reverse into open space.",
      );
    s.vehicle = recovered;
    record(
      s,
      "recover",
      "player",
      "Coast Runner recovered to a clear nearby road position.",
    );
  } else if (cmd.type === "driveTarget") {
    if (!s.vehicle.occupied) return fail("Enter your vehicle first.");
    if (!Number.isFinite(cmd.point.x) || !Number.isFinite(cmd.point.z))
      return fail("Choose a road destination.");
    s.vehicle.target = { ...cmd.point };
  } else if (cmd.type === "waypoint") {
    s.waypoint =
      cmd.point && Number.isFinite(cmd.point.x) && Number.isFinite(cmd.point.z)
        ? { ...cmd.point }
        : null;
  } else if (cmd.type === "talk") {
    const r = s.residents.find((r) => r.id === cmd.id);
    if (!r || !near(r.position, 5))
      return fail("Approach them before speaking.");
    record(s, "conversation", cmd.id, cmd.text.slice(0, 500), [
      `Conversation mode: ${cmd.mode}`,
    ]);
  } else if (cmd.type === "acceptDelivery") {
    if (
      !near(P.dispatch, 5) ||
      !["available", "abandoned"].includes(s.delivery.status)
    )
      return fail("Meet Inez at harbor dispatch for an available job.");
    const c = s.campaign.characters.find((c) => c.id === "inez")!;
    s.delivery = {
      status: "accepted",
      goods: 8,
      reward: 300 + (c.trust >= 60 ? 100 : 0) + (s.upgrades.workbench ? 50 : 0),
      promised: !!cmd.promise,
    };
    const id = record(
      s,
      "delivery-accepted",
      "inez",
      cmd.promise
        ? "You promised Inez to bring eight crates home."
        : "You accepted eight crates for your warehouse.",
      [`Reward $${s.delivery.reward}`],
    );
    if (cmd.promise)
      s.campaign.commitments.push({
        id: `region-delivery-${s.nextEvent}`,
        characterId: "inez",
        resource: "food",
        amount: 8,
        delivered: 0,
        dueHour: s.campaign.hour + 72,
        status: "pending",
        eventId: id,
      });
  } else if (cmd.type === "abandonDelivery") {
    if (!["accepted", "loaded"].includes(s.delivery.status))
      return fail("No active delivery.");
    s.delivery.status = "abandoned";
    s.vehicle.cargo = 0;
    for (const c of s.campaign.commitments)
      if (c.id.startsWith("region-delivery-") && c.status === "pending")
        c.status = "broken";
    record(
      s,
      "delivery-abandoned",
      "inez",
      "The delivery was cancelled; unclaimed cargo returned to dispatch.",
      [],
      s.delivery.promised ? -8 : 0,
    );
  } else if (cmd.type === "interact") {
    const target = regionInteractions(s).find((i) => i.id === cmd.id);
    if (!target || !near(target.position, target.radius) || s.vehicle.occupied)
      return fail("Park and approach the interaction.");
    switch (cmd.id) {
      case "cargo":
        if (
          s.delivery.status !== "accepted" ||
          distance(s.vehicle.position, P.cargo) > 7 ||
          Math.abs(s.vehicle.speed) > 0.1
        )
          return fail(
            "Accept the delivery and park your vehicle beside the crates.",
          );
        s.vehicle.cargo = 8;
        s.delivery.status = "loaded";
        record(
          s,
          "cargo-loaded",
          "inez",
          "Eight crates loaded into your Coast Runner.",
          ["Vehicle capacity 8 crates"],
        );
        break;
      case "home":
        if (s.delivery.status === "loaded") {
          if (distance(s.vehicle.position, P.home) > 9 || s.vehicle.cargo !== 8)
            return fail("Park the loaded vehicle beside the warehouse.");
          s.delivery.status = "complete";
          s.vehicle.cargo = 0;
          s.campaign.inventory.food += 8;
          s.campaign.money += s.delivery.reward;
          for (const c of s.campaign.commitments)
            if (c.id.startsWith("region-delivery-") && c.status === "pending") {
              c.status = "kept";
              c.delivered = 8;
            }
          record(
            s,
            "delivery-complete",
            "inez",
            "Eight crates arrived at your warehouse. Inez remembers your reliable help.",
            [`Paid $${s.delivery.reward}`],
            s.delivery.promised ? 12 : 7,
          );
        } else if (s.expedition.relic && !s.expedition.complete) {
          s.expedition.complete = true;
          s.campaign.money += 250;
          record(
            s,
            "expedition-complete",
            "sam",
            "The recovered brass lens now belongs at your home base.",
            ["Research grant $250"],
            8,
          );
        } else return fail("Your supplies and creatures are safe here.");
        break;
      case "clue":
        if (s.expedition.clue)
          return fail("The tracks lead toward the old wetland passage.");
        s.expedition.clue = true;
        record(
          s,
          "clue",
          "player",
          "Fresh prints vanish beside a tangled wetland passage.",
        );
        break;
      case "shortcut":
        if (s.expedition.shortcut) return fail("The passage is already open.");
        if (
          !s.expedition.clue ||
          !["brindlefin", "cairnback"].includes(s.wildlife.companion ?? "") ||
          distance(s.wildlife.companionPosition, P.shortcut) > 7
        )
          return fail(
            "Inspect the tracks, then bring a track-finding or strong companion.",
          );
        s.expedition.shortcut = true;
        record(
          s,
          "shortcut",
          "player",
          s.wildlife.companion === "brindlefin"
            ? "Your Brindlefin reveals a dry passage beneath the roots."
            : "Your Cairnback pushes the tangled branches aside.",
        );
        break;
      case "ruin":
        if (!s.expedition.shortcut || s.expedition.relic)
          return fail(
            "Find a companion-assisted passage before recovering the lens.",
          );
        s.expedition.relic = true;
        record(
          s,
          "relic",
          "sam",
          "You recovered the observatory’s brass lens.",
        );
        break;
      case "rescue":
        if (s.assistance.status !== "waiting")
          return fail("Walk with your neighbor to the safe quay.");
        s.assistance.status = "escorting";
        record(
          s,
          "rescue-started",
          "jo",
          "Jo is following. Lead them to the orange life ring on dry ground.",
        );
        break;
      case "upgrade-shelter":
      case "upgrade-workbench": {
        const key = cmd.id === "upgrade-shelter" ? "shelter" : "workbench",
          cost = key === "shelter" ? 500 : 350;
        if (s.upgrades[key] || s.campaign.money < cost)
          return fail("Already built, or insufficient funds.");
        s.campaign.money -= cost;
        s.upgrades[key] = true;
        record(
          s,
          "upgrade",
          "ada",
          `${key === "shelter" ? "Creature shelter" : "Loading bench"} installed at home.`,
          [`Spent $${cost}`],
          3,
        );
        break;
      }
      default:
        return fail("Speak to the resident or choose a mission.");
    }
  }
  return { state: s, ok: true };
}
export function tickRegion(
  input: RegionState,
  delta: number,
  base: Collider[] = [],
  driveInput: DriveInput = { throttle: 0, steer: 0, brake: false },
): RegionState {
  const dt = Math.max(0, Math.min(0.1, Number.isFinite(delta) ? delta : 0));
  if (!dt) return input;
  const colliders = [...base, ...regionColliders(input)];
  const previousTraffic = trafficPositions(input);
  const trafficTime = [0, 1].map((i) => {
    const previous = input.trafficTime?.[i] ?? input.elapsed + i * 22;
    const p = previousTraffic[i].position;
    return (
      previous +
      (distance(p, input.wildlife.player) < 5 ||
      distance(p, input.vehicle.position) < 6 ||
      input.residents.some((r) => distance(p, r.position) < 3)
        ? 0
        : dt)
    );
  }) as [number, number];
  const s = {
    ...input,
    trafficTime,
    elapsed: input.elapsed + dt,
    vehicle: tickVehicle(input.vehicle, driveInput, dt, colliders),
    residents: tickPopulation(input.residents, dt, [
      ...colliders,
      ...parkedVehicleColliders(input),
    ]),
  };
  let wildlife = input.wildlife;
  if (s.vehicle.occupied)
    wildlife = {
      ...wildlife,
      player: { ...s.vehicle.position },
      path: [],
      companionPosition: { ...s.vehicle.position },
      companionPath: [],
    };
  const walkingColliders = [...colliders, ...parkedVehicleColliders(s)];
  s.wildlife = tickWildlife(wildlife, dt, walkingColliders, REGION_BOUNDS);
  if (s.vehicle.occupied) {
    s.wildlife.player = { ...s.vehicle.position };
    s.wildlife.companionPosition = { ...s.vehicle.position };
    s.wildlife.companionPath = [];
    s.wildlife.speed = Math.abs(s.vehicle.speed);
  }
  s.district = districtAt(s.wildlife.player);
  if (!s.discovered.includes(s.district))
    s.discovered = [...s.discovered, s.district];
  for (const [id, p] of Object.entries(P))
    if (distance(s.wildlife.player, p) < 10 && !s.discovered.includes(id))
      s.discovered = [...s.discovered, id];
  if (s.assistance.status === "escorting") {
    s.assistance = { ...s.assistance };
    if (
      distance(s.assistance.position, s.wildlife.player) > 2 &&
      Math.floor(s.elapsed) !== Math.floor(input.elapsed)
    )
      s.assistance.path = findPath(
        s.assistance.position,
        s.wildlife.player,
        walkingColliders,
        REGION_BOUNDS,
      );
    if (distance(s.assistance.position, s.wildlife.player) <= 2)
      s.assistance.path = [];
    Object.assign(
      s.assistance,
      walkPath(
        s.assistance.position,
        s.assistance.path,
        dt * 2,
        walkingColliders,
      ),
    );
    if (distance(s.assistance.position, P.safe) < 4) {
      s.campaign = structuredClone(s.campaign);
      s.assistance.status = "complete";
      s.assistance.path = [];
      s.campaign.money += 180;
      record(
        s,
        "rescue-complete",
        "jo",
        "The dock worker reached the safe quay and stays there.",
        ["Community thanks $180"],
        10,
      );
    }
  }
  s.residents = s.residents.map((r) =>
    r.id === "jo"
      ? { ...r, position: { ...s.assistance.position }, path: [] }
      : r,
  );
  return s;
}
export function validateRegion(value: unknown): value is RegionState {
  try {
    const s = value as RegionState;
    const point = (p: Point) =>
      !!p &&
      Number.isFinite(p.x) &&
      Number.isFinite(p.z) &&
      p.x >= REGION_BOUNDS.minX &&
      p.x <= REGION_BOUNDS.maxX &&
      p.z >= REGION_BOUNDS.minZ &&
      p.z <= REGION_BOUNDS.maxZ;
    const number = (n: number) => Number.isFinite(n) && n >= 0;
    const bool = (b: unknown) => typeof b === "boolean";
    const path = (p: Point[]) =>
      Array.isArray(p) && p.length < 1000 && p.every(point);
    if (
      !s ||
      s.version !== 1 ||
      !validateWildlife(s.wildlife, REGION_BOUNDS) ||
      !validateWorld(s.campaign)
    )
      return false;
    if (
      s.trafficTime &&
      (!Array.isArray(s.trafficTime) ||
        s.trafficTime.length !== 2 ||
        !s.trafficTime.every(number))
    )
      return false;
    const v = s.vehicle;
    if (
      !v ||
      !point(v.position) ||
      !point(v.lastSafe) ||
      !Number.isFinite(v.speed) ||
      Math.abs(v.speed) > 30 ||
      !Number.isFinite(v.yaw) ||
      !Number.isFinite(v.steer) ||
      !number(v.distance) ||
      !number(v.impact) ||
      ![0, 8].includes(v.cargo) ||
      !bool(v.occupied) ||
      !bool(v.owned) ||
      (v.target !== null && !point(v.target))
    )
      return false;
    if (
      !Array.isArray(s.residents) ||
      s.residents.length !== 12 ||
      new Set(s.residents.map((r) => r.id)).size !== 12 ||
      !s.residents.every(
        (r) =>
          s.campaign.characters.some((c) => c.id === r.id) &&
          point(r.position) &&
          point(r.home) &&
          point(r.destination) &&
          path(r.path) &&
          number(r.pause) &&
          Number.isSafeInteger(r.routine) &&
          r.routine >= 0,
      )
    )
      return false;
    if (
      !number(s.elapsed) ||
      !["town", "harbor", "wetlands"].includes(s.district) ||
      !Array.isArray(s.discovered) ||
      s.discovered.length > 100 ||
      !s.discovered.every((x) => typeof x === "string") ||
      (s.waypoint !== null && !point(s.waypoint)) ||
      !Array.isArray(s.events) ||
      s.events.length > 180 ||
      !Number.isSafeInteger(s.nextEvent) ||
      s.nextEvent < 1
    )
      return false;
    if (
      !s.events.every(
        (e) =>
          typeof e.id === "string" &&
          number(e.at) &&
          typeof e.kind === "string" &&
          typeof e.actor === "string" &&
          typeof e.detail === "string" &&
          Array.isArray(e.facts) &&
          e.facts.every((f) => typeof f === "string"),
      )
    )
      return false;
    const regional = s.campaign.events.filter((e) =>
      e.id.startsWith("region-"),
    );
    const validId = (id: string) =>
      /^region-[1-9]\d*$/.test(id) && Number(id.slice(7)) < s.nextEvent;
    if (
      new Set(s.events.map((e) => e.id)).size !== s.events.length ||
      new Set(regional.map((e) => e.id)).size !== regional.length ||
      !s.events.every((e) => validId(e.id)) ||
      !regional.every((e) => validId(e.id))
    )
      return false;
    if (
      !s.events.every((e) =>
        regional.some(
          (c) => c.id === e.id && c.kind === e.kind && c.actor === e.actor,
        ),
      )
    )
      return false;
    const completion = (kind: string) => regional.some((e) => e.kind === kind);
    if (
      completion("delivery-complete") !== (s.delivery.status === "complete") ||
      completion("expedition-complete") !== s.expedition.complete ||
      completion("rescue-complete") !== (s.assistance.status === "complete")
    )
      return false;
    if (
      s.campaign.commitments
        .filter((c) => c.id.startsWith("region-delivery-"))
        .some(
          (c) =>
            !regional.some(
              (e) => e.id === c.eventId && e.kind === "delivery-accepted",
            ),
        )
    )
      return false;
    if (
      !s.delivery ||
      !["available", "accepted", "loaded", "complete", "abandoned"].includes(
        s.delivery.status,
      ) ||
      s.delivery.goods !== 8 ||
      !number(s.delivery.reward) ||
      s.delivery.reward > 450 ||
      !bool(s.delivery.promised) ||
      (s.delivery.status === "loaded") !== (v.cargo === 8)
    )
      return false;
    if (
      !s.assistance ||
      !["waiting", "escorting", "complete"].includes(s.assistance.status) ||
      !point(s.assistance.position) ||
      !path(s.assistance.path)
    )
      return false;
    if (
      !s.expedition ||
      !Object.values(s.expedition).every(bool) ||
      !["clue", "shortcut", "relic", "complete"].every((k) =>
        bool(s.expedition[k as keyof typeof s.expedition]),
      ) ||
      (s.expedition.relic && !s.expedition.shortcut) ||
      (s.expedition.complete && !s.expedition.relic)
    )
      return false;
    return (
      !!s.upgrades && bool(s.upgrades.shelter) && bool(s.upgrades.workbench)
    );
  } catch {
    return false;
  }
}
