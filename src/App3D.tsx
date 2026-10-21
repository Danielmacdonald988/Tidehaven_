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
  createPhysicalWorld,
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
import { demoConversation } from "./intelligence";
import type {
  World,
  Action,
  Checkpoint,
  ConversationReply,
  SimEvent,
  Resource,
} from "./contracts";
import "./three.css";
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
  const world = createPhysicalWorld();
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
    if (validSave(s)) return { ...s, world: activateSpatial(s.world) };
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
    [drawer, setDrawer] = useState<"journal" | "saves" | "settings" | null>(
      null,
    ),
    [evidence, setEvidence] = useState<SimEvent>(),
    [hint, setHint] = useState(
      "Click the street to walk. Drag to turn the camera.",
    ),
    [notice, setNotice] = useState(""),
    [message, setMessage] = useState(""),
    [reply, setReply] = useState<ConversationReply>(),
    [busy, setBusy] = useState(false),
    [live, setLive] = useState(false),
    [usage, setUsage] = useState({ requests: 0, tokens: 0, limit: 60 }),
    [quality, setQuality] = useState<Quality>("high"),
    [muted, setMuted] = useState(true),
    [volume, setVolume] = useState(0.35),
    [perf, setPerf] = useState<PerformanceSample>(),
    [replay, setReplay] = useState<World>(),
    [showRoute, setShowRoute] = useState(false);
  const world = replay || currentWorld;
  const replayRef = useRef(!!replay),
    dialogueEpoch = useRef(0),
    selectedRef = useRef(selected);
  replayRef.current = !!replay;
  selectedRef.current = selected;
  function invalidateDialogue() {
    dialogueEpoch.current++;
    setBusy(false);
    setReply(undefined);
  }
  function viewMoment(snapshot: World) {
    scene.current?.stop();
    invalidateDialogue();
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
    invalidateDialogue();
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
        setLive(s.mode === "live");
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
    if (intro || replayRef.current) return false;
    return commit(
      { id: id(), kind: moving ? "walk" : "advance", position: p, seconds },
      true,
    );
  }
  function interact(i: Interaction) {
    if (replayRef.current) return;
    invalidateDialogue();
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
  async function speak(text = message) {
    if (
      !character ||
      !text.trim() ||
      busy ||
      replayRef.current ||
      saveRef.current.world.ended
    )
      return;
    const who = character.id,
      whoName = character.name,
      generation = dialogueEpoch.current,
      context = getCharacterContext(saveRef.current.world, who);
    setBusy(true);
    setMessage("");
    let response: ConversationReply;
    try {
      if (live) {
        const r = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ characterId: who, message: text, context }),
          signal: AbortSignal.timeout(65000),
        });
        if (!r.ok) throw Error();
        response = await r.json();
      } else response = demoConversation(context, text);
    } catch {
      response = {
        ...demoConversation(context, text),
        error:
          "Live service unavailable. A deterministic response keeps this encounter playable.",
      };
    }
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
        if (response.usage) setUsage(response.usage);
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
    invalidateDialogue();
    replayRef.current = false;
    const s = saveRef.current;
    const next: Save = {
      ...s,
      world: activateSpatial(clone(w)),
      archives: [
        ...s.archives,
        {
          name: `Response ${s.archives.length + 1} · hour ${s.world.hour.toFixed(1)}`,
          state: clone(s.world),
        },
      ],
      moments: [clone(w)],
    };
    saveRef.current = next;
    setSave(next);
    setReset((v) => v + 1);
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
    <div className="neighborhood">
      <Scene
        ref={scene}
        world={world}
        readOnly={!!replay || intro}
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
            {Math.max(0, 72 - world.hour).toFixed(1)}h to landfall
            <small>
              {world.hour < 24
                ? "Warm air. A distant warning."
                : world.hour < 54
                  ? "Wind rising. Clouds closing in."
                  : "Causeway closed. Stay inland."}
            </small>
          </span>
        </div>
        <button className="nh-desk" onClick={() => setDrawer("saves")}>
          Field desk <span>↗</span>
        </button>
      </header>
      <section className="nh-mission">
        <span className="nh-eyebrow">01 / THE FIRST RELIEF RUN</span>
        <h1>{phase}</h1>
        <p>
          {kept
            ? "Mara remembers. Keep building the response, or rewind and choose another way."
            : broken
              ? "The deadline passed. Speak with Mara to learn what she needs now, or rewind your checkpoint."
              : world.spatial!.carried.medical >= 10
                ? "Ten kits are in your pack. Walk to Mercy Clinic and deliver them to Mara."
                : world.inventory.medical >= 10
                  ? "Enter the warehouse and load ten kits into your pack. Carry them to Mara at the clinic."
                  : world.staff
                    ? "Promise Mara ten medical kits. Buy them from Eli, then assign your helper to collect them."
                    : "Find Inez at the warehouse. Ask her to join your crew, then meet Mara at the clinic."}
        </p>
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
            {character ? "IN CONVERSATION" : "YOU ARE HERE"}
          </span>
          <h2>{character?.name || place.name}</h2>
          <p className="nh-role">
            {character?.role ||
              (place.id === "harbor"
                ? "The quay serves the relief fleet. Exposed access closes at hour 54."
                : "Step inside. The doors are open.")}
            {character && ` · trust ${character.trust}`}
          </p>
          {character ? (
            <>
              <p className="nh-character-line">
                {character.recruited ? character.status : character.motivation}
              </p>
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
                  <small>
                    {reply.mode === "live" ? "LIVE AI" : "DEMO DIALOGUE"}
                  </small>
                  <p>{reply.text}</p>
                  {reply.error && <small>{reply.error}</small>}
                  {reply.proposal && (
                    <button
                      className="nh-primary"
                      disabled={busy}
                      onClick={() => commit(reply.proposal!)}
                    >
                      Agree · {nameAction(reply.proposal)}
                    </button>
                  )}
                </div>
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
                  disabled={busy || !message.trim()}
                >
                  {busy ? "…" : "↗"}
                </button>
              </form>
              <div className="nh-quick">
                <button
                  disabled={busy}
                  onClick={() => void speak("What do you need?")}
                >
                  What do you need?
                </button>
                <button
                  disabled={busy}
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
            {stationActions.map((a, i) => (
              <button
                key={a.kind + "-" + i}
                disabled={busy || world.ended}
                onClick={() => commit(a)}
              >
                <span>{nameAction(a)}</span>
                <small>
                  {a.kind === "dispatch"
                    ? "10-unit carrying limit"
                    : `${actionHours(a)}h`}
                </small>
              </button>
            ))}
          </div>
          {world.location === "market" && (
            <p className="nh-caption">
              Purchased here, stored here until collected. Market stock awaiting
              pickup:{" "}
              {Object.values(world.spatial!.staged).reduce((a, b) => a + b, 0)}{" "}
              units.
            </p>
          )}
        </aside>
      )}
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
            {live ? "LIVE CHARACTER AI" : "DETERMINISTIC DEMO"}
          </span>
          <p>{replay ? "Recorded moment · read only" : hint}</p>
          <small data-testid="player-position">
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
              The shop has medicine. Your warehouse has space. Between them is a
              neighborhood—and people whose trust you will have to earn.
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
                ? "Live conversation enabled"
                : "Deterministic demo; no API key required"}
              <br />
              Sound starts muted. Walking and decisions advance the storm clock.
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
              {drawer === "settings"
                ? "Make yourself at home."
                : drawer === "journal"
                  ? "The town remembers."
                  : "Other possible mornings."}
            </h2>
            <nav>
              <button onClick={() => setDrawer("saves")}>Checkpoints</button>
              <button onClick={() => setDrawer("journal")}>Evidence</button>
              <button onClick={() => setDrawer("settings")}>Settings</button>
            </nav>
            {drawer === "settings" ? (
              <>
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
                  AI: {usage.requests}/{usage.limit} requests · {usage.tokens}{" "}
                  tokens. Rendering and movement continue while a reply is
                  pending.
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
                            invalidateDialogue();
                            replayRef.current = false;
                            setReplay(undefined);
                            setSelected(undefined);
                            setPlaceOpen(false);
                            setShowRoute(false);
                            const restored = {
                              ...s,
                              world: activateSpatial(s.world),
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
      {world.ended && !drawer && !replay && (
        <div className="nh-ending">
          <span className="nh-eyebrow">AFTER THE STORM</span>
          <h2>{world.outcome?.title}</h2>
          <p>{world.outcome?.summary}</p>
          <button onClick={() => setDrawer("saves")}>
            Compare another response ↗
          </button>
        </div>
      )}
    </div>
  );
}
