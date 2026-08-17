import RNHelpers from '@/core/native/RNHelpers';
import { registerSyncAbortHandler } from '@/databases/sync/abort';
import { getNativeTokenChainSyncEnabled } from '@/hooks/appSettings';

export type TokenChainSyncMode = 'js' | 'native';
export type TokenChainReplacementScope = 'address' | 'chains';
export type NativeTokenChainSyncResult = Awaited<
  ReturnType<typeof RNHelpers.syncNativeTokenChains>
>;

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

  const result = await RNHelpers.syncNativeTokenChains(
    address,
    chainIds,
    replacementScope,
    replaceExisting,
  );
  if (!result.success) {
    throw new Error(
      `Native token chain sync failed at ${result.stage}: ${result.error}`,
    );
  }

  return {
    mode,
    result,
  };
}

registerSyncAbortHandler(() => {
  RNHelpers.cancelAllNativeTokenCacheSyncs();
});
