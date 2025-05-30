import { apisSafe } from '@/core/apis/safe';
import type { SafeMessage } from '@rabby-wallet/gnosis-sdk';
import { useRequest } from 'ahooks';
import type { Options } from 'ahooks/lib/useRequest/src/types';

export const useGnosisPendingMessages = (
  params: { address?: string },
  options?: Options<
    | {
        total: number;
        results: {
          networkId: string;
          messages: SafeMessage[];
        }[];
      }
    | undefined
    | null,
    any[]
  >,
) => {
  const { address } = params;
  return useRequest(
    async () => {
      if (address) {
        return apisSafe.getGnosisAllPendingMessages(address);
      }
    },
    {
      refreshDeps: [address],
      cacheKey: `useGnosisPendingMessages-${address}`,
      staleTime: 500,
      ...options,
    },
  );
};
