import { apisSafe } from '@/core/apis/safe';
import { useRequest } from 'ahooks';
import type { Options } from 'ahooks/lib/useRequest/src/types';

export const useGnosisNetworks = (
  params: { address?: string },
  options?: Options<string[] | undefined, any[]>,
) => {
  const { address } = params;
  return useRequest(
    async () => {
      if (address) {
        return apisSafe.getGnosisNetworkIds(address);
      }
    },
    {
      refreshDeps: [address],
      cacheKey: `useGnosisNetworks-${address}`,
      ...options,
    },
  );
};
