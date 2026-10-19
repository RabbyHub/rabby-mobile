import { AppState } from 'react-native';
import type { PerpsCandleDataInterval } from '@/constant/perps';
import { normalizeSimpleChartPreference } from '@/constant/perpsSimpleChart';
import { apisPerps } from '@/core/apis/perps';
import {
  loadPerpsCandleSourceSnapshot,
  readPerpsCandleSourceSnapshot,
} from './sourceSnapshot';

// Request scheduling only. Candles and in-flight deduplication stay in sourceSnapshot.
const queue: Array<() => Promise<void>> = [];
let running = 0;
function drain() {
  while (running < 2 && queue.length) {
    const job = queue.shift()!;
    running++;
    void job().finally(() => {
      running--;
      drain();
    });
  }
}

/** Best effort, public market data only; never delays navigation or opens a WS. */
export function preloadSimpleChart(
  coin: string,
  interval?: PerpsCandleDataInterval,
  isActive: () => boolean = () => true,
) {
  if (!coin || AppState.currentState !== 'active' || !isActive()) return;
  if (queue.length >= 4) queue.shift();
  queue.push(async () => {
    try {
      const targetInterval =
        interval ??
        normalizeSimpleChartPreference(
          await apisPerps.getSimpleChartPreference(),
        ).interval;
      if (AppState.currentState !== 'active' || !isActive()) return;
      if (readPerpsCandleSourceSnapshot(coin, targetInterval)) return;
      await loadPerpsCandleSourceSnapshot({ coin, interval: targetInterval });
    } catch {
      // The visible feed owns errors and recovery. A cancelled intent has no UI.
    }
  });
  drain();
}
