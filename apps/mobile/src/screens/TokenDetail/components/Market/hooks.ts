import { openapi } from '@/core/request';
import { useRequest } from 'ahooks';
import { useEffect, useMemo } from 'react';
import { every10sEvent } from '../../event';

export const useHolderInfo = (tokenId: string, chainId: string) => {
  const {
    data: summaryData,
    loading: summaryLoading,
    refresh: refreshSummary,
  } = useRequest(async () => {
    const res = await openapi.getTokenHolderSummary({
      token_id: tokenId,
      chain_id: chainId,
    });
    return res;
  });
  const {
    data: detailsData,
    loading: detailsLoading,
    refresh: refreshDetails,
  } = useRequest(async () => {
    const res = await openapi.getTokenHolderList({
      token_id: tokenId,
      chain_id: chainId,
    });
    return res;
  });

  const holderEmpty = useMemo(() => {
    return (
      !summaryData?.ratio_top100 &&
      !summaryData?.ratio_top10 &&
      !detailsData?.data_list.length &&
      !detailsLoading &&
      !summaryLoading
    );
  }, [
    detailsData?.data_list.length,
    detailsLoading,
    summaryData,
    summaryLoading,
  ]);

  useEffect(() => {
    if (holderEmpty) {
      return;
    }
    const refresh = () => {
      refreshSummary();
      refreshDetails();
    };
    return every10sEvent.on(refresh);
  }, [refreshSummary, refreshDetails, holderEmpty]);

  return {
    summaryData,
    summaryLoading,
    detailsData,
    detailsLoading,
    isHolderEmpty: holderEmpty,
  };
};

export const scrollEndCallBack = {
  cb: () => {},
};
