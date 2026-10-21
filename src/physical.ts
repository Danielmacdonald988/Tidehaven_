import type {
  Action,
  Point,
  World,
  Resource,
  LocationId,
  Shipment,
} from "./contracts";
import { createWorld } from "./engine";
import {
  PLACES,
  START,
  BOUNDS,
  residentHome,
  routeBetweenLocations,
  pointAtLocation,
} from "./three/shared";
import { emptyInventory } from "./scenario";
export const distance = (a: Point, b: Point) =>
  Math.hypot(a.x - b.x, a.z - b.z);
export function activateSpatial(world: World): World {
  const w = structuredClone(world);
  if (!w.spatial) {
    const place = PLACES.find((p) => p.id === w.location)!;
    w.spatial = {
      player: w.location === "warehouse" ? { ...START } : { ...place.door },
      staged: emptyInventory(),
      carried: emptyInventory(),
      shipments: [],
      elapsedSeconds: 0,
    };
  }
  if (!w.spatial.carried) w.spatial.carried = emptyInventory();
  return w;
}
export function createPhysicalWorld(seed = 42): World {
  return activateSpatial(createWorld(seed));
}
export function physicalLocation(p: Point): LocationId {
  return PLACES.reduce((best, place) =>
    distance(p, place.door) < distance(p, best.door) ? place : best,
  ).id;
}
export function physicalResidentPosition(w: World, id: string): Point {
  const shipments = w.spatial?.shipments.filter((s) => s.workerId === id);
  return shipments?.length
    ? { ...shipments[shipments.length - 1].position }
    : residentHome(w, id);
}
function pointValid(p: Point) {
  return (
    !!p &&
    Number.isFinite(p.x) &&
    Number.isFinite(p.z) &&
    p.x >= BOUNDS.minX &&
    p.x <= BOUNDS.maxX &&
    p.z >= BOUNDS.minZ &&
    p.z <= BOUNDS.maxZ
  );
}
function insideWall(p: Point) {
  return PLACES.filter((b) => b.id !== "harbor").some((b) => {
    const x = Math.abs(p.x - b.center.x),
      z = Math.abs(p.z - b.center.z),
      halfW = b.width / 2,
      halfD = b.depth / 2;
    return (
      x <= halfW + 0.2 &&
      z <= halfD + 0.2 &&
      (x >= halfW - 0.35 || z >= halfD - 0.35) &&
      !(p.z > b.center.z && Math.abs(p.x - b.door.x) < 1.8)
    );
  });
}
export function spatialError(w: World, a: Action): string | undefined {
  if (!w.spatial)
    return ["walk", "advance", "dispatch"].includes(a.kind)
      ? "Physical mode is not active."
      : undefined;
  const s = w.spatial;
  if (a.kind === "travel")
    return "Walk to the destination; map teleportation is disabled.";
  if (a.kind === "walk" || a.kind === "advance") {
    if (!Number.isFinite(a.seconds) || a.seconds! <= 0 || a.seconds! > 5)
      return "Advance between 0 and 5 seconds.";
    if (a.kind === "walk") {
      if (
        !a.position ||
        !pointValid(a.position) ||
        distance(s.player, a.position) > 3.5 * a.seconds! + 0.15
      )
        return "Walking movement exceeds the valid bounds or speed.";
      const segments = Math.max(
        1,
        Math.ceil(distance(s.player, a.position) / 0.15),
      );
      for (let i = 1; i <= segments; i++) {
        const p = {
          x: s.player.x + ((a.position.x - s.player.x) * i) / segments,
          z: s.player.z + ((a.position.z - s.player.z) * i) / segments,
        };
        if (insideWall(p)) return "A building wall blocks that path.";
        if (
          w.hour >= 54 &&
          p.z > 23 &&
          !(s.player.z > 23 && a.position!.z < s.player.z)
        )
          return "Floodwater has closed the harbor approach. Move toward shore to leave the flooded area.";
      }
    }
    return;
  }
  if (a.kind === "wait") return;
  const place = PLACES.find((p) => p.id === w.location)!;
  if (distance(s.player, pointAtLocation(place.id)) > 4)
    return "Move closer to the location before taking this action.";
  if (["talk", "recruit", "promise", "assign"].includes(a.kind) && a.target) {
    if (distance(s.player, physicalResidentPosition(w, a.target)) > 3.5)
      return "Move within speaking distance of this resident.";
    if (
      s.shipments.some((t) => t.workerId === a.target && t.status !== "arrived")
    )
      return "This helper is moving supplies. Speak when they return.";
  }
  if (["transport", "evacuate"].includes(a.kind) && w.hour >= 54)
    return "Floodwater has closed the harbor route.";
}
function route(from: Point, fromId: LocationId, toId: LocationId): Point[] {
  return [{ ...from }, ...routeBetweenLocations(fromId, toId)];
}
export function dispatchShipment(w: World, a: Action): string | undefined {
  const s = w.spatial!,
    worker = w.characters.find((c) => c.id === a.target);
  if (
    a.kind !== "resident_act" &&
    !["warehouse", "market"].includes(w.location)
  )
    return "Dispatch supplies from the warehouse or market.";
  if (!worker?.recruited)
    return "Recruit this helper before assigning a shipment.";
  if (
    s.shipments.some((t) => t.workerId === worker.id && t.status !== "arrived")
  )
    return "This helper already has an active shipment.";
  if (
    !a.resource ||
    !Object.hasOwn(s.staged, a.resource) ||
    !Number.isInteger(a.amount) ||
    a.amount! <= 0 ||
    a.amount! > 10 ||
    s.staged[a.resource] < a.amount!
  )
    return "Choose up to 10 units of staged supplies.";
  const start = physicalResidentPosition(w, worker.id);
  const previous = s.shipments.some((t) => t.workerId === worker.id);
  const outbound = route(
    start,
    previous ? "warehouse" : worker.location,
    "market",
  );
  const inbound = route(pointAtLocation("market"), "market", "warehouse");
  const path = [...outbound, ...inbound.slice(1)];
  s.staged[a.resource] -= a.amount!;
  s.shipments.push({
    id: `shipment-${a.id}`,
    resource: a.resource,
    amount: a.amount!,
    workerId: worker.id,
    status: "collecting",
    position: { ...start },
    progress: 0,
    route: path,
    waypoint: 1,
    collectionIndex: outbound.length - 1,
  });
  worker.status = `Collecting ${a.amount} ${a.resource} at Salt Market`;
  return;
}
export function advanceShipments(w: World, seconds: number): Shipment[] {
  const s = w.spatial!;
  s.elapsedSeconds += seconds;
  const arrivals: Shipment[] = [];
  for (const shipment of s.shipments) {
    if (shipment.status === "arrived") continue;
    let movement = seconds * 2;
    while (movement > 0 && shipment.waypoint < shipment.route.length) {
      const next = shipment.route[shipment.waypoint],
        d = distance(shipment.position, next);
      if (d <= movement) {
        shipment.position = { ...next };
        movement -= d;
        shipment.waypoint++;
        if (shipment.waypoint > shipment.collectionIndex)
          shipment.status = "carrying";
      } else {
        shipment.position = {
          x:
            shipment.position.x +
            ((next.x - shipment.position.x) * movement) / d,
          z:
            shipment.position.z +
            ((next.z - shipment.position.z) * movement) / d,
        };
        movement = 0;
      }
    }
    let total = 0,
      remaining = 0;
    for (let i = 1; i < shipment.route.length; i++)
      total += distance(shipment.route[i - 1], shipment.route[i]);
    if (shipment.waypoint < shipment.route.length) {
      remaining = distance(
        shipment.position,
        shipment.route[shipment.waypoint],
      );
      for (let i = shipment.waypoint + 1; i < shipment.route.length; i++)
        remaining += distance(shipment.route[i - 1], shipment.route[i]);
    }
    shipment.progress = total ? 1 - remaining / total : 1;
    if (shipment.waypoint === shipment.route.length) {
      shipment.status = "arrived";
      shipment.progress = 1;
      w.inventory[shipment.resource] += shipment.amount;
      const worker = w.characters.find((c) => c.id === shipment.workerId)!;
      worker.location = "warehouse";
      worker.status = `Delivered ${shipment.amount} ${shipment.resource} to the warehouse`;
      arrivals.push(shipment);
    }
  }
  return arrivals;
}
export function shipmentActions(w: World): Action[] {
  if (!w.spatial || !["warehouse", "market"].includes(w.location)) return [];
  const worker = w.characters.find(
    (c) =>
      c.recruited &&
      !w.spatial!.shipments.some(
        (s) => s.workerId === c.id && s.status !== "arrived",
      ),
  );
  if (!worker) return [];
  return (Object.keys(w.spatial.staged) as Resource[])
    .filter((r) => w.spatial!.staged[r] > 0)
    .map((resource) => ({
      id: `dispatch-${resource}`,
      kind: "dispatch",
      target: worker.id,
      resource,
      amount: Math.min(10, w.spatial!.staged[resource]),
      text: `Send ${worker.name.split(" ")[0]} for ${Math.min(10, w.spatial!.staged[resource])} ${resource}`,
    }));
}
