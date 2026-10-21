import test from "node:test";
import assert from "node:assert/strict";
import { isSheltered } from "../src/region/Presentation";
import { PLACES } from "../src/three/shared";

test("rain shelter follows actual enclosed town buildings while open pier remains wet", () => {
  for (const place of PLACES) {
    assert.equal(
      isSheltered(place.center.x, place.center.z),
      place.id !== "harbor",
      place.name,
    );
  }
  assert.equal(
    isSheltered(-22, 20.5),
    false,
    "warehouse frontage road is open sky",
  );
  assert.equal(isSheltered(5, 29), false, "harbor pier is open sky");
});
test("rain cannot enter freight-house or field-station interior edges", () => {
  for (const [x, z] of [
    [62.2, -0.8],
    [77.8, 10.8],
    [-71.8, 5.7],
    [-62.2, 14.3],
  ])
    assert.equal(isSheltered(x, z), true, `interior ${x},${z}`);
  assert.equal(isSheltered(70, 14), false, "freight forecourt is open sky");
  assert.equal(isSheltered(-67, 17), false, "station trail is open sky");
});
test("creature shelter blocks rain only after authoritative upgrade", () => {
  assert.equal(isSheltered(-34, 14, false), false);
  assert.equal(isSheltered(-34, 14, true), true);
  assert.equal(isSheltered(-38, 14, true), false);
  assert.equal(isSheltered(-34, 19, true), false);
});
