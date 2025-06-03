import { useRequest } from 'ahooks';
import type { Options } from 'ahooks/lib/useRequest/src/types';
import type { SafeTransactionItem } from '@rabby-wallet/gnosis-sdk/dist/api';
import { apisSafe } from '@/core/apis/safe';

export const useGnosisPendingTxs = (
  params: { address?: string },
  options?: Options<
    | {
        total: number;
        results: {
          networkId: string;
          txs: SafeTransactionItem[];
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
        return apisSafe.getGnosisAllPendingTxs(address);
      }
    },
    {
      refreshDeps: [address],
      cacheKey: `useGnosisPendingTxs-${address}`,
      staleTime: 500,
      ...options,
    },
  );
};
