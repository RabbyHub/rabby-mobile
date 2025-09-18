import { openapi } from '@/core/request';
import { useRequest } from 'ahooks';
import { useMemo } from 'react';

export const useHolderInfo = (tokenId: string, chainId: string) => {
  const { data: summaryData, loading: summaryLoading } = useRequest(
    async () => {
      const res = await openapi.getTokenHolderSummary({
        token_id: tokenId,
        chain_id: chainId,
      });
      return res;
    },
  );
  const { data: detailsData, loading: detailsLoading } = useRequest(
    async () => {
      const res = await openapi.getTokenHolderList({
        token_id: tokenId,
        chain_id: chainId,
      });
      return res;
    },
  );
  const holderEmpty = useMemo(() => {
    return (
      !summaryData?.ratio_top100 &&
      !summaryData?.ratio_top10 &&
      !detailsData?.data_list &&
      !detailsLoading &&
      !summaryLoading
    );
  }, [
    detailsData?.data_list,
    detailsLoading,
    summaryData?.ratio_top10,
    summaryData?.ratio_top100,
    summaryLoading,
  ]);

  return {
    summaryData,
    summaryLoading,
    detailsData,
    detailsLoading,
    isHolderEmpty: holderEmpty,
  };
};
