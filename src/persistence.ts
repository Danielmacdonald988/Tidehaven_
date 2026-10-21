import type { World, Checkpoint, Timeline } from "./contracts";
const resources = ["food", "water", "medical", "fuel"];
const locations = [
  "warehouse",
  "market",
  "clinic",
  "harbor",
  "heights",
  "radio",
];
const record = (x: unknown): x is Record<string, any> =>
  !!x && typeof x === "object" && !Array.isArray(x);
const nonnegative = (x: unknown) =>
  typeof x === "number" && Number.isFinite(x) && x >= 0;
const inventory = (x: unknown) =>
  record(x) && resources.every((k) => nonnegative(x[k]));
/** Local saves are untrusted input. Reject malformed state before it reaches the engine. */
export function validateWorld(x: unknown): x is World {
  if (
    !record(x) ||
    x.version !== 1 ||
    !Number.isInteger(x.seed) ||
    !Number.isInteger(x.rng) ||
    !nonnegative(x.hour) ||
    x.hour > 72 ||
    !locations.includes(x.location)
  )
    return false;
  if (
    !["money", "staff", "transport", "evacuated", "prepared"].every((k) =>
      nonnegative(x[k]),
    ) ||
    !inventory(x.inventory) ||
    !inventory(x.delivered)
  )
    return false;
  if (
    !Array.isArray(x.characters) ||
    x.characters.length !== 12 ||
    new Set(x.characters.map((c: any) => c?.id)).size !== 12
  )
    return false;
  if (
    !x.characters.every(
      (c: any) =>
        record(c) &&
        [
          "id",
          "name",
          "role",
          "motivation",
          "style",
          "goal",
          "status",
          "color",
        ].every((k) => typeof c[k] === "string") &&
        locations.includes(c.location) &&
        nonnegative(c.money) &&
        Number.isFinite(c.trust) &&
        typeof c.recruited === "boolean" &&
        inventory(c.inventory) &&
        record(c.relationships) &&
        Object.values(c.relationships).every(
          (v) => typeof v === "number" && Number.isFinite(v),
        ) &&
        ["privateFacts", "knowledge"].every(
          (k) =>
            Array.isArray(c[k]) &&
            c[k].every((v: any) => typeof v === "string"),
        ) &&
        Array.isArray(c.memories) &&
        c.memories.every(
          (m: any) =>
            record(m) &&
            typeof m.eventId === "string" &&
            typeof m.text === "string" &&
            nonnegative(m.hour) &&
            Array.isArray(m.tags),
        ),
    )
  )
    return false;
  if (
    !Array.isArray(x.events) ||
    !x.events.every(
      (e: any) =>
        record(e) &&
        ["id", "kind", "title", "description", "actor"].every(
          (k) => typeof e[k] === "string",
        ) &&
        nonnegative(e.hour) &&
        ["facts", "constraints", "effects"].every(
          (k) =>
            Array.isArray(e[k]) &&
            e[k].every((v: any) => typeof v === "string"),
        ),
    )
  )
    return false;
  if (
    !Array.isArray(x.commitments) ||
    !x.commitments.every(
      (p: any) =>
        record(p) &&
        typeof p.id === "string" &&
        x.characters.some((c: any) => c.id === p.characterId) &&
        resources.includes(p.resource) &&
        ["amount", "delivered", "dueHour"].every((k) => nonnegative(p[k])) &&
        ["pending", "kept", "broken"].includes(p.status) &&
        typeof p.eventId === "string",
    )
  )
    return false;
  if (x.lives !== undefined) {
    if (
      !record(x.lives) ||
      Object.keys(x.lives).length !== 12 ||
      !x.characters.every((c: any) => record(x.lives[c.id]))
    )
      return false;
    for (const life of Object.values(x.lives) as any[]) {
      if (
        typeof life.routine !== "string" ||
        !Number.isFinite(life.lastDecisionHour) ||
        life.lastDecisionHour < -8 ||
        life.lastDecisionHour > x.hour ||
        !Array.isArray(life.handledTriggers) ||
        life.handledTriggers.length > 80 ||
        !life.handledTriggers.every((t: any) => typeof t === "string") ||
        new Set(life.handledTriggers).size !== life.handledTriggers.length
      )
        return false;
      if (life.assignment !== undefined) {
        const a = life.assignment;
        if (
          !record(a) ||
          typeof a.id !== "string" ||
          !resources.includes(a.resource) ||
          !Number.isInteger(a.amount) ||
          a.amount < 1 ||
          a.amount > 10 ||
          !["pending", "accepted", "declined", "complete"].includes(a.status) ||
          typeof a.eventId !== "string" ||
          !x.events.some((e: any) => e.id === a.eventId)
        )
          return false;
      }
      if (life.initiative !== undefined) {
        const i = life.initiative;
        if (
          !record(i) ||
          typeof i.text !== "string" ||
          typeof i.eventId !== "string" ||
          !["demo", "live", "fallback"].includes(i.source) ||
          !x.events.some((e: any) => e.id === i.eventId)
        )
          return false;
      }
    }
  }
  if (x.spatial !== undefined) {
    const p = (v: any) =>
      record(v) &&
      Number.isFinite(v.x) &&
      Number.isFinite(v.z) &&
      Math.abs(v.x) <= 100 &&
      Math.abs(v.z) <= 100;
    const s = x.spatial;
    if (
      !record(s) ||
      !p(s.player) ||
      !inventory(s.staged) ||
      (s.carried !== undefined &&
        (!inventory(s.carried) ||
          Object.values(s.carried).reduce((a: number, b: any) => a + b, 0) >
            10)) ||
      !nonnegative(s.elapsedSeconds) ||
      !Array.isArray(s.shipments) ||
      s.shipments.length > 10000
    )
      return false;
    const active = new Set<string>();
    const ids = new Set<string>();
    for (const shipment of s.shipments) {
      if (
        !record(shipment) ||
        typeof shipment.id !== "string" ||
        ids.has(shipment.id) ||
        !resources.includes(shipment.resource) ||
        !Number.isInteger(shipment.amount) ||
        shipment.amount < 1 ||
        shipment.amount > 10 ||
        !x.characters.some(
          (c: any) => c.id === shipment.workerId && c.recruited,
        ) ||
        !["collecting", "carrying", "arrived"].includes(shipment.status) ||
        !p(shipment.position) ||
        !nonnegative(shipment.progress) ||
        shipment.progress > 1 ||
        !Array.isArray(shipment.route) ||
        shipment.route.length < 2 ||
        shipment.route.length > 100 ||
        !shipment.route.every(p) ||
        !Number.isInteger(shipment.waypoint) ||
        shipment.waypoint < 1 ||
        shipment.waypoint > shipment.route.length ||
        !Number.isInteger(shipment.collectionIndex) ||
        shipment.collectionIndex < 0 ||
        shipment.collectionIndex >= shipment.route.length
      )
        return false;
      ids.add(shipment.id);
      if (shipment.status !== "arrived") {
        if (active.has(shipment.workerId)) return false;
        active.add(shipment.workerId);
      } else if (
        shipment.progress !== 1 ||
        shipment.waypoint !== shipment.route.length
      )
        return false;
    }
  }
  return (
    Array.isArray(x.appliedActions) &&
    x.appliedActions.every((id: any) => typeof id === "string") &&
    new Set(x.appliedActions).size === x.appliedActions.length &&
    record(x.flags) &&
    Object.values(x.flags).every((v) => typeof v === "boolean") &&
    typeof x.ended === "boolean" &&
    (!x.ended ||
      (record(x.outcome) &&
        typeof x.outcome.title === "string" &&
        typeof x.outcome.summary === "string" &&
        ["score", "evacuated", "supplied", "trust"].every((k) =>
          Number.isFinite(x.outcome[k]),
        )))
  );
}
export function cloneWorld(world: World): World {
  return structuredClone(world);
}
export function makeCheckpoint(world: World, name: string): Checkpoint {
  return {
    id: crypto.randomUUID(),
    name,
    state: cloneWorld(world),
    createdAt: new Date().toISOString(),
  };
}
export function branchFrom(checkpoint: Checkpoint, name: string): Timeline {
  if (!validateWorld(checkpoint.state))
    throw new Error(
      "This checkpoint is damaged or from an incompatible version.",
    );
  return {
    id: crypto.randomUUID(),
    name,
    initial: cloneWorld(checkpoint.state),
    steps: [],
  };
}
export function serializeWorld(world: World): string {
  if (!validateWorld(world)) throw new Error("Cannot save an invalid world.");
  return JSON.stringify({ format: "afterlight", version: 1, world });
}
export function deserializeWorld(serialized: string): World {
  const data: unknown = JSON.parse(serialized);
  if (
    !record(data) ||
    data.format !== "afterlight" ||
    data.version !== 1 ||
    !validateWorld(data.world)
  )
    throw new Error("This save is damaged or from an incompatible version.");
  return cloneWorld(data.world);
}

