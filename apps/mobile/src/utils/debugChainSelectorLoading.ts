import { zCreate } from '@/core/utils/reexports';

/**
 * Dev-only switch that forces the home chain selector into its loading state.
 *
 * QA 1157 asks for a visible loading state while the chain projection is still
 * building; reproducing that window by hand (cold start + slow network) is
 * unreliable, so the debug deep link can pin the skeleton on:
 *
 *   ..._cmd=debug-open-target&target=chainLoading
 *
 * Toggling again returns to the real state. Nothing reads this outside
 * development builds.
 */
const debugChainSelectorLoadingStore = zCreate<{ forced: boolean }>(() => ({
  forced: false,
}));

export function toggleDebugChainSelectorLoading(next?: boolean) {
  const current = debugChainSelectorLoadingStore.getState().forced;
  debugChainSelectorLoadingStore.setState({
    forced: typeof next === 'boolean' ? next : !current,
  });
  return debugChainSelectorLoadingStore.getState().forced;
}

export function useDebugChainSelectorLoading() {
  return debugChainSelectorLoadingStore(s => s.forced);
}
