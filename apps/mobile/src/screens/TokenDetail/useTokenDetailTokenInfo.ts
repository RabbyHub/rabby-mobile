import { useRequest } from 'ahooks';
import { useCallback, useEffect, useState } from 'react';
import type { ITokenItem } from '@/store/tokens';

export function getTokenDetailRequestKey({
  address,
  chain,
  tokenId,
  isCustomTestnetToken,
}: {
  address?: string;
  chain: string;
  tokenId: string;
  isCustomTestnetToken: boolean;
}) {
  return JSON.stringify([
    address?.toLowerCase(),
    chain,
    tokenId,
    isCustomTestnetToken,
  ]);
}

// Keep the existing debounced/manual request timing in the Screen. This hook
// only binds the returned balance and initial failure to the requested scope.
export function useTokenDetailTokenInfo({
  requestKey,
  fetchToken,
}: {
  requestKey: string;
  fetchToken: () => Promise<ITokenItem>;
}) {
  const [failedRequestKey, setFailedRequestKey] = useState<string>();
  const { data, runAsync, cancel } = useRequest(
    async (key: string) => ({ key, token: await fetchToken() }),
    {
      manual: true,
      onBefore: () => setFailedRequestKey(undefined),
      onError: (_error, [key]) => setFailedRequestKey(key),
    },
  );

  useEffect(() => () => cancel(), [cancel, requestKey]);

  const refreshAsync = useCallback(async () => {
    try {
      return await runAsync(requestKey);
    } catch {
      // The unavailable presentation is explicit; a failed initial request
      // must not keep showing a loading animation or a fabricated zero.
      return undefined;
    }
  }, [requestKey, runAsync]);

  const tokenInfo = data?.key === requestKey ? data.token : undefined;
  return {
    tokenInfo,
    refreshAsync,
    initialLoading: !tokenInfo && failedRequestKey !== requestKey,
  };
}
