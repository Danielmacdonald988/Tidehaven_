import { useEffect, useState, useRef } from "react";
import {
  LOCATIONS,
  type World,
  type Action,
  type SimEvent,
  type Checkpoint,
  type Timeline,
  type ConversationReply,
  type LocationId,
} from "./contracts";
import {
  createWorld,
  applyAction,
  getAvailableActions,
  getCharacterContext,
  actionHours,
} from "./engine";
import { demoConversation } from "./intelligence";
import { validateSession, makeCheckpoint, branchFrom } from "./persistence";
import TownMap from "./TownMap";
import "./styles.css";
const uid = () => crypto.randomUUID();
const hasStarted = () => {
  try {
    return !!localStorage.getItem("afterlight.started");
  } catch {
    return false;
  }
};
const markStarted = () => {
  try {
    localStorage.setItem("afterlight.started", "1");
  } catch {}
};
const clone = <T,>(x: T): T => structuredClone(x);
const time = (h: number) =>
  `Day ${Math.min(3, Math.floor(h / 24) + 1)} · ${String((8 + h) % 24).padStart(2, "0")}:00`;
const hoursFor = actionHours;
const title = (a: Action) =>
  a.text ||
  `${a.kind[0].toUpperCase() + a.kind.slice(1)}${a.amount ? " " + a.amount : ""}${a.resource ? " " + a.resource : ""}`;
