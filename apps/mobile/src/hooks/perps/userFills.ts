import type { WsFill } from '@rabby-wallet/hyperliquid-sdk';

export const MAX_USER_FILLS = 2000;

// tid alone is only a 50-bit hash of (buyer_oid, seller_oid) — HL docs say a
// globally unique trade id is (time, coin, tid); side disambiguates the two
// legs of a self-trade, which share one tid.
export const getFillKey = (fill: WsFill): string =>
  `${fill.time}-${fill.coin}-${fill.side}-${fill.tid}`;

// Merge, newest first. A WS reconnect snapshot only carries recent fills and
// must never overwrite the fuller HTTP history — overwriting blanks the
// single-coin history until the HTTP refetch lands.
export const mergeUserFills = (
  incoming: WsFill[],
  prev: WsFill[],
): WsFill[] => {
  const seen = new Set<string>();
  const merged: WsFill[] = [];
  for (const fill of [...incoming, ...prev].sort((a, b) => b.time - a.time)) {
    const key = getFillKey(fill);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    merged.push(fill);
    if (merged.length >= MAX_USER_FILLS) {
      break;
    }
  }
  return merged;
};

// The HTTP result is authoritative inside its own time window: replace
// overlapping entries (normalizes any WS-vs-HTTP aggregation drift) but keep
// WS fills newer than the response and history older than its window.
export const reconcileHttpFills = (res: WsFill[], prev: WsFill[]): WsFill[] => {
  const first = res[0];
  if (!first) {
    return prev;
  }
  let newest = first.time;
  let oldest = first.time;
  for (const fill of res) {
    if (fill.time > newest) {
      newest = fill.time;
    }
    if (fill.time < oldest) {
      oldest = fill.time;
    }
  }
  const keep = prev.filter(fill => fill.time > newest || fill.time < oldest);
  return mergeUserFills(res, keep);
};