export interface SavedSession {
  world: World;
  checkpoints: Checkpoint[];
  timeline: Timeline;
  archives: Timeline[];
}
export function validateTimeline(x: unknown): x is Timeline {
  if (
    !record(x) ||
    typeof x.id !== "string" ||
    typeof x.name !== "string" ||
    !validateWorld(x.initial) ||
    !Array.isArray(x.steps) ||
    x.steps.length > 1000
  )
    return false;
  return x.steps.every(
    (s: any) =>
      record(s) &&
      record(s.action) &&
      typeof s.action.id === "string" &&
      typeof s.action.kind === "string" &&
      validateWorld(s.state),
  );
}
export function validateSession(x: unknown): x is SavedSession {
  if (
    !record(x) ||
    !validateWorld(x.world) ||
    !validateTimeline(x.timeline) ||
    !Array.isArray(x.checkpoints) ||
    x.checkpoints.length > 100 ||
    !Array.isArray(x.archives) ||
    x.archives.length > 50
  )
    return false;
  if (
    !x.checkpoints.every(
      (c: any) =>
        record(c) &&
        typeof c.id === "string" &&
        typeof c.name === "string" &&
        typeof c.createdAt === "string" &&
        validateWorld(c.state),
    ) ||
    !x.archives.every(validateTimeline)
  )
    return false;
  const current = x.timeline.steps.at(-1)?.state || x.timeline.initial;
  return JSON.stringify(current) === JSON.stringify(x.world);
}
