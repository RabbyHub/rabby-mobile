import { zCreate } from '@/core/utils/reexports';

/**
 * Delivery variants for the native pager-offset sampling path (QA 1396).
 *
 * - `off`  : shipped behaviour, JS interpolates the ~60Hz sample stream.
 * - `pull` : a worklet reads `global.__pagerOffset()` every frame.
 * - `push` : native calls a bound setter on every sample, so the shared value
 *            is already fresh when Reanimated's frame callbacks run.
 */
export type PagerOffsetMode = 'off' | 'pull' | 'push';

/**
 * Dev-only switch for the native pager-offset sampling path (QA 1396).
 *
 * `react-native-pager-view` reports `onPageScroll` at ~60Hz while the page
 * itself moves at the display rate. The patched native module samples the real
 * `RecyclerView` offset every display frame and hands it to the Reanimated UI
 * runtime; this flag selects how the chrome consumes it.
 *
 * Toggle from the debug deep link:
 *   ...&_cmd=toggle-pager-offset-sampling            (off <-> push)
 *   ...&_cmd=toggle-pager-offset-sampling&value=on|push|pull|off
 *
 * Kept deliberately dependency-free: the deep-link handler imports this module,
 * so pulling the pager/tab-bar layers in here would create import cycles.
 */
const debugPagerOffsetSamplingStore = zCreate<{ mode: PagerOffsetMode }>(
  () => ({
    mode: 'off',
  }),
);

type Applier = (mode: PagerOffsetMode) => void;
let applier: Applier | null = null;

/** Reactive read for the chrome that consumes the sampled offset. */
export function useDebugPagerOffsetSamplingMode() {
  return debugPagerOffsetSamplingStore(s => s.mode);
}

/** Registered by the consumer so this module stays import-cycle free. */
export function registerDebugPagerOffsetSamplingApplier(fn: Applier) {
  applier = fn;
  const { mode } = debugPagerOffsetSamplingStore.getState();
  if (mode !== 'off') {
    fn(mode);
  }
}

export const debugPagerOffsetSampling = {
  get mode(): PagerOffsetMode {
    return debugPagerOffsetSamplingStore.getState().mode;
  },
  get enabled() {
    return this.mode !== 'off';
  },
  set(mode: PagerOffsetMode) {
    if (debugPagerOffsetSamplingStore.getState().mode === mode) {
      return;
    }
    debugPagerOffsetSamplingStore.setState({ mode });
    applier?.(mode);
  },
  toggle() {
    this.set(this.mode === 'off' ? 'push' : 'off');
  },
};
