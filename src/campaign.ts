import type { Action, World, CampaignState, LocationId } from "./contracts";
import { createWorld } from "./engine";
import { activateSpatial, distance } from "./physical";
import { activateLives } from "./lives";

export const CAMPAIGN_STATIONS = {
  "relief-van": { x: -15, z: 18 },
  "shelter-work": { x: -23, z: -13 },
  "road-debris": { x: -10, z: 3 },
  "market-ledger": { x: 0, z: -10 },
} as const;
const projects: Record<
  string,
  { station: keyof typeof CAMPAIGN_STATIONS; text: string; hours: number }
> = {
  finish_scenario: {
    station: "shelter-work",
    text: "Shelter through landfall · advances to hour 72",
    hours: 0,
  },
  inspect_van: {
    station: "relief-van",
    text: "Inspect the stranded relief van · no time cost",
    hours: 0,
  },
  repair_van: {
    station: "relief-van",
    text: "Repair with Inez · $800 · 4h · saves transport and fuel",
    hours: 4,
  },
  salvage_van: {
    station: "relief-van",
    text: "Salvage ten medical kits · free · 1h · abandon the van",
    hours: 1,
  },
  market_trade: {
    station: "market-ledger",
    text: "Trade 4 reserve fuel for 20 food + 20 water · 1h",
    hours: 1,
  },
  market_coop: {
    station: "market-ledger",
    text: "Show clinic receipt; pool 20 food + 20 water · 1h",
    hours: 1,
  },
  shelter_cots: {
    station: "shelter-work",
    text: "Prepare twenty shelter places · $600 · 1 idle helper · 4h",
    hours: 4,
  },
  shelter_stock: {
    station: "shelter-work",
    text: "Crew stocks shelter · 20 food + 20 water · 2 idle helpers · 4h",
    hours: 4,
  },
  shelter_stock_solo: {
    station: "shelter-work",
    text: "Stock shelter yourself · 20 food + 20 water · 8h",
    hours: 8,
  },
  clear_route: {
    station: "road-debris",
    text: "Clear the inland route · $400 · 1 idle helper · 3h",
    hours: 3,
  },
};
export function activateCampaign(world: World): World {
  const w = activateLives(activateSpatial(world));
  if (!w.campaign)
    w.campaign = {
      version: 1,
      inspected: false,
      van: "stranded",
      cooperation: "none",
      shelter: "bare",
      route: "blocked",
    };
  const inez = w.characters.find((c) => c.id === "inez")!;
  const fact =
    "The stranded van contains ten medical kits; repairing its axle costs $800 and four hours, salvaging the kits takes one hour.";
  if (!inez.knowledge.includes(fact)) inez.knowledge.push(fact);
  return w;
}
export function createCampaignWorld(): World {
  const w = activateCampaign(createWorld());
  w.spatial!.player = { x: -13, z: 18 };
  w.events[0].title = "The last good road";
  w.events[0].description =
    "A relief van has stalled outside your warehouse. Ten medical kits are trapped inside. Inez can repair it, or you can salvage the medicine and find another way to move people.";
  w.events[0].facts.push(
    "Van cargo: 10 medical kits; recoverable fuel: 12 units",
    "The inland route is obstructed; a slower detour remains open until hour 54",
  );
  return w;
}
export function idleHelpers(w: World): number {
  return w.characters.filter(
    (c) =>
      c.recruited &&
      !w.spatial?.shipments.some(
        (s) => s.workerId === c.id && s.status !== "arrived",
      ),
  ).length;
}
export function shelterNeeds(w: World): { food: number; water: number } {
  return {
    food: Math.max(0, 20 - w.delivered.food),
    water: Math.max(0, 20 - w.delivered.water),
  };
}
export function campaignActionHours(a: Action): number {
  return a.target === "finish_scenario"
    ? 0
    : (projects[a.target || ""]?.hours ?? 0);
}
export function campaignError(w: World, a: Action): string | undefined {
  const c = w.campaign,
    p = projects[a.target || ""];
  if (!c || !p) return "Unknown neighborhood project.";
  if (
    !w.spatial ||
    distance(w.spatial.player, CAMPAIGN_STATIONS[p.station]) > 4
  )
    return "Approach this project to inspect or work on it.";
  if (w.hour + p.hours > 72)
    return "There is not enough time to complete this project before landfall.";
  if (a.target === "finish_scenario")
    return w.hour < 54
      ? "Wait until the storm reaches shore at hour 54 before sheltering through landfall."
      : undefined;
  if (a.target === "inspect_van")
    return c.inspected ? "You have already inspected the van." : undefined;
  if (a.target === "repair_van" || a.target === "salvage_van") {
    if (!c.inspected || c.van !== "stranded")
      return "Inspect the stranded van first; its cargo can only be recovered once.";
    if (Object.values(w.spatial.carried).some((n) => n > 0))
      return "Deliver your carried supplies first; the ten medical kits fill your carrying capacity.";
    if (
      a.target === "repair_van" &&
      w.characters.find((c) => c.id === "inez")!.trust < 35
    )
      return "Inez will not entrust the van to this effort while her trust is below 35. Salvage the medicine or find other transport.";
    if (a.target === "repair_van" && w.money < 800)
      return "Repairing the van requires $800 for parts.";
    if (
      a.target === "repair_van" &&
      w.spatial.shipments.some(
        (s) => s.workerId === "inez" && s.status !== "arrived",
      )
    )
      return "Inez must finish her current delivery before repairing the van.";
  }
  if (a.target === "market_trade" || a.target === "market_coop") {
    if (c.cooperation !== "none")
      return "Eli has already contributed his one emergency allotment.";
    const eli = w.characters.find((c) => c.id === "eli")!;
    if (eli.inventory.food < 20 || eli.inventory.water < 20)
      return "The market no longer has twenty food and twenty water available.";
    if (a.target === "market_trade" && w.inventory.fuel < 4)
      return "The generator needs four fuel from your warehouse reserve.";
    if (a.target === "market_coop" && w.delivered.medical < 10)
      return "Eli will pool his stock once the clinic has ten medical kits.";
  }
  if (a.target === "shelter_cots") {
    if (c.shelter !== "bare") return "The shelter already has its cots.";
    if (w.money < 600 || idleHelpers(w) < 1)
      return "Cots and shutters need $600 and one helper who is not carrying a shipment.";
  }
  if (a.target === "shelter_stock" || a.target === "shelter_stock_solo") {
    if (c.shelter !== "cots")
      return "Prepare the cots before stocking the shelter; it only needs stocking once.";
    const need = shelterNeeds(w);
    if (w.inventory.food < need.food || w.inventory.water < need.water)
      return `The shelter still needs ${need.food} food and ${need.water} water from your warehouse. Supplies already delivered and neighbors’ donations count.`;
    if (a.target === "shelter_stock" && idleHelpers(w) < 2)
      return "The quick supply run needs two idle helpers. You can work alone for eight hours instead.";
  }
  if (a.target === "clear_route") {
    if (c.route === "cleared") return "The route is already clear.";
    if (w.hour >= 54)
      return "Floodwater has closed the exposed road; clearing debris will not reopen it.";
    if (w.money < 400 || idleHelpers(w) < 1)
      return "Clearing debris needs $400 and one idle helper.";
  }
}
export function getCampaignOptions(
  w: World,
  station?: string,
): { action: Action; reason?: string }[] {
  if (!w.campaign || w.ended) return [];
  const c = w.campaign;
  return Object.entries(projects)
    .filter(
      ([target, p]) =>
        (!station || p.station === station) &&
        !(target === "inspect_van" && c.inspected) &&
        !(
          ["repair_van", "salvage_van"].includes(target) && c.van !== "stranded"
        ) &&
        !(
          ["market_trade", "market_coop"].includes(target) &&
          c.cooperation !== "none"
        ) &&
        !(target === "shelter_cots" && c.shelter !== "bare") &&
        !(
          ["shelter_stock", "shelter_stock_solo"].includes(target) &&
          c.shelter === "stocked"
        ) &&
        !(target === "clear_route" && c.route === "cleared"),
    )
    .map(([target, p]) => {
      const action: Action = {
        id: `project-${target}`,
        kind: "project",
        target,
        text: ["shelter_stock", "shelter_stock_solo"].includes(target)
          ? `${target === "shelter_stock" ? "Crew stocks shelter" : "Stock shelter yourself"} · ${shelterNeeds(w).food} food + ${shelterNeeds(w).water} water · ${target === "shelter_stock" ? "2 idle helpers · 4h" : "8h"}`
          : p.text,
      };
      return { action, reason: campaignError(w, action) };
    });
}
export function getCampaignActions(w: World, station?: string): Action[] {
  return getCampaignOptions(w, station)
    .filter((o) => !o.reason)
    .map((o) => o.action);
}
/** Mutates only the engine's cloned, validated transaction. Returns explicit audit facts. */
export function commitCampaignProject(
  w: World,
  a: Action,
): { title: string; description: string; effects: string[]; witness?: string } {
  const c = w.campaign!,
    target = a.target!;
  let title = "",
    description = "",
    effects: string[] = [],
    witness: string | undefined;
  const trust = (id: string, amount: number) => {
    const resident = w.characters.find((c) => c.id === id)!;
    resident.trust = Math.min(100, resident.trust + amount);
    witness = id;
    effects.push(`${resident.name} trust +${amount}`);
  };
  if (target === "finish_scenario") {
    title = "Together until the wind falls";
    description =
      "You shelter through the final hours. The preparations already made determine what survives.";
    effects = ["Time advances to landfall"];
  }
  if (target === "inspect_van") {
    c.inspected = true;
    title = "A repair, or a rescue";
    description =
      "The axle can be repaired for $800 and four hours with Inez. Salvaging the ten medical kits takes one hour, but sacrifices this van and its fuel. Both choices put the kits in your hands for Mercy Clinic.";
    effects = ["Van damage and cargo inspected"];
  }
  if (target === "repair_van" || target === "salvage_van") {
    c.van = target === "repair_van" ? "repaired" : "salvaged";
    w.spatial!.carried.medical += 10;
    title =
      c.van === "repaired"
        ? "The engine turns over"
        : "Medicine before machinery";
    description =
      c.van === "repaired"
        ? "You and Inez replace the axle. Ten medical kits are in your pack; twelve fuel are secured in the warehouse. Inez joins the relief crew and the van provides twelve evacuation seats."
        : "You unload ten medical kits into your pack. The damaged van is abandoned. The clinic can be helped now; transport will need another solution.";
    effects = ["Carried medical +10", "Van medical cargo -10"];
    if (c.van === "repaired") {
      w.money -= 800;
      w.inventory.fuel += 12;
      w.transport = Math.max(12, w.transport);
      const i = w.characters.find((c) => c.id === "inez")!;
      if (!i.recruited) {
        i.recruited = true;
        w.staff++;
        effects.push("Staff +1");
      }
      i.status = "Relief mechanic; van repaired";
      effects.push(
        "Money -$800",
        "Warehouse fuel +12",
        "Transport capacity 12",
      );
      trust("inez", 15);
    } else trust("inez", 5);
  }
  if (target === "market_trade" || target === "market_coop") {
    const eli = w.characters.find((c) => c.id === "eli")!;
    c.cooperation = target === "market_trade" ? "trade" : "shared";
    for (const r of ["food", "water"] as const) {
      eli.inventory[r] -= 20;
      w.spatial!.staged[r] += 20;
    }
    if (c.cooperation === "trade") {
      w.inventory.fuel -= 4;
      eli.inventory.fuel += 4;
      effects.push("Warehouse fuel -4", "Eli generator fuel +4");
    }
    trust("eli", c.cooperation === "shared" ? 15 : 5);
    title =
      c.cooperation === "shared"
        ? "A neighborhood, not a queue"
        : "Fuel for the shelves";
    description =
      (c.cooperation === "shared"
        ? `You show Eli the clinic receipt: ${w.delivered.medical} medical kits delivered. `
        : "") +
      "Eli sets aside twenty food and twenty water at Salt Market. Helpers still need to carry the crates to your warehouse.";
    if (c.cooperation === "shared")
      effects.push(
        `Reliable clinic receipt shared with Eli: ${w.delivered.medical} medical delivered`,
      );
    effects.push(
      "Eli stock -20 food, -20 water",
      "Market staged +20 food, +20 water",
    );
  }
  if (target === "shelter_cots") {
    c.shelter = "cots";
    w.money -= 600;
    title = "Twenty places out of the wind";
    description =
      "Your crew secures shutters and assembles twenty dry sleeping places at Cypress Heights. Food and water are still needed.";
    effects = [
      "Money -$600",
      "Shelter cots ready",
      "Twenty dry shelter places prepared",
    ];
    trust("inez", 5);
  }
  if (target === "shelter_stock" || target === "shelter_stock_solo") {
    const need = shelterNeeds(w);
    c.shelter = "stocked";
    for (const r of ["food", "water"] as const) {
      w.inventory[r] -= need[r];
      w.delivered[r] += need[r];
    }
    title = "A shelter that can stay open";
    description =
      "Food and water reach Cypress Heights in a single organized supply run. Twenty neighbors can shelter here without drawing on the clinic.";
    effects = [
      `Warehouse -${need.food} food, -${need.water} water`,
      `Shelter delivered +${need.food} food, +${need.water} water`,
      "Prior deliveries and neighbors’ donations counted toward twenty of each",
    ];
    trust("inez", 10);
  }
  if (target === "clear_route") {
    c.route = "cleared";
    w.money -= 400;
    title = "The inland road opens";
    description =
      "Your crew clears the fallen timber. Evacuations no longer need the two-hour detour or its two extra fuel. Floodwater will still close the harbor at hour 54.";
    effects = ["Money -$400", "Evacuation detour removed"];
    trust("inez", 5);
  }
  return { title, description, effects, witness };
}
export function getCampaignView(w: World): {
  chapter: string;
  title: string;
  description: string;
  objectives: {
    id: string;
    title: string;
    detail: string;
    done: boolean;
    location: LocationId;
  }[];
} {
  const c = w.campaign;
  return {
    chapter: w.ended
      ? "Aftermath"
      : w.hour >= 54
        ? "The storm reaches shore"
        : w.hour >= 32
          ? "The last good road"
          : "Before the rain",
    title: w.ended
      ? w.outcome!.title
      : c?.van === "stranded"
        ? "Ten kits. One broken axle."
        : w.delivered.medical < 10
          ? "Mercy Clinic is waiting"
          : c?.cooperation === "none"
            ? "Give Eli a reason to share"
            : c?.shelter !== "stocked"
              ? "Turn supplies into shelter"
              : w.hour < 54
                ? "Who still needs a way uphill?"
                : "Keep the doors open",
    description: w.ended
      ? w.outcome!.summary
      : c?.van === "stranded"
        ? "Inspect the relief van beside you. Repair it with Inez, or take its medicine and leave the machinery."
        : w.delivered.medical < 10
          ? "Your ten medical kits can keep Mara’s clinic open. Carry them to Mercy Clinic; you do not need to promise first."
          : c?.cooperation === "none"
            ? "Eli can pool food and water now that the clinic is supplied. You can also trade fuel or buy stock outright."
            : c?.shelter !== "stocked"
              ? "Ask helpers to collect the market crates. Prepare cots at Cypress Heights, then organize a supply run from your warehouse."
              : "The harbor closes at hour 54. Evacuate with two idle helpers, fuel and transport; a cleared road saves two hours per trip.",
    objectives: [
      {
        id: "van",
        title: "Recover the stranded medicine",
        detail:
          "Inspect the van by the warehouse. Repair it or salvage its cargo.",
        done: !!c && c.van !== "stranded",
        location: "warehouse",
      },
      {
        id: "clinic",
        title: "Keep Mercy Clinic open",
        detail:
          "Carry ten medical kits to Mara. A promise is optional; its deadline is real.",
        done: w.delivered.medical >= 10,
        location: "clinic",
      },
      {
        id: "market",
        title: "Win Eli’s cooperation",
        detail:
          "Help the clinic or trade four fuel; ordinary purchases remain available.",
        done: !!c && c.cooperation !== "none",
        location: "market",
      },
      {
        id: "shelter",
        title: "Make twenty places ready",
        detail:
          "Prepare cots, bring stock to the warehouse, then organize one shelter supply run.",
        done: c?.shelter === "stocked",
        location: "heights",
      },
      {
        id: "route",
        title: "Choose your evacuation route",
        detail:
          "Clear the timber with a helper and $400, or keep the slower detour: two extra fuel and two extra hours per trip.",
        done: c?.route === "cleared",
        location: "warehouse",
      },
      {
        id: "evacuation",
        title: "Bring families off the waterfront",
        detail:
          "Recruit two helpers, secure fuel and transport. Clear the route or pay the slower detour.",
        done: w.evacuated >= 24,
        location: "harbor",
      },
    ],
  };
}
