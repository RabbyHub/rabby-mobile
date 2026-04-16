import nftListStore, { getAssetsMapDirectly } from '@/store/nfts';
import { debounce } from 'lodash';
import { useCallback } from 'react';
import { useAppOrmSyncEvents } from '@/databases/sync/_event';
import { useShallow } from 'zustand/react/shallow';

export const useLoadAssets = () => {
  const { isLoading, isFirstFetch, nftsMap } = nftListStore(
    useShallow(s => ({
      isLoading: s.isLoading,
      isFirstFetch: s.isFirstFetch,
      nftsMap: s.nftsMap,
    })),
  );

  const batchLoadCacheNFT = nftListStore(s => s.batchLoadCacheNFT);
  const batchGetNFTList = nftListStore(s => s.batchGetNFTList);
  const getCacheTop10NFTs = nftListStore(s => s.getCacheTop10NFTs);

  const checkIsExpireAndUpdate = useCallback(
    (
      force?: boolean,
      options?: {
        realTimeAddresses?: string[];
        ignoreLoading?: boolean;
        updateReturn?: boolean;
      },
    ) => batchGetNFTList(force, options),
    [batchGetNFTList],
  );

  const getCacheTop10Assets = useCallback(
    (options?: {
      realTimeAddresses?: string[];
      core?: boolean;
      maxNFTLength?: number;
    }) => getCacheTop10NFTs(options),
    [getCacheTop10NFTs],
  );

  return {
    isLoading,
    getCacheTop10Assets,
    checkIsExpireAndUpdate,
    batchLoadCacheNFT,
    refreshing: !!isLoading && !isFirstFetch,
    nftsMap,
  };
};

export const useAssetsRefreshing = () => {
  const { isLoading, isFirstFetch } = nftListStore(
    useShallow(s => ({
      isLoading: s.isLoading,
      isFirstFetch: s.isFirstFetch,
    })),
  );

  return {
    refreshing: !!isLoading && !isFirstFetch,
  };
};

const debounceReloadNftList = debounce((addresses: string[]) => {
  nftListStore.getState().batchLoadCacheNFT(addresses);
}, 2000);

export const useInitDetectDBAssets = () => {
  useAppOrmSyncEvents({
    taskFor: ['token', 'protocols', 'nfts'],
    onRemoteDataUpserted: useCallback(ctx => {
      if (!ctx.success || nftListStore.getState().isLoading) {
        return;
      }
      const { taskFor } = ctx;
      const currentUpdateCount =
        ctx.syncDetails.batchSize * ctx.syncDetails.round +
        ctx.syncDetails.count;

      let currentAssetCount = 0;
      if (taskFor === 'nfts') {
        currentAssetCount =
          getAssetsMapDirectly('nfts')[ctx.owner_addr]?.length || 0;
      }
      if (taskFor === 'nfts') {
        if (currentUpdateCount > currentAssetCount) {
          debounceReloadNftList([ctx.owner_addr]);
        }
      }
    }, []),
  });
};