interface Session {
  world: World;
  checkpoints: Checkpoint[];
  timeline: Timeline;
  archives: Timeline[];
}
function fresh(): Session {
  const world = createWorld();
  return {
    world,
    checkpoints: [makeCheckpoint(world, "The first morning")],
    timeline: {
      id: uid(),
      name: "First response",
      initial: clone(world),
      steps: [],
    },
    archives: [],
  };
}
function readSession(): Session {
  try {
    const s = JSON.parse(localStorage.getItem("afterlight.session") || "null");
    if (validateSession(s)) return s;
  } catch {}
  return fresh();
}
export default function App() {
  const [session, setSession] = useState<Session>(readSession);
  const currentSession = useRef(session);
  currentSession.current = session;
  const world = session.world;
  const [selected, setSelected] = useState<string>();
  const [intro, setIntro] = useState(() => !hasStarted());
  const [panel, setPanel] = useState<"journal" | "branches" | "help" | null>(
    null,
  );
  const [event, setEvent] = useState<SimEvent>();
  const [notice, setNotice] = useState("");
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState<ConversationReply>();
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState(false);
  const [usage, setUsage] = useState({ requests: 0, tokens: 0, limit: 80 });
  const [muted, setMuted] = useState(true);
  const [audio, setAudio] = useState<AudioContext>();
  const [outcomeDismissed, setOutcomeDismissed] = useState(false);
  const [replay, setReplay] = useState<{
    timeline: Timeline;
    index: number;
  } | null>(null);
  useEffect(() => {
    try {
      localStorage.setItem("afterlight.session", JSON.stringify(session));
    } catch {
      setNotice(
        "Your browser could not save this session. Keep this tab open.",
      );
    }
  }, [session]);
  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then((s) => {
        setLive(s.mode === "live" || s.live === true || s.configured === true);
        if (s.usage) setUsage(s.usage);
      })
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(""), 6500);
    return () => clearTimeout(id);
  }, [notice]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setEvent(undefined);
        setPanel(null);
        if (world.ended) setOutcomeDismissed(true);
      }
      if (e.key === "Tab") {
        const dialogs = document.querySelectorAll<HTMLElement>("[role=dialog]");
        const dialog = dialogs[dialogs.length - 1];
        if (!dialog) return;
        const focusable = Array.from(
          dialog.querySelectorAll<HTMLElement>(
            'button:not(:disabled),input:not(:disabled),[tabindex="0"]',
          ),
        );
        const first = focusable[0],
          last = focusable.at(-1);
        if (!first) return;
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            !dialog.contains(document.activeElement))
        ) {
          e.preventDefault();
          last?.focus();
        } else if (
          !e.shiftKey &&
          (document.activeElement === last ||
            !dialog.contains(document.activeElement))
        ) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [world.ended]);
  useEffect(() => {
    const dialogs = document.querySelectorAll<HTMLElement>("[role=dialog]");
    const top = dialogs[dialogs.length - 1];
    top?.querySelector<HTMLElement>("button")?.focus();
  }, [panel, event, intro, world.ended]);
  const shown = replay
    ? replay.index === 0
      ? replay.timeline.initial
      : replay.timeline.steps[replay.index - 1].state
    : world;
  const character = shown.characters.find((c) => c.id === selected);
  const location = LOCATIONS.find((l) => l.id === shown.location)!;
  useEffect(() => {
    if (
      selected &&
      !replay &&
      world.characters.find((c) => c.id === selected)?.location !==
        world.location
    ) {
      setSelected(undefined);
      setReply(undefined);
    }
  }, [world, selected, replay]);
  function act(action: Action) {
    if (replay) {
      setNotice("Exit replay to make a new decision.");
      return;
    }
    const submitted = { ...action, id: uid() };
    const result = applyAction(currentSession.current.world, submitted);
    setNotice(result.message);
    if (result.ok) {
      setSession((s) => ({
        ...s,
        world: result.state,
        timeline: {
          ...s.timeline,
          steps: [
            ...s.timeline.steps,
            { action: submitted, state: clone(result.state) },
          ],
        },
      }));
      setReply(undefined);
    }
  }
  function visit(id: LocationId) {
    if (replay || busy) return;
    setSelected(undefined);
    setReply(undefined);
    if (id !== world.location) act({ id: uid(), kind: "travel", location: id });
  }
  function person(id: string) {
    if (busy) return;
    const c = world.characters.find((c) => c.id === id)!;
    if (c.location !== world.location && !replay)
      act({ id: uid(), kind: "travel", location: c.location });
    setSelected(id);
    setReply(undefined);
  }
  async function speak(text = message) {
    if (!character || !text.trim() || busy) return;
    setBusy(true);
    setMessage("");
    const context = getCharacterContext(world, character.id);
    try {
      let response: ConversationReply;
      if (live) {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            characterId: character.id,
            message: text,
            context,
          }),
          signal: AbortSignal.timeout(65000),
        });
        if (!res.ok) throw new Error("The radio link is quiet.");
        response = await res.json();
      } else response = demoConversation(context, text);
      if (
        currentSession.current.world.hour !== world.hour ||
        currentSession.current.world.location !== world.location ||
        currentSession.current.timeline.id !== session.timeline.id
      ) {
        setNotice(
          "The situation changed while they were answering. Ask again from their location.",
        );
        return;
      }
      act({
        id: uid(),
        kind: "talk",
        target: character.id,
        text: `You: ${text}\n${character.name} (${response.mode}): ${response.text}`,
      });
      setReply(response);
      if (response.usage) setUsage(response.usage);
    } catch {
      if (
        currentSession.current.world.hour !== world.hour ||
        currentSession.current.world.location !== world.location ||
        currentSession.current.timeline.id !== session.timeline.id
      ) {
        setNotice(
          "The situation changed while they were answering. Ask again from their location.",
        );
        return;
      }
      const fallback = {
        ...demoConversation(context, text),
        mode: "fallback" as const,
        error:
          "Live AI is unavailable. This response uses the deterministic fallback; your world is safe.",
      };
      act({
        id: uid(),
        kind: "talk",
        target: character.id,
        text: `You: ${text}\n${character.name} (demo fallback): ${fallback.text}`,
      });
      setReply(fallback);
    } finally {
      setBusy(false);
    }
  }
  function checkpoint() {
    const c = makeCheckpoint(world, `${time(world.hour)} · ${location.name}`);
    setSession((s) => ({ ...s, checkpoints: [...s.checkpoints, c] }));
    setNotice("Checkpoint saved. You can return here and choose another path.");
  }
  function rewind(c: Checkpoint) {
    if (busy) return;
    const timeline = branchFrom(
      c,
      `Alternate response ${session.archives.length + 1}`,
    );
    setSession((s) => ({
      ...s,
      world: clone(c.state),
      archives: [...s.archives, clone(s.timeline)],
      timeline,
    }));
    setSelected(undefined);
    setReply(undefined);
    setPanel(null);
    setReplay(null);
    setOutcomeDismissed(false);
    setNotice("A new branch has begun. Your previous timeline is preserved.");
  }
  function sound() {
    if (!audio) {
      const ctx = new AudioContext();
      const buffer = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++)
        data[i] = (Math.random() * 2 - 1) * 0.18;
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 380;
      const gain = ctx.createGain();
      gain.gain.value = 0.3;
      source.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      source.start();
      setAudio(ctx);
      setMuted(false);
    } else {
      if (muted) void audio.resume();
      else void audio.suspend();
      setMuted(!muted);
    }
  }
  const actions = getAvailableActions(shown, character?.id).filter(
    (a) => !["travel", "wait", "talk"].includes(a.kind),
  );
  return (
    <div className={`app day-${Math.floor(shown.hour / 24)}`}>
      <header className="topbar">
        <button className="wordmark" onClick={() => setPanel("help")}>
          AFTERLIGHT<span>A TOWN WORTH SAVING</span>
        </button>
        <div className="storm-clock">
          <span className="storm-dot" />
          <div>
            <strong>{Math.max(0, 72 - shown.hour)} hours to landfall</strong>
            <small>{time(shown.hour)} · Bellwether</small>
          </div>
        </div>
        <div className="resource-strip">
          <div>
            <small>RELIEF FUND</small>
            <strong>${shown.money.toLocaleString()}</strong>
          </div>
          <div>
            <small>VOLUNTEERS</small>
            <strong>
              {shown.staff}
              <span> people</span>
            </strong>
          </div>
          <div>
            <small>TRANSPORT</small>
            <strong>
              {shown.transport}
              <span> seats</span>
            </strong>
          </div>
        </div>
        <button
          className="icon-button sound"
          onClick={sound}
          aria-label={muted ? "Enable ambient sound" : "Mute ambient sound"}
        >
          {muted ? "Sound off" : "Sound on"}
        </button>
        <button
          className="menu-button"
          onClick={() => setPanel("help")}
          aria-label="How to play"
        >
          ?
        </button>
      </header>
      <main className="world-stage">
        <TownMap
          world={shown}
          selected={selected}
          onLocation={visit}
          onPerson={person}
        />
        <div className="weather-wash" />
        <section className="mission">
          <div className="eyebrow">
            {replay ? "RECORDED TIMELINE" : "THE BELLWETHER RESPONSE"}
          </div>
          <h1>
            {shown.hour < 24
              ? "Before the rain."
              : shown.hour < 48
                ? "The tide is turning."
                : shown.ended
                  ? "What we carried."
                  : "Leave no one behind."}
          </h1>
          <p>
            {shown.hour < 24
              ? "An empty warehouse. Twelve neighbors. Three days to make a difference."
              : shown.hour < 48
                ? "The first roads are flooding. Every hour now belongs to someone."
                : "The harbor is closing. The promises you made are coming due."}
          </p>
          <div className="mission-progress">
            <span>{shown.evacuated}/48 residents evacuated</span>
            <span>
              {shown.prepared
                ? "Warehouse stormproofed"
                : "Warehouse unsecured"}
            </span>
            <span>
              Shelter: {shown.delivered.food}/60 food · {shown.delivered.water}
              /60 water
            </span>
            <span>Clinic: {shown.delivered.medical}/10 medical kits</span>
          </div>
          <div className="mode-label">
            <i />
            {live ? "Live AI configured" : "Deterministic demo"}
            <button onClick={() => setPanel("help")}>ⓘ</button>
          </div>
        </section>
        <nav className="mobile-location-nav" aria-label="Town locations">
          {LOCATIONS.map((l) => (
            <button
              key={l.id}
              className={shown.location === l.id ? "active" : ""}
              disabled={busy || !!replay || world.ended}
              onClick={() => visit(l.id)}
            >
              {l.name}
              <small>
                {shown.location === l.id ? "You are here" : "Visit · 1h"}
              </small>
            </button>
          ))}
        </nav>
        <div className="map-caption">
          <span>BELLWETHER</span>
          <small>35° 12′ N &nbsp; 76° 42′ W · Fictional town</small>
        </div>
        <aside className="interaction-panel">
          <div className="place-heading">
            <span className="eyebrow">
              {character ? "A NEIGHBOR, NOT A NUMBER" : "YOU ARE HERE"}
            </span>
            <h2>{character ? character.name : location.name}</h2>
            <p>{character ? character.role : location.subtitle}</p>
            {character && (
              <button
                className="close-person"
                onClick={() => {
                  setSelected(undefined);
                  setReply(undefined);
                }}
                aria-label="Back to location"
              >
                ×
              </button>
            )}
          </div>
          <div className="panel-body">
            {character ? (
              <>
                <div className="person-summary">
                  <span
                    className="portrait"
                    style={{ background: character.color }}
                  >
                    {character.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </span>
                  <div>
                    <span className="status-label">
                      {character.recruited
                        ? "On your relief team"
                        : character.status}
                    </span>
                    <div className="trust-track">
                      <i style={{ width: `${character.trust}%` }} />
                    </div>
                    <small>Trust {Math.round(character.trust)} / 100</small>
                  </div>
                </div>
                <p className="character-motivation">“{character.motivation}”</p>
                {shown.commitments
                  .filter((c) => c.characterId === character.id)
                  .map((c) => (
                    <div className={`promise ${c.status}`} key={c.id}>
                      <b>
                        {c.status === "pending"
                          ? "Your promise"
                          : c.status === "kept"
                            ? "Promise kept"
                            : "Promise broken"}
                      </b>
                      <span>
                        {c.delivered}/{c.amount} {c.resource} · due{" "}
                        {time(c.dueHour)}
                      </span>
                    </div>
                  ))}
                {reply && (
                  <div className="conversation">
                    <span className="eyebrow">
                      {reply.mode === "live"
                        ? "LIVE RESPONSE"
                        : reply.mode === "fallback"
                          ? "DETERMINISTIC FALLBACK"
                          : "DEMO RESPONSE"}
                    </span>
                    <p>{reply.text}</p>
                    {reply.error && (
                      <small className="error">{reply.error}</small>
                    )}
                    {reply.proposal && (
                      <button
                        className="primary"
                        onClick={() => act(reply.proposal!)}
                        disabled={shown.ended || !!replay || busy}
                      >
                        Agree · {title(reply.proposal)} ·{" "}
                        {hoursFor(reply.proposal)}h
                      </button>
                    )}
                  </div>
                )}
                <form
                  className="talk-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void speak();
                  }}
                >
                  <input
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={`Ask ${character.name.split(" ")[0]} about helping…`}
                    aria-label="Message to resident"
                    maxLength={1200}
                    disabled={shown.ended || !!replay || busy}
                  />
                  <button
                    disabled={
                      busy || !message.trim() || shown.ended || !!replay
                    }
                    aria-label="Send message"
                  >
                    {busy ? "…" : "↗"}
                  </button>
                </form>
                <div className="quick-asks">
                  <button
                    onClick={() =>
                      void speak(
                        "What do you need, and how can we help each other?",
                      )
                    }
                    disabled={busy || shown.ended || !!replay}
                  >
                    What do you need?
                  </button>
                  <button
                    onClick={() => void speak("Do you remember my promise?")}
                    disabled={busy || shown.ended || !!replay}
                  >
                    Our promises
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="location-story">
                  {
                    {
                      warehouse:
                        "The old net loft smells of salt and cedar. Its doors are open. Now give people a reason to come.",
                      market:
                        "Canvas awnings stir above the square. The shelves are full, but everyone is doing the same arithmetic.",
                      clinic:
                        "The lights are still on. Inside, a few exhausted people are deciding who can safely move.",
                      harbor:
                        "Lines knock against the masts. A way out exists, if you can put the right people aboard.",
                      heights:
                        "Above the flood line, windows face the bay. Safe ground is only useful if people can reach it.",
                      radio:
                        "A small aerial reaches into the gathering clouds. The whole town is listening.",
                    }[location.id]
                  }
                </p>
                <div className="eyebrow residents-label">PEOPLE HERE</div>
                <div className="residents">
                  {shown.characters
                    .filter((c) => c.location === location.id)
                    .map((c) => (
                      <button key={c.id} onClick={() => person(c.id)}>
                        <span
                          className="avatar"
                          style={{ background: c.color }}
                        >
                          {c.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </span>
                        <span>
                          <strong>{c.name}</strong>
                          <small>{c.role}</small>
                        </span>
                        <span className="arrow">↗</span>
                      </button>
                    ))}
                </div>
              </>
            )}
            <div className="actions">
              <div className="eyebrow">
                {character ? "MAKE IT HAPPEN" : "AT THIS LOCATION"}
              </div>
              {actions.length ? (
                actions.map((a, i) => (
                  <button
                    key={i}
                    disabled={shown.ended || !!replay || busy}
                    onClick={() => act(a)}
                  >
                    <span>
                      {title(a)}
                      <small className="action-time">{hoursFor(a)} hours</small>
                    </span>
                    <b>↗</b>
                  </button>
                ))
              ) : (
                <p className="empty-note">
                  Talk to a neighbor or explore another location.
                </p>
              )}
            </div>
          </div>
          <div className="panel-footer">
            <span>Travel 1h · Conversations 1h</span>
            <button onClick={() => setPanel("journal")}>Field notes ↗</button>
          </div>
        </aside>
        <div className="supply-tray">
          <span className="eyebrow">WAREHOUSE</span>
          {(["food", "water", "medical", "fuel"] as const).map((r) => (
            <div key={r}>
              <b>{shown.inventory[r]}</b>
              <span>{r === "medical" ? "medicine" : r}</span>
            </div>
          ))}
          <button
            onClick={() => visit("warehouse")}
            aria-label="Return to warehouse"
          >
            ↗
          </button>
        </div>
      </main>
      <footer className="bottom-bar">
        <button
          className="latest-event"
          onClick={() => setEvent(shown.events.at(-1))}
        >
          <span className="event-pulse" />
          <span>
            <small>LATEST IN TOWN</small>
            <strong>
              {shown.events.at(-1)?.title ||
                "A storm is coming. Your response begins now."}
            </strong>
          </span>
          <b>↗</b>
        </button>
        <div className="time-controls">
          {replay ? (
            <>
              <span>
                Exact replay · {replay.index}/{replay.timeline.steps.length}
              </span>
              <button
                disabled={replay.index === 0}
                onClick={() =>
                  setReplay({ ...replay, index: replay.index - 1 })
                }
              >
                ←
              </button>
              <button
                disabled={replay.index === replay.timeline.steps.length}
                onClick={() =>
                  setReplay({ ...replay, index: replay.index + 1 })
                }
              >
                →
              </button>
              <button onClick={() => setReplay(null)}>Exit replay</button>
            </>
          ) : (
            <>
              <button onClick={checkpoint} disabled={world.ended || busy}>
                Checkpoint
              </button>
              <button onClick={() => setPanel("branches")}>Timelines</button>
              <button
                className="wait-button"
                disabled={world.ended || busy}
                onClick={() => act({ id: uid(), kind: "wait", hours: 6 })}
              >
                Wait 6h <span>→</span>
              </button>
            </>
          )}
        </div>
      </footer>
      {notice && (
        <div role="status" className="toast">
          {notice}
        </div>
      )}
      {intro && (
        <div className="modal-scrim intro-scrim">
          <section
            className="intro-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Welcome to Afterlight"
          >
            <span className="eyebrow">
              BELLWETHER · THREE DAYS BEFORE LANDFALL
            </span>
            <h2>
              The storm is coming.
              <br />
              <em>The town is still here.</em>
            </h2>
            <p>
              You have $10,000, an empty warehouse, and 72 hours. The people of
              Bellwether have plans of their own. Give them something worth
              believing in.
            </p>
            <div className="intro-choice">
              <span>YOUR FIRST STOP</span>
              <button
                onClick={() => {
                  setIntro(false);
                  markStarted();
                  visit("clinic");
                }}
              >
                <strong>People first</strong>
                <small>Find out what the clinic needs</small>
                <b>↗</b>
              </button>
              <button
                onClick={() => {
                  setIntro(false);
                  markStarted();
                  visit("market");
                }}
              >
                <strong>Build the supply line</strong>
                <small>Make a deal at Salt Market</small>
                <b>↗</b>
              </button>
            </div>
            <p className="intro-foot">
              Deterministic demo · Rule-based characters, no live AI by default
              <br />A playable town simulation · About 15 minutes
              <br />
              Decisions advance time. Take your time choosing.
            </p>
          </section>
        </div>
      )}
      {world.ended && !outcomeDismissed && !replay && (
        <div className="modal-scrim">
          <section
            className="outcome-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Scenario outcome"
          >
            <span className="eyebrow">AFTER THE STORM</span>
            <h2>{world.outcome?.title || "The morning after."}</h2>
            <p>{world.outcome?.summary}</p>
            <div className="outcome-numbers">
              <div>
                <strong>{world.evacuated}</strong>
                <span>people evacuated</span>
              </div>
              <div>
                <strong>
                  {world.commitments.filter((c) => c.status === "kept").length}
                </strong>
                <span>promises kept</span>
              </div>
              <div>
                <strong>{world.outcome?.score || 0}</strong>
                <span>response score</span>
              </div>
            </div>
            <p className="muted">
              Another decision could have changed this morning. Your timeline is
              saved.
            </p>
            <button
              className="primary"
              onClick={() => {
                setOutcomeDismissed(true);
                setPanel("branches");
              }}
            >
              Explore another outcome ↗
            </button>
            <button
              className="text-button"
              onClick={() => setOutcomeDismissed(true)}
            >
              Return to the town
            </button>
          </section>
        </div>
      )}
      {panel && (
        <div className="modal-scrim" onClick={() => setPanel(null)}>
          <section
            className="notebook"
            role="dialog"
            aria-modal="true"
            aria-label="Field notebook"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close"
              onClick={() => setPanel(null)}
              aria-label="Close panel"
            >
              ×
            </button>
            <span className="eyebrow">THE RELIEF COORDINATOR'S NOTEBOOK</span>
            <h2>
              {panel === "journal"
                ? "A town remembers."
                : panel === "branches"
                  ? "Other possible mornings."
                  : "Welcome to Bellwether."}
            </h2>
            {panel === "journal" ? (
              <>
                <p>
                  Recorded facts, validated decisions, and the consequences that
                  followed.
                </p>
                <div className="event-list">
                  {shown.events
                    .slice()
                    .reverse()
                    .map((e) => (
                      <button key={e.id} onClick={() => setEvent(e)}>
                        <small>
                          {time(e.hour)} · {e.kind}
                        </small>
                        <strong>{e.title}</strong>
                        <span>{e.description}</span>
                        <b>Inspect evidence ↗</b>
                      </button>
                    ))}
                </div>
              </>
            ) : panel === "branches" ? (
              <>
                <p>
                  Rewind creates a new branch. Your original decisions stay
                  intact. Exact replay views saved states without calling AI.
                </p>
                <button
                  className="primary"
                  disabled={busy}
                  onClick={checkpoint}
                >
                  Save checkpoint here
                </button>
                <h3>Return to a moment</h3>
                <div className="checkpoint-list">
                  {session.checkpoints.map((c) => (
                    <button
                      key={c.id}
                      disabled={busy}
                      onClick={() => rewind(c)}
                    >
                      <span>
                        <strong>{c.name}</strong>
                        <small>
                          ${c.state.money.toLocaleString()} ·{" "}
                          {c.state.evacuated} evacuated
                        </small>
                      </span>
                      <b>Branch ↗</b>
                    </button>
                  ))}
                </div>
                <h3>Compare responses</h3>
                <div className="comparison">
                  <div className="comparison-head">
                    <span>Timeline</span>
                    <span>Hour</span>
                    <span>Safe</span>
                    <span>Fund</span>
                  </div>
                  {[...session.archives, session.timeline].map((t) => {
                    const end = t.steps.at(-1)?.state || t.initial;
                    return (
                      <button
                        key={t.id}
                        onClick={() => {
                          setReplay({ timeline: t, index: 0 });
                          setPanel(null);
                        }}
                      >
                        <span>
                          {t.name}
                          {t.id === session.timeline.id ? " · active" : ""}
                          <small>
                            {end.outcome ? `Score ${end.outcome.score} · ` : ""}
                            {
                              end.commitments.filter((c) => c.status === "kept")
                                .length
                            }{" "}
                            promises kept ·{" "}
                            {
                              end.commitments.filter(
                                (c) => c.status === "broken",
                              ).length
                            }{" "}
                            broken
                          </small>
                          <small>View exact replay ↗</small>
                        </span>
                        <span>{end.hour}</span>
                        <span>{end.evacuated}</span>
                        <span>${end.money.toLocaleString()}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <>
                <p>
                  Explore the map. Listen to your neighbors. Turn a conversation
                  into a concrete deal, then deliver on it before the storm
                  arrives.
                </p>
                <ol className="help-steps">
                  <li>
                    <b>Explore.</b> Click a location or person. Travel and
                    actions advance the 72-hour clock; reading does not.
                  </li>
                  <li>
                    <b>Commit.</b> Buy supplies, recruit volunteers, arrange
                    transport, and prepare shelter. Every deal changes real
                    resources.
                  </li>
                  <li>
                    <b>Follow through.</b> Promises have deadlines. People
                    remember, and trust changes what they will do for you.
                  </li>
                  <li>
                    <b>Adapt.</b> Neighbors act whenever time advances. Inspect
                    field notes for the evidence behind each event.
                  </li>
                  <li>
                    <b>Try another path.</b> Checkpoint before a hard choice.
                    Timelines preserves your original response when you rewind.
                  </li>
                </ol>
                <div className="mode-detail">
                  <b>
                    {live
                      ? "Live character AI configured"
                      : "Deterministic demo mode"}
                  </b>
                  <p>
                    {live
                      ? "Conversation uses a server-side model. Proposed actions still require your confirmation and engine validation."
                      : "Character conversations use authored motivations and recorded memories. Independent behavior is rule-based. No model calls are made."}
                  </p>
                  <button className="text-button" onClick={sound}>
                    {muted ? "Turn ambient sound on" : "Mute ambient sound"}
                  </button>
                  <br />
                  <small>
                    Model usage: {usage.requests} requests · {usage.tokens}{" "}
                    tokens · request limit {usage.limit}
                  </small>
                </div>
                <p className="muted">
                  Goal: evacuate 48 people, deliver 60 food and 60 water to the
                  school, deliver 10 medical kits to the clinic, and stormproof
                  your warehouse. Recruit at least two helpers for evacuation
                  and preparation.
                </p>
                <p className="muted">
                  Your session is saved automatically in this browser. To enable
                  live AI, follow the server-side setup in README.md.
                </p>
                <button
                  className="text-button"
                  onClick={() => {
                    const text = JSON.stringify(session);
                    const url = URL.createObjectURL(
                      new Blob([text], { type: "application/json" }),
                    );
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "afterlight-save.json";
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  Export saved town ↓
                </button>
                <label className="text-button import-button">
                  Import saved town
                  <input
                    type="file"
                    accept="application/json"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      try {
                        if (f.size > 20000000) throw Error();
                        const s = JSON.parse(await f.text());
                        if (!validateSession(s)) throw Error();
                        setSession(s);
                        setPanel(null);
                        setReplay(null);
                        setNotice("Saved town restored.");
                      } catch {
                        setNotice(
                          "This save is invalid or incompatible. Your town has not changed.",
                        );
                      }
                    }}
                  />
                </label>
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() => {
                    const next = fresh();
                    setSession((previous) => ({
                      ...next,
                      archives: [
                        ...previous.archives,
                        clone(previous.timeline),
                      ],
                      timeline: {
                        ...next.timeline,
                        name: `Fresh response ${previous.archives.length + 1}`,
                      },
                    }));
                    setSelected(undefined);
                    setReply(undefined);
                    setPanel(null);
                    setReplay(null);
                    setOutcomeDismissed(false);
                    setIntro(true);
                  }}
                >
                  Start a new response · keep past timelines
                </button>
              </>
            )}
          </section>
        </div>
      )}
      {event && (
        <div
          className="modal-scrim event-scrim"
          onClick={() => setEvent(undefined)}
        >
          <section
            className="event-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Event evidence"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close"
              onClick={() => setEvent(undefined)}
              aria-label="Close event"
            >
              ×
            </button>
            <span className="eyebrow">
              RECORDED EVIDENCE · {time(event.hour)}
            </span>
            <h2>{event.title}</h2>
            <p>{event.description}</p>
            {[
              ["Known facts", event.facts],
              ["Rules & constraints", event.constraints],
              ["Committed effects", event.effects],
            ].map(([label, items]) => (
              <section key={label as string}>
                <h3>{label as string}</h3>
                <ul>
                  {(items as string[]).length === 0 && (
                    <li>
                      {label === "Committed effects"
                        ? "No resources changed."
                        : "No additional constraints recorded."}
                    </li>
                  )}
                  {(items as string[]).map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </section>
            ))}
            <small className="muted">
              Event {event.id} · {event.actor}
              <br />A concise record of causes and effects, not private model
              reasoning.
            </small>
          </section>
        </div>
      )}
    </div>
  );
}
