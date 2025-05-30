import { apisSafe } from '@/core/apis/safe';
import type { BasicSafeInfo } from '@rabby-wallet/gnosis-sdk';
import { useRequest } from 'ahooks';
import type { Options } from 'ahooks/lib/useRequest/src/types';

export const useGnosisSafeInfo = (
  params: { address?: string; networkId?: string },
  options?: Options<BasicSafeInfo | undefined, any[]>,
) => {
  const { address, networkId } = params;
  return useRequest(
    async () => {
      if (address && networkId) {
        const safeInfo = await apisSafe.getBasicSafeInfo({
          address,
          networkId,
        });

        return safeInfo;
      }
    },
    {
      refreshDeps: [address],
      cacheKey: `useGnosisSafeInfo-${address}-${networkId}`,
      ...options,
    },
  );
};
