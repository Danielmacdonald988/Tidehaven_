import {
  archiveWildlife,
  loadArchivedWildlife,
  WILDLIFE_ARCHIVE_KEY,
} from "../src/wildlife/persistence";
import { buildWildlifeWorld } from "../src/wildlife/World";
import type { Collider } from "../src/three/shared";
let colliders: Collider[] = [];
import test from "node:test";
import assert from "node:assert/strict";
import {
  createWildlife,
  tickWildlife,
  wildlifeCommand,
  validateWildlife,
} from "../src/wildlife/engine";
import {
  SITES,
  type SpeciesId,
  type WildlifeCommand,
  type WildlifeState,
} from "../src/wildlife/contracts";
import {
  loadWildlife,
  saveWildlife,
  WILDLIFE_SAVE_KEY,
} from "../src/wildlife/persistence";

function apply(s: WildlifeState, command: WildlifeCommand) {
  const next = wildlifeCommand(s, command, colliders);
  assert(next.ok, `${JSON.stringify(command)}: ${next.reason}`);
  return next.state;
}
function wait(s: WildlifeState, seconds: number) {
  for (let i = 0; i < Math.ceil(seconds * 10); i++)
    s = tickWildlife(s, 0.1, colliders);
  return s;
}
function walk(s: WildlifeState, point: { x: number; z: number }) {
  s = apply(s, { type: "move", point });
  for (let i = 0; i < 800 && s.path.length; i++)
    s = tickWildlife(s, 0.1, colliders);
  assert(
    Math.hypot(s.player.x - point.x, s.player.z - point.z) < 0.1,
    "player reaches intended spot",
  );
  return wait(s, 1.5);
}
function befriend(s: WildlifeState, id: SpeciesId) {
  const target = s.creatures.find((c) => c.id === id)!;
  s = walk(s, { x: target.home.x, z: target.home.z + 3 });
  s = apply(s, { type: "select", id });
  if (id === "sailpip") {
    for (
      let i = 0;
      i < 90 && s.creatures.find((c) => c.id === id)!.phase % 8 > 3;
      i++
    )
      s = wait(s, 0.1);
  }
  s = apply(s, { type: "attention" });
  s = apply(s, { type: "pulse", id });
  return wait(s, 2.2);
}

test("independent playthrough: walk the complete three-ability chain and deterministic rare reveal", () => {
  const oldDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const context = new Proxy({}, { get: () => () => {} });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      createElement: () => ({ width: 0, height: 0, getContext: () => context }),
    },
  });
  const environment = buildWildlifeWorld();
  if (oldDocument) Object.defineProperty(globalThis, "document", oldDocument);
  else Reflect.deleteProperty(globalThis, "document");
  colliders = environment.colliders;
  try {
    let s = wait(createWildlife(), 0.1);
    s = befriend(s, "brindlefin");
    s = walk(s, SITES.shell);
    s = apply(s, { type: "shell" });
    s = walk(s, SITES.tracks);
    s = apply(s, { type: "ability", target: "tracks" });
    s = befriend(s, "cairnback");
    s = apply(s, { type: "companion", id: "cairnback" });
    s = walk(s, { x: -34, z: 1 });
    s = apply(s, { type: "ability", target: "gate" });
    s = walk(s, SITES.bench);
    while (s.weather !== "rain") s = apply(s, { type: "weather" });
    s = befriend(s, "pluvlet");
    s = apply(s, { type: "companion", id: "pluvlet" });
    s = walk(s, SITES.light);
    s = apply(s, { type: "ability", target: "light" });
    s = walk(s, SITES.bench);
    while (s.weather !== "dusk") s = apply(s, { type: "weather" });
    s = befriend(s, "glasswhorl");
    s = befriend(s, "sailpip");
    s = walk(s, SITES.bench);
    while (s.weather !== "storm") s = apply(s, { type: "weather" });
    s = walk(s, SITES.bell);
    s = apply(s, { type: "bell" });
    assert(s.rareRevealed);
    s = befriend(s, "tempestray");
    assert.equal(s.creatures.filter((c) => c.bonded).length, 6);
    assert.equal(s.events.filter((e) => e.kind === "bond").length, 6);
    assert.equal(s.events.filter((e) => e.kind === "reveal").length, 1);
    assert(validateWildlife(s));
    const restored = JSON.parse(JSON.stringify(s));
    assert.equal(
      JSON.stringify(wait(restored, 3)),
      JSON.stringify(wait(s, 3)),
      "save resumes deterministic behavior",
    );
  } finally {
    colliders = [];
    environment.dispose();
  }
});

