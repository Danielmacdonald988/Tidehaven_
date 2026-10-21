import { useCallback, useEffect, useRef, useState } from "react";
import RescueScene, { type RescueMetrics } from "./RescueScene";
import {
  createRescue,
  validateRescueState,
  command,
  tick,
  rescueColliders,
  rescueTargets,
  objective,
  type RescueState,
  type RescueCommand,
} from "./engine";
import { clearSegment } from "../three/navigation";
import type { Collider, Quality } from "../three/shared";
import type { ConversationReply, ConversationRequest } from "../contracts";
import "./rescue.css";
const SAVE = "afterlight-storm-rescue-v1";
function initial(): RescueState {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE) || "null");
    if (validateRescueState(saved)) return saved;
  } catch {}
  return createRescue();
}
export default function RescueApp() {
  const [view, setView] = useState<RescueState>(initial),
    ref = useRef<RescueState>(view),
    colliders = useRef<Collider[]>([]),
    [paused, setPaused] = useState(false),
    [muted, setMuted] = useState(true),
    [volume, setVolume] = useState(0.6),
    [quality, setQuality] = useState<Quality>("high"),
    [shake, setShake] = useState(true),
    [sensitivity, setSensitivity] = useState(1),
    [settings, setSettings] = useState(false),
    [instruction, setInstruction] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(
      "Inez, help me lift the beam so we can reach Jo.",
    ),
    [reply, setReply] = useState<ConversationReply | null>(null),
    [notice, setNotice] = useState(""),
    [provenance, setProvenance] = useState("Checking AI connection"),
    [metrics, setMetrics] = useState<RescueMetrics | null>(null),
    pending = useRef<string | null>(null),
    [ready, setReady] = useState(false),
    lastPublish = useRef(0),
    epoch = useRef(0);
  const publish = () => setView({ ...ref.current });
  const act = useCallback((cmd: RescueCommand, base = colliders.current) => {
    const result = command(ref.current, cmd, base);
    ref.current = result.state;
    if (!result.ok) setNotice(result.reason || "Move closer to try that.");
    setView({ ...ref.current });
    return result.ok;
  }, []);
  const target = useCallback(
    (id: string) => {
      const t = rescueTargets(ref.current).find((x) => x.id === id);
      if (!t) return;
      pending.current = id;
      act({ type: "move", point: t.position });
    },
    [act],
  );
  const step = useCallback(
    (dt: number, base: Collider[]) => {
      ref.current = tick(ref.current, dt, base);
      const id = pending.current;
      if (id) {
        const t = rescueTargets(ref.current).find((x) => x.id === id);
        if (!t) pending.current = null;
        else if (
          Math.hypot(
            ref.current.player.x - t.position.x,
            ref.current.player.z - t.position.z,
          ) < 2.4 &&
          clearSegment(ref.current.player, t.position, [
            ...base,
            ...rescueColliders(ref.current),
          ])
        ) {
          pending.current = null;
          if (id === "beam") {
            ref.current = { ...ref.current, path: [], playerSpeed: 0 };
            setInstruction(true);
            setReply(null);
          } else act({ type: "interact", target: id });
        }
      }
      if (performance.now() - lastPublish.current > 100) {
        lastPublish.current = performance.now();
        setView({ ...ref.current });
      }
    },
    [act],
  );
  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then((s) =>
        setProvenance(
          ref.current.assistMode === "live"
            ? "LIVE AI · recorded instruction"
            : s.configured
              ? "AI ready · awaiting instruction"
              : "Deterministic demo",
        ),
      )
      .catch(() => setProvenance("Offline · demo available"));
    const save = setInterval(() => {
      localStorage.setItem(SAVE, JSON.stringify(ref.current));
    }, 2000);
    const keys = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.code === "Space") {
        e.preventDefault();
        setPaused((v) => !v);
      }
      if (e.code === "Escape") {
        setInstruction(false);
        setSettings(false);
      }
    };
    window.addEventListener("keydown", keys);
    return () => {
      clearInterval(save);
      window.removeEventListener("keydown", keys);
    };
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(timer);
  }, [notice]);
  async function ask() {
    if (busy || !message.trim()) return;
    setBusy(true);
    setReply(null);
    const generation = epoch.current;
    const state = ref.current;
    const request: ConversationRequest = {
      characterId: "inez",
      message: message.trim(),
      purpose: "conversation",
      context: {
        name: "Inez Cruz",
        role: "Mechanic beside a storm rescue",
        motivation:
          "Reach Jo inside Bay Radio safely. Help the player lift the fallen beam together. Never send anyone under an unstable awning.",
        style:
          "One short practical sentence. No long explanation. Respond to this immediate physical emergency.",
        hour: 54 + state.elapsed / 120,
        trust: 55,
        knowledge: [
          "I witnessed the transformer fail. Jo is inside Bay Radio.",
          "The front beam can be lifted with two people; an east service doorway is the alternative.",
        ],
        publicFacts: [
          "The player is beside the blocked entrance.",
          "Lifting means physically walking over and working for nine seconds.",
          "No resources or rescue have occurred yet.",
        ],
        memories: state.events.slice(-5).map((e) => ({
          text: e.detail,
          eventId: String(e.id),
          hour: e.at / 120,
          tags: ["witnessed", "rescue"],
        })),
        availableActions: [
          {
            id: "rescue-assist",
            kind: "recruit",
            target: "inez",
            text: "Help lift the beam at Bay Radio; approach and work together.",
          },
        ],
      },
    };
    try {
      const controller = new AbortController(),
        timeout = setTimeout(() => controller.abort(), 15000);
      let response: Response;
      try {
        response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(request),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }
      if (!response.ok) throw Error("request");
      const result: ConversationReply = await response.json();
      if (generation !== epoch.current) return;
      setReply(result);
      setProvenance(
        result.mode === "live"
          ? "LIVE AI · instruction verified"
          : result.mode === "demo"
            ? "Deterministic demo"
            : "AI unavailable · fallback",
      );
    } catch {
      if (generation === epoch.current) {
        setReply({
          mode: "fallback",
          text: "The radio link is down. Use the agreed hand signal and Inez can help.",
          proposal: {
            id: "rescue-assist",
            kind: "recruit",
            target: "inez",
            text: "Help lift the beam",
          },
        });
        setProvenance("AI unavailable · fallback");
      }
    } finally {
      if (generation === epoch.current) setBusy(false);
    }
  }
  function accept() {
    if (
      reply?.proposal?.id !== "rescue-assist" ||
      reply.proposal.kind !== "recruit"
    )
      return;
    if (act({ type: "assist", mode: reply.mode })) {
      setInstruction(false);
      setReply(null);
    }
  }
  const started = (view as RescueState & { started?: boolean }).started;
  const near = rescueTargets(view).filter(
    (t) =>
      Math.hypot(view.player.x - t.position.x, view.player.z - t.position.z) <
      5,
  );
  return (
    <main className="rescue-root">
      <RescueScene
        state={view}
        getState={() => ref.current}
        paused={paused || settings || instruction || busy}
        muted={muted}
        volume={volume}
        quality={quality}
        shake={shake}
        sensitivity={sensitivity}
        onTick={step}
        onCommand={(cmd, base) => {
          pending.current = null;
          act(cmd, base);
        }}
        onReady={(base) => {
          colliders.current = base;
          setReady(true);
        }}
        onMetrics={setMetrics}
        onTarget={target}
      />
      <div className="rescue-grain" />
      <header className="rescue-header">
        <a href="?campaign" aria-label="Return to original campaign">
          AFTERLIGHT<span>A STORM RESCUE</span>
        </a>
        <nav>
          <button
            onClick={() => setMuted((v) => !v)}
            aria-label={muted ? "Enable sound" : "Mute sound"}
          >
            {muted ? "Sound off" : "Sound on"}
          </button>
          <button onClick={() => setPaused((v) => !v)}>
            {paused ? "Resume" : "Pause"}
          </button>
          <button
            onClick={() => setSettings(true)}
            aria-label="Rescue settings"
          >
            Options
          </button>
        </nav>
      </header>
      {!started ? (
        <section className="rescue-title">
          <p>THE WATERFRONT / 18:42</p>
          <h1>
            When the
            <br />
            lights go out.
          </h1>
          <p className="rescue-intro">
            One neighbor still inside.
            <br />
            One road back to safety.
          </p>
          <button
            className="rescue-primary"
            disabled={!ready}
            onClick={() => {
              act({ type: "start" });
              setMuted(false);
            }}
          >
            Enter the storm <span>↗</span>
          </button>
          <small>Click to walk · Drag to look · Sound recommended</small>
          <a href="?campaign">Continue the original campaign</a>
        </section>
      ) : (
        <>
          <section className="rescue-objective">
            <span>
              {view.phase === "aftermath"
                ? "THE MORNING AFTER"
                : "STAY TOGETHER"}
            </span>
            <h1>{objective(view)}</h1>
            {view.phase === "approach" && (
              <p>
                Follow the emergency lamp east. The service entrance offers
                another way inside.
              </p>
            )}
          </section>
          {!instruction &&
            !settings &&
            view.phase !== "opening" &&
            view.phase !== "blackout" && (
              <div className="rescue-actions">
                {near.map((t) => (
                  <button key={t.id} onClick={() => target(t.id)}>
                    {t.label}
                    <span>↗</span>
                  </button>
                ))}
                {view.phase === "approach" && !near.length && (
                  <button
                    onClick={() =>
                      target(view.passage === "cleared" ? "victim" : "beam")
                    }
                  >
                    {view.passage === "cleared"
                      ? "Reach Jo inside"
                      : "Approach the blocked entrance"}{" "}
                    <span>↗</span>
                  </button>
                )}
                {view.escortStage > 0 &&
                  !view.rescued &&
                  !near.some((t) => t.id === "shelter") && (
                    <button onClick={() => target("shelter")}>
                      Lead Jo to the lit warehouse <span>↗</span>
                    </button>
                  )}
              </div>
            )}
          <footer className="rescue-footer">
            <span>{provenance}</span>
            <small>
              {paused
                ? "PAUSED"
                : busy
                  ? "AI RESPONSE · TIME PAUSED"
                  : "Click ground to move · Drag camera · WASD optional"}
            </small>
          </footer>
        </>
      )}
      {view.phase === "helping" && (
        <div className="rescue-progress">
          <span>Two people. One clear passage.</span>
          <progress max={9} value={view.helping} />
        </div>
      )}
      {view.phase === "collapse" && (
        <div className="rescue-warning">
          AWNING COMING DOWN — KEEP TO THE EAST DOOR
        </div>
      )}
      {notice && (
        <div role="status" className="rescue-notice">
          {notice}
        </div>
      )}
      {instruction && (
        <section
          className="rescue-instruction"
          aria-label="Give Inez an instruction"
        >
          <button
            className="rescue-close"
            onClick={() => setInstruction(false)}
            aria-label="Close instruction"
          >
            ×
          </button>
          <small>INEZ / WITHIN SPEAKING DISTANCE</small>
          <h2>A hand on the other end.</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              ask();
            }}
          >
            <input
              aria-label="Instruction for Inez"
              maxLength={300}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={busy}
            />
            <button disabled={busy || !message.trim()}>
              {busy ? "Listening…" : "Ask Inez"}
            </button>
          </form>
          {reply && (
            <>
              <p>{reply.text}</p>
              {reply.proposal?.id === "rescue-assist" && (
                <button className="rescue-primary" onClick={accept}>
                  Lift together
                </button>
              )}
            </>
          )}
          <button
            className="rescue-alternative"
            onClick={() => {
              setInstruction(false);
              target("side-door");
            }}
          >
            Take the east service doorway instead ↗
          </button>
          <small>{provenance} · no deadline while speaking</small>
        </section>
      )}
      {settings && (
        <section className="rescue-options" aria-label="Rescue options">
          <button
            className="rescue-close"
            onClick={() => setSettings(false)}
            aria-label="Close options"
          >
            ×
          </button>
          <h2>Make yourself comfortable.</h2>
          <label>
            Volume
            <input
              aria-label="Sound volume"
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
            <input
              type="checkbox"
              checked={shake}
              onChange={(e) => setShake(e.target.checked)}
            />{" "}
            Subtle camera impact
          </label>
          <label>
            Graphics
            <select
              aria-label="Graphics"
              value={quality}
              onChange={(e) => setQuality(e.target.value as Quality)}
            >
              <option value="high">High</option>
              <option value="low">Low</option>
            </select>
          </label>
          <button
            onClick={() => {
              epoch.current++;
              setBusy(false);
              pending.current = null;
              act({ type: "recover" });
              setSettings(false);
            }}
          >
            Return to safe checkpoint
          </button>
          <button
            onClick={() => {
              epoch.current++;
              setBusy(false);
              pending.current = null;
              ref.current = createRescue();
              setProvenance("New rescue · no AI instruction yet");
              publish();
              setSettings(false);
              localStorage.removeItem(SAVE);
            }}
          >
            Replay the rescue
          </button>
          {metrics && (
            <small>
              {metrics.fps} FPS · p95 {metrics.p95} ms · {metrics.draws} draws ·{" "}
              {metrics.triangles.toLocaleString()} triangles
              <br />
              {metrics.renderer}
            </small>
          )}
          <a href="?campaign">Return to the original campaign</a>
        </section>
      )}
      {view.phase === "aftermath" && !settings && (
        <section className="rescue-aftermath">
          <p>JO MADE IT INSIDE.</p>
          <h2>A door held open.</h2>
          <p>
            {view.supplies === "shelter"
              ? "The medical case is dry beside her."
              : "The case remained at Bay Radio. A person mattered more."}
            <br />
            Stay a moment. The storm is passing.
          </p>
          <button onClick={() => setSettings(true)}>Replay or return ↗</button>
        </section>
      )}
    </main>
  );
}
