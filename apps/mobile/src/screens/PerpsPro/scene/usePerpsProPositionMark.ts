import { perpsStore } from '@/hooks/perps/usePerpsStore';
import { useShallow } from 'zustand/react/shallow';

import { resolvePerpsProMarketPresentation } from '../model/market';

// The position cards derive their mark price, liquidation distance and the
// position TP/SL summary from the live mark. At tick speed that re-renders the
// whole card (dozens of text nodes plus the dotted-underline measurement) many
// times per second, which shows up as idle and scroll jank on the positions
// list. Coalesce to two display updates per second by handing back the last
// snapshot while inside the window so `useShallow` sees an unchanged object.
const MARK_SNAPSHOT_THROTTLE_MS = 500;
type PerpsProPositionMarkSnapshot = ReturnType<
  typeof resolvePerpsProMarketPresentation
> & {
  markPrice: string | null;
  pxDecimals: number | undefined;
};
const markSnapshotCache = new Map<
  string,
  { at: number; snapshot: PerpsProPositionMarkSnapshot }
>();

export const usePerpsProPositionMark = (coin: string) =>
  perpsStore(
    useShallow(state => {
      const market = state.marketDataMap[coin];
      const presentation = resolvePerpsProMarketPresentation(coin, market);
      const next: PerpsProPositionMarkSnapshot = {
        ...presentation,
        markPrice: market?.markPx || null,
        pxDecimals: market?.pxDecimals,
      };
      const now = Date.now();
      const cached = markSnapshotCache.get(coin);
      if (
        cached &&
        now - cached.at < MARK_SNAPSHOT_THROTTLE_MS &&
        cached.snapshot.markPrice != null &&
        next.markPrice != null
      ) {
        return cached.snapshot;
      }
      markSnapshotCache.set(coin, { at: now, snapshot: next });
      return next;
    }),
  );
