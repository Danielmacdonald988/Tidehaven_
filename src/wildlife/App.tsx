import { useCallback, useEffect, useRef, useState } from "react";
import WildlifeScene, { type Metrics } from "./Scene";
import Journal from "./Journal";
import {
  loadWildlife,
  saveWildlife,
  archiveWildlife,
  loadArchivedWildlife,
} from "./persistence";
import {
  createWildlife,
  wildlifeCommand,
  tickWildlife,
  wildlifeColliders,
  receptive,
} from "./engine";
import {
  SPECIES,
  SITES,
  REST_SITES,
  type WildlifeState,
  type WildlifeCommand,
  type SpeciesId,
} from "./contracts";
import { findCreatureApproach } from "./approach";
import { clearSegment } from "../three/navigation";
import type { Collider, Quality } from "../three/shared";
import type { ConversationReply, ConversationRequest } from "../contracts";
import "./wildlife.css";
const attentionNames: Record<SpeciesId, string> = {
  brindlefin: "Offer an open palm",
  cairnback: "Return the striped shell",
  pluvlet: "Touch the water",
  sailpip: "Raise a gentle hand",
  glasswhorl: "Echo the reflected light",
  tempestray: "Trace the wind",
};
export default function WildlifeApp() {
  const [view, setView] = useState(loadWildlife),
    state = useRef(view),
    base = useRef<Collider[]>([]),
    pending = useRef<SpeciesId | null>(null),
    lastPublish = useRef(0),
    [journal, setJournal] = useState(false),
    [options, setOptions] = useState(false),
    [paused, setPaused] = useState(false),
    [muted, setMuted] = useState(true),
    [volume, setVolume] = useState(0.5),
    [quality, setQuality] = useState<Quality>("high"),
    [sensitivity, setSensitivity] = useState(1),
    [metrics, setMetrics] = useState<Metrics | null>(null),
    [notice, setNotice] = useState(""),
    [charging, setCharging] = useState(false),
    [reaction, setReaction] = useState<{
      id: SpeciesId;
      until: number;
      kind: string;
    } | null>(null),
    [aiMode, setAiMode] = useState("Optional AI reactions · checking"),
    [aiEnabled, setAiEnabled] = useState(true),
    lastAI = useRef(-Infinity),
    calls = useRef(0),
    lastEvent = useRef(view.events.at(-1)?.id ?? 0),
    [celebrate, setCelebrate] = useState<SpeciesId | null>(null);
  const [sceneEpoch, setSceneEpoch] = useState(0);
  function expedition(restore = false) {
    const next = restore ? loadArchivedWildlife() : createWildlife();
    if (!next) {
      setNotice("No previous expedition saved.");
      return;
    }
    if (!archiveWildlife(state.current)) {
      setNotice("Storage unavailable. Your current expedition is unchanged.");
      return;
    }
    state.current = next;
    pending.current = null;
    lastEvent.current = next.events.at(-1)?.id ?? 0;
    setCelebrate(null);
    setReaction(null);
    setNotice("");
    setOptions(false);
    setPaused(false);
    setView({ ...next });
    saveWildlife(next);
    setSceneEpoch((v) => v + 1);
  }
  const publish = () => setView({ ...state.current });
  const act = useCallback((cmd: WildlifeCommand, colliders = base.current) => {
    const result = wildlifeCommand(state.current, cmd, colliders);
    state.current = result.state;
    if (!result.ok) setNotice(result.reason || "Try again gently.");
    setView({ ...state.current });
    if (result.ok && cmd.type !== "move") saveWildlife(state.current);
    return result.ok;
  }, []);
  const onCreature = useCallback(
    (id: SpeciesId) => {
      const c = state.current.creatures.find((c) => c.id === id);
      if (!c || c.bonded) return;
      if (state.current.selected === id && c.attention) {
        act({ type: "pulse", id });
        return;
      }
      const dx = state.current.player.x - c.position.x,
        dz = state.current.player.z - c.position.z,
        d = Math.hypot(dx, dz) || 1;
      const obstacles = [...base.current, ...wildlifeColliders(state.current)];
      const point = findCreatureApproach(
        state.current.player,
        c.position,
        obstacles,
      );
      if (!point) {
        setNotice("Try approaching from the open side.");
        return;
      }
      pending.current = id;
      act({ type: "move", point, quiet: true });
      if (
        d <= 5 &&
        clearSegment(state.current.player, c.position, [
          ...base.current,
          ...wildlifeColliders(state.current),
        ])
      ) {
        pending.current = null;
        act({ type: "select", id });
      }
    },
    [act],
  );
  const step = useCallback(
    (dt: number, colliders: Collider[]) => {
      state.current = tickWildlife(state.current, dt, colliders);
      if (pending.current) {
        const c = state.current.creatures.find((c) => c.id === pending.current);
        if (
          c &&
          Math.hypot(
            c.position.x - state.current.player.x,
            c.position.z - state.current.player.z,
          ) < 5 &&
          clearSegment(state.current.player, c.position, [
            ...colliders,
            ...wildlifeColliders(state.current),
          ])
        ) {
          const id = pending.current;
          pending.current = null;
          act({ type: "select", id });
        }
      }
      if (performance.now() - lastPublish.current > 100) {
        lastPublish.current = performance.now();
        setView({ ...state.current });
      }
    },
    [act],
  );
  useEffect(() => {
    document.title = "AFTERLIGHT — The Living Coast";
    const flush = () => saveWildlife(state.current);
    window.addEventListener("pagehide", flush);
    const timer = setInterval(flush, 2000);
    const key = (e: KeyboardEvent) => {
      if (
        e.defaultPrevented ||
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLSelectElement ||
        e.target instanceof HTMLButtonElement
      )
        return;
      if (e.code === "Space") {
        e.preventDefault();
        setPaused((v) => !v);
      }
      if (e.code === "KeyJ") setJournal((v) => !v);
      if (e.code === "Escape") {
        setJournal(false);
        setOptions(false);
      }
    };
    window.addEventListener("keydown", key);
    fetch("/api/status")
      .then((r) => r.json())
      .then((s) =>
        setAiMode(
          s.configured
            ? "AI reactions ready"
            : "Demo reactions · no API needed",
        ),
      )
      .catch(() => setAiMode("Offline · deterministic reactions"));
    return () => {
      clearInterval(timer);
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("keydown", key);
      saveWildlife(state.current);
    };
  }, []);
  useEffect(() => {
    const e = view.events.at(-1);
    if (!e || e.id === lastEvent.current) return;
    lastEvent.current = e.id;
    if (e.kind === "bond" && e.species) {
      setCelebrate(e.species);
    }
    if (e.kind === "reveal")
      setNotice("The chimes answer. Something moves above the water.");
  }, [view.events]);
  useEffect(() => {
    if (!celebrate) return;
    const timer = setTimeout(() => setCelebrate(null), 3800);
    return () => clearTimeout(timer);
  }, [celebrate]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 4200);
    return () => clearTimeout(t);
  }, [notice]);
  async function choose(id: SpeciesId) {
    if (!act({ type: "companion", id })) return;
    setJournal(false);
    if (
      !aiEnabled ||
      performance.now() - lastAI.current < 60000 ||
      calls.current >= 6
    )
      return;
    lastAI.current = performance.now();
    calls.current++;
    const species = SPECIES.find((s) => s.id === id)!;
    const request: ConversationRequest = {
      characterId: id,
      message:
        "Choose one small nonverbal reaction to accompanying the explorer. Do not speak, reveal an undiscovered creature, claim an ability occurred, or invent resources. Choose only an offered reaction.",
      context: {
        name: species.name,
        role: "Nonverbal coastal companion",
        motivation: species.personality,
        style: "One short grounded description; never dialogue.",
        hour: state.current.elapsed / 60,
        trust: 60,
        knowledge: [
          `Weather: ${state.current.weather}`,
          `Befriended at ${species.habitat}.`,
        ],
        publicFacts: [
          `The explorer chose ${species.name} to accompany them.`,
          `Known discoveries: ${state.current.creatures
            .filter((c) => c.discovered)
            .map((c) => SPECIES.find((s) => s.id === c.id)!.name)
            .join(", ")}`,
        ],
        memories: state.current.events
          .filter((e) => e.species === id)
          .slice(-3)
          .map((e) => ({
            eventId: String(e.id),
            hour: e.at / 60,
            text: e.detail,
            tags: ["witnessed"],
          })),
        availableActions: [
          {
            id: "look",
            kind: "talk",
            target: id,
            text: "Look toward the explorer with curiosity.",
          },
          {
            id: "play",
            kind: "talk",
            target: id,
            text: "Make a brief playful motion.",
          },
          {
            id: "quiet",
            kind: "talk",
            target: id,
            text: "Stay quietly beside the explorer.",
          },
        ],
      },
    };
    try {
      const controller = new AbortController(),
        timeout = setTimeout(() => controller.abort(), 13000);
      let reply: ConversationReply;
      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(request),
          signal: controller.signal,
        });
        if (!response.ok) throw Error();
        reply = await response.json();
      } finally {
        clearTimeout(timeout);
      }
      setAiMode(
        reply.mode === "live"
          ? "Live AI reaction verified"
          : reply.mode === "demo"
            ? "Demo reactions"
            : "AI fallback · core play unaffected",
      );
      const kind = reply.proposal?.id;
      if (
        state.current.companion === id &&
        kind &&
        ["look", "play", "quiet"].includes(kind)
      )
        setReaction({ id, until: performance.now() + 2400, kind });
    } catch {
      setAiMode("AI unavailable · core play unaffected");
    }
  }
  const selected = view.creatures.find(
      (c) => c.id === view.selected && !c.bonded && c.available,
    ),
    spec = SPECIES.find((s) => s.id === selected?.id),
    companion = SPECIES.find((s) => s.id === view.companion),
    bonded = view.creatures.filter((c) => c.bonded).length,
    near = (p: { x: number; z: number }, r = 5) =>
      Math.hypot(view.player.x - p.x, view.player.z - p.z) < r;
  const encounterReachable =
    !!selected &&
    near(selected.position, 5) &&
    clearSegment(view.player, selected.position, [
      ...base.current,
      ...wildlifeColliders(view),
    ]);
  const pulse = () => {
    setCharging(false);
    if (selected) act({ type: "pulse", id: selected.id });
  };
  return (
    <main className="wildlife-root">
      <WildlifeScene
        key={sceneEpoch}
        getState={() => state.current}
        paused={paused || journal || options}
        muted={muted}
        volume={volume}
        quality={quality}
        sensitivity={sensitivity}
        reaction={reaction}
        onTick={step}
        onCommand={(cmd, b) => {
          pending.current = null;
          act(cmd, b);
        }}
        onCreature={onCreature}
        onReady={(b) => {
          base.current = b;
          publish();
        }}
        onMetrics={setMetrics}
      />
      <div className="wildlife-shade" />
      <header className="wildlife-header">
        <div>
          <span>AFTERLIGHT</span>
          <small>THE LIVING COAST</small>
        </div>
        <nav>
          <button
            onClick={() => setMuted((v) => !v)}
            aria-label={muted ? "Enable wildlife sound" : "Mute wildlife sound"}
          >
            {muted ? "Sound off" : "Sound on"}
          </button>
          <button onClick={() => setJournal(true)}>
            Field journal <b>{bonded}/6</b>
          </button>
          <button
            aria-label="Exploration options"
            onClick={() => setOptions(true)}
          >
            •••
          </button>
        </nav>
      </header>
      <aside className="wildlife-weather">
        <i className={`weather-dot ${view.weather}`} />
        {view.weather === "fair"
          ? "Salt air & soft light"
          : view.weather === "rain"
            ? "Rain wakes the garden"
            : view.weather === "dusk"
              ? "The coast turns violet"
              : "The weather is singing"}
        <small>Free exploration · no countdown</small>
      </aside>
      {bonded === 0 && !selected && (
        <div className="wildlife-first">
          <p>Something small is stirring.</p>
          <span>Follow the little shoreline prints.</span>
        </div>
      )}
      {selected && spec && !journal && !options && (
        <section className="wildlife-encounter">
          <div>
            <small>{spec.habitat}</small>
            <h1>{spec.name}</h1>
            <p>
              {selected.alarm > 0
                ? "A little space. It will return."
                : selected.attention
                  ? receptive(view, selected)
                    ? "Its crest answers yours."
                    : "Listen for the next bright moment."
                  : selected.id === "sailpip"
                    ? selected.phase % 8 <= 3
                      ? "A hovering pause. Now, gently."
                      : "Follow it. Wait for a hovering pause."
                    : "A quiet greeting is enough."}
            </p>
          </div>
          {!selected.attention ? (
            <button
              disabled={selected.alarm > 0}
              onClick={() =>
                encounterReachable
                  ? act({ type: "attention" })
                  : onCreature(spec.id)
              }
            >
              {!encounterReachable
                ? "Approach quietly"
                : attentionNames[spec.id]}{" "}
              <span>↗</span>
            </button>
          ) : (
            <button
              className={`resonance ${receptive(view, selected) ? "ready" : ""} ${charging ? "charging" : ""}`}
              onPointerDown={() => setCharging(true)}
              onPointerUp={pulse}
              onPointerCancel={() => setCharging(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  pulse();
                }
              }}
            >
              {charging
                ? "Release gently"
                : receptive(view, selected)
                  ? "Release resonance"
                  : "Listen · then release"}
              <span>◌</span>
            </button>
          )}
          <button
            className="dismiss"
            aria-label="Leave encounter"
            onClick={() => {
              state.current = { ...state.current, selected: null };
              publish();
            }}
          >
            ×
          </button>
        </section>
      )}
      {!selected && !journal && !options && (
        <div className="wildlife-context">
          {!view.foundShell && near(SITES.shell, 3.3) && (
            <button onClick={() => act({ type: "shell" })}>
              Pick up the striped shell <span>↗</span>
            </button>
          )}
          {REST_SITES.some((p) => near(p, 4)) && (
            <button onClick={() => act({ type: "weather" })}>
              Rest ·{" "}
              {view.weather === "fair"
                ? "wait for rain"
                : view.weather === "rain"
                  ? "watch dusk arrive"
                  : view.weather === "dusk"
                    ? "listen for a storm"
                    : "welcome clear skies"}{" "}
              <span>↗</span>
            </button>
          )}
          {companion?.ability &&
            near(SITES[companion.ability], 6) &&
            !view.abilities[companion.ability] && (
              <button
                className="ability"
                onClick={() =>
                  act({ type: "ability", target: companion.ability! })
                }
              >
                {companion.ability === "tracks"
                  ? "Brindlefin, find the hidden tracks"
                  : companion.ability === "gate"
                    ? "Cairnback, move the driftwood"
                    : "Pluvlet, light the passage"}{" "}
                <span>✧</span>
              </button>
            )}
          {near(SITES.bell, 4) && (
            <button onClick={() => act({ type: "bell" })}>
              Sound the weather chimes <span>↗</span>
            </button>
          )}
        </div>
      )}
      {companion && !journal && (
        <button className="wildlife-companion" onClick={() => setJournal(true)}>
          <span style={{ background: companion.color }} />
          <div>
            <small>WITH YOU</small>
            {companion.name}
          </div>
          <b>↗</b>
        </button>
      )}
      {notice && (
        <div className="wildlife-notice" role="status">
          {notice}
        </div>
      )}
      {celebrate && (
        <div className="wildlife-bond">
          <small>A NEW FRIEND</small>
          <h2>{SPECIES.find((s) => s.id === celebrate)!.name}</h2>
          <span>Not caught. Chosen.</span>
        </div>
      )}
      <footer className="wildlife-footer">
        <span>
          {paused ? "PAUSED" : "Click to walk · Click a creature to approach"}
        </span>
        <small>Drag to look · J journal · Space pause</small>
      </footer>
      {journal && (
        <Journal
          state={view}
          onChoose={choose}
          onClose={() => setJournal(false)}
        />
      )}
      {options && (
        <section className="wildlife-options" aria-label="Exploration options">
          <button
            className="dismiss"
            aria-label="Close exploration options"
            onClick={() => setOptions(false)}
          >
            ×
          </button>
          <h2>A little breathing room.</h2>
          <label>
            <input
              type="checkbox"
              checked={view.assistance}
              onChange={(e) =>
                act({ type: "assistTiming", enabled: e.target.checked })
              }
            />{" "}
            Gentle timing assistance
          </label>
          <p>
            Assisted pulses answer any curious moment. Switch off for the
            bright-crest timing window.
          </p>
          <label>
            Volume
            <input
              aria-label="Wildlife volume"
              type="range"
              min="0"
              max="1"
              step=".05"
              value={volume}
              onChange={(e) => setVolume(+e.target.value)}
            />
          </label>
          <label>
            Camera sensitivity
            <input
              aria-label="Camera sensitivity"
              type="range"
              min=".3"
              max="2"
              step=".1"
              value={sensitivity}
              onChange={(e) => setSensitivity(+e.target.value)}
            />
          </label>
          <label>
            Graphics
            <select
              aria-label="Wildlife graphics"
              value={quality}
              onChange={(e) => setQuality(e.target.value as Quality)}
            >
              <option value="high">High</option>
              <option value="low">Low</option>
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              checked={aiEnabled}
              onChange={(e) => setAiEnabled(e.target.checked)}
            />{" "}
            Occasional AI companion reactions
          </label>
          <small>
            {aiMode}
            <br />
            At most six requests this session, at least one minute apart.
            Movement and bonding never wait for AI.
          </small>
          <button
            onClick={() => {
              setPaused((v) => !v);
              setOptions(false);
            }}
          >
            {paused ? "Resume exploring" : "Pause exploration"}
          </button>
          {metrics && (
            <small>
              {metrics.fps} FPS · p95 {metrics.p95} ms
              <br />
              {metrics.draws} draws · {metrics.triangles.toLocaleString()}{" "}
              triangles
            </small>
          )}
          <div className="wildlife-expeditions">
            <button onClick={() => expedition()}>New expedition</button>
            <button onClick={() => expedition(true)}>
              Restore previous expedition
            </button>
          </div>
          <small>
            Starting again keeps one recoverable previous expedition.
          </small>
          <nav>
            <a href="?rescue">Storm rescue ↗</a>
            <a href="?campaign">Original campaign ↗</a>
          </nav>
        </section>
      )}
    </main>
  );
}
