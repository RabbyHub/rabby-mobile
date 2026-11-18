import { zCreate } from '@/core/utils/reexports';
import { IS_ANDROID } from '@/core/native/utils';
import {
  getOnlineConfig,
  ONLINE_STRATEGY_PAGER_OFFSET,
  type PagerOffsetStrategy,
} from '@/core/config/online';

export type { PagerOffsetStrategy };

/**
 * How the home tab chrome consumes the pager offset (QA 1396 / 1421).
 *
 * - `off`  : JS interpolates the ~60Hz `onPageScroll` sample stream.
 * - `pull` : a worklet reads `global.__pagerOffset()` every display frame.
 * - `push` : native calls a bound setter on every sample, so the shared value
 *            is already fresh when Reanimated's frame callbacks run.
 *
 * The startup value comes from the online config strategy
 * `20261119.pager_offset_strategy` (`off` | `pull` | `push`), resolved once when
 * this module loads. The native sampler is Android-only, so iOS always resolves
 * to `off`. When the strategy is absent or unreachable, the fallback is `pull`.
 *
 * A debug deep link can still override the value for the current session:
 *   ...&_cmd=toggle-pager-offset-sampling            (off <-> pull)
 *   ...&_cmd=toggle-pager-offset-sampling&value=on|push|pull|off
 *
 * Kept deliberately free of pager/tab-bar imports: the deep-link handler imports
 * this module, so pulling those layers in here would create import cycles.
 */
function resolveInitialPagerOffsetStrategy(): PagerOffsetStrategy {
  if (!IS_ANDROID) {
    return 'off';
  }
  const configured =
    getOnlineConfig().strategies?.[ONLINE_STRATEGY_PAGER_OFFSET];
  if (configured === 'off' || configured === 'pull' || configured === 'push') {
    return configured;
  }
  return 'pull';
}

const pagerOffsetStrategyStore = zCreate<{ mode: PagerOffsetStrategy }>(() => ({
  mode: resolveInitialPagerOffsetStrategy(),
}));

type Applier = (mode: PagerOffsetStrategy) => void;
let applier: Applier | null = null;

/** Reactive read for the chrome that consumes the sampled offset. */
export function usePagerOffsetStrategy() {
  return pagerOffsetStrategyStore(s => s.mode);
}

/** Registered by the consumer so this module stays import-cycle free. */
export function registerPagerOffsetStrategyApplier(fn: Applier) {
  applier = fn;
  const { mode } = pagerOffsetStrategyStore.getState();
  if (mode !== 'off') {
    fn(mode);
  }
}

export const pagerOffsetStrategy = {
  get mode(): PagerOffsetStrategy {
    return pagerOffsetStrategyStore.getState().mode;
  },
  get enabled() {
    return this.mode !== 'off';
  },
  set(mode: PagerOffsetStrategy) {
    if (pagerOffsetStrategyStore.getState().mode === mode) {
      return;
    }
    pagerOffsetStrategyStore.setState({ mode });
    applier?.(mode);
  },
  toggle() {
    // `pull` tracks the pager best; `push` stays reachable via `value=push`.
    this.set(this.mode === 'off' ? 'pull' : 'off');
  },
};