test("collection storage is isolated and rejects invalid saves without throwing", () => {
  const backing = new Map<string, string>([
    ["afterlight-save", "original campaign"],
  ]);
  const descriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "localStorage",
  );
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => backing.get(key) ?? null,
      setItem: (key: string, value: string) => backing.set(key, value),
    },
  });
  try {
    let s = befriend(createWildlife(), "brindlefin");
    s = apply(s, { type: "assistTiming", enabled: false });
    saveWildlife(s);
    assert.deepEqual(loadWildlife(), s);
    assert.equal(backing.get("afterlight-save"), "original campaign");
    const count = loadWildlife().events.filter((e) => e.kind === "bond").length;
    assert(
      !wildlifeCommand(loadWildlife(), { type: "pulse", id: "brindlefin" }).ok,
    );
    assert.equal(
      loadWildlife().events.filter((e) => e.kind === "bond").length,
      count,
    );
    backing.set(WILDLIFE_SAVE_KEY, '{"version":1,"creatures":[]}');
    assert.deepEqual(loadWildlife(), createWildlife());
    backing.set(WILDLIFE_SAVE_KEY, "not json");
    assert.deepEqual(loadWildlife(), createWildlife());
  } finally {
    if (descriptor)
      Object.defineProperty(globalThis, "localStorage", descriptor);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});

test("unavailable browser storage does not break collection play", () => {
  const descriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "localStorage",
  );
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    get() {
      throw new Error("Storage is disabled");
    },
  });
  try {
    assert.deepEqual(loadWildlife(), createWildlife());
    assert.doesNotThrow(() => saveWildlife(createWildlife()));
  } finally {
    if (descriptor)
      Object.defineProperty(globalThis, "localStorage", descriptor);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});

test("expedition archive preserves active and legacy saves and validates recovery", () => {
  const backing = new Map<string, string>([
    ["afterlight-save", "legacy untouched"],
  ]);
  const descriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "localStorage",
  );
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => backing.get(key) ?? null,
      setItem: (key: string, value: string) => backing.set(key, value),
    },
  });
  try {
    const first = befriend(createWildlife(), "brindlefin");
    saveWildlife(first);
    assert.equal(loadArchivedWildlife(), null);
    assert(archiveWildlife(first));
    assert.deepEqual(loadWildlife(), first);
    saveWildlife(createWildlife());
    assert.deepEqual(loadArchivedWildlife(), first);
    assert.deepEqual(loadWildlife(), createWildlife());
    assert.equal(backing.get("afterlight-save"), "legacy untouched");
    assert(!archiveWildlife({ ...first, creatures: [] }));
    assert.deepEqual(
      loadArchivedWildlife(),
      first,
      "invalid archive must not erase recovery",
    );
    const restored = loadArchivedWildlife()!;
    assert(archiveWildlife(loadWildlife()));
    saveWildlife(restored);
    assert.deepEqual(loadWildlife(), first);
    assert.deepEqual(loadArchivedWildlife(), createWildlife());
    backing.set(WILDLIFE_ARCHIVE_KEY, "{broken");
    assert.equal(loadArchivedWildlife(), null);
    backing.set(WILDLIFE_ARCHIVE_KEY, JSON.stringify({ version: 1 }));
    assert.equal(loadArchivedWildlife(), null);
    assert.deepEqual(loadWildlife(), first);
  } finally {
    if (descriptor)
      Object.defineProperty(globalThis, "localStorage", descriptor);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});

test("archive fails safely when browser storage rejects writes", () => {
  const descriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "localStorage",
  );
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: () => {
        throw Error("blocked");
      },
      setItem: () => {
        throw Error("quota");
      },
    },
  });
  try {
    assert.equal(archiveWildlife(createWildlife()), false);
    assert.equal(loadArchivedWildlife(), null);
  } finally {
    if (descriptor)
      Object.defineProperty(globalThis, "localStorage", descriptor);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});
