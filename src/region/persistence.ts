import { createRegion, validateRegion } from "./engine";
import { validateWorld } from "../persistence";
import { validateWildlife } from "../wildlife/engine";
import type { RegionState } from "./contracts";
export const REGION_SAVE_KEY = "afterlight-region-v1";
export function loadRegion(): RegionState {
  try {
    const raw = localStorage.getItem(REGION_SAVE_KEY);
    if (raw) {
      try {
        const parsed: unknown = JSON.parse(raw);
        if (validateRegion(parsed)) return parsed;
      } catch {}
      localStorage.setItem(`${REGION_SAVE_KEY}-corrupt-backup`, raw);
    }
    let wildlife, campaign;
    try {
      const w = JSON.parse(
        localStorage.getItem("afterlight-living-coast-v1") ?? "null",
      );
      if (validateWildlife(w)) wildlife = w;
    } catch {}
    for (const key of [
      "afterlight.neighborhood",
      "afterlight.neighborhood.world",
      "afterlight.session",
    ]) {
      try {
        const saved = JSON.parse(localStorage.getItem(key) ?? "null"),
          candidate = saved?.world ?? saved;
        if (validateWorld(candidate)) {
          campaign = candidate;
          break;
        }
      } catch {}
    }
    const state = createRegion(wildlife, campaign);
    saveRegion(state);
    return state;
  } catch {
    return createRegion();
  }
}
export function saveRegion(state: RegionState): boolean {
  if (!validateRegion(state)) return false;
  try {
    const data = JSON.stringify(state);
    localStorage.setItem(REGION_SAVE_KEY, data);
    return localStorage.getItem(REGION_SAVE_KEY) === data;
  } catch {
    return false;
  }
}
