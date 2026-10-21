export type Resource = "food" | "water" | "medical" | "fuel";
export type LocationId =
  "warehouse" | "market" | "clinic" | "harbor" | "heights" | "radio";
export type ActionKind =
  | "load"
  | "walk"
  | "advance"
  | "dispatch"
  | "travel"
  | "wait"
  | "buy"
  | "recruit"
  | "promise"
  | "deliver"
  | "transport"
  | "evacuate"
  | "talk"
  | "prepare";
export interface Action {
  id: string;
  kind: ActionKind;
  actor?: string;
  target?: string;
  resource?: Resource;
  amount?: number;
  location?: LocationId;
  hours?: number;
  position?: Point;
  seconds?: number;
  text?: string;
}
export interface Memory {
  eventId: string;
  hour: number;
  text: string;
  tags: string[];
}
export interface Character {
  id: string;
  name: string;
  role: string;
  location: LocationId;
  color: string;
  motivation: string;
  style: string;
  privateFacts: string[];
  knowledge: string[];
  relationships: Record<string, number>;
  trust: number;
  goal: string;
  status: string;
  recruited: boolean;
  inventory: Record<Resource, number>;
  money: number;
  memories: Memory[];
}
export interface Commitment {
  id: string;
  characterId: string;
  resource: Resource;
  amount: number;
  delivered: number;
  dueHour: number;
  status: "pending" | "kept" | "broken";
  eventId: string;
}
export interface SimEvent {
  id: string;
  hour: number;
  kind: string;
  title: string;
  description: string;
  actor: string;
  facts: string[];
  constraints: string[];
  effects: string[];
  action?: Action;
}
export interface Outcome {
  title: string;
  summary: string;
  score: number;
  evacuated: number;
  supplied: number;
  trust: number;
}
export interface World {
  version: 1;
  seed: number;
  rng: number;
  hour: number;
  location: LocationId;
  money: number;
  inventory: Record<Resource, number>;
  staff: number;
  transport: number;
  evacuated: number;
  prepared: number;
  delivered: Record<Resource, number>;
  characters: Character[];
  commitments: Commitment[];
  events: SimEvent[];
  appliedActions: string[];
  flags: Record<string, boolean>;
  ended: boolean;
  outcome?: Outcome;
  spatial?: SpatialState;
}
export interface ActionResult {
  ok: boolean;
  state: World;
  message: string;
}
export interface Checkpoint {
  id: string;
  name: string;
  state: World;
  createdAt: string;
}
export interface RecordedStep {
  action: Action;
  state: World;
}
export interface Timeline {
  id: string;
  name: string;
  initial: World;
  steps: RecordedStep[];
}
export interface ConversationRequest {
  characterId: string;
  message: string;
  context: CharacterContext;
}
export interface CharacterContext {
  name: string;
  role: string;
  motivation: string;
  style: string;
  hour: number;
  trust: number;
  knowledge: string[];
  memories: Memory[];
  publicFacts: string[];
  availableActions: Action[];
}
export interface ConversationReply {
  mode: "demo" | "live";
  text: string;
  proposal?: Action;
  usage?: { requests: number; tokens: number; limit: number };
  error?: string;
}
export const LOCATIONS: {
  id: LocationId;
  name: string;
  subtitle: string;
  x: number;
  y: number;
}[] = [
  {
    id: "warehouse",
    name: "The Warehouse",
    subtitle: "Your relief base",
    x: 37,
    y: 68,
  },
  {
    id: "market",
    name: "Salt Market",
    subtitle: "Supplies & local favors",
    x: 32,
    y: 38,
  },
  {
    id: "clinic",
    name: "Mercy Clinic",
    subtitle: "Care for the vulnerable",
    x: 55,
    y: 30,
  },
  {
    id: "harbor",
    name: "Old Harbor",
    subtitle: "Boats, fuel & a way out",
    x: 70,
    y: 67,
  },
  {
    id: "heights",
    name: "Cypress Heights",
    subtitle: "High ground, open doors",
    x: 18,
    y: 19,
  },
  {
    id: "radio",
    name: "Radio House",
    subtitle: "A voice across the bay",
    x: 76,
    y: 19,
  },
];

export interface Point {
  x: number;
  z: number;
}
export interface Shipment {
  id: string;
  resource: Resource;
  amount: number;
  workerId: string;
  status: "collecting" | "carrying" | "arrived";
  position: Point;
  progress: number;
  route: Point[];
  waypoint: number;
  collectionIndex: number;
}
export interface SpatialState {
  player: Point;
  carried: Record<Resource, number>;
  staged: Record<Resource, number>;
  shipments: Shipment[];
  elapsedSeconds: number;
}
