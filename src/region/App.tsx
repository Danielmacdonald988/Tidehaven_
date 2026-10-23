import { useCallback, useEffect, useRef, useState } from "react";
import WildlifeScene, { type Metrics } from "./Scene";
import { loadRegion, saveRegion } from "./persistence";
import {
  regionCommand,
  tickRegion,
  regionInteractions,
  expeditionGuidance,
} from "./engine";
import {
  REGION_BOUNDS,
  type RegionCommand,
  type DriveInput,
} from "./contracts";
import { ClipRecorder } from "./ClipRecorder";
import RegionMap from "./Map";
import ResidentTalk from "./Talk";
import "./region.css";
import Journal from "../wildlife/Journal";
import { wildlifeColliders, receptive } from "../wildlife/engine";
import {
  SPECIES,
  SITES,
  REST_SITES,
  type WildlifeCommand,
  type SpeciesId,
} from "../wildlife/contracts";
import { findCreatureApproach } from "../wildlife/approach";
import { clearSegment } from "../three/navigation";
import type { Collider, Quality } from "../three/shared";
import type { ConversationReply, ConversationRequest } from "../contracts";
import "../wildlife/wildlife.css";
const readSetting = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const storeSetting = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* Private mode keeps this session usable. */
  }
};
const attentionNames: Record<SpeciesId, string> = {
  brindlefin: "Offer an open palm",
  cairnback: "Return the striped shell",
  pluvlet: "Touch the water",
  sailpip: "Raise a gentle hand",
  glasswhorl: "Echo the reflected light",
  tempestray: "Trace the wind",
};
export default function RegionApp() {
  const [initialRegion] = useState(loadRegion);
  const region = useRef(initialRegion);
  const [map, setMap] = useState(false),
    [talk, setTalk] = useState<string | null>(null),
    [missions, setMissions] = useState(false);
  const [driveInput, setDriveInput] = useState<DriveInput>({
    throttle: 0,
    steer: 0,
    brake: false,
  });
  const [view, setView] = useState(region.current.wildlife),
    state = useRef(view),
    base = useRef<Collider[]>([]),
    pending = useRef<SpeciesId | null>(null),
    lastPublish = useRef(0),
    [journal, setJournal] = useState(false),
    [options, setOptions] = useState(false),
    [paused, setPaused] = useState(false),
    [muted, setMuted] = useState(true),
    [volume, setVolume] = useState(0.5),
    [quality, setQuality] = useState<Quality>(() =>
      readSetting("afterlight-graphics") === "low" ? "low" : "high",
    ),
    [ambientOcclusion, setAmbientOcclusion] = useState(
      () => readSetting("afterlight-depth-shading") !== "off",
    ),
    [renderScale, setRenderScale] = useState(() => {
      const v = Number(readSetting("afterlight-render-scale"));
      return [0.75, 1, 1.25].includes(v) ? v : 1;
    }),
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
  const publish = () => setView({ ...state.current });
  const act = useCallback((cmd: WildlifeCommand, colliders = base.current) => {
    const result = regionCommand(
      region.current,
      { type: "wildlife", command: cmd },
      colliders,
    );
    region.current = result.state;
    state.current = result.state.wildlife;
    if (!result.ok) setNotice(result.reason || "Try again gently.");
    setView({ ...state.current });
    if (result.ok && cmd.type !== "move") saveRegion(region.current);
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
        REGION_BOUNDS,
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
    (dt: number, colliders: Collider[], input: DriveInput) => {
      region.current = tickRegion(region.current, dt, colliders, input);
      state.current = region.current.wildlife;
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
    const flush = () => saveRegion(region.current);
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
      saveRegion(region.current);
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
    if (e.kind === "ability" || e.kind === "pulse") setNotice(e.detail);
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
  function command(cmd: RegionCommand) {
    const previousEvent = region.current.events.at(-1)?.id;
    const result = regionCommand(region.current, cmd, base.current);
    region.current = result.state;
    state.current = result.state.wildlife;
    if (!result.ok) setNotice(result.reason || "Come a little closer.");
    else if (
      result.state.events.at(-1)?.id !== previousEvent &&
      cmd.type !== "waypoint" &&
      cmd.type !== "driveTarget" &&
      cmd.type !== "talk"
    )
      setNotice(result.state.events.at(-1)?.detail || "");
    setView({ ...state.current });
    saveRegion(region.current);
    return result.ok;
  }
  function interact(id: string) {
    const item = regionInteractions(region.current).find((i) => i.id === id);
    if (
      item &&
      Math.hypot(
        item.position.x - state.current.player.x,
        item.position.z - state.current.player.z,
      ) > item.radius
    ) {
      act({ type: "move", point: item.position, quiet: false });
      setNotice("Approach, then use the nearby action.");
      return;
    }
    if (id.startsWith("resident-")) {
      setTalk(id.slice(9));
      return;
    }
    if (id === "dispatch") {
      setTalk("inez");
      return;
    }
    if (id === "mission") {
      setMissions(true);
      return;
    }
    if (id === "vehicle") {
      command({ type: region.current.vehicle.occupied ? "exit" : "enter" });
      return;
    }
    command({ type: "interact", id });
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
        getState={() => state.current}
        getRegion={() => region.current}
        onInteract={interact}
        onDriveTarget={(point) => command({ type: "driveTarget", point })}
        driveInput={driveInput}
        paused={paused || journal || options || map || !!talk || missions}
        muted={muted}
        volume={volume}
        quality={quality}
        renderScale={renderScale}
        ambientOcclusion={ambientOcclusion}
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
          <small>
            {region.current.district.toUpperCase()} · THE LIVING COAST
          </small>
        </div>
        <nav>
          <button onClick={() => setMap(true)}>Coastal map</button>
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
      {false && bonded === 0 && !selected && (
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
                    ? selected.id === "brindlefin"
                      ? "Fins open. A little paw reaches toward you."
                      : "Its crest answers yours."
                    : selected.id === "brindlefin"
                      ? "A curious tilt. Wait for its fins to open."
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
              region.current.wildlife = state.current;
              publish();
            }}
          >
            ×
          </button>
        </section>
      )}
      {!selected &&
        !journal &&
        !options &&
        !map &&
        !talk &&
        !region.current.vehicle.occupied && (
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
      {companion && !journal && !region.current.vehicle.occupied && (
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
          <span>
            {celebrate === "brindlefin" && !view.abilities.tracks
              ? "Follow the shells together. Something waits in the sand."
              : "Not caught. Chosen."}
          </span>
        </div>
      )}
      <footer className="wildlife-footer">
        <span>
          {paused
            ? "PAUSED"
            : (expeditionGuidance(region.current) ??
              "Click to walk · People, creatures & your truck are interactive")}
        </span>
        <small>WASD move/drive · B brake · Drag camera · Space pause</small>
      </footer>
      <div className="region-status">
        <b>${region.current.campaign.money.toLocaleString()}</b>
        <span>
          {region.current.vehicle.occupied
            ? `${Math.round(Math.abs(region.current.vehicle.speed) * 3.6)} km/h · ${region.current.vehicle.cargo}/8 crates`
            : "Free roam · your own pace"}
        </span>
      </div>
      {!journal && !options && !map && !talk && !missions && (
        <div className="region-actions">
          {region.current.vehicle.occupied ? (
            <>
              <button onClick={() => command({ type: "exit" })}>
                Park & step out
              </button>
              <button onClick={() => command({ type: "recover" })}>
                Recover vehicle
              </button>
              <button onClick={() => setMap(true)}>
                Choose driving destination
              </button>
            </>
          ) : (
            regionInteractions(region.current)
              .filter((i) => near(i.position, i.radius))
              .slice(0, 5)
              .map((i) => (
                <button key={i.id} onClick={() => interact(i.id)}>
                  {i.label}
                </button>
              ))
          )}
        </div>
      )}
      {region.current.vehicle.occupied && !map && (
        <div className="drive-pad" aria-label="Mouse driving controls">
          {[
            { label: "Reverse", throttle: -1, steer: 0 },
            { label: "Left", throttle: 0, steer: 1 },
            { label: "Accelerate", throttle: 1, steer: 0 },
            { label: "Right", throttle: 0, steer: -1 },
          ].map((k) => (
            <button
              key={k.label}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                setDriveInput({
                  throttle: k.throttle,
                  steer: k.steer,
                  brake: false,
                });
              }}
              onPointerUp={() =>
                setDriveInput({ throttle: 0, steer: 0, brake: false })
              }
              onPointerCancel={() =>
                setDriveInput({ throttle: 0, steer: 0, brake: false })
              }
            >
              {k.label}
            </button>
          ))}
          <button
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              setDriveInput({ throttle: 0, steer: 0, brake: true });
            }}
            onPointerUp={() =>
              setDriveInput({ throttle: 0, steer: 0, brake: false })
            }
            onPointerCancel={() =>
              setDriveInput({ throttle: 0, steer: 0, brake: false })
            }
          >
            Brake
          </button>
        </div>
      )}
      {region.current.delivery.status === "accepted" ||
      region.current.delivery.status === "loaded" ? (
        <aside className="region-job">
          {region.current.delivery.status === "accepted"
            ? "Harbor freight · park beside the cargo bay, then load eight crates."
            : "Eight crates aboard · bring them home to your warehouse."}
          <button onClick={() => command({ type: "abandonDelivery" })}>
            Abandon job
          </button>
        </aside>
      ) : null}
      {map && (
        <RegionMap
          state={region.current}
          onClose={() => setMap(false)}
          onWaypoint={(point) => command({ type: "waypoint", point })}
          onTravel={(point) => {
            setMap(false);
            region.current.vehicle.occupied
              ? command({ type: "driveTarget", point })
              : act({ type: "move", point, quiet: false });
          }}
        />
      )}
      {talk && (
        <ResidentTalk
          key={talk}
          id={talk}
          state={region.current}
          onClose={() => setTalk(null)}
          onCommand={command}
        />
      )}
      {missions && (
        <section className="region-dialog">
          <button onClick={() => setMissions(false)}>Close</button>
          <h2>Weather the storm</h2>
          <p>
            Free roam is saved. Story missions retain their own existing
            checkpoints.
          </p>
          <a href="?rescue">Play storm rescue</a>
          <a href="?campaign">Continue relief campaign</a>
        </section>
      )}
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
              onChange={(e) => {
                setQuality(e.target.value as Quality);
                storeSetting("afterlight-graphics", e.target.value);
              }}
            >
              <option value="high">Coastal · detailed shadows</option>
              <option value="low">Performance · contact shadows</option>
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              checked={ambientOcclusion}
              onChange={(e) => {
                setAmbientOcclusion(e.target.checked);
                storeSetting(
                  "afterlight-depth-shading",
                  e.target.checked ? "on" : "off",
                );
              }}
            />
            Depth shading · Coastal preset
          </label>
          <label>
            Render resolution
            <select
              aria-label="Render resolution"
              value={renderScale}
              onChange={(e) => {
                const v = Number(e.target.value);
                setRenderScale(v);
                storeSetting("afterlight-render-scale", String(v));
              }}
            >
              <option value={0.75}>75% · faster</option>
              <option value={1}>100% · recommended</option>
              <option value={1.25}>125% · sharper</option>
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
              <br />
              {metrics.geometries} geometries · {metrics.textures} textures
              <br />
              {metrics.resolution} render pixels
              <br />
              {metrics.capabilities}
              <br />
              {metrics.gpu}
            </small>
          )}
          <nav>
            <a href="?rescue">Storm rescue ↗</a>
            <a href="?campaign">Original campaign ↗</a>
          </nav>
        </section>
      )}
      <div hidden={!options} className="region-clip-panel">
        <ClipRecorder onStart={() => setOptions(false)} />
      </div>
    </main>
  );
}
