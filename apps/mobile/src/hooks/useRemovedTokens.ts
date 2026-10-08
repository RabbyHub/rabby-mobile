import { useEffect } from 'react';
import { addressUtils } from '@rabby-wallet/base-utils';

import {
  addRemovedToken as persistRemovedToken,
  bindRemovedTokensListener,
  getRemovedTokensSnapshot,
  removeRemovedToken as deletePersistedRemovedToken,
} from '@/core/serviceApi/preference';
import { zCreate } from '@/core/utils/reexports';
import type { IManageToken } from '@/types/assets';
import { useActivityStore } from '@/hooks/storeActivity/useActivityStore';

type RemovedTokensState = {
  removedTokens: readonly IManageToken[];
  addRemovedToken: typeof addRemovedToken;
  removeRemovedToken: typeof removeRemovedToken;
  isTokenRemoved: typeof isTokenRemoved;
  getRemovedTokens: typeof getRemovedTokens;
};

const removedTokensStore = zCreate<RemovedTokensState>(() => ({
  removedTokens: getRemovedTokensSnapshot(),
  addRemovedToken,
  removeRemovedToken,
  isTokenRemoved,
  getRemovedTokens,
}));

let storeBindingPromise: Promise<void> | null = null;
let disposeStoreBinding: (() => void) | null = null;

function ensureRemovedTokensBinding(): Promise<void> {
  if (disposeStoreBinding || storeBindingPromise) {
    return storeBindingPromise || Promise.resolve();
  }

  // One service subscription for the lifetime of the shared store.
  storeBindingPromise = bindRemovedTokensListener(removedTokens => {
    removedTokensStore.setState({ removedTokens });
  })
    .then(dispose => {
      disposeStoreBinding = dispose;
    })
    .catch(error => {
      storeBindingPromise = null;
      throw error;
    });

  return storeBindingPromise;
}

async function addRemovedToken(token: IManageToken) {
  await ensureRemovedTokensBinding();
  await persistRemovedToken(token);
}

async function removeRemovedToken(token: IManageToken) {
  await ensureRemovedTokensBinding();
  await deletePersistedRemovedToken(token);
}

function isTokenRemoved(token: IManageToken): boolean {
  return removedTokensStore
    .getState()
    .removedTokens.some(
      item =>
        item.chainId.toLowerCase() === token.chainId.toLowerCase() &&
        addressUtils.isSameAddress(item.tokenId, token.tokenId),
    );
}

function getRemovedTokens(): IManageToken[] {
  return removedTokensStore
    .getState()
    .removedTokens.map(token => ({ ...token }));
}

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
