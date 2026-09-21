import type { CHAINS_ENUM } from '@debank/common';

export type PersistedSwapSelectionStatus = 'pending' | 'ready';

export function shouldApplyInitialChainFallback({
  persistedSelectionStatus,
  persistedSelectedChain,
  hasExplicitSelection,
  hasAppliedFallback,
}: {
  persistedSelectionStatus: PersistedSwapSelectionStatus;
  persistedSelectedChain: CHAINS_ENUM | null;
  hasExplicitSelection: boolean;
  hasAppliedFallback: boolean;
}) {
  return (
    persistedSelectionStatus === 'ready' &&
    persistedSelectedChain === null &&
    !hasExplicitSelection &&
    !hasAppliedFallback
  );
}
