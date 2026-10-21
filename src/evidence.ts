import type { SimEvent } from "./contracts";
/** Evidence IDs are exact references, never substrings of another ID or prose. */
export function resolveEvidence(
  source: string,
  events: SimEvent[],
): SimEvent | undefined {
  const id =
    /^Event (e\d+):/.exec(source)?.[1] ??
    (/^e\d+$/.test(source) ? source : undefined);
  return id ? events.find((event) => event.id === id) : undefined;
}
