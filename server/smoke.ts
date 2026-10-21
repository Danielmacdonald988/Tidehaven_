/** Optional real-provider-to-simulation check; prints metadata, never secrets or raw replies. */
import dotenv from "dotenv";
import { createIntelligence, DEFAULT_MODEL } from "../src/intelligence";
import { activateLives, getDecisionRequests } from "../src/lives";
import { createPhysicalWorld, physicalResidentPosition } from "../src/physical";
import { applyAction } from "../src/engine";
import { routeBetweenLocations } from "../src/three/shared";
import type { Action, Point } from "../src/contracts";
dotenv.config({ path: ".env.local" });
dotenv.config();
if (!process.env.OPENAI_API_KEY?.trim()) {
  console.log(
    "SKIPPED: no project/environment OPENAI_API_KEY. No provider request made.",
  );
} else {
  try {
    const price = (name: string) => {
      const n = Number(process.env[name]);
      return Number.isFinite(n) && n > 0 ? n : undefined;
    };
    const service = createIntelligence({
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
      maxRequests: 1,
      maxTokens: 20000,
      maxUsd: 0.05,
      maxConcurrency: 1,
      inputUsdPerMillion: price("AI_INPUT_USD_PER_MILLION"),
      outputUsdPerMillion: price("AI_OUTPUT_USD_PER_MILLION"),
    });
    let world = activateLives(createPhysicalWorld()),
      sequence = 0;
    function act(action: Omit<Action, "id">) {
      const result = applyAction(world, {
        ...action,
        id: `smoke-${sequence++}`,
      });
      if (!result.ok)
        throw Error("Smoke fixture action failed authoritative validation");
      world = result.state;
    }
    function walk(points: Point[]) {
      for (const target of points) {
        let remaining = Math.hypot(
          target.x - world.spatial!.player.x,
          target.z - world.spatial!.player.z,
        );
        while (remaining > 0.0001) {
          const start = world.spatial!.player,
            step = Math.min(8, remaining),
            seconds = step / 3.2;
          act({
            kind: "walk",
            seconds,
            position: {
              x: start.x + ((target.x - start.x) * step) / remaining,
              z: start.z + ((target.z - start.z) * step) / remaining,
            },
          });
          remaining = Math.hypot(
            target.x - world.spatial!.player.x,
            target.z - world.spatial!.player.z,
          );
        }
      }
    }
    walk(routeBetweenLocations("warehouse", "market"));
    act({ kind: "buy", resource: "medical", amount: 10 });
    walk(routeBetweenLocations("market", "warehouse"));
    walk([physicalResidentPosition(world, "inez")]);
    act({ kind: "assign", target: "inez", resource: "medical", amount: 10 });
    const request = getDecisionRequests(world).find(
      (r) => r.characterId === "inez",
    );
    if (!request) throw Error("No valid assignment decision was generated");
    const result = await service.chat(request);
    if (
      result.mode !== "live" ||
      result.proposal?.kind !== "resident_act" ||
      result.proposal.decision?.source !== "live"
    ) {
      console.log(
        JSON.stringify({
          result: "LIVE_SMOKE_FAILED",
          mode: result.mode,
          error: result.error || "No valid indexed decision",
          usage: result.usage,
        }),
      );
      process.exitCode = 1;
    } else {
      const before = world.inventory.medical;
      act(result.proposal);
      for (
        let i = 0;
        i < 120 && world.spatial!.shipments.some((s) => s.status !== "arrived");
        i++
      )
        act({ kind: "advance", seconds: 5 });
      const state = world.lives!.inez.assignment!.status;
      if (state === "accepted")
        throw Error("Physical shipment did not finish within the smoke limit");
      console.log(
        JSON.stringify({
          result: "LIVE_VERIFIED",
          model: service.status().model,
          successfulLiveRequests: service.status().successfulLiveRequests,
          validatedDecision: result.proposal.decision.choice,
          assignmentStatus: state,
          medicalInventoryBefore: before,
          medicalInventoryAfter: world.inventory.medical,
          shipmentCount: world.spatial!.shipments.length,
          note:
            state === "declined"
              ? "Resident declined; no shipment or free goods created."
              : "Resident pickup reached the warehouse through validated physical advancement.",
          usage: result.usage,
        }),
      );
    }
  } catch {
    console.log(
      "LIVE_SMOKE_FAILED: request or gameplay validation did not complete. No secret or raw provider response was logged.",
    );
    process.exitCode = 1;
  }
}
