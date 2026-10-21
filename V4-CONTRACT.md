# AFTERLIGHT 4.0 — The Last Good Road

## Direction

Preserve the small coastal neighborhood, live bounded Responses adapter, authoritative deliveries, promises, checkpoints and classic edition. Replace shallow opening/task repetition with a connected van → clinic/cooperation → shelter/route → storm → aftermath scenario. Target 20–30 minutes, exploration and dialogue never steal deadlines. No secrets touched.

## Ownership (single writer)

- Gameplay agent: src/campaign.ts (new), src/contracts.ts, src/engine.ts, src/physical.ts, src/persistence.ts; tests/campaign.test.ts. Own authoritative project actions, validation, balance, outcomes, save/replay.
- World agent: src/three/Environment.ts, src/three/Residents.ts, src/three/audio.ts, ASSETS.md. Visual storytelling, landmarks, van/obstruction/shelter and state-driven aftermath; no UI/engine edits.
- Intelligence agent: src/intelligence.ts, src/lives.ts, src/scenario.ts, tests/intelligence-v4.test.ts. Deep Inez/Eli/Mara, restrained meaningful initiatives, context/proposal interpretation, preserve live integration. Then independent verification assignment.
- Lead: src/App3D.tsx, src/three/Scene.tsx, src/three/shared.ts, src/three.css, docs, integration tests and browser playthrough. Own complete player experience, fair clock, clear project interaction panel, camera/pause/options.

## Stable contracts

World gains optional campaign?: CampaignState. No existing save invalidation: new campaign opted in through createCampaignWorld()/activateCampaign(world); classic remains unchanged. Old neighborhood saves retain play and can start a new campaign with previous outcome archived.
CampaignState: { version: 1; inspected: boolean; van: 'stranded'|'repaired'|'salvaged'; cooperation: 'none'|'trade'|'shared'; shelter: 'bare'|'cots'|'stocked'; route: 'blocked'|'cleared'; [additional explicit fields only after coordination] }
ActionKind adds 'project'; target is finite known project id. No free-text effects. All project availability and costs generated from current authoritative state and proximity, applied through applyAction with event facts/constraints/effects/memories.
src/campaign.ts exports createCampaignWorld(): World, activateCampaign(w: World): World, getCampaignActions(w: World, station?: string): Action[], getCampaignView(w: World): { chapter: string; title: string; description: string; objectives: {id:string;title:string;detail:string;done:boolean;location:LocationId}[] }, campaignActionHours(action: Action): number.
Project stations/physical interactions (reuse Interaction.kind='supply', ids below; no floating labels): relief-van at (-15,18), shelter-work at (-23,-13), road-debris at (-10,3), market-ledger at (0,-10). Root connects clicks/proximity to campaign actions, world agent creates exact geometry/hit targets. Nearby resident conversations can offer same actions ONLY if engine prerequisites allow.
Project targets reserved: inspect_van, repair_van, salvage_van, market_trade, market_coop, shelter_cots, shelter_stock, clear_route. Add other targets only by coordinating.
Visuals consume optional world.campaign above; no visual delivery without inventory event. Repaired van static repaired pose (do not pretend drivable); salvage cargo removed only committed. Shelter state controls cots/stock, route controls debris; late storm and ended control atmosphere/debris/damage.
Pause/explore are UI preferences: movement and rendering can continue in explore, authoritative walk still records position but clockPaused=true with validated movement seconds; no critical time on dialogue/read/API waits. Action costs always apply and are displayed. Active normal clock target 1h/20sec; project costs and explicit waits account for rest; measure honestly, do not claim duration from estimate.
