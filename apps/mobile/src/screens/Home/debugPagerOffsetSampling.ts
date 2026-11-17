import { zCreate } from '@/core/utils/reexports';

/**
 * Dev-only switch for the native pager-offset sampling path (QA 1396).
 *
 * `react-native-pager-view` reports `onPageScroll` at ~60Hz while the page
 * itself moves at the display rate. The patched native module samples the real
 * `RecyclerView` offset every display frame and exposes it to a worklet; this
 * flag selects between that path and the JS-side interpolation fallback.
 *
 * Toggle from the debug deep link:
 *   ...&_cmd=toggle-pager-offset-sampling&value=on|off
 *
 * Kept deliberately dependency-free: the deep-link handler imports this module,
 * so pulling the pager/tab-bar layers in here would create import cycles.
 */
const debugPagerOffsetSamplingStore = zCreate<{ enabled: boolean }>(() => ({
  enabled: false,
}));

type Applier = (enabled: boolean) => void;
let applier: Applier | null = null;

/** Reactive read for the chrome that consumes the sampled offset. */
export function useDebugPagerOffsetSamplingEnabled() {
  return debugPagerOffsetSamplingStore(s => s.enabled);
}

/** Registered by the consumer so this module stays import-cycle free. */
export function registerDebugPagerOffsetSamplingApplier(fn: Applier) {
  applier = fn;
  if (debugPagerOffsetSamplingStore.getState().enabled) {
    fn(true);
  }
}

export const debugPagerOffsetSampling = {
  get enabled() {
    return debugPagerOffsetSamplingStore.getState().enabled;
  },
  set(enabled: boolean) {
    if (debugPagerOffsetSamplingStore.getState().enabled === enabled) {
      return;
    }
    debugPagerOffsetSamplingStore.setState({ enabled });
    applier?.(enabled);
  },
  toggle() {
    this.set(!this.enabled);
  },
};
