import RNHelpers from '@/core/native/RNHelpers';
import { registerSyncAbortHandler } from '@/databases/sync/abort';
import { getNativeTokenChainSyncEnabled } from '@/hooks/appSettings';

import { ensureNativeAssetSyncEventsStarted } from './nativeAssetSyncEvents';
import {
  waitForNativeAssetSyncCompletion,
  type NativeAssetSyncCompletion,
} from './nativeAssetSyncReceipt';

export type TokenChainSyncMode = 'js' | 'native';
export type TokenChainReplacementScope = 'address' | 'chains';
export type NativeTokenChainSyncResult = NativeAssetSyncCompletion;

type TokenChainSyncRequest<T> = {
  mode: TokenChainSyncMode;
  address: string;
  chainIds: string[];
  replacementScope: TokenChainReplacementScope;
  replaceExisting: boolean;
  executeJs(): Promise<T>;
};

export type TokenChainSyncExecution<T> =
  | {
      mode: 'js';
      value: T;
    }
  | {
      mode: 'native';
      result: NativeTokenChainSyncResult;
    };

export function getTokenChainSyncMode(): TokenChainSyncMode {
  return getNativeTokenChainSyncEnabled() ? 'native' : 'js';
}

export async function executeTokenChainSync<T>({
  mode,
  address,
  chainIds,
  replacementScope,
  replaceExisting,
  executeJs,
}: TokenChainSyncRequest<T>): Promise<TokenChainSyncExecution<T>> {
  if (mode === 'js') {
    RNHelpers.cancelNativeTokenCacheSync(address);
    return {
      mode,
      value: await executeJs(),
    };
  }

  ensureNativeAssetSyncEventsStarted();
  const { requestId } = await RNHelpers.startNativeTokenChains(
    address,
    chainIds,
    replacementScope,
    replaceExisting,
  );
  const result = await waitForNativeAssetSyncCompletion(requestId);

  return {
    mode,
    result,
  };
}

registerSyncAbortHandler(() => {
  RNHelpers.cancelAllNativeTokenCacheSyncs();
});
