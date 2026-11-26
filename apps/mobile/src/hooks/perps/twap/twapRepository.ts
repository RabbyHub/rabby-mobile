import { apisPerps } from '@/core/apis/perps';
import {
  hasAllPerpsTwapFills,
  mergePerpsTwapFills,
  parsePerpsTwapFill,
} from './twapReconciliation';
import type { PerpsTwapFill, PerpsTwapRecord } from './types';

/** Bounded overlapping windows; the TWAP ByTime endpoint has no documented page size. */
export const loadPerpsTwapFills = async (
  user: string,
  order: PerpsTwapRecord,
  isCurrent: () => boolean,
): Promise<{ fills: readonly PerpsTwapFill[]; complete: boolean }> => {
  const client = apisPerps.getPerpsSDK().info;
  const end = order.endedAt === null ? Date.now() : order.endedAt + 999;
  let start = order.state.timestamp;
  let fills: readonly PerpsTwapFill[] = [];
  const hasAllExecutedFills = () => hasAllPerpsTwapFills(order, fills);
  const seen = new Set<string>();
  for (let request = 0; request < 20 && isCurrent(); request++) {
    const response = await client.getUserTwapSliceFillsByTime(user, start, end);
    if (!isCurrent()) return { fills, complete: false };
    if (!Array.isArray(response))
      throw new Error('Invalid TWAP fills response');
    // An empty page alone does not prove completeness (e.g. retention limits).
    if (!response.length) return { fills, complete: hasAllExecutedFills() };
    const parsed = response.map(parsePerpsTwapFill);
    if (parsed.some(fill => !fill)) throw new Error('Invalid TWAP fill');
    const page = parsed.filter((fill): fill is PerpsTwapFill => !!fill);
    let added = 0;
    for (const fill of page) {
      if (!seen.has(fill.key)) {
        seen.add(fill.key);
        added++;
      }
    }
    fills = mergePerpsTwapFills(
      fills,
      page.filter(
        fill => fill.twapId === order.twapId && fill.coin === order.state.coin,
      ),
    );
    // A terminal authoritative total proves completeness even if the API
    // repeats the final millisecond and never returns an empty page.
    if (order.endedAt !== null && hasAllExecutedFills())
      return { fills, complete: true };
    const last = Math.max(...page.map(fill => fill.time));
    // Never skip a same-millisecond boundary. Stop conservatively on no progress.
    if (!added || last < start || seen.size >= 10000) break;
    start = last;
  }
  return { fills, complete: false };
};
