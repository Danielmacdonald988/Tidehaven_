import type {
  Action,
  ConversationRequest,
  World,
  LocationId,
  SimEvent,
  ResidentLife,
} from "./contracts";
import { getCharacterContext } from "./engine";
import { INITIAL_RELATIONSHIPS } from "./scenario";
import {
  dispatchShipment,
  physicalResidentPosition,
  distance,
} from "./physical";
import { pointAtLocation } from "./three/shared";
const routines: Record<string, string> = {
  mara: "Triage patients at Mercy Clinic; protect medicine access before lending staff.",
  eli: "Count and sell market stock; keep enough goods moving to local families.",
  jo: "Check the harbor route and help move families before the flood.",
  rosa: "Keep the Cypress school shelter open and reunite separated neighbors.",
  sam: "Maintain the radio and verify public storm warnings.",
  inez: "Inspect warehouse tools; take one practical supply run at a time.",
  theo: "Check on the fishing crew; seek high ground when the harbor floods.",
  bea: "Bring her own bread to the school and check the shelter pantry.",
  noah: "Board school windows and check sleeping spaces.",
  ada: "Organize the warehouse crew, then check the shelter if unassigned.",
  luis: "Stay near the clinic patients until medicine and transport are secured.",
  kit: "Carry verified messages from radio house to the school when the storm closes in.",
};
export function activateLives(world: World): World {
  const w = structuredClone(world);
  const migrating = !w.lives;
  if (!w.lives) w.lives = {};
  for (const c of w.characters) {
    if (migrating) c.relationships = { ...INITIAL_RELATIONSHIPS[c.id] };
    delete c.relationships[c.id];
  }
  for (const c of w.characters)
    if (!w.lives[c.id])
      w.lives[c.id] = {
        routine: routines[c.id] || c.goal,
        lastDecisionHour: -8,
        handledTriggers: [],
      };
  return w;
}
export function routineDescription(w: World, id: string): string {
  return w.lives?.[id]?.routine || routines[id] || "Prepare for the storm.";
}
export function residentConstraint(w: World, id: string): string | undefined {
  const c = w.characters.find((c) => c.id === id)!;
  if (c.trust < 35) return "Trust is too low to accept another task.";
  if (["mara", "luis", "eli"].includes(id) && w.delivered.medical < 10)
    return "The clinic needs 10 medical kits before this resident can leave their work.";
  if (
    id === "mara" &&
    w.commitments.some((p) => p.status === "broken") &&
    w.delivered.medical < 20
  )
    return "The broken medicine promise must be repaired with 20 kits before Mara can help.";
  if (["jo", "theo", "kit"].includes(id) && !w.transport)
    return "Arrange a real transport route before asking this resident to leave their post.";
}
function busy(w: World, id: string) {
  return !!w.spatial?.shipments.some(
    (s) => s.workerId === id && s.status !== "arrived",
  );
}
function trigger(w: World, id: string): string | undefined {
  const life = w.lives?.[id],
    c = w.characters.find((c) => c.id === id);
  if (!life || !c || busy(w, id) || w.ended) return;
  const assignment = life.assignment;
  if (assignment?.status === "pending") return `assignment:${assignment.id}`;
  if (w.hour - life.lastDecisionHour < 2) return;
  const eventMemory = [...c.memories]
    .reverse()
    .find(
      (m) =>
        !m.tags.includes("conversation") &&
        !m.tags.includes("decision") &&
        !life.handledTriggers.includes(`event:${m.eventId}`),
    );
  if (eventMemory) return `event:${eventMemory.eventId}`;
  const routine = `routine:${id}:${Math.floor(w.hour / 8)}`;
  if (
    w.hour - life.lastDecisionHour >= 8 &&
    !life.handledTriggers.includes(routine)
  )
    return routine;
}
export function residentChoices(w: World, id: string): Action[] {
  const t = trigger(w, id),
    life = w.lives?.[id];
  if (!t || !life) return [];
  const assignment = life.assignment;
  const action = (
    choice: NonNullable<Action["decision"]>["choice"],
    summary: string,
    extra: Partial<Action> = {},
  ): Action => ({
    id: `choice-${id}-${choice}`,
    kind: "resident_act",
    actor: id,
    target: id,
    text: summary,
    ...extra,
    decision: { triggerId: t, choice, source: "demo", summary },
  });
  if (t.startsWith("assignment:") && assignment) {
    const choices: Action[] = [];
    if (
      w.spatial &&
      !residentConstraint(w, id) &&
      w.spatial.staged[assignment.resource] >= assignment.amount
    )
      choices.push(
        action(
          "collect",
          `Accept the requested ${assignment.amount} ${assignment.resource} pickup and carry it to the warehouse.`,
          { resource: assignment.resource, amount: assignment.amount },
        ),
      );
    choices.push(
      action(
        "decline",
        residentConstraint(w, id) ||
          `Decline this pickup if it conflicts with your current priorities or no stock remains.`,
      ),
    );
    return choices;
  }
  const choices = [
    action(
      t.startsWith("routine:") ? "routine" : "check_in",
      t.startsWith("routine:")
        ? routineDescription(w, id)
        : "Acknowledge a recorded event and update your local plan.",
    ),
  ];
  if (t.startsWith("routine:"))
    choices.push(
      action(
        "check_in",
        "Stay at your current post for this cycle and acknowledge your existing priorities.",
      ),
    );
  return choices;
}
export function getDecisionRequests(w: World): ConversationRequest[] {
  if (!w.lives || w.ended) return [];
  return w.characters
    .map((c) => ({ c, choices: residentChoices(w, c.id) }))
    .filter((x) => x.choices.length)
    .sort(
      (a, b) =>
        Number(b.choices[0].decision!.triggerId.startsWith("assignment:")) -
          Number(a.choices[0].decision!.triggerId.startsWith("assignment:")) ||
        w.lives![a.c.id].lastDecisionHour - w.lives![b.c.id].lastDecisionHour,
    )
    .slice(0, 3)
    .map(({ c, choices }) => {
      const context = getCharacterContext(w, c.id);
      context.availableActions = choices;
      context.decisionTrigger = choices[0].decision!.triggerId;
      const assignment = w.lives![c.id].assignment;
      if (assignment?.status === "pending")
        context.publicFacts.push(
          `You were directly asked to collect ${assignment.amount} ${assignment.resource}. Assignment source event ${assignment.eventId}.`,
          ...(residentConstraint(w, c.id)
            ? [residentConstraint(w, c.id)!]
            : []),
        );
      return {
        characterId: c.id,
        purpose: "decision",
        message:
          "Choose one offered action from your own priorities and known evidence. Your words are a brief decision summary, not new world facts.",
        context,
      };
    });
}
export function assignmentError(w: World, a: Action): string | undefined {
  const c = w.characters.find((c) => c.id === a.target);
  if (!w.lives || !w.spatial || !c)
    return "Resident assignments require a living physical world.";
  if (c.location !== w.location) return "Ask this resident in person.";
  if (
    !a.resource ||
    !Object.hasOwn(w.spatial.staged, a.resource) ||
    !Number.isInteger(a.amount) ||
    a.amount! < 1 ||
    a.amount! > 10
  )
    return "Request a pickup of one to ten real supply units.";
  if (w.spatial.staged[a.resource] < a.amount!)
    return "Buy these supplies at the market before requesting pickup.";
  if (
    busy(w, c.id) ||
    ["pending", "accepted"].includes(w.lives[c.id].assignment?.status || "")
  )
    return "This resident already has an active task.";
}
export function applyResidentChoice(
  w: World,
  a: Action,
): {
  error?: string;
  title?: string;
  description?: string;
  facts?: string[];
  effects?: string[];
  constraints?: string[];
} {
  const d = a.decision;
  if (
    !d ||
    !["live", "demo", "fallback"].includes(d.source) ||
    typeof d.summary !== "string" ||
    d.summary.length > 4000 ||
    a.actor !== a.target
  )
    return { error: "Malformed resident decision." };
  const c = w.characters.find((c) => c.id === a.actor),
    life = c && w.lives?.[c.id];
  if (!c || !life) return { error: "Unknown resident decision." };
  const allowed = residentChoices(w, c.id).find(
    (candidate) =>
      candidate.decision!.triggerId === d.triggerId &&
      candidate.decision!.choice === d.choice &&
      candidate.resource === a.resource &&
      candidate.amount === a.amount,
  );
  if (!allowed)
    return {
      error: "This decision is stale or violates the current offered actions.",
    };
  const facts = [
      `Decision source: ${d.source}`,
      `Trigger: ${d.triggerId}`,
      `Resident goal: ${c.goal}`,
    ],
    effects: string[] = [];
  const constraints = [
    "Current trigger and exact offered action revalidated",
    "Model summary cannot change resources or knowledge",
  ];
  let title = `${c.name} checks their plan`,
    description = allowed.decision!.summary;
  if (d.choice === "collect") {
    if (!c.recruited) {
      c.recruited = true;
      w.staff++;
      effects.push("Staff +1 by resident agreement");
    }
    const failure = dispatchShipment(w, a);
    if (failure) return { error: failure };
    life.assignment!.status = "accepted";
    title = `${c.name} accepts the pickup`;
    description = `${c.name} starts a real ${a.amount} ${a.resource} shipment from Salt Market to the warehouse.`;
    facts.push(`Assignment source: ${life.assignment!.eventId}`);
    effects.push(
      `Market staged ${a.resource} -${a.amount}`,
      "Shipment reserved; warehouse stock unchanged",
    );
  } else if (d.choice === "decline") {
    life.assignment!.status = "declined";
    title = `${c.name} declines the pickup`;
    description = `The requested task was declined. ${residentConstraint(w, c.id) || "The resident chose to keep their present commitments."}`;
    effects.push("Assignment declined; no stock or money changed");
  } else if (d.choice === "routine") {
    let destination: LocationId | undefined;
    if (!c.recruited && !busy(w, c.id)) {
      if (c.id === "kit" && w.hour >= 24) destination = "heights";
      if (c.id === "ada" && w.hour >= 32) destination = "heights";
      if (c.id === "theo" && w.hour >= 54) destination = "heights";
    }
    if (destination && destination !== c.location) {
      effects.push(`Location ${c.location} → ${destination}`);
      c.location = destination;
    }
    c.status = routineDescription(w, c.id);
    effects.push("Personal routine updated");
  } else effects.push("Known event acknowledged; no economic effects");
  life.lastDecisionHour = w.hour;
  life.handledTriggers.push(d.triggerId);
  life.handledTriggers = life.handledTriggers.slice(-80);
  return { title, description, facts, effects, constraints };
}
export function recordLifeEvent(w: World, e: SimEvent, actor?: string): void {
  if (!w.lives) return;
  const actorLife = actor && w.lives[actor];
  if (actorLife && e.action?.decision) {
    actorLife.initiative = {
      text: e.action.decision.summary.slice(0, 600),
      eventId: e.id,
      source: e.action.decision.source,
    };
  }
  if (["talk", "promise", "resident_decision"].includes(e.kind)) return;
  for (const c of w.characters) {
    if (
      c.id === actor ||
      c.location !== (e.kind === "shipment" ? "warehouse" : w.location) ||
      busy(w, c.id)
    )
      continue;
    if (
      w.spatial &&
      distance(
        physicalResidentPosition(w, c.id),
        e.kind === "shipment" ? pointAtLocation("warehouse") : w.spatial.player,
      ) > 6
    )
      continue;
    const text = `Witnessed ${e.title}: ${e.effects.join("; ") || e.description}`;
    c.knowledge.push(text);
    c.knowledge = c.knowledge.slice(-40);
    c.memories.push({
      eventId: e.id,
      hour: e.hour,
      text,
      tags: ["witnessed", e.kind],
    });
  }
}
export function completeAssignment(
  w: World,
  workerId: string,
  e: SimEvent,
): void {
  const life = w.lives?.[workerId];
  if (life?.assignment?.status === "accepted") {
    life.assignment.status = "complete";
    const c = w.characters.find((c) => c.id === workerId)!;
    c.knowledge.push(
      `Completed your requested ${life.assignment.amount} ${life.assignment.resource} pickup. Source event ${e.id}.`,
    );
    c.memories.push({
      eventId: e.id,
      hour: e.hour,
      text: `I collected and delivered the ${life.assignment.amount} ${life.assignment.resource} you requested.`,
      tags: ["assignment", "shipment", "complete"],
    });
    life.initiative = {
      text: `I brought the ${life.assignment.amount} ${life.assignment.resource} you asked for. It is inside the warehouse now.`,
      eventId: e.id,
      source: life.initiative?.source || "demo",
    };
  }
}
