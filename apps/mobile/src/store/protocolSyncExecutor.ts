import RNHelpers from '@/core/native/RNHelpers';
import { registerSyncAbortHandler } from '@/databases/sync/abort';
import { getNativeProtocolSyncEnabled } from '@/hooks/appSettings';

import { ensureNativeAssetSyncEventsStarted } from './nativeAssetSyncEvents';
import {
  waitForNativeAssetSyncCompletion,
  type NativeAssetSyncCompletion,
} from './nativeAssetSyncReceipt';

export type ProtocolSyncMode = 'js' | 'native';

type ProtocolSyncRequest<T> = {
  mode: ProtocolSyncMode;
  address: string;
  replaceExisting: boolean;
  executeJs(): Promise<T>;
};

export type ProtocolSyncExecution<T> =
  | {
      mode: 'js';
      value: T;
    }
  | {
      mode: 'native';
      result: NativeAssetSyncCompletion;
    };

export function getProtocolSyncMode(): ProtocolSyncMode {
  return getNativeProtocolSyncEnabled() ? 'native' : 'js';
}

export async function executeProtocolSync<T>({
  mode,
  address,
  replaceExisting,
  executeJs,
}: ProtocolSyncRequest<T>): Promise<ProtocolSyncExecution<T>> {
  if (mode === 'js') {
    RNHelpers.cancelNativeProtocolCacheSync(address);
    return {
      mode,
      value: await executeJs(),
    };
  }

  ensureNativeAssetSyncEventsStarted();
  const { requestId } = await RNHelpers.startNativeProtocolSync(
    address,
    replaceExisting,
  );
  const result = await waitForNativeAssetSyncCompletion(requestId);
  if (result.kind !== 'protocol') {
    throw new Error(`Unexpected native asset sync kind: ${result.kind}`);
  }

  return {
    mode,
    result,
  };
}

registerSyncAbortHandler(() => {
  RNHelpers.cancelAllNativeProtocolCacheSyncs();
});
