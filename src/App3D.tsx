import { useEffect, useRef, useState } from "react";
import Scene, {
  type SceneControl,
  type PerformanceSample,
} from "./three/Scene";
import {
  PLACES,
  type Interaction,
  type Point,
  type Quality,
} from "./three/shared";
import {
  activateSpatial,
  physicalResidentPosition,
  distance,
} from "./physical";
import {
  applyAction,
  getAvailableActions,
  getCharacterContext,
  actionHours,
} from "./engine";
import { validateWorld, makeCheckpoint } from "./persistence";
import { demoConversation, demoDecision, asFallback } from "./intelligence";
import { activateLives, getDecisionRequests } from "./lives";
import type {
  World,
  Action,
  Checkpoint,
  ConversationReply,
  SimEvent,
  Resource,
  AIUsage,
  ConversationRequest,
} from "./contracts";
import "./three.css";
import { resolveEvidence } from "./evidence";
import {
  createCampaignWorld,
  getCampaignOptions,
  getCampaignView,
} from "./campaign";
interface Save {
  version: 2;
  world: World;
  checkpoints: Checkpoint[];
  archives: { name: string; state: World }[];
  moments: World[];
}
const clone = <T,>(x: T): T => structuredClone(x),
  id = () => crypto.randomUUID();
const fresh = (): Save => {
  const world = createCampaignWorld();
  return {
    version: 2,
    world,
    checkpoints: [makeCheckpoint(world, "First light")],
    archives: [],
    moments: [clone(world)],
  };
};
function validSave(s: any): s is Save {
  return (
    s?.version === 2 &&
    validateWorld(s.world) &&
    !!s.world.spatial &&
    Array.isArray(s.checkpoints) &&
    s.checkpoints.every(
      (c: any) => c && typeof c.name === "string" && validateWorld(c.state),
    ) &&
    Array.isArray(s.archives) &&
    s.archives.every(
      (a: any) => a && typeof a.name === "string" && validateWorld(a.state),
    ) &&
    Array.isArray(s.moments) &&
    s.moments.every(validateWorld)
  );
}
function readSave() {
  try {
    const s = JSON.parse(
      localStorage.getItem("afterlight.neighborhood") || "null",
    );
    if (validSave(s))
      return { ...s, world: activateLives(activateSpatial(s.world)) };
  } catch {}
  return fresh();
}
const nameAction = (a: Action) => a.text || a.kind;
export default function App3D() {
  const [save, setSave] = useState<Save>(readSave),
    saveRef = useRef(save);
  saveRef.current = save;
  const currentWorld = save.world;
  const scene = useRef<SceneControl>(null);
  const [ready, setReady] = useState(false),
    [intro, setIntro] = useState(
      () => !localStorage.getItem("afterlight.neighborhood.started"),
    ),
    [reset, setReset] = useState(0),
    [selected, setSelected] = useState<string>(),
    [placeOpen, setPlaceOpen] = useState(false),
    [drawer, setDrawer] = useState<
      "journal" | "saves" | "settings" | "plan" | null
    >(null),
    [evidence, setEvidence] = useState<SimEvent>(),
    [hint, setHint] = useState(
      "Click the street to walk. Drag to turn the camera.",
    ),
    [notice, setNotice] = useState(""),
    [message, setMessage] = useState(""),
    [reply, setReply] = useState<ConversationReply>(),
    [busy, setBusy] = useState(false),
    [live, setLive] = useState(false),
    [liveVerified, setLiveVerified] = useState(false),
    [lastMode, setLastMode] = useState<ConversationReply["mode"]>("demo"),
    [decisionPending, setDecisionPending] = useState<string>(),
    [requestOwner, setRequestOwner] = useState<string>(),
    [usage, setUsage] = useState<AIUsage>({
      requests: 0,
      tokens: 0,
      limit: 60,
    }),
    [quality, setQuality] = useState<Quality>("high"),
    [muted, setMuted] = useState(true),
    [volume, setVolume] = useState(0.35),
    [perf, setPerf] = useState<PerformanceSample>(),
    [replay, setReplay] = useState<World>(),
    [showRoute, setShowRoute] = useState(false),
    [station, setStation] = useState<string>(),
    [paused, setPaused] = useState(false),
    [explore, setExplore] = useState(
      () => localStorage.getItem("afterlight.explore") === "true",
    ),
    [sensitivity, setSensitivity] = useState(
      () => Number(localStorage.getItem("afterlight.camera")) || 1,
    ),
    [endingDismissed, setEndingDismissed] = useState(false),
    [navigation, setNavigation] = useState<{
      project?: string;
      place?: World["location"];
    }>();
  const world = replay || currentWorld;
  const replayRef = useRef(!!replay),
    dialogueEpoch = useRef(0),
    selectedRef = useRef(selected);
  replayRef.current = !!replay;
  selectedRef.current = selected;
  const worldEpoch = useRef(0),
    requestInFlight = useRef(false),
    lastDecisionAt = useRef(0),
    lastRequestedTrigger = useRef(new Map<string, number>());
  const runtime = useRef({
    intro,
    ready,
    busy,
    replay: !!replay,
    drawer,
    evidence: !!evidence,
    encounter: !!selected || placeOpen,
    paused,
  });
  runtime.current = {
    intro,
    ready,
    busy,
    replay: !!replay,
    drawer,
    evidence: !!evidence,
    encounter: !!selected || placeOpen,
    paused,
  };
  function invalidateWorldWork() {
    worldEpoch.current++;
    lastRequestedTrigger.current.clear();
    invalidateDialogue();
  }
  function invalidateDialogue() {
    dialogueEpoch.current++;
    setBusy(false);
    setReply(undefined);
  }
  function viewMoment(snapshot: World) {
    scene.current?.stop();
    invalidateWorldWork();
    replayRef.current = true;
    setReplay(activateSpatial(clone(snapshot)));
    setSelected(undefined);
    setPlaceOpen(false);
    setShowRoute(false);
    setEvidence(undefined);
    setReset((r) => r + 1);
    setDrawer(null);
  }
  function exitReplay() {
    invalidateWorldWork();
    replayRef.current = false;
    setReplay(undefined);
    setSelected(undefined);
    setPlaceOpen(false);
    setShowRoute(false);
    setReset((r) => r + 1);
  }
  const character = world.characters.find((c) => c.id === selected),
    place = PLACES.find((p) => p.id === world.location)!;
  const active = world.spatial!.shipments.filter((s) => s.status !== "arrived");
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem("afterlight.neighborhood", JSON.stringify(save));
      } catch {
        setNotice(
          "Storage is full. Export this neighborhood from the field desk.",
        );
      }
    }, 700);
    return () => clearTimeout(t);
  }, [save]);
  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then((s) => {
        setLive(s.configured ?? s.mode === "live");
        setLiveVerified(s.liveVerified === true);
        if (s.lastMode) setLastMode(s.lastMode);
        if (s.usage) setUsage(s.usage);
      })
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(t);
  }, [notice]);
  useEffect(() => {
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDrawer(null);
        setEvidence(undefined);
        setSelected(undefined);
        setPlaceOpen(false);
        setShowRoute(false);
        setStation(undefined);
      }
      if (
        e.code === "Space" &&
        !(e.target as HTMLElement)?.matches("input,textarea,select,button")
      ) {
        e.preventDefault();
        setPaused((p) => !p);
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);
  function commit(a: Action, quiet = false): boolean {
    if (replayRef.current) return false;
    const old = saveRef.current,
      result = applyAction(old.world, { ...a, id: id() });
    if (!result.ok) {
      if (!quiet) setNotice(result.message);
      return false;
    }
    const meaningful =
      !["walk", "advance"].includes(a.kind) ||
      result.state.events.length !== old.world.events.length;
    const next = {
      ...old,
      world: result.state,
      moments: meaningful
        ? [...old.moments.slice(-59), clone(result.state)]
        : old.moments,
    };
    saveRef.current = next;
    setSave(next);
    if (!quiet) {
      setNotice(result.message);
      setReply(undefined);
    }
    return true;
  }
  function step(p: Point, seconds: number, moving: boolean) {
    if (intro || drawer || evidence || replayRef.current || paused)
      return false;
    const clockPaused =
      explore ||
      !!selected ||
      placeOpen ||
      requestInFlight.current ||
      saveRef.current.world.ended;
    if (!moving && clockPaused) return true;
    return commit(
      {
        id: id(),
        kind: moving ? "walk" : "advance",
        position: p,
        seconds,
        clockPaused,
      },
      true,
    );
  }
  function interact(i: Interaction) {
    if (replayRef.current) return;
    invalidateDialogue();
    setStation(
      ["relief-van", "shelter-work", "road-debris", "market-ledger"].includes(
        i.id,
      )
        ? i.id
        : undefined,
    );
    if (i.kind === "person") {
      const pid = i.id.replace(/^person[:-]/, "");
      setSelected(pid);
      setPlaceOpen(false);
    } else {
      setSelected(undefined);
      setPlaceOpen(true);
    }
    setReply(undefined);
    setHint(i.label);
  }
  const modeLabel = (mode: ConversationReply["mode"]) =>
    mode === "live"
      ? "LIVE MODEL RESPONSE"
      : mode === "fallback"
        ? "DETERMINISTIC FALLBACK"
        : "DETERMINISTIC DEMO";
  function updateIntelligence(response: ConversationReply) {
    setLastMode(response.mode);
    if (response.mode === "live") setLiveVerified(true);
    if (response.usage) setUsage(response.usage);
  }
  async function requestCharacter(
    request: ConversationRequest,
  ): Promise<ConversationReply> {
    setRequestOwner(request.characterId);
    try {
      const result = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(25000),
      });
      if (!result.ok) throw new Error("Character service unavailable");
      const response = await result.json();
      if (
        !response ||
        !["demo", "live", "fallback"].includes(response.mode) ||
        typeof response.text !== "string"
      )
        throw new Error("Malformed response");
      return response as ConversationReply;
    } catch {
      const response =
        request.purpose === "decision"
          ? demoDecision(request.context)
          : demoConversation(request.context, request.message);
      return asFallback(
        response,
        "Connection unavailable. This response uses the deterministic fallback.",
      );
    } finally {
      setRequestOwner(undefined);
    }
  }
  // One bounded request at a time, outside the render loop. Trigger IDs come from the simulation.
  useEffect(() => {
    let disposed = false;
    const tick = async () => {
      const r = runtime.current,
        now = Date.now(),
        current = saveRef.current.world;
      if (
        disposed ||
        document.hidden ||
        !r.ready ||
        r.intro ||
        r.replay ||
        r.drawer ||
        r.evidence ||
        r.encounter ||
        r.paused ||
        r.busy ||
        requestInFlight.current ||
        current.ended ||
        now - lastDecisionAt.current < 15000
      )
        return;
      const candidates = getDecisionRequests(current);
      const request = candidates.find((candidate) => {
        const trigger =
          candidate.context.decisionTrigger ||
          candidate.context.availableActions.find((a) => a.decision)?.decision
            ?.triggerId;
        return (
          !!trigger &&
          now -
            (lastRequestedTrigger.current.get(
              candidate.characterId + ":" + trigger,
            ) || 0) >
            60000
        );
      });
      if (!request) return;
      const trigger =
        request.context.decisionTrigger ||
        request.context.availableActions.find((a) => a.decision)?.decision
          ?.triggerId ||
        "";
      const generation = worldEpoch.current;
      lastDecisionAt.current = now;
      lastRequestedTrigger.current.set(
        request.characterId + ":" + trigger,
        now,
      );
      requestInFlight.current = true;
      setDecisionPending(request.characterId);
      try {
        const response = await requestCharacter({
          ...request,
          purpose: "decision",
        });
        if (!disposed) updateIntelligence(response);
        if (
          disposed ||
          generation !== worldEpoch.current ||
          replayRef.current ||
          runtime.current.intro ||
          saveRef.current.world.ended
        )
          return;
        const offered =
          response.proposal ||
          request.context.availableActions.find(
            (a) =>
              a.kind === "resident_act" && a.decision?.choice === "check_in",
          );
        if (offered?.kind === "resident_act" && offered.decision) {
          commit(
            {
              ...offered,
              id: id(),
              decision: {
                ...offered.decision,
                source: response.mode,
                summary: response.text.slice(0, 1200),
              },
            },
            true,
          );
        }
      } finally {
        requestInFlight.current = false;
        if (!disposed) setDecisionPending(undefined);
      }
    };
    const timer = setInterval(() => void tick(), 1000);
    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    if (!selected || busy || replay) return;
    if (
      distance(
        world.spatial!.player,
        physicalResidentPosition(world, selected),
      ) > 4
    ) {
      setSelected(undefined);
      setReply(undefined);
    }
  }, [world, selected, busy, replay]);
  async function speak(text = message) {
    if (
      !character ||
      !text.trim() ||
      replayRef.current ||
      saveRef.current.world.ended
    )
      return;
    if (busy || requestInFlight.current) {
      setNotice(
        "A resident is still responding. Your draft is still here; send it when the response arrives.",
      );
      return;
    }
    const who = character.id,
      whoName = character.name,
      generation = dialogueEpoch.current,
      context = getCharacterContext(saveRef.current.world, who);
    setBusy(true);
    requestInFlight.current = true;
    setMessage("");
    const response = await requestCharacter({
      characterId: who,
      message: text,
      context,
      purpose: "conversation",
    });
    requestInFlight.current = false;
    updateIntelligence(response);
    // A response belongs to its original encounter and branch, even when its request finishes later.
    if (
      generation !== dialogueEpoch.current ||
      replayRef.current ||
      selectedRef.current !== who
    ) {
      if (generation === dialogueEpoch.current) setBusy(false);
      return;
    }
    const current = saveRef.current.world;
    if (
      distance(
        current.spatial!.player,
        physicalResidentPosition(current, who),
      ) <= 3.5
    ) {
      if (
        commit(
          {
            id: id(),
            kind: "talk",
            target: who,
            text: `You: ${text}\n${whoName} (${response.mode}): ${response.text}`,
          },
          true,
        )
      ) {
        setReply(response);
      } else
        setNotice(
          "The town changed before this conversation could be recorded.",
        );
    } else
      setNotice(
        "You walked out of speaking distance. The conversation was not committed.",
      );
    setBusy(false);
  }
  function checkpoint() {
    if (replayRef.current) return;
    const s = saveRef.current;
    const next = {
      ...s,
      checkpoints: [
        ...s.checkpoints,
        makeCheckpoint(
          s.world,
          `Hour ${s.world.hour.toFixed(1)} · ${place.name}`,
        ),
      ],
    };
    saveRef.current = next;
    setSave(next);
    setNotice("Checkpoint saved, including every shipment in transit.");
  }
  function rewind(w: World, name: string) {
    scene.current?.stop();
    invalidateWorldWork();
    replayRef.current = false;
    const s = saveRef.current;
    const next: Save = {
      ...s,
      world: activateLives(activateSpatial(clone(w))),
      archives: [
        ...s.archives,
        {
          name: `Response ${s.archives.length + 1} · hour ${s.world.hour.toFixed(1)}`,
          state: clone(s.world),
        },
      ],
      moments: [activateLives(activateSpatial(clone(w)))],
    };
    saveRef.current = next;
    setSave(next);
    setReset((v) => v + 1);
    setStation(undefined);
    setEndingDismissed(false);
    setSelected(undefined);
    setPlaceOpen(false);
    setDrawer(null);
    setReplay(undefined);
    setHint("Click the street to walk. Drag to turn the camera.");
    setNotice(`New branch from ${name}. Previous response preserved.`);
  }
  function exportSave() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(saveRef.current)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "afterlight-neighborhood.json";
    a.click();
    URL.revokeObjectURL(url);
  }
  const actions = getAvailableActions(world, selected).filter(
    (a) => !["walk", "advance", "travel", "wait", "talk"].includes(a.kind),
  );
  const logistics = getAvailableActions(world).filter(
    (a) => a.kind === "dispatch",
  );
  const stationActions = selected
    ? [
        ...actions,
        ...logistics.filter(
          (a) =>
            !actions.some(
              (b) => b.kind === "dispatch" && b.resource === a.resource,
            ),
        ),
      ]
    : actions;
  const checkedActions = (station ? [] : stationActions).map((action) => ({
    action,
    check: applyAction(world, { ...action, id: `preview-${action.id}` }),
  }));
  const chapter = world.campaign ? getCampaignView(world) : undefined;
  const projectOptions =
    world.campaign && station
      ? getCampaignOptions(world, station).filter(
          ({ action }) =>
            action.target !== "finish_scenario" || world.hour >= 54,
        )
      : [];
  const clockReason = paused
    ? "PAUSED"
    : drawer || evidence
      ? "READING · CLOCK PAUSED"
      : selected || placeOpen
        ? "ENCOUNTER · CLOCK PAUSED"
        : requestOwner
          ? "AI RESPONSE · CLOCK PAUSED"
          : explore
            ? "EXPLORATION · CLOCK PAUSED"
            : world.ended
              ? "AFTERMATH"
              : "CLOCK RUNNING";
  function newCampaign() {
    scene.current?.stop();
    invalidateWorldWork();
    const next = fresh();
    const old = saveRef.current;
    next.archives = [
      ...old.archives,
      {
        name: `Previous response · hour ${old.world.hour.toFixed(1)}`,
        state: clone(old.world),
      },
    ];
    next.checkpoints = [...old.checkpoints, ...next.checkpoints];
    saveRef.current = next;
    setSave(next);
    setReset((r) => r + 1);
    setSelected(undefined);
    setStation(undefined);
    setPlaceOpen(false);
    setDrawer(null);
    setReplay(undefined);
    setIntro(false);
    setPaused(false);
    setEndingDismissed(false);
    localStorage.setItem("afterlight.neighborhood.started", "1");
    setNotice(
      "A relief van has stalled outside your warehouse. Click its open hood or inspect it from your plan.",
    );
  }
  useEffect(() => {
    if (!navigation || drawer || intro || paused || replay) return;
    if (navigation.project) scene.current?.inspect(navigation.project);
    else if (navigation.place) scene.current?.walkTo(navigation.place);
    setNavigation(undefined);
  }, [navigation, drawer, intro, paused, replay]);
  function goProject(project: string) {
    setSelected(undefined);
    setPlaceOpen(false);
    setStation(undefined);
    setDrawer(null);
    setShowRoute(false);
    setNavigation({ project });
  }
  const kept = world.commitments.some((p) => p.status === "kept");
  const broken = world.commitments.some((p) => p.status === "broken");
  const phase = kept
    ? "Your word became action"
    : broken
      ? "Trust takes more than words"
      : world.spatial!.carried.medical >= 10
        ? "Carry your promise to the clinic"
        : world.inventory.medical >= 10
          ? "Collect your medicine at the warehouse"
          : active.length
            ? "A neighbor carries the plan"
            : world.spatial!.staged.medical
              ? "The deal is done. Now move it."
              : world.staff
                ? "A crew starts with one person"
                : "Start with a neighbor";
  return (
    <div className={`neighborhood ${world.campaign ? "campaign" : "legacy"}`}>
      <Scene
        key={world.campaign ? "campaign" : "legacy"}
        ref={scene}
        world={world}
        readOnly={!!replay || intro || !!drawer || !!evidence || paused}
        cameraSensitivity={sensitivity}
        quality={quality}
        muted={muted}
        volume={volume}
        selected={selected}
        reset={reset}
        onStep={step}
        onInteract={interact}
        onHint={setHint}
        onPerformance={setPerf}
        onReady={() => setReady(true)}
      />
      <div className="cinema-vignette" />
      <header className="nh-header">
        <button className="nh-brand" onClick={() => setDrawer("settings")}>
          AFTERLIGHT<span>BELLWETHER / THE WATERFRONT</span>
        </button>
        <div className="nh-weather">
          <i />
          <span>
            {world.ended
              ? "The morning after"
              : `${Math.max(0, 72 - world.hour).toFixed(1)}h to landfall`}
            <small>
              {world.ended
                ? "The water is falling. What held matters."
                : world.hour < 24
                  ? "Warm air. A distant warning."
                  : world.hour < 54
                    ? "Wind rising. Clouds closing in."
                    : "Causeway closed. Stay inland."}
            </small>
          </span>
        </div>
        <button
          className="nh-pause"
          aria-pressed={paused}
          onClick={() => setPaused(!paused)}
        >
          {paused ? "Resume" : "Pause"}
        </button>
        <button
          className="nh-desk"
          onClick={() => setDrawer(world.campaign ? "plan" : "saves")}
        >
          Field desk <span>↗</span>
        </button>
      </header>
      <section className="nh-mission">
        <span className="nh-eyebrow">
          {chapter?.chapter || "01 / THE FIRST RELIEF RUN"}
        </span>
        <h1>{chapter?.title || phase}</h1>
        <p>
          {chapter
            ? chapter.description
            : kept
              ? "Mara remembers. Keep building the response, or rewind and choose another way."
              : broken
                ? "The deadline passed. Speak with Mara to learn what she needs now, or rewind your checkpoint."
                : world.spatial!.carried.medical >= 10
                  ? "Ten kits are in your pack. Walk to Mercy Clinic and deliver them to Mara."
                  : world.inventory.medical >= 10
                    ? "Enter the warehouse and load ten kits into your pack. Carry them to Mara at the clinic."
                    : Object.values(world.spatial!.staged).some((n) => n > 0)
                      ? "Find Inez and ask her to collect your purchased supplies. She will consider the request, then make the trip herself."
                      : world.staff
                        ? "Promise Mara ten medical kits. Buy them from Eli, then ask a neighbor to collect them."
                        : "Find Inez at the warehouse. Ask her to join your crew, then meet Mara at the clinic."}
        </p>
        {world.campaign && (
          <button
            className="nh-next"
            onClick={() =>
              world.campaign?.van === "stranded"
                ? goProject("relief-van")
                : setDrawer("plan")
            }
          >
            {world.campaign.van === "stranded"
              ? "Inspect the stranded van ↗"
              : "Open the response plan ↗"}
          </button>
        )}
        {!world.campaign && (
          <button className="nh-next" onClick={newCampaign}>
            Play the new chapter ↗
          </button>
        )}
        <button
          disabled={!!replay}
          onClick={() => {
            setShowRoute(!showRoute);
            setSelected(undefined);
            setPlaceOpen(false);
          }}
        >
          Explore the neighborhood <span>⌄</span>
        </button>
      </section>
      <div className="nh-resources">
        <span>
          <small>RELIEF FUND</small>
          <strong>${world.money.toLocaleString()}</strong>
        </span>
        <span>
          <small>CREW</small>
          <strong>{world.staff}</strong>
        </span>
        <span>
          <small>WAREHOUSE</small>
          <strong>
            {world.inventory.medical} <em>kits</em> · {world.inventory.food}{" "}
            <em>food</em> · {world.inventory.water} <em>water</em>
          </strong>
          <small>{world.inventory.fuel} fuel · {world.evacuated}/48 uphill</small>
        </span>
        <span>
          <small>CARRYING</small>
          <strong>
            {Object.values(world.spatial!.carried || {}).reduce(
              (a, b) => a + b,
              0,
            )}
            <em> / 10</em>
          </strong>
        </span>
      </div>
      {showRoute && !replay && (
        <nav className="nh-destinations" aria-label="Walk to a destination">
          {PLACES.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                scene.current?.walkTo(p.id);
                setShowRoute(false);
                setSelected(undefined);
                setPlaceOpen(false);
              }}
            >
              Walk to{" "}
              {p.name.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}
              <span>↗</span>
            </button>
          ))}
        </nav>
      )}
      {(character || placeOpen) && !intro && !drawer && !replay && (
        <aside className="nh-encounter">
          <button
            className="nh-close"
            aria-label="Close encounter"
            onClick={() => {
              setSelected(undefined);
              setPlaceOpen(false);
            }}
          >
            ×
          </button>
          <span className="nh-eyebrow">
            {character ? "WITHIN SPEAKING DISTANCE" : "YOU ARE HERE"}
          </span>
          <h2>
            {character?.name ||
              (station === "relief-van"
                ? "The stranded relief van"
                : station === "road-debris"
                  ? "The inland road"
                  : station === "shelter-work"
                    ? "Make room at Cypress"
                    : station === "market-ledger"
                      ? "The market ledger"
                      : place.name)}
          </h2>
          <p className="nh-role">
            {character?.role ||
              (station === "relief-van"
                ? (world.campaign?.van === "stranded" ? "A broken axle, ten medical kits, and a choice about what is worth saving." : world.campaign?.van === "repaired" ? "The repaired van provides twelve evacuation seats. Its medical cargo has been recovered." : "The medicine was recovered. This van was left behind; the harbor offers another transport option.")
                : station === "shelter-work"
                  ? (world.campaign?.shelter === "stocked" ? "Twenty sleeping places are ready, with food and water secured. Your preparations will carry through the storm." : `A refuge needs dry sleeping places and supplies. Warehouse reserve: ${world.inventory.food} food, ${world.inventory.water} water.`)
                  : station === "road-debris"
                    ? (world.campaign?.route === "cleared" ? "The freight lane is clear. Each evacuation takes four hours and four fuel before the harbor closes at hour 54." : "Clear this freight lane or take the detour: each evacuation costs two extra hours and two extra fuel. Pedestrians can pass.")
                    : station === "market-ledger"
                      ? "Bring a clinic receipt or trade fuel for the shop generator. Goods stay here until collected."
                      : place.id === "harbor"
                        ? "The quay serves the relief fleet. Exposed access closes at hour 54."
                        : "Step inside. The doors are open.")}
            {character && ` · trust ${character.trust}`}
          </p>
          {character ? (
            <>
              <p className="nh-character-line">
                {character.recruited ? character.status : character.motivation}
              </p>
              <div className="nh-resident-life">
                <span>
                  {world.lives?.[character.id]?.routine || character.status}
                </span>
                {world.lives?.[character.id]?.assignment && (
                  <small>
                    Pickup assignment ·{" "}
                    {world.lives[character.id].assignment!.amount}{" "}
                    {world.lives[character.id].assignment!.resource} ·{" "}
                    {world.lives[character.id].assignment!.status}
                  </small>
                )}
              </div>
              <details className="nh-context-details">
                <summary>
                  What matters to {character.name.split(" ")[0]}
                </summary>
                <p>{character.goal}</p>
                <div className="nh-relations">
                  {Object.entries(character.relationships)
                    .filter(([who]) => who !== character.id)
                    .slice(0, 3)
                    .map(([who, value]) => (
                      <span key={who}>
                        {world.characters.find((c) => c.id === who)?.name ||
                          who}
                        <b>
                          {value >= 0 ? "+" : ""}
                          {value}
                        </b>
                      </span>
                    ))}
                </div>
                <small>
                  Relationships and priorities are recorded simulation state.
                </small>
              </details>
              {world.events.filter(
                (e) =>
                  e.action?.kind === "talk" &&
                  e.action?.target === character.id,
              ).length > 0 && (
                <details className="nh-context-details">
                  <summary>Earlier conversations</summary>
                  {world.events
                    .filter(
                      (e) =>
                        e.action?.kind === "talk" &&
                        e.action?.target === character.id,
                    )
                    .slice(-3)
                    .map((e) => (
                      <button
                        className="nh-memory-row"
                        key={e.id}
                        onClick={() => setEvidence(e)}
                      >
                        <small>
                          Hour {e.hour.toFixed(1)} · recorded conversation
                        </small>
                        <span>
                          {e.description.length > 180
                            ? e.description.slice(0, 180) + "…"
                            : e.description}
                        </span>
                        <b>Read source ↗</b>
                      </button>
                    ))}
                </details>
              )}
              {world.commitments
                .filter((p) => p.characterId === character.id)
                .map((p) => (
                  <p className={`nh-promise ${p.status}`} key={p.id}>
                    {p.status.toUpperCase()} · {p.delivered}/{p.amount} kits ·
                    due hour {p.dueHour}
                  </p>
                ))}
              {reply && (
                <div className="nh-dialogue">
                  <small>{modeLabel(reply.mode)}</small>
                  <p>{reply.text}</p>
                  {reply.error && (
                    <small className="nh-fallback-note">{reply.error}</small>
                  )}
                  {!!reply.evidence?.length && (
                    <details className="nh-reply-evidence">
                      <summary>
                        Context from {reply.evidence.length} recorded sources
                      </summary>
                      {reply.evidence.map((source, i) => {
                        const sourceEvent = resolveEvidence(
                          source,
                          world.events,
                        );
                        return sourceEvent ? (
                          <button
                            key={i}
                            onClick={() => setEvidence(sourceEvent)}
                          >
                            {sourceEvent.title} ↗
                          </button>
                        ) : (
                          <span key={i}>{source}</span>
                        );
                      })}
                    </details>
                  )}
                  {reply.proposal && (
                    <button
                      className="nh-primary"
                      disabled={busy}
                      onClick={() => commit(reply.proposal!)}
                    >
                      Agree · {nameAction(reply.proposal)} ·{" "}
                      {Number(actionHours(reply.proposal, world).toFixed(1))}h
                    </button>
                  )}
                </div>
              )}
              {requestOwner && (
                <small className="nh-thinking" role="status">
                  {
                    world.characters
                      .find((c) => c.id === requestOwner)
                      ?.name.split(" ")[0]
                  }{" "}
                  {decisionPending
                    ? "is considering their next step"
                    : "is responding"}
                  … The clock is paused. Your draft stays here.
                </small>
              )}
              <form
                className="nh-talk"
                onSubmit={(e) => {
                  e.preventDefault();
                  void speak();
                }}
              >
                <input
                  aria-label="Message to resident"
                  placeholder={`Ask ${character.name.split(" ")[0]}…`}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={1200}
                />
                <button
                  aria-label="Send message"
                  disabled={busy || !!requestOwner || !message.trim()}
                >
                  {busy ? "…" : "↗"}
                </button>
              </form>
              <div className="nh-quick">
                <button
                  disabled={busy || !!requestOwner}
                  onClick={() => void speak("What do you need?")}
                >
                  What do you need?
                </button>
                <button
                  disabled={busy || !!requestOwner}
                  onClick={() => void speak("Do you remember my promise?")}
                >
                  Our promise
                </button>
              </div>
            </>
          ) : (
            <div className="nh-neighbors">
              {world.characters
                .filter((c) => c.location === world.location)
                .map((c) => (
                  <button
                    key={c.id}
                    onClick={() => scene.current?.approach(c.id)}
                  >
                    <span>
                      {c.name}
                      <small>{c.role}</small>
                    </span>
                    <b>Meet ↗</b>
                  </button>
                ))}
            </div>
          )}
          <div className="nh-actions">
            {projectOptions.map(({ action: a, reason }) => (
              <button
                key={a.target}
                disabled={busy || world.ended || !!reason}
                onClick={() => commit(a)}
              >
                <span>
                  {nameAction(a)}
                  {reason && <em className="nh-requirement">{reason}</em>}
                </span>
                <small>{Number(actionHours(a, world).toFixed(1))}h</small>
              </button>
            ))}
            {checkedActions.map(({ action: a, check }, i) => (
              <button
                key={a.kind + "-" + i}
                disabled={busy || world.ended || !check.ok}
                onClick={() => commit(a)}
              >
                <span>
                  {nameAction(a)}
                  {!check.ok && (
                    <em className="nh-requirement">{check.message}</em>
                  )}
                </span>
                <small>
                  {a.kind === "dispatch"
                    ? "10-unit carrying limit"
                    : a.target === "finish_scenario"
                      ? `${(72 - world.hour).toFixed(1)}h · through landfall`
                      : `${Number(actionHours(a, world).toFixed(1))}h`}
                </small>
              </button>
            ))}
          </div>
          {world.location === "market" && (!station || station === "market-ledger") && (
            <p className="nh-caption">
              Purchased here, stored here until collected. Market stock awaiting
              pickup:{" "}
              {Object.values(world.spatial!.staged).reduce((a, b) => a + b, 0)}{" "}
              units.
            </p>
          )}
        </aside>
      )}
      {!intro &&
        !drawer &&
        !replay &&
        !character &&
        !placeOpen &&
        (() => {
          const neighbor = world.characters.find(
            (c) =>
              world.lives?.[c.id]?.initiative &&
              distance(
                world.spatial!.player,
                physicalResidentPosition(world, c.id),
              ) <= 3.5,
          );
          const initiative = neighbor && world.lives?.[neighbor.id]?.initiative;
          return neighbor && initiative ? (
            <button
              className="nh-initiative"
              onClick={() => scene.current?.approach(neighbor.id)}
            >
              <small>
                {neighbor.name} · {modeLabel(initiative.source)}
              </small>
              <span>“{initiative.text.slice(0, 160)}”</span>
              <b>Listen ↗</b>
            </button>
          ) : null;
        })()}
      {!!active.length && (
        <div className="nh-shipment">
          <span className="nh-eyebrow">RELIEF IN MOTION</span>
          {active.map((s) => (
            <div key={s.id}>
              <p>
                <b>
                  {
                    world.characters
                      .find((c) => c.id === s.workerId)
                      ?.name.split(" ")[0]
                  }
                </b>{" "}
                ·{" "}
                {s.status === "collecting"
                  ? "walking to the store"
                  : "carrying to the warehouse"}{" "}
                · {s.amount} {s.resource}
              </p>
              <progress value={s.progress} max={1} />
            </div>
          ))}
        </div>
      )}
      <footer className="nh-footer">
        <div>
          <span className="nh-mode">
            {lastMode === "fallback"
              ? "DETERMINISTIC FALLBACK"
              : liveVerified
                ? "LIVE AI VERIFIED"
                : live
                  ? "LIVE CONFIGURED · UNVERIFIED"
                  : "DETERMINISTIC DEMO"}
          </span>
          <p>{replay ? "Recorded moment · read only" : hint}</p>
          <small className="nh-clock-state" role="status">
            {clockReason}
          </small>
          <small className="nh-position" data-testid="player-position">
            Position {world.spatial!.player.x.toFixed(1)},{" "}
            {world.spatial!.player.z.toFixed(1)} · Click to walk · Drag to look
            · WASD optional
          </small>
        </div>
        <div className="nh-camera">
          <button
            aria-label="Rotate camera left"
            onClick={() => scene.current?.rotate(-Math.PI / 4)}
          >
            ↶
          </button>
          <button
            aria-label="Rotate camera right"
            onClick={() => scene.current?.rotate(Math.PI / 4)}
          >
            ↷
          </button>
          <button
            aria-label="Zoom closer"
            onClick={() => scene.current?.zoom(-2)}
          >
            ＋
          </button>
          <button aria-label="Zoom out" onClick={() => scene.current?.zoom(2)}>
            −
          </button>
          <button onClick={() => setMuted(!muted)}>
            {muted ? "Sound off" : "Sound on"}
          </button>
          <button onClick={() => setDrawer("settings")}>Settings</button>
        </div>
      </footer>
      {notice && (
        <div role="status" className="nh-notice">
          {notice.slice(0, 220)}
        </div>
      )}
      {intro && (
        <div className="nh-scrim">
          <section
            className="nh-intro"
            role="dialog"
            aria-modal="true"
            aria-label="Welcome to the neighborhood"
          >
            <span className="nh-eyebrow">A WALKABLE CHAPTER / AFTERLIGHT</span>
            <h2>
              Before the water,
              <br />
              <em>we have each other.</em>
            </h2>
            <p>
              A relief van has broken down outside your warehouse. Ten medical
              kits are trapped inside; Mara’s clinic needs them. Inez can
              help—but she has neighbors of her own to protect.
            </p>
            <div className="nh-intro-rules">
              <span>Click the street to walk.</span>
              <span>Click a person to approach.</span>
              <span>Drag to turn the camera.</span>
            </div>
            <button
              className="nh-primary"
              disabled={!ready}
              onClick={() => {
                setIntro(false);
                localStorage.setItem("afterlight.neighborhood.started", "1");
              }}
            >
              {ready ? "Step into Bellwether ↗" : "Preparing the neighborhood…"}
            </button>
            <small>
              Complete local scenario ·{" "}
              {live
                ? liveVerified
                  ? "Live AI verified in this session"
                  : "Live configured; awaiting successful response"
                : "Deterministic demo; no API key required"}
              <br />
              Sound starts muted. Reading and AI replies pause the clock. Choose
              exploration mode in settings for unhurried movement. Work always
              takes the time shown.
            </small>
          </section>
        </div>
      )}
      {drawer && (
        <div className="nh-scrim" onClick={() => setDrawer(null)}>
          <section
            className="nh-notebook"
            role="dialog"
            aria-modal="true"
            aria-label="Field desk"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="nh-close"
              aria-label="Close field desk"
              onClick={() => setDrawer(null)}
            >
              ×
            </button>
            <span className="nh-eyebrow">AFTERLIGHT / FIELD DESK</span>
            <h2>
              {drawer === "plan"
                ? "The people counting on you."
                : drawer === "settings"
                  ? "Make yourself at home."
                  : drawer === "journal"
                    ? "The town remembers."
                    : "Other possible mornings."}
            </h2>
            <nav>
              {world.campaign && (
                <button onClick={() => setDrawer("plan")}>Response plan</button>
              )}
              <button onClick={() => setDrawer("saves")}>Checkpoints</button>
              <button onClick={() => setDrawer("journal")}>Evidence</button>
              <button onClick={() => setDrawer("settings")}>Settings</button>
            </nav>
            {drawer === "plan" && chapter ? (
              <>
                <p>
                  These needs connect. You can choose the order, share the
                  burden, and recover from a missed promise. Work costs time;
                  reading this plan does not.
                </p>
                <div className="nh-plan">
                  {chapter.objectives.map((o) => (
                    <button
                      className={o.done ? "complete" : ""}
                      key={o.id}
                      onClick={() => {
                        const project = (
                          {
                            van: "relief-van",
                            transport: "relief-van",
                            cooperation: "market-ledger",
                            market: "market-ledger",
                            shelter: "shelter-work",
                            route: "road-debris",
                          } as Record<string, string>
                        )[o.id];
                        if (project) goProject(project);
                        else {
                          setDrawer(null);
                          setSelected(undefined);
                          setPlaceOpen(false);
                          setNavigation({ place: o.location });
                        }
                      }}
                    >
                      <small>{o.done ? "✓ RESOLVED" : "OPEN NEED"}</small>
                      <b>{o.title}</b>
                      <span>{o.detail}</span>
                      <em>{o.done ? "Visit ↗" : "Go there ↗"}</em>
                    </button>
                  ))}
                </div>
                <p className="nh-caption">
                  Harbor access closes at hour 54. An uncleared inland road
                  stays usable but costs extra evacuation time and fuel. Shelter
                  stock and clinic medicine are separate needs.
                </p>
                <button
                  className="nh-text"
                  disabled={world.ended}
                  onClick={() => commit({ id: id(), kind: "wait", hours: 6 })}
                >
                  Work with your crew / pass 6 hours
                </button>
              </>
            ) : drawer === "settings" ? (
              <>
                <label className="nh-setting">
                  Exploration-friendly mode
                  <input
                    type="checkbox"
                    checked={explore}
                    onChange={(e) => {
                      setExplore(e.target.checked);
                      localStorage.setItem(
                        "afterlight.explore",
                        String(e.target.checked),
                      );
                    }}
                  />
                </label>
                <p className="nh-caption">
                  Walk and look without advancing deadlines. Deliberate actions
                  still cost their displayed hours. Deliveries resume when you
                  work, wait, or turn this off.
                </p>
                <label className="nh-setting">
                  Camera sensitivity
                  <input
                    aria-label="Camera sensitivity"
                    type="range"
                    min="0.4"
                    max="2"
                    step="0.1"
                    value={sensitivity}
                    onChange={(e) => {
                      setSensitivity(Number(e.target.value));
                      localStorage.setItem("afterlight.camera", e.target.value);
                    }}
                  />
                </label>
                <label className="nh-setting">
                  Graphics
                  <select
                    value={quality}
                    onChange={(e) => setQuality(e.target.value as Quality)}
                  >
                    <option value="high">High · shadows, 1.5× pixels</option>
                    <option value="low">Low · no shadows, 1× pixels</option>
                  </select>
                </label>
                <label className="nh-setting">
                  Coastal ambience
                  <input
                    aria-label="Ambience volume"
                    type="range"
                    min="0"
                    max="1"
                    step=".05"
                    value={volume}
                    onChange={(e) => setVolume(Number(e.target.value))}
                  />
                  <button onClick={() => setMuted(!muted)}>
                    {muted ? "Unmute" : "Mute"}
                  </button>
                </label>
                <div className="nh-performance" data-testid="performance">
                  <b>Measured in this browser</b>
                  <p>
                    {perf
                      ? `${perf.fps} FPS · p95 ${perf.p95}ms · ${perf.draws} draws · ${perf.triangles.toLocaleString()} triangles`
                      : "Sampling render frames…"}
                  </p>
                  <small>
                    {perf?.renderer}
                    <br />
                    {perf && `${perf.width} × ${perf.height} render pixels`}
                  </small>
                  <p>
                    Target: 60 FPS high, 30 FPS low. Measurement is a rolling
                    2-second sample, not a guarantee.
                  </p>
                </div>
                <p>
                  {liveVerified
                    ? "Live provider response verified."
                    : live
                      ? "Live AI configured; no successful provider response verified yet."
                      : "Deterministic demo mode."}{" "}
                  Last response: {lastMode}.<br />
                  AI: {usage.requests}/{usage.limit} requests · {usage.tokens}{" "}
                  tokens.
                  {usage.budgetUsd !== undefined && (
                    <>
                      {" "}
                      Budget ${usage.spentUsd?.toFixed(3) || "0.000"} spent / $
                      {usage.budgetUsd.toFixed(2)}; $
                      {usage.reservedUsd?.toFixed(3) || "0.000"} reserved.
                    </>
                  )}
                  <br />
                  One request at a time. Background decisions are at least 15
                  seconds apart and only run for simulation triggers. A repeated
                  unresolved trigger is retried no sooner than 60 seconds.
                  Rendering and movement continue while a reply is pending.
                </p>
                <p>
                  Click ground to walk, click residents to approach, drag to
                  orbit, or use camera buttons. WASD is optional. Goods travel
                  only after a validated dispatch. Helpers carry at most ten
                  units each trip.
                </p>
                <button
                  className="nh-text"
                  disabled={!!replay}
                  onClick={() => commit({ id: id(), kind: "wait" })}
                >
                  Let six simulated hours pass
                </button>
                <a className="nh-text" href="?classic">
                  Open the preserved 2D field-desk edition ↗
                </a>
              </>
            ) : drawer === "journal" ? (
              <>
                {world.events
                  .slice()
                  .reverse()
                  .map((e) => (
                    <button
                      className="nh-log"
                      key={e.id}
                      onClick={() => setEvidence(e)}
                    >
                      <small>
                        HOUR {e.hour.toFixed(1)} · {e.kind}
                      </small>
                      <b>{e.title}</b>
                      <span>Inspect recorded causes ↗</span>
                    </button>
                  ))}
              </>
            ) : (
              <>
                <p>
                  Checkpoints include position, memories, staged goods, and
                  shipments in transit. Rewind creates a new branch and
                  preserves the current outcome.
                </p>
                <button className="nh-text" onClick={newCampaign}>
                  Start The Last Good Road · preserve this response
                </button>
                <button
                  className="nh-primary"
                  onClick={checkpoint}
                  disabled={!!replay}
                >
                  Save this moment
                </button>
                {save.checkpoints.map((c) => (
                  <button
                    className="nh-save-row"
                    key={c.id}
                    onClick={() => rewind(c.state, c.name)}
                  >
                    <b>{c.name}</b>
                    <span>
                      ${c.state.money.toLocaleString()} ·{" "}
                      {
                        c.state.commitments.filter((p) => p.status === "kept")
                          .length
                      }{" "}
                      promises kept · Branch ↗
                    </span>
                  </button>
                ))}
                <h3>Preserved responses</h3>
                {save.archives.map((a, i) => (
                  <div className="nh-save-row" key={i}>
                    <b>{a.name}</b>
                    <span>
                      ${a.state.money.toLocaleString()} · {a.state.evacuated}{" "}
                      safe ·{" "}
                      {
                        a.state.commitments.filter((p) => p.status === "kept")
                          .length
                      }{" "}
                      kept /{" "}
                      {
                        a.state.commitments.filter((p) => p.status === "broken")
                          .length
                      }{" "}
                      broken promises
                    </span>
                  </div>
                ))}
                <h3>Recorded moments</h3>
                <p>
                  Read-only snapshots of committed events. Returning to the
                  current town resumes its saved physical state.
                </p>
                <select
                  aria-label="Recorded moment"
                  value=""
                  onChange={(e) => {
                    if (e.target.value !== "")
                      viewMoment(save.moments[Number(e.target.value)]);
                  }}
                >
                  <option value="">Choose an event to revisit</option>
                  {save.moments.map((w, i) => (
                    <option key={i} value={i}>
                      Hour {w.hour.toFixed(1)} · {w.events.at(-1)?.title}
                    </option>
                  ))}
                </select>
                <div className="nh-save-tools">
                  <button onClick={exportSave}>Export save</button>
                  <label>
                    Import save
                    <input
                      type="file"
                      accept="application/json"
                      aria-label="Import neighborhood save"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (!f || f.size > 20e6) return;
                        try {
                          const s = JSON.parse(await f.text());
                          if (validSave(s)) {
                            scene.current?.stop();
                            invalidateWorldWork();
                            replayRef.current = false;
                            setReplay(undefined);
                            setEndingDismissed(false);
                            setSelected(undefined);
                            setPlaceOpen(false);
                            setShowRoute(false);
                            const restored = {
                              ...s,
                              world: activateLives(activateSpatial(s.world)),
                            };
                            saveRef.current = restored;
                            setSave(restored);
                            setReset((r) => r + 1);
                            setDrawer(null);
                          } else if (validateWorld(s.world)) {
                            rewind(activateSpatial(s.world), "imported town");
                          } else throw Error();
                        } catch {
                          setNotice(
                            "Invalid save. Your neighborhood has not changed.",
                          );
                        }
                      }}
                    />
                  </label>
                </div>
              </>
            )}
          </section>
        </div>
      )}
      {evidence && (
        <div
          className="nh-scrim evidence"
          onClick={() => setEvidence(undefined)}
        >
          <section
            className="nh-notebook"
            role="dialog"
            aria-label="Recorded evidence"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="nh-close"
              aria-label="Close evidence"
              onClick={() => setEvidence(undefined)}
            >
              ×
            </button>
            <span className="nh-eyebrow">
              EVENT {evidence.id} · HOUR {evidence.hour.toFixed(1)}
            </span>
            <h2>{evidence.title}</h2>
            <p>{evidence.description}</p>
            {[
              ["Facts", evidence.facts],
              ["Constraints", evidence.constraints],
              ["Effects", evidence.effects],
            ].map(([label, items]) => (
              <section key={label as string}>
                <h3>{label as string}</h3>
                <ul>
                  {(items as string[]).map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </section>
            ))}
            <small>
              Recorded facts and validated effects, not private model reasoning.
            </small>
          </section>
        </div>
      )}
      {replay && (
        <button className="nh-replay-exit nh-primary" onClick={exitReplay}>
          Return to current town
        </button>
      )}
      {world.ended && !drawer && !replay && !endingDismissed && (
        <div className="nh-ending">
          <span className="nh-eyebrow">AFTER THE STORM</span>
          <h2>{world.outcome?.title}</h2>
          <p>{world.outcome?.summary}</p>
          <button onClick={() => setEndingDismissed(true)}>
            Walk through the aftermath ↗
          </button>
          <button onClick={() => setDrawer("saves")}>
            Compare another response ↗
          </button>
        </div>
      )}
    </div>
  );
}
