import {
  spatialError,
  physicalLocation,
  dispatchShipment,
  advanceShipments,
  shipmentActions,
} from "./physical";
import type {
  World,
  Action,
  ActionResult,
  CharacterContext,
  Timeline,
  Outcome,
  Resource,
  SimEvent,
} from "./contracts";
import { LOCATIONS } from "./contracts";
import { createCharacters, emptyInventory, PRICES } from "./scenario";
const copy = <T>(x: T): T => JSON.parse(JSON.stringify(x));
function event(
  w: World,
  title: string,
  description: string,
  kind = "world",
  facts: string[] = [],
  constraints: string[] = [],
  effects: string[] = [],
  action?: Action,
): SimEvent {
  const e: SimEvent = {
    id: `e${w.events.length + 1}`,
    hour: w.hour,
    kind,
    title,
    description,
    actor: action?.target || "town",
    facts,
    constraints,
    effects,
    ...(action ? { action: copy(action) } : {}),
  };
  w.events.push(e);
  return e;
}
export function createWorld(seed = 42): World {
  const w: World = {
    version: 1,
    seed,
    rng: seed >>> 0,
    hour: 0,
    location: "warehouse",
    money: 10000,
    inventory: emptyInventory(),
    staff: 0,
    transport: 0,
    evacuated: 0,
    prepared: 0,
    delivered: emptyInventory(),
    characters: createCharacters(),
    commitments: [],
    events: [],
    appliedActions: [],
    flags: {},
    ended: false,
  };
  event(
    w,
    "Seventy-two hours",
    "The hurricane has turned toward Bellwether. You have $10,000, an empty warehouse, and three days. Mara needs medicine; the harbor families need a way uphill.",
    "opening",
    ["Landfall at hour 72", "$10,000 relief budget"],
    [],
    ["Relief effort begins"],
  );
  return w;
}
function remember(
  w: World,
  id: string,
  e: SimEvent,
  text: string,
  tags: string[],
) {
  const c = w.characters.find((c) => c.id === id);
  if (c) {
    c.memories.push({ eventId: e.id, hour: e.hour, text, tags });
    c.knowledge = [...new Set([...c.knowledge, text])];
  }
}
function recruitReason(w: World, id: string): string | undefined {
  if (
    id === "mara" &&
    w.commitments.some((p) => p.status === "broken") &&
    w.delivered.medical < 20
  )
    return "You broke your promise. Bring 20 medical kits in total before I can trust this effort with my time.";
  if (["mara", "luis", "eli"].includes(id) && w.delivered.medical < 10)
    return "I can help once the clinic has 10 medical kits. Patients come first.";
  if (["jo", "theo", "kit"].includes(id) && w.transport === 0)
    return "Arrange transport first. Then I can put my time behind a real route.";
  return undefined;
}
function tick(w: World, hours: number) {
  const before = w.hour;
  w.hour = Math.min(72, w.hour + hours);
  for (const p of w.commitments) {
    if (p.status === "pending" && w.hour >= p.dueHour) {
      p.status = "broken";
      const c = w.characters.find((c) => c.id === p.characterId)!;
      c.trust = Math.max(0, c.trust - 25);
      const e = event(
        w,
        "A promise missed",
        `${c.name} waited for ${p.amount} medical kits. The deadline passed; trust is damaged.`,
        "commitment",
        [
          `Promise recorded in ${p.eventId}`,
          `Delivered ${p.delivered}/${p.amount}`,
          `Deadline hour ${p.dueHour}`,
        ],
        ["Pending commitment reached its deadline"],
        ["Trust -25"],
      );
      e.hour = p.dueHour;
      remember(
        w,
        c.id,
        e,
        `You promised ${p.amount} medical kits by hour ${p.dueHour}, but did not deliver them.`,
        ["promise", "broken"],
      );
    }
  }
  const milestones: [number, string, string, string, () => void][] = [
    [
      8,
      "bea",
      "Bread before the rain",
      "Bea walks bread up to the school on her own.",
      () => {
        const bea = w.characters.find((c) => c.id === "bea")!;
        const donation = Math.min(bea.inventory.food, 10 + ((w.rng >>> 8) % 5));
        bea.inventory.food -= donation;
        w.delivered.food += donation;
        bea.location = "heights";
      },
    ],
    [
      16,
      "sam",
      "A voice over the bay",
      "Sam broadcasts the storm warning. Every resident now knows the forecast.",
      () => {
        for (const c of w.characters)
          c.knowledge.push(
            "Sam broadcast a severe hurricane warning at hour 16.",
          );
      },
    ],
    [
      28,
      "noah",
      "The school holds its breath",
      "Noah boards the school windows. Ten more shelter places are usable.",
      () => {
        w.flags.schoolReady = true;
      },
    ],
    [
      40,
      "jo",
      "The last reliable road",
      "Jo checks the harbor road. After hour 54, evacuation fuel use doubles.",
      () => {
        w.flags.roadWarning = true;
      },
    ],
    [
      54,
      "theo",
      "Water over the causeway",
      "Floodwater slows every evacuation. Theo helps six neighbors uphill without waiting for you.",
      () => {
        w.evacuated = Math.min(48, w.evacuated + 6);
      },
    ],
    [
      64,
      "rosa",
      "Doors stay open",
      "Rosa gathers isolated residents into the school. Six more people reach high ground.",
      () => {
        w.evacuated = Math.min(48, w.evacuated + 6);
      },
    ],
  ];
  for (const [at, id, title, desc, effect] of milestones)
    if (before < at && w.hour >= at && !w.flags[`auto${at}`]) {
      w.flags[`auto${at}`] = true;
      effect();
      const c = w.characters.find((c) => c.id === id)!;
      c.status = desc;
      const e = event(
        w,
        title,
        desc,
        "autonomous",
        [
          `Hour ${at} independent planning cycle`,
          `${c.name}'s goal: ${c.goal}`,
        ],
        ["Action uses resident resources; no player authorization needed"],
        [
          at === 8
            ? `Bea stock -${14 - w.characters.find((c) => c.id === "bea")!.inventory.food} food; shelter food received the same amount`
            : at === 54 || at === 64
              ? "Evacuated +6"
              : at === 28
                ? "School shelter reinforced"
                : "Information shared",
        ],
      );
      e.hour = at;
      remember(w, id, e, desc, ["goal", "action"]);
    }
  w.rng = (Math.imul(w.rng, 1664525) + 1013904223) >>> 0;
  if (w.hour === 72) {
    w.ended = true;
    w.outcome = evaluateOutcome(w);
    event(
      w,
      w.outcome.title,
      w.outcome.summary,
      "outcome",
      [
        `Evacuated ${w.evacuated}`,
        `Delivered food ${w.delivered.food}, water ${w.delivered.water}, medical ${w.delivered.medical}`,
        `Prepared ${w.prepared}`,
      ],
      ["Landfall at hour 72"],
      [`Outcome score ${w.outcome.score}`],
    );
  }
}
export function evaluateOutcome(w: World): Outcome {
  const supplied = Math.min(w.delivered.food, w.delivered.water);
  const trust = Math.round(w.characters.reduce((a, c) => a + c.trust, 0) / 12);
  const score = Math.min(
    100,
    Math.round(
      (Math.min(36, w.evacuated) / 36) * 35 +
        (Math.min(60, supplied) / 60) * 25 +
        (Math.min(10, w.delivered.medical) / 10) * 20 +
        w.prepared * 10 +
        (Math.min(4, w.staff) / 4) * 10,
    ),
  );
  return {
    title:
      score >= 80
        ? "A light through the storm"
        : score >= 45
          ? "Some doors stayed open"
          : "The water came too soon",
    summary:
      score >= 80
        ? `Bellwether bends, but holds. ${w.evacuated} people reached high ground; medicine and shelter supplies kept neighbors safe.`
        : score >= 45
          ? `${w.evacuated} people reached high ground. Your effort mattered, but gaps in shelter supplies and preparation left difficult days ahead.`
          : `Only ${w.evacuated} people reached high ground. Unmet needs overwhelmed the response. Rewind a checkpoint to try another strategy.`,
    score,
    evacuated: w.evacuated,
    supplied,
    trust,
  };
}
export function applyAction(world: World, a: Action): ActionResult {
  const fail = (message: string) => ({ ok: false, state: world, message });
  if (
    !a ||
    typeof a !== "object" ||
    Array.isArray(a) ||
    typeof a.id !== "string" ||
    !a.id.trim() ||
    a.id.length > 200 ||
    ![
      "walk",
      "advance",
      "dispatch",
      "load",
      "travel",
      "wait",
      "buy",
      "recruit",
      "promise",
      "deliver",
      "transport",
      "evacuate",
      "talk",
      "prepare",
    ].includes(a.kind)
  )
    return fail("Malformed action.");
  if (world.ended)
    return fail("The storm has arrived. Rewind to make a different choice.");
  if (!a.id || world.appliedActions.includes(a.id))
    return fail(
      "This action has already been recorded or has no transaction ID.",
    );
  const w = copy(world);
  const c = w.characters.find((c) => c.id === a.target);
  const quantity = a.amount ?? 0;
  let hours = 2,
    title = "",
    desc = "",
    effects: string[] = [];
  const facts = [
      `Before action: hour ${w.hour}`,
      `Location: ${w.location}`,
      `Budget: $${w.money}`,
    ],
    constraints: string[] = [];
  if (a.actor && a.actor !== "player")
    return fail("Only the player can submit relief actions.");
  const spatialProblem = spatialError(w, a);
  if (spatialProblem) return fail(spatialProblem);
  if (a.kind === "walk" || a.kind === "advance") {
    if (a.kind === "walk") {
      w.spatial!.player = { ...a.position! };
      w.location = physicalLocation(a.position!);
    }
    const arrivals = advanceShipments(w, a.seconds!);
    w.appliedActions.push(a.id);
    tick(w, a.seconds! / 60);
    for (const shipment of arrivals) {
      const arrived = event(
        w,
        "Supplies arrive at the warehouse",
        `${shipment.amount} ${shipment.resource} carried by ${shipment.workerId} is now available.`,
        "shipment",
        [`Shipment ${shipment.id}`, `Worker ${shipment.workerId}`],
        ["Goods credited only after physical route completed"],
        [`${shipment.resource} +${shipment.amount}`],
      );
      remember(w, shipment.workerId, arrived, arrived.description, [
        "shipment",
      ]);
    }
    return {
      ok: true,
      state: w,
      message: arrivals.length ? "Supplies arrived." : "Town advanced.",
    };
  }
  switch (a.kind) {
    case "load": {
      if (
        !w.spatial ||
        w.location !== "warehouse" ||
        !a.resource ||
        !["food", "water", "medical"].includes(a.resource) ||
        !Number.isInteger(quantity) ||
        quantity <= 0
      )
        return fail("Load supplies at the warehouse.");
      const carried = w.spatial.carried;
      if (Object.values(carried).reduce((sum, n) => sum + n, 0) + quantity > 10)
        return fail(
          "You can carry ten supply units in total. Deliver your current load first.",
        );
      if (w.inventory[a.resource] < quantity)
        return fail("Wait for helpers to deliver this stock to the warehouse.");
      w.inventory[a.resource] -= quantity;
      carried[a.resource] += quantity;
      hours = 0.25;
      title = "Supplies loaded";
      desc = `You lift ${quantity} ${a.resource} from the warehouse. Carry it to its destination.`;
      effects = [
        `Warehouse ${a.resource} -${quantity}`,
        `Carried ${a.resource} +${quantity}`,
      ];
      break;
    }
    case "dispatch": {
      const error = dispatchShipment(w, a);
      if (error) return fail(error);
      hours = 0;
      title = "Helper dispatched";
      desc = `${c!.name} will carry ${quantity} ${a.resource} from Salt Market to the warehouse.`;
      effects = [
        `Staged ${a.resource} -${quantity}`,
        "Shipment reserved; warehouse stock unchanged",
      ];
      break;
    }
    case "travel":
      if (
        !LOCATIONS.some((l) => l.id === a.location) ||
        a.location === w.location
      )
        return fail("Choose another valid location.");
      w.location = a.location!;
      hours = 1;
      title = `Arrived at ${LOCATIONS.find((l) => l.id === a.location)!.name}`;
      desc = "You cross town as preparations continue around you.";
      effects = [`Location → ${a.location}`];
      break;
    case "wait":
      hours = 6;
      title = "Six hours pass";
      desc = "You give the town time to act. The storm keeps coming.";
      break;
    case "buy": {
      if (
        w.location !== "market" ||
        !a.resource ||
        !Object.hasOwn(PRICES, a.resource) ||
        !Number.isInteger(quantity) ||
        quantity <= 0 ||
        quantity > 200
      )
        return fail("Buy a valid quantity at Salt Market.");
      const seller = w.characters.find((c) => c.id === "eli")!;
      const cost = PRICES[a.resource] * quantity;
      if (seller.inventory[a.resource] < quantity)
        return fail("Eli does not have that much stock.");
      if (w.money < cost)
        return fail("The relief budget cannot cover this purchase.");
      w.money -= cost;
      seller.money += cost;
      seller.inventory[a.resource] -= quantity;
      if (w.spatial) w.spatial.staged[a.resource] += quantity;
      else w.inventory[a.resource] += quantity;
      title = `Purchased ${quantity} ${a.resource}`;
      desc = w.spatial
        ? `Eli stages ${quantity} ${a.resource} at Salt Market. Assign a helper to carry it to the warehouse. $${cost} changes hands.`
        : `Eli counts the stock into your relief reserve. $${cost} changes hands.`;
      constraints.push("Seller stock and player funds checked");
      effects = [
        `Money -$${cost}`,
        `${w.spatial ? "Market staged " : ""}${a.resource} +${quantity}`,
      ];
      break;
    }
    case "recruit": {
      if (!c || c.location !== w.location)
        return fail("Speak with a resident at this location.");
      if (c.recruited) return fail("This resident is already helping.");
      const reason = recruitReason(w, c.id);
      title = reason
        ? `${c.name} sets a condition`
        : `${c.name} joins the effort`;
      desc =
        reason || `${c.name} commits their time to the warehouse relief crew.`;
      if (!reason) {
        c.recruited = true;
        c.trust = Math.min(100, c.trust + 5);
        c.status = "Working with your relief crew";
        w.staff++;
        effects = ["Staff +1", "Trust +5"];
      } else constraints.push(reason);
      break;
    }
    case "promise":
      if (
        w.location !== "clinic" ||
        a.target !== "mara" ||
        w.hour >= 24 ||
        w.commitments.length
      )
        return fail("Mara can accept one medicine promise before hour 24.");
      title = "Your word to Mara";
      desc = "You promise Mara 10 medical kits at the clinic by hour 24.";
      w.commitments.push({
        id: `p${w.commitments.length + 1}`,
        characterId: "mara",
        resource: "medical",
        amount: 10,
        delivered: 0,
        dueHour: 24,
        status: "pending",
        eventId: `e${w.events.length + 1}`,
      });
      effects = ["Medicine commitment recorded: 10 kits by hour 24"];
      break;
    case "deliver": {
      if (
        !a.resource ||
        !["food", "water", "medical"].includes(a.resource) ||
        !Number.isInteger(quantity) ||
        quantity <= 0
      )
        return fail("Choose a positive supply quantity.");
      if (
        (a.resource === "medical" && w.location !== "clinic") ||
        (a.resource !== "medical" && w.location !== "heights")
      )
        return fail(
          "Medicine goes to the clinic; food and water go to Cypress Heights.",
        );
      const deliveryStock = w.spatial ? w.spatial.carried : w.inventory;
      if (deliveryStock[a.resource] < quantity)
        return fail(
          w.spatial
            ? "You must load these supplies at the warehouse and carry them here."
            : "Your reserve does not contain enough supplies.",
        );
      if (quantity > 20 && w.staff < 1)
        return fail(
          "Recruit at least one helper for deliveries larger than 20 units.",
        );
      deliveryStock[a.resource] -= quantity;
      w.delivered[a.resource] += quantity;
      title = `Delivered ${quantity} ${a.resource}`;
      desc = `The supplies are now in the hands of ${a.resource === "medical" ? "the clinic" : "the shelter"}.`;
      effects = [
        `Reserve ${a.resource} -${quantity}`,
        `Delivered ${a.resource} +${quantity}`,
      ];
      break;
    }
    case "transport":
      if (w.location !== "harbor" || w.transport > 0 || w.money < 1800)
        return fail(
          "At the harbor, $1,800 secures the one available truck and driver.",
        );
      w.money -= 1800;
      w.transport = 12;
      hours = 3;
      title = "A route to high ground";
      desc =
        "Jo secures a truck and driver: twelve seats each trip. Each evacuation uses four fuel, or eight after hour 54.";
      effects = ["Money -$1800", "Transport capacity +12"];
      break;
    case "evacuate": {
      const fuel = w.hour >= 54 ? 8 : 4;
      if (
        w.location !== "harbor" ||
        w.transport < 1 ||
        w.staff < 2 ||
        w.inventory.fuel < fuel
      )
        return fail(
          `Evacuation needs the harbor, transport, two helpers, and ${fuel} fuel.`,
        );
      if (w.evacuated >= 48)
        return fail("All 48 floodplain residents have reached high ground.");
      const n = Math.min(12, 48 - w.evacuated);
      w.evacuated += n;
      w.inventory.fuel -= fuel;
      hours = 4;
      title = `${n} neighbors reach high ground`;
      desc =
        "Your crew checks each household, loads the truck, and reunites families at the school.";
      constraints.push("Transport capacity 12; two helpers required");
      effects = [`Evacuated +${n}`, `Fuel -${fuel}`];
      break;
    }
    case "prepare":
      if (
        w.location !== "warehouse" ||
        w.prepared ||
        w.money < 800 ||
        w.staff < 2
      )
        return fail("Prepare the warehouse once, with two helpers and $800.");
      w.money -= 800;
      w.prepared = 1;
      hours = 4;
      title = "A warehouse becomes a refuge";
      desc =
        "Your crew seals the roof, raises the supplies, and creates a dry place to coordinate relief.";
      effects = ["Money -$800", "Warehouse stormproofed"];
      break;
    case "talk":
      if (!c || c.location !== w.location)
        return fail("Choose a resident at your location.");
      hours = 1;
      title = `A moment with ${c.name}`;
      desc = a.text
        ? String(a.text).slice(0, 4000)
        : `${c.goal} ${c.privateFacts[0]}`;
      effects = ["Conversation recorded; dialogue does not mutate resources"];
      break;
    default:
      return fail("Unknown action.");
  }
  if (a.kind !== "wait" && w.hour + hours > 72)
    return fail(
      "There is not enough time to finish this action before landfall.",
    );
  w.appliedActions.push(a.id);
  const e = event(w, title, desc, a.kind, facts, constraints, effects, a);
  if (c && a.kind === "talk") {
    c.memories.push({
      eventId: e.id,
      hour: w.hour,
      text: `Conversation transcript (unverified speech): ${desc}`,
      tags: ["conversation"],
    });
  } else if (c)
    remember(
      w,
      c.id,
      e,
      a.kind === "promise" ? "You promised 10 medical kits by hour 24." : desc,
      [a.kind],
    );
  if (a.kind === "deliver" && a.resource === "medical") {
    for (const p of w.commitments)
      if (p.status === "pending") {
        p.delivered += quantity;
        if (p.delivered >= p.amount && w.hour + hours <= p.dueHour) {
          p.status = "kept";
          const mara = w.characters.find((c) => c.id === p.characterId)!;
          mara.trust = Math.min(100, mara.trust + 25);
          const kept = event(
            w,
            "Mara remembers your word",
            "“Ten kits, before the deadline. You did what you said. I can put my people behind you now.”",
            "commitment",
            [`Source promise: ${p.eventId}`, `Delivery: ${e.id}`],
            ["10 kits delivered before hour 24"],
            ["Mara trust +25", "Clinic crew recruitment unlocked"],
          );
          kept.hour = w.hour + hours;
          remember(
            w,
            "mara",
            kept,
            "You kept your promise: 10 medical kits by hour 24.",
            ["promise", "kept"],
          );
        }
      }
  }
  tick(w, hours);
  return { ok: true, state: w, message: desc };
}
export function getAvailableActions(w: World, characterId?: string): Action[] {
  if (w.ended) return [];
  const actions: Action[] = [];
  const add = (
    kind: Action["kind"],
    text: string,
    extra: Partial<Action> = {},
  ) =>
    actions.push({
      id: `offer-${kind}-${actions.length}`,
      kind,
      text,
      ...extra,
    });
  if (characterId) {
    const c = w.characters.find((c) => c.id === characterId);
    if (!c || c.location !== w.location) return [];
    add("talk", `Ask ${c.name.split(" ")[0]} what matters`, { target: c.id });
    if (!c.recruited)
      add("recruit", "Ask them to join your relief crew", { target: c.id });
    if (c.id === "mara" && w.hour < 24 && !w.commitments.length)
      add("promise", "Promise 10 medical kits by hour 24", { target: "mara" });
    const logistics = getAvailableActions(w).filter((a) =>
      [
        "buy",
        "transport",
        "evacuate",
        "deliver",
        "prepare",
        "dispatch",
        "load",
      ].includes(a.kind),
    );
    actions.push(
      ...logistics.map((a, i) => ({ ...a, id: `offer-logistics-${i}` })),
    );
    return actions;
  }
  for (const l of LOCATIONS)
    if (!w.spatial && l.id !== w.location)
      add("travel", `Visit ${l.name}`, { location: l.id });
  if (w.location === "market") {
    for (const [resource, amount] of [
      ["medical", 10],
      ["food", 30],
      ["water", 30],
      ["fuel", 12],
    ] as [Resource, number][])
      add("buy", `Buy ${amount} ${resource} · $${PRICES[resource] * amount}`, {
        resource,
        amount,
      });
  }
  if (w.location === "clinic")
    add("deliver", "Deliver 10 medical kits", {
      resource: "medical",
      amount: 10,
    });
  if (w.location === "heights")
    for (const resource of ["food", "water"] as Resource[])
      add("deliver", `Deliver ${w.spatial ? 10 : 30} ${resource}`, {
        resource,
        amount: w.spatial ? 10 : 30,
      });
  if (w.location === "harbor") {
    if (!w.transport) add("transport", "Hire truck & driver · $1,800");
    add("evacuate", `Evacuate 12 residents · ${w.hour >= 54 ? 8 : 4} fuel`);
  }
  if (w.location === "warehouse" && !w.prepared)
    add("prepare", "Stormproof warehouse · $800");
  if (w.spatial && w.location === "warehouse")
    for (const resource of ["medical", "food", "water"] as Resource[])
      if (w.inventory[resource] > 0)
        add(
          "load",
          `Load ${Math.min(10, w.inventory[resource])} ${resource} for delivery`,
          { resource, amount: Math.min(10, w.inventory[resource]) },
        );
  actions.push(...shipmentActions(w));
  add("wait", "Let six hours pass");
  return actions;
}
export function getCharacterContext(w: World, id: string): CharacterContext {
  const c = w.characters.find((c) => c.id === id);
  if (!c) throw Error("Unknown character");
  return {
    name: c.name,
    role: c.role,
    motivation: c.motivation,
    style: c.style,
    hour: w.hour,
    trust: c.trust,
    knowledge: [
      ...c.knowledge.slice(-12),
      ...c.privateFacts.map((f) => `Your private knowledge: ${f}`),
    ],
    memories: c.memories.slice(-6),
    publicFacts: [
      ...(recruitReason(w, id)
        ? [`Recruitment condition: ${recruitReason(w, id)}`]
        : ["Ready to join your crew if asked."]),
      `Storm arrives at hour 72. Current hour ${Number(w.hour.toFixed(1))}.`,
      `Relief effort has ${w.staff} helpers and ${w.transport} transport seats.`,
      `Relief reserve: food ${w.inventory.food}, water ${w.inventory.water}, medical ${w.inventory.medical}, fuel ${w.inventory.fuel}. Budget $${w.money}.`,
      ...(w.spatial
        ? [
            `Purchased supplies awaiting a helper at market: food ${w.spatial.staged.food}, water ${w.spatial.staged.water}, medical ${w.spatial.staged.medical}, fuel ${w.spatial.staged.fuel}. Supplies enter warehouse inventory only when a shipment arrives. Carried: food ${w.spatial.carried.food}, water ${w.spatial.carried.water}, medical ${w.spatial.carried.medical}. Delivery requires carrying supplies from the warehouse.`,
          ]
        : []),
      ...w.commitments
        .filter((p) => p.characterId === id)
        .map(
          (p) =>
            `Your medicine promise: ${p.status}, ${p.delivered}/${p.amount} by hour ${p.dueHour}.`,
        ),
    ],
    availableActions: getAvailableActions(w, id),
  };
}
export function replayTimeline(t: Timeline): World {
  let state = copy(t.initial);
  for (const step of t.steps) {
    const result = applyAction(state, step.action);
    if (
      !result.ok ||
      JSON.stringify(result.state) !== JSON.stringify(step.state)
    )
      throw Error("Timeline evidence does not match deterministic replay.");
    state = copy(step.state);
  }
  return state;
}

export function actionHours(action: Action): number {
  if (action.kind === "load") return 0.25;
  if (action.kind === "dispatch") return 0;
  if (action.kind === "walk" || action.kind === "advance")
    return (action.seconds || 0) / 60;
  return action.kind === "travel" || action.kind === "talk"
    ? 1
    : action.kind === "wait"
      ? 6
      : action.kind === "transport"
        ? 3
        : action.kind === "evacuate" || action.kind === "prepare"
          ? 4
          : 2;
}
