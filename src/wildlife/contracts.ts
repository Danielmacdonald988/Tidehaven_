import type { Point, Collider } from "../three/shared";
export type SpeciesId =
  | "brindlefin"
  | "cairnback"
  | "pluvlet"
  | "sailpip"
  | "glasswhorl"
  | "tempestray";
export type Weather = "fair" | "rain" | "dusk" | "storm";
export type CreatureMood =
  | "idle"
  | "travel"
  | "alert"
  | "curious"
  | "receptive"
  | "bonding"
  | "companion";
export interface CreatureState {
  id: SpeciesId;
  position: Point;
  home: Point;
  path: Point[];
  mood: CreatureMood;
  phase: number;
  alarm: number;
  trust: number;
  discovered: boolean;
  bonded: boolean;
  variant: number;
  attention: boolean;
  available: boolean;
  bondAt?: number;
}
export interface WildlifeState {
  version: 1;
  player: Point;
  path: Point[];
  speed: number;
  elapsed: number;
  weather: Weather;
  weatherTime: number;
  creatures: CreatureState[];
  companion: SpeciesId | null;
  companionPosition: Point;
  companionPath: Point[];
  selected: SpeciesId | null;
  assistance: boolean;
  abilities: { tracks: boolean; gate: boolean; light: boolean };
  bellRung: boolean;
  rareRevealed: boolean;
  events: {
    id: number;
    at: number;
    kind: string;
    species?: SpeciesId;
    detail: string;
  }[];
  pulse: { at: number; from: Point; to: Point; success: boolean } | null;
  foundShell: boolean;
}
export type WildlifeCommand =
  | { type: "move"; point: Point; quiet?: boolean }
  | { type: "select"; id: SpeciesId }
  | { type: "attention" }
  | { type: "pulse"; id: SpeciesId }
  | { type: "companion"; id: SpeciesId }
  | { type: "ability"; target: "tracks" | "gate" | "light" }
  | { type: "weather" }
  | { type: "bell" }
  | { type: "shell" }
  | { type: "assistTiming"; enabled: boolean };
export interface Species {
  id: SpeciesId;
  name: string;
  habitat: string;
  hint: string;
  color: string;
  ability: "tracks" | "gate" | "light" | null;
  position: Point;
  height: number;
  personality: string;
}
export const SPECIES: Species[] = [
  {
    id: "brindlefin",
    name: "Brindlefin",
    habitat: "Warm tide sand",
    hint: "Slow steps. Offer an open palm.",
    color: "#d59662",
    ability: "tracks",
    position: { x: -8, z: 26 },
    height: 0,
    personality: "Curious collector",
  },
  {
    id: "cairnback",
    name: "Cairnback",
    habitat: "Driftwood shelter",
    hint: "Return the little striped shell.",
    color: "#84998b",
    ability: "gate",
    position: { x: -33, z: 18 },
    height: 0,
    personality: "Patient protector",
  },
  {
    id: "pluvlet",
    name: "Pluvlet",
    habitat: "Rain garden",
    hint: "Ripples invite a reply.",
    color: "#72b8b4",
    ability: "light",
    position: { x: -34, z: -7 },
    height: 0,
    personality: "Bright and bashful",
  },
  {
    id: "sailpip",
    name: "Sailpip",
    habitat: "Market canopy",
    hint: "Follow the glide; greet it at rest.",
    color: "#ba8a9b",
    ability: null,
    position: { x: 0, z: -6 },
    height: 2,
    personality: "Restless acrobat",
  },
  {
    id: "glasswhorl",
    name: "Glasswhorl",
    habitat: "Reflected dusk",
    hint: "Borrow a little living light.",
    color: "#9ca9d0",
    ability: null,
    position: { x: 12, z: -24 },
    height: 0.4,
    personality: "Quiet observer",
  },
  {
    id: "tempestray",
    name: "Tempestray",
    habitat: "Where weather sings",
    hint: "Three small kindnesses. A storm answers.",
    color: "#d2b9e0",
    ability: null,
    position: { x: 14, z: 29 },
    height: 2,
    personality: "A patient storm",
  },
];
export const SITES = {
  tracks: { x: -26, z: 19 },
  gate: { x: -34, z: -1.5 },
  light: { x: 12, z: -20 },
  bench: { x: -6, z: 24.5 },
  bell: { x: 8, z: 24 },
  shell: { x: -14, z: 25 },
} satisfies Record<string, Point>;
export interface WildlifeEngine {
  createWildlife(): WildlifeState;
  wildlifeCommand(
    s: WildlifeState,
    c: WildlifeCommand,
    base?: Collider[],
  ): { state: WildlifeState; ok: boolean; reason?: string };
  tickWildlife(s: WildlifeState, dt: number, base?: Collider[]): WildlifeState;
  wildlifeColliders(s: WildlifeState): Collider[];
  validateWildlife(v: unknown): v is WildlifeState;
}

/** Physical resting places keep weather discovery local and unhurried. */
export const REST_SITES = [
  SITES.bench,
  { x: -34, z: 6.5 },
  { x: 15, z: -17 },
] as const;
