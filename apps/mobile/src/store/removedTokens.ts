import { addressUtils } from '@rabby-wallet/base-utils';

import {
  addRemovedToken as persistRemovedToken,
  bindRemovedTokensListener,
  getRemovedTokensSnapshot,
  isRemovedTokensReadySnapshot,
  removeRemovedToken as deletePersistedRemovedToken,
} from '@/core/serviceApi/preference';
import { zCreate } from '@/core/utils/reexports';
import type { IManageToken } from '@/types/assets';

export type RemovedTokensState = {
  isReady: boolean;
  removedTokens: readonly IManageToken[];
  addRemovedToken: typeof addRemovedToken;
  removeRemovedToken: typeof removeRemovedToken;
  isTokenRemoved: typeof isTokenRemoved;
  getRemovedTokens: typeof getRemovedTokens;
};

export const removedTokensStore = zCreate<RemovedTokensState>(() => ({
  isReady: isRemovedTokensReadySnapshot(),
  removedTokens: getRemovedTokensSnapshot(),
  addRemovedToken,
  removeRemovedToken,
  isTokenRemoved,
  getRemovedTokens,
}));

let storeBindingPromise: Promise<void> | null = null;
let disposeStoreBinding: (() => void) | null = null;

export function ensureRemovedTokensBinding(): Promise<void> {
  if (disposeStoreBinding || storeBindingPromise) {
    return storeBindingPromise || Promise.resolve();
  }

  // Catch up synchronously when the preference service is already available.
  const removedTokens = getRemovedTokensSnapshot();
  const isReady = isRemovedTokensReadySnapshot();
  if (
    isReady &&
    (!removedTokensStore.getState().isReady ||
      removedTokens !== removedTokensStore.getState().removedTokens)
  ) {
    removedTokensStore.setState({ removedTokens, isReady: true });
  }

  // One service subscription for the lifetime of the shared store.
  storeBindingPromise = bindRemovedTokensListener(removedTokens => {
    removedTokensStore.setState({ removedTokens, isReady: true });
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
