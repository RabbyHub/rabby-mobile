import RNHelpers from '@/core/native/RNHelpers';
import { registerSyncAbortHandler } from '@/databases/sync/abort';
import { getNativeNftSyncEnabled } from '@/hooks/appSettings';

import { ensureNativeAssetSyncEventsStarted } from './nativeAssetSyncEvents';
import {
  waitForNativeAssetSyncCompletion,
  type NativeAssetSyncCompletion,
} from './nativeAssetSyncReceipt';

export type NftSyncMode = 'js' | 'native';

type NftSyncRequest<T> = {
  mode: NftSyncMode;
  address: string;
  replaceExisting: boolean;
  executeJs(): Promise<T>;
};

export type NftSyncExecution<T> =
  | {
      mode: 'js';
      value: T;
    }
  | {
      mode: 'native';
      result: NativeAssetSyncCompletion;
    };

export function getNftSyncMode(): NftSyncMode {
  return getNativeNftSyncEnabled() ? 'native' : 'js';
}

export async function executeNftSync<T>({
  mode,
  address,
  replaceExisting,
  executeJs,
}: NftSyncRequest<T>): Promise<NftSyncExecution<T>> {
  if (mode === 'js') {
    RNHelpers.cancelNativeNftCacheSync(address);
    return {
      mode,
      value: await executeJs(),
    };
  }

  ensureNativeAssetSyncEventsStarted();
  const { requestId } = await RNHelpers.startNativeNftSync(
    address,
    replaceExisting,
  );
  const result = await waitForNativeAssetSyncCompletion(requestId);
  if (result.kind !== 'nft') {
    throw new Error(`Unexpected native asset sync kind: ${result.kind}`);
  }

  return {
    mode,
    result,
  };
}

registerSyncAbortHandler(() => {
  RNHelpers.cancelAllNativeNftCacheSyncs();
});
