import { useEffect } from 'react';
import {
  ensureRemovedTokensBinding,
  removedTokensStore,
  type RemovedTokensState,
} from '@/store/removedTokens';
import { useActivityStore } from '@/hooks/storeActivity/useActivityStore';

export function useRemovedTokens(): RemovedTokensState;
export function useRemovedTokens<Selected>(
  selector: (state: RemovedTokensState) => Selected,
): Selected;
export function useRemovedTokens<Selected>(
  selector?: (state: RemovedTokensState) => Selected,
) {
  useEffect(() => {
    ensureRemovedTokensBinding().catch(console.error);
  }, []);

  return useActivityStore<RemovedTokensState, RemovedTokensState | Selected>(
    removedTokensStore,
    state => (selector ? selector(state) : state),
    Object.is,
    { storeLabel: 'removed-tokens' },
  );
}
