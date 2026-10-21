# AFTERLIGHT 4.0 — The Last Good Road

The default experience is now a **playable Three.js neighborhood**. The original simulation, promises, negotiations, outcomes and tests remain underneath it. The previous 2D edition is preserved at `?classic`, with its original browser save untouched.

## Play the new chapter

Launch with `npm run dev` (http://127.0.0.1:5173), or `npm run build && npm start` (http://127.0.0.1:3001). Stop an existing server before starting another on the same port. Existing saves remain intact: select **Play the new chapter** or **Field desk → Checkpoints → Start The Last Good Road** to archive the current response and start the new scenario.

A stranded van puts ten medical kits within reach—but you must choose repair or salvage. Work with Inez, Mara and Eli, secure real supplies, prepare Cypress House, and choose how to get people off the waterfront before hour 54. Shelter through the storm after hour 54, then explore the aftermath. The response plan provides direction without forcing a fixed order.

**Time is fair:** encounters, reading and AI waits pause deadlines. Use **Pause** or Space for a full pause, and **Settings → Exploration-friendly mode** for unhurried movement. Work and waiting still consume their displayed time. Normal active campaign time runs at one hour per 20 seconds. The 20–30-minute duration is a design target; explicit waiting can shorten it.

Live OpenAI was subsequently configured and verified through real requests, including Inez’s repair decision and Eli’s shared-supply agreement. The key remains only in ignored server-side configuration. The earlier release verification sections below are historical records. See [RELEASE-4.md](RELEASE-4.md) for the new rules, improvements and remaining scope.

## Previous 3.0 foundation

The existing OpenAI Responses adapter now powers both conversation and bounded resident decisions when a project credential is configured. Without one, the game explicitly uses **deterministic demo** behavior. Provider failures or exhausted limits display **deterministic fallback**. A configured key is not shown as verified until a structured provider response succeeds.

Try the new interaction: buy ten medical kits at Salt Market, walk to Inez, and type **“Can you collect the ten medical kits I bought while I check on Mara?”** Accept the proposed request, then walk away. The request remains pending until Inez considers it. Acceptance recruits her if eligible and starts a real capacity-limited supply trip; refusal leaves your goods untouched. Return after delivery to hear her sourced recollection. Ask Mara for the same pickup before supplying her patients and her competing responsibilities constrain the answer.

Residents now have distinct priorities, relationships, routines, retrieved event memories and nearby initiatives. A single background decision is dispatched at a time, at least fifteen seconds apart, for pending tasks, known events or eight-hour routine cycles. Model prose never creates facts or inventory. Specialist residents keep their duties; eligible mobile residents may choose to stay or follow their routine. The world advances while the active game is open; the field desk, evidence, replay and hidden tabs pause it.

**Enable real AI securely:** run `npm run setup:ai` in your own project terminal. Paste your OpenAI project key into its hidden input, never chat. It writes only ignored `.env.local` with owner-only permissions. Restart the server afterward. `npm run smoke:ai` then makes at most one real request (a $0.05 local smoke cap) and verifies its chosen action against an actual assignment/delivery fixture. It skips explicitly when no key is present. A refusal is reported as a refusal, not a successful shipment.

Limits live in `.env.example`: requests, tokens, concurrency, output tokens, timeout and conservative USD reservations. Defaults are sixty requests, 100,000 tokens, two concurrent server requests, 400 output tokens and $1 per server process. Counters reset on restart; these are not account-wide billing caps. Set an OpenAI project budget separately if needed. Choosing another model requires its correct input/output rates. Failed requests conservatively consume their reserved allowance.

**3.0 verification:** 84 automated tests pass, including mocked provider-to-shipment integration, failure limits, knowledge boundaries, persistence and exact event evidence. Chrome demo play verified the Inez pickup, independent arrival, recalled completion, Mara’s kept promise, and a 390×844 encounter/evidence layout.

See [AI-AUDIT.md](AI-AUDIT.md) for what was scripted before, what models can now decide, official documentation references, and verification boundaries. At the original 3.0 checkpoint no credential was available. The 4.0 verification above supersedes that limitation; real upstream requests now work.

## Start the 3D build

```sh
npm install
npm run dev
```

Open **http://127.0.0.1:5173**. For production, stop dev first, then `npm run build && npm start` and open **http://127.0.0.1:3001**. Both modes work without an API key. Node.js 22+ is recommended.

## The first physical relief run

1. **Recruit Inez.** Click the mechanic in the warehouse doorway. Your character walks into speaking distance; ask her to join.
2. **Give Mara your word.** Use **Explore the neighborhood → Walk to Mercy Clinic**, meet Mara, and promise ten medical kits by simulation hour 24.
3. **Negotiate at Salt Market.** Walk to the store, meet Eli, and ask to buy medical kits. Accept the proposal. Your money and merchant stock change, but the goods remain at the market.
4. **Send your helper.** Choose **Send Inez for 10 medical**. Watch her walk to the store, pick up the crate, and carry it back. Her progress is authoritative; warehouse stock increases only on arrival.
5. **Carry the last mile.** Walk back to the warehouse, load ten medical kits into your pack, then walk to the clinic and deliver them.
6. **Return to the promise.** Ask Mara **Our promise**. She remembers the actual delivery. A missed deadline changes trust and her recruitment conditions.

Click ground to move, click people/doors/supplies to approach, and drag to rotate the camera. Camera buttons provide a mouse-only alternative; WASD is optional. Featured buildings have open interiors and cutaway roofs. Workers and the player carry at most ten units per load. The relief truck retains its twelve-seat capacity.

In 3.0 the active neighborhood advances one simulation hour per 60 seconds, including idle time; deliberate decisions retain their displayed hour costs. Open the field desk or evidence inspector to pause. Background/hidden tabs pause rendering and physical progress. Do not expect offline deliveries.

**Field desk** includes saved checkpoints, preserved branches, event evidence, import/export, and read-only recorded moments. 3D saves use a separate namespace from the original game. Importing a legacy save migrates its world state; retain the original export for its complete legacy timeline. The neighborhood keeps the latest 60 meaningful-event snapshots, not every animation frame. Reload resumes partial shipments.

**Settings** offers High/Low graphics, mute, volume, and live render statistics. Sound is off initially. Procedural surf, wind, and footfalls require unmuting. The hurricane darkens the sky, strengthens waves and palms, adds late rain on High, and closes the exposed harbor after hour 54.

## Art, performance, and boundaries

Original procedural architecture, articulated character models, material textures, signage, and synthesized sound are documented in [ASSETS.md](ASSETS.md). No external model downloads or unlicensed artwork are required. This is a stylized neighborhood, not photorealistic scanned scenery. All six featured locations are enterable; one background cottage is decorative.

Performance targets are **60 FPS High / 30 FPS Low**. The following measurements are from the 2.0 world release; 3.0 performance has not been re-benchmarked. Settings displays rolling 2-second measurements including p95 frame time, draws, triangles and renderer. Production Chrome on **Apple M4 / ANGLE** measured **60 FPS, p95 17.5 ms** at the warehouse: High **2565×1213** render pixels, **828 draws / 126,070 triangles**; Low **1710×809**, **431 draws / 69,546 triangles**. A 390×844 emulated viewport sampled 60 FPS, p95 17.2 ms. These are short, scene-dependent samples, not sustained benchmarks or measurements from a physical phone. Low removes shadows and rain and caps pixel ratio at 1.

Verified in the actual browser: mouse-only recruitment, promise, store negotiation, staged purchase, dispatched collection, reload during transit, visible crate arrival, loading/carrying/delivery, remembered kept promise (trust 75), rewind and remembered broken promise (trust 25), mobile encounters, snapshot inspection, and camera controls. Tests include resource conservation, capacity, replay, promises, knowledge boundaries, API failures and collision-safe route following.

Live AI still uses the existing server-side adapter and bounded, validated proposals. No upstream call has been made without credentials. Storm milestones and resource rules remain authored. In 3.0, optional model decisions choose task acceptance/refusal and bounded routine alternatives; demo mode uses deterministic choices. Vehicles are interactive transport resources but are not drivable; evacuation remains a validated timed action rather than a fully animated passenger sequence. Full cinematic motion replay and mechanic generation are outside this neighborhood milestone.

---

## Original scenario and server reference

**A town worth saving.** A playable coastal relief simulation with twelve persistent residents, three simulated days, and decisions that leave a record.

## Launch

Requires Node.js 22+ and npm. From this directory:

```sh
npm install
npm run dev
```

Open **http://127.0.0.1:5173**. No credentials needed: the complete scenario runs in clearly labeled **deterministic demo** mode. The development API runs on port 3001.

For the production build:

```sh
npm run build
npm start
```

Open **http://127.0.0.1:3001**. Stop the development process before starting production, since both use API port 3001. Servers bind to loopback; nothing is publicly deployed. Browser saves are per origin, so development and production have separate saves. Export/import through **?** to transfer between them.

## Play

You arrive in Bellwether on Mercy Bay with $10,000 and an empty warehouse. Hurricane landfall is at simulation hour 72. Reading and inspecting do not advance time. Travel takes 1 hour, conversation 1 hour, and resource actions display their duration. The intended first playthrough is around 15 minutes; reading pace varies.

Click a map location or resident. On phones, large location controls appear below the map. Meet residents, ask questions, accept a proposed deal, and deliver on it. The buttons under **Make it happen** offer the same authoritative actions as conversations. Failed resource prerequisites explain what is missing without spending time or supplies; a resident's deliberate refusal does consume the displayed conversation/negotiation time.

Aim to evacuate 48 floodplain residents, supply the school with 60 food and 60 water, deliver 10 medical kits to the clinic, and stormproof the warehouse. At least two helpers are needed for evacuation and warehouse work. Three truck trips before the road floods, plus residents' independent rescues, can bring everyone to safety. A less efficient response can still help substantially.

### Six interactions to try

1. **A specific promise:** Visit Mara at Mercy Clinic. Promise 10 medical kits by hour 24, buy them at Salt Market, and return in time to finish the delivery. Ask **Our promises**. If you miss the deadline, Mara remembers and requires 20 medical kits in total before joining.
2. **Different interests:** Ask Ada at the warehouse and Mara at the clinic to join. Ada is ready; Mara protects her patients first. Jo wants transport arranged before volunteering.
3. **A real negotiation:** Ask Eli, “Can I buy water for the shelter?” Accept the proposal: $300 leaves your budget, 30 water enters your reserve, and Eli's stock falls by 30. Dialogue alone never executes a deal.
4. **A town that acts:** While you travel and work, Bea delivers bread from her own stock and moves to the school. Sam broadcasts warnings; others prepare shelter or rescue neighbors. These cycles are authored and deterministic in both modes.
5. **Inspect consequences:** Click the latest town event or **Field notes**, then inspect facts, constraints, and committed effects. Records include source event links for commitments, actual conversation text, and validated actions—not private model reasoning.
6. **Another possible morning:** Save a **Checkpoint** before a hard choice. **Timelines → Branch** preserves the original timeline and starts a new one. Compare safety, money, promises, and final score. Clicking a timeline opens read-only **exact replay** of its recorded snapshots, including recorded dialogue, with no model calls.

Sessions autosave locally. **?** offers JSON export/import and a fresh response that preserves previous timelines. Sound is optional and off initially. On desktop use **Sound off/on**; on phones find the control in **?**. Use Tab/Enter for controls and Escape to dismiss notebook/evidence dialogs.

## Optional live character AI

No API key was present during development. The live adapter is implemented and tested against mocked provider responses and the real local HTTP endpoint; a paid upstream request has **not** been verified.

1. Copy `.env.example` to `.env.local`:
   ```sh
   cp .env.example .env.local
   ```
2. Edit `.env.local` locally and set `OPENAI_API_KEY` to your own key. Never paste it into browser code, chat, a save file, or source control.
3. Optionally set `OPENAI_MODEL` (default `gpt-4.1-mini`). The model must support the Responses API and strict JSON-schema output.
4. Restart the server and reload the page. The mode label changes to **Live character AI**. Open **?** for request/token usage, then talk to a resident.

The server uses OpenAI's [Responses API](https://platform.openai.com/docs/api-reference/responses/create), with `store: false`. Only the selected character's bounded context, relevant memories, public facts, available offers, and your message are sent. Your conversation text is sent to OpenAI when live mode is enabled. Model prose may still be imperfect; only an indexed offer from the engine can become a proposed transaction, and you must accept it.

Defaults: 2 concurrent requests, 60 requests per server process, 100,000-token budget, 400 maximum output tokens/request, 12-second timeout per attempt, and at most one retry for 429/5xx responses. Configure `AI_MAX_REQUESTS`, `AI_MAX_TOKENS`, and `AI_TIMEOUT_MS` in `.env.local`. Limits reset on server restart. Token counts for uncertain failures use conservative estimates. If a request times out, fails validation, or hits a limit, a labeled demo fallback keeps the game playable. There are no background model calls.

If live mode does not appear, ensure the key is in the server's `.env.local`, restart from the project root, and reload. If another app occupies 5173, Vite prints its chosen port. The dev proxy expects API port 3001; changing `PORT` also requires updating `vite.config.ts`.

## Architecture and validation

- React + TypeScript + Vite, bespoke SVG town, Express localhost API.
- `src/contracts.ts`: shared world/action/event contracts.
- `src/engine.ts` and `src/scenario.ts`: immutable seeded simulation, explicit inventory/money/staff/transport, commitments, autonomous activity, outcomes, and deterministic replay validation.
- `src/intelligence.ts`: authored demo voices, request/response validation, indexed live proposals, bounded API use.
- `src/persistence.ts`: deep snapshot cloning, save/session validation and branch creation.
- `src/App.tsx`, `src/TownMap.tsx`, `src/styles.css`: playable experience and exact recorded-state playback.
- `server/index.ts`: server-only credentials, loopback host/origin protection, API and production asset serving.

```sh
npm test
npm run build
```

**38 tests pass.** Coverage includes valid and adversarial transactions, stock conservation, duplicate actions, malformed proposals, private knowledge isolation, long dialogue, commitment deadlines, promise-dependent recruitment, seeded autonomy, population caps, complete UI-offer strategies, exact replay, branch independence, save/load, malformed model output, timeout/network fallback, budgets, concurrency, and HTTP validation.

**Actual Chrome verification:** complete successful strategy (95 score, 48 safe, promise kept); rewind and failed strategy (12 score, 12 safe, promise broken); event evidence; archived branch comparison; recorded replay; mobile 390×844 navigation and conversation purchase; browser reload persistence. Desktop and phone layouts were visually inspected. Live upstream requests and every possible play order have not been tested.

## Honest release boundaries

This is a complete first scenario, not an open-ended society simulator. Autonomous plans are authored threshold-driven actions; live AI enhances conversation and action selection, not continuous independent planning. Relationships persist but are mostly characterization context; there is one structured medicine-promise type, fixed-price supply deals, one transport contract, and a compact outcome model. Negotiation chooses bounded offers rather than inventing arbitrary bargains.

Simulation state is authoritative within the single-player engine, but stored on your device. It is not a multiplayer anti-cheat server. Snapshot-heavy histories can eventually exhaust browser storage; export important saves. Imported saves are validated for structure but are not cryptographically authenticated. Replay UI displays recorded states; automated replay tests also recompute recorded actions and compare every resulting state. New branches run the simulation again and may make new live requests.

Experimental natural-language mechanic/code generation is **not implemented**. It was deliberately deferred to protect the core six moments. No generated code executes, no unrestricted sandbox is exposed, and there is no pretend “tested patch” workflow. A future version should start with restricted declarative mechanics, isolated validation, explicit acceptance, and rollback.
