import type { WildlifeState } from "./contracts";
import { createWildlife, validateWildlife } from "./engine";
export const WILDLIFE_SAVE_KEY = "afterlight-living-coast-v1";
/** This save never touches the campaign or rescue timelines. */
export function loadWildlife(): WildlifeState {
  try {
    const raw = localStorage.getItem(WILDLIFE_SAVE_KEY);
    if (raw) {
      const state: unknown = JSON.parse(raw);
      if (validateWildlife(state)) return state;
    }
  } catch {
    /* Private browsing or an invalid save: a playable fresh shore. */
  }
  return createWildlife();
}
export function saveWildlife(state: WildlifeState): void {
  if (!validateWildlife(state)) return;
  try {
    localStorage.setItem(WILDLIFE_SAVE_KEY, JSON.stringify(state));
  } catch {
    /* Storage access must not interrupt a physical encounter. */
  }
}

export const WILDLIFE_ARCHIVE_KEY = "afterlight-living-coast-archive-v1";
/** Archive first; callers must not replace the active expedition on failure. */
export function archiveWildlife(state: WildlifeState): boolean {
  if (!validateWildlife(state)) return false;
  try {
    const encoded = JSON.stringify(state);
    localStorage.setItem(WILDLIFE_ARCHIVE_KEY, encoded);
    return localStorage.getItem(WILDLIFE_ARCHIVE_KEY) === encoded;
  } catch {
    return false;
  }
}
export function loadArchivedWildlife(): WildlifeState | null {
  try {
    const raw = localStorage.getItem(WILDLIFE_ARCHIVE_KEY);
    if (!raw) return null;
    const state: unknown = JSON.parse(raw);
    return validateWildlife(state) ? state : null;
  } catch {
    return null;
  }
}
