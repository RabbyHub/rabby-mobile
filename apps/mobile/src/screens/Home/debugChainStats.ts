import { zCreate } from '@/core/utils/reexports';

/**
 * Dev-only switch that pins the home chain projection in the state a cold start
 * actually has: the stores are empty and the projection has not produced a
 * result yet. Unlike hiding the icons at render time, this drives the real code
 * path - `useTop3Chains`/`chainLength` consumers see no chains and
 * `useChainStatsLoading()` reports a pending projection, so the chain selector
 * renders its loading state for the same reason it would on a real restart
 * (QA 1157).
 *
 * Toggle from the debug deep link, e.g.
 *   ..._cmd=debug-open-target&target=chainLoading
 *
 * The flag is read by the projection itself (which then skips recomputing) and
 * by the components that read the projection. Nothing outside development reads
 * it.
 */
// Kept deliberately dependency-free: the deep-link handler imports this module,
// and pulling the projection/storage layers in here creates import cycles.
const debugChainStatsForcedStore = zCreate<{ forced: boolean }>(() => ({
  forced: false,
}));

type Applier = (forced: boolean) => void;
let applier: Applier | null = null;

/**
 * Registered by the chain projection module so this lightweight module (and the
 * deep-link handler that imports it) never has to import the projection itself
 * and risk an import cycle.
 */
export function registerDebugChainStatsApplier(fn: Applier) {
  applier = fn;
  // A persisted pin must be applied on the first render after a restart.
  if (debugChainStatsForcedStore.getState().forced) {
    fn(true);
  }
}

/** Dev-only: flip the pinned state and let the projection clear/rebuild. */
export function toggleDebugChainStatsForced(next?: boolean) {
  if (!__DEV__) {
    return false;
  }
  const forced =
    typeof next === 'boolean'
      ? next
      : !debugChainStatsForcedStore.getState().forced;
  debugChainStatsForcedStore.setState({ forced });
  applier?.(forced);
  return forced;
}

let releaseTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Pin the state for `ms` and release automatically, so the
 * `skeleton -> real chain icons` transition can be observed end to end.
 */
export function forceDebugChainStatsFor(ms: number) {
  if (!__DEV__) {
    return false;
  }
  if (releaseTimer) {
    clearTimeout(releaseTimer);
    releaseTimer = null;
  }
  toggleDebugChainStatsForced(true);
  if (ms > 0) {
    releaseTimer = setTimeout(() => {
      releaseTimer = null;
      toggleDebugChainStatsForced(false);
    }, ms);
  }
  return true;
}

export function isDebugChainStatsForced() {
  return __DEV__ && debugChainStatsForcedStore.getState().forced;
}

export function setDebugChainStatsForced(forced: boolean) {
  if (!__DEV__) {
    return false;
  }
  debugChainStatsForcedStore.setState({ forced });
  return forced;
}

export function useDebugChainStatsForced() {
  return debugChainStatsForcedStore(s => s.forced);
}
