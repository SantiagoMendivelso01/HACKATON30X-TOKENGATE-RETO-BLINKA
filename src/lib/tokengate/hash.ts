/** cyrb53: small, stable, non-cryptographic hash used to chain the demo audit log. */
export function hash(str: string, seed = 0): string {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, "0");
}

export type ChainedEvent<T> = T & { prev: string; hash: string };

/** Chains events: each hash covers the previous hash plus the event's content. */
export function chain<T extends { at: string; summary: string; type: string }>(
  events: T[],
): ChainedEvent<T>[] {
  let prev = "GENESIS";
  return events.map((e) => {
    const h = hash(prev + JSON.stringify([e.at, e.type, e.summary]));
    const out = { ...e, prev, hash: h };
    prev = h;
    return out;
  });
}

/** Index of the first event whose content no longer matches its hash, or -1 if intact. */
export function verifyChain<T extends { at: string; summary: string; type: string }>(
  events: ChainedEvent<T>[],
): number {
  for (let i = 0; i < events.length; i++) {
    const e = events[i]!;
    const expectedPrev = i === 0 ? "GENESIS" : events[i - 1]!.hash;
    if (
      e.prev !== expectedPrev ||
      hash(e.prev + JSON.stringify([e.at, e.type, e.summary])) !== e.hash
    )
      return i;
  }
  return -1;
}
