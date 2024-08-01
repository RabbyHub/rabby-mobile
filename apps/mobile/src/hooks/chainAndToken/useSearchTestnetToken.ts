import { apiCustomTestnet } from '@/core/apis';
import { customTestnetTokenToTokenItem } from '@/utils/token';
import { useRequest } from 'ahooks';

export const useSearchTestnetToken = ({
  address,
  q,
  chainId,
  withBalance = false,
  enabled = false,
}: {
  address?: string;
  q?: string;
  chainId?: number;
  withBalance: boolean;
  enabled?: boolean;
}) => {
  const { data = [], loading } = useRequest(
    async () => {
      if (!enabled || !address) {
        return [];
      }
      let res = await apiCustomTestnet.getCustomTestnetTokenList({
        address,
        chainId,
        q,
      });
      if (withBalance) {
        res = res.filter(item => item.amount > 0);
      }
      return res.map(item => customTestnetTokenToTokenItem(item));
    },
    {
      refreshDeps: [address, chainId, enabled, withBalance, q],
    },
  );

  return {
    testnetTokenList: data,
    loading,
  };
};
