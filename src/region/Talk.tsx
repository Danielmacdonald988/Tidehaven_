import { useEffect, useRef, useState } from "react";
import type { ConversationReply, ConversationRequest } from "../contracts";
import {
  REGION_SITES,
  districtAt,
  type RegionCommand,
  type RegionState,
} from "./contracts";

let sessionRequests = 0;
const MAX_REQUESTS = 20;
type Props = {
  id: string;
  state: RegionState;
  onClose: () => void;
  onCommand: (cmd: RegionCommand) => boolean;
};
/** Conversation is advisory: the only gameplay proposal is separately committed by the region engine. */
export function RegionTalk({ id, state, onClose, onCommand }: Props) {
  const resident = state.residents.find((r) => r.id === id),
    character = state.campaign.characters.find((c) => c.id === id);
  const [message, setMessage] = useState(""),
    [reply, setReply] = useState(""),
    [mode, setMode] = useState("Ready"),
    [busy, setBusy] = useState(false),
    [proposal, setProposal] = useState(false),
    [notice, setNotice] = useState(""),
    [pledge, setPledge] = useState(false);
  const inflight = useRef<AbortController | null>(null),
    alive = useRef(true),
    latest = useRef(state),
    input = useRef<HTMLInputElement>(null);
  latest.current = state;
  useEffect(() => {
    alive.current = true;
    input.current?.focus();
    return () => {
      alive.current = false;
      inflight.current?.abort();
    };
  }, []);
  const atDispatch =
    !!resident &&
    Math.hypot(
      state.wildlife.player.x - REGION_SITES.dispatch.x,
      state.wildlife.player.z - REGION_SITES.dispatch.z,
    ) <= 5;
  const canOffer =
    id === "inez" &&
    atDispatch &&
    ["available", "abandoned"].includes(state.delivery.status);
  async function send(text: string) {
    text = text.trim().slice(0, 900);
    if (!text || busy || inflight.current || !character || !resident) return;
    if (sessionRequests >= MAX_REQUESTS) {
      setNotice(
        "Conversation limit reached. Physical activities remain available.",
      );
      return;
    }
    const current = latest.current,
      person = current.residents.find((r) => r.id === id);
    if (
      !person ||
      Math.hypot(
        person.position.x - current.wildlife.player.x,
        person.position.z - current.wildlife.player.z,
      ) > 5
    ) {
      setNotice("Move closer to continue.");
      return;
    }
    setBusy(true);
    setNotice("");
    setMessage("");
    setProposal(false);
    sessionRequests++;
    const controller = new AbortController();
    inflight.current = controller;
    const timeout = setTimeout(() => controller.abort(), 12000);
    const deliveryOffer = canOffer;
    const request: ConversationRequest = {
      characterId: id,
      message: text,
      context: {
        name: character.name,
        role: character.role,
        motivation: character.motivation,
        style: `${character.style} Reply in at most two short sentences. This is relaxed free roam, without a storm countdown. Never claim a task, delivery, payment, rescue or movement has happened because of conversation. Only offer the provided action; it requires the player's separate confirmation. Unsupported proposals can be politely declined.`,
        hour: current.campaign.hour,
        trust: character.trust,
        knowledge: character.knowledge.slice(-16),
        publicFacts: [
          `Current location: ${districtAt(person.position)} district, at ${person.position.x.toFixed(0)}, ${person.position.z.toFixed(0)}.`,
          `Local weather: ${current.wildlife.weather}.`,
          `The explorer is standing nearby.`,
          ...(id === "inez"
            ? [
                `Dispatch delivery status: ${current.delivery.status}. Eight crates can be transported in the player's pickup and handed over at their home warehouse. No goods move until physically loaded.`,
                ...current.campaign.commitments
                  .filter(
                    (c) => c.characterId === id && c.id.startsWith("region-"),
                  )
                  .slice(-3)
                  .map(
                    (c) =>
                      `Recorded delivery commitment: ${c.status}, ${c.delivered} of ${c.amount} delivered.`,
                  ),
              ]
            : []),
        ],
        memories: character.memories
          .filter((m) => m.eventId && m.text)
          .slice(-5)
          .map((m) => ({ ...m, text: m.text.slice(0, 1200) })),
        priorities: [character.goal],
        routine: character.status,
        availableActions: deliveryOffer
          ? [
              {
                id: "region-offer-delivery",
                kind: "talk",
                target: id,
                text: "Offer eight freight crates for physical collection and delivery to the warehouse. The player may accept and promise completion.",
              },
            ]
          : [],
      },
    };
    let response: ConversationReply;
    try {
      const result = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
        signal: controller.signal,
      });
      if (!result.ok) throw Error("unavailable");
      response = await result.json();
      if (
        !["live", "demo", "fallback"].includes(response.mode) ||
        typeof response.text !== "string"
      )
        throw Error("invalid");
    } catch {
      response = {
        mode: "fallback",
        text: deliveryOffer
          ? "I have eight crates ready. Park close to the loading bay if you want to bring them home."
          : "Let’s keep it simple for now. I’ll be around if you need me.",
      };
    } finally {
      clearTimeout(timeout);
      inflight.current = null;
    }
    if (!alive.current) return;
    const spoken = response.text.slice(0, 900);
    const recorded = onCommand({
      type: "talk",
      id,
      text: `You: ${text.slice(0, 190)} | ${character.name}: ${spoken.slice(0, 250)}`,
      mode: response.mode,
    });
    setBusy(false);
    if (!recorded) {
      setNotice(
        "You moved out of earshot; this conversation was not recorded.",
      );
      return;
    }
    setReply(spoken);
    setMode(
      response.mode === "live"
        ? "Live AI"
        : response.mode === "demo"
          ? "Scripted demo"
          : "Offline fallback",
    );
    setProposal(
      deliveryOffer &&
        (response.proposal?.id === "region-offer-delivery" ||
          response.mode !== "live"),
    );
  }
  if (!character || !resident) return null;
  function accept() {
    if (onCommand({ type: "acceptDelivery", promise: pledge })) {
      setProposal(false);
      setNotice(
        pledge
          ? "Promise recorded. Bring your pickup to the crates."
          : "Job accepted. Bring your pickup to the crates.",
      );
    } else setNotice("This offer is no longer available here.");
  }
  return (
    <section
      className="region-dialog"
      role="dialog"
      aria-label={`Speak with ${character.name}`}
      style={{
        position: "absolute",
        right: 20,
        bottom: 80,
        width: "min(370px, calc(100vw - 32px))",
        padding: 18,
        background: "rgba(25,47,45,.96)",
        color: "#f1ead8",
        border: "1px solid #a2b2a066",
        borderRadius: 16,
        boxShadow: "0 14px 50px #0006",
        zIndex: 30,
      }}
    >
      <div style={{ display: "flex", alignItems: "start", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <strong>{character.name}</strong>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
            {character.role} · {mode}
          </div>
        </div>
        <button onClick={onClose} aria-label="Close conversation">
          ×
        </button>
      </div>
      {reply ? (
        <p
          aria-live="polite"
          style={{
            fontSize: 14,
            lineHeight: 1.5,
            margin: "14px 0",
            maxHeight: 150,
            overflowY: "auto",
          }}
        >
          {reply}
        </p>
      ) : (
        <p style={{ fontSize: 13, opacity: 0.8 }}>A moment to talk.</p>
      )}
      {canOffer && (
        <div
          style={{
            borderTop: "1px solid #8b9e9344",
            paddingTop: 10,
            marginBottom: 10,
          }}
        >
          {proposal && (
            <div style={{ fontSize: 12, marginBottom: 8 }}>
              Inez has offered you the freight run.
            </div>
          )}
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              fontSize: 12,
              marginBottom: 8,
            }}
          >
            <input
              type="checkbox"
              checked={pledge}
              onChange={(e) => setPledge(e.target.checked)}
            />
            Promise Inez you’ll finish the delivery
          </label>
          <button onClick={accept} style={{ width: "100%" }}>
            Accept freight job · eight crates
          </button>
        </div>
      )}
      {notice && (
        <p role="status" style={{ fontSize: 12, color: "#dfc38f" }}>
          {notice}
        </p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(message);
        }}
        style={{ display: "flex", gap: 6 }}
      >
        <input
          ref={input}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={900}
          placeholder="Speak naturally…"
          aria-label={`Message to ${character.name}`}
          disabled={busy}
          style={{
            minWidth: 0,
            flex: 1,
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid #8b9e9366",
            background: "#102a28",
            color: "#fff",
          }}
        />
        <button type="submit" disabled={busy || !message.trim()}>
          {busy ? "Listening…" : "Say"}
        </button>
      </form>
      {!reply && !busy && (
        <button
          onClick={() =>
            void send(
              canOffer
                ? "Do you have any delivery work for me?"
                : "What brings you here today?",
            )
          }
          style={{ fontSize: 12, marginTop: 10 }}
        >
          {canOffer ? "Ask about freight" : "Ask how they’re doing"}
        </button>
      )}
      <div style={{ fontSize: 10, opacity: 0.5, marginTop: 9 }}>
        Conversation offers are confirmed separately · {sessionRequests}/
        {MAX_REQUESTS} requests
      </div>
    </section>
  );
}
export default RegionTalk;
