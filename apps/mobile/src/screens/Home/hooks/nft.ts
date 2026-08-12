import { useCallback, useEffect, useMemo } from 'react';
import { DisplayNftItem } from '../types';
import { CollectionList } from '@rabby-wallet/rabby-api/dist/types';
import { debounce } from 'lodash';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { useAppOrmSyncEvents } from '@/databases/sync/_event';
import type { CombineNFTItem } from './store';
import nftListStore from '@/store/nfts';
import { useActivityStore } from '@/hooks/storeActivity/useActivityStore';

const EMPTY_NFT_LIST: DisplayNftItem[] = [];

const useNftListForAddress = (addr?: string) => {
  const normalizedAddr = addr?.toLowerCase();
  return useActivityStore(
    nftListStore,
    useCallback(
      s =>
        normalizedAddr
          ? s.nftsMap[normalizedAddr] || EMPTY_NFT_LIST
          : EMPTY_NFT_LIST,
      [normalizedAddr],
    ),
    Object.is,
    { storeLabel: 'single-address-nfts' },
  );
};

export const useSingleNftListController = (addr?: string, visible = true) => {
  const normalizedAddr = addr?.toLowerCase();
  const isLoading = useActivityStore(
    nftListStore,
    useCallback(
      state =>
        normalizedAddr
          ? state.singleLoadStatusByAddress[normalizedAddr] !== 'ready'
          : false,
      [normalizedAddr],
    ),
    Object.is,
    { storeLabel: 'single-address-nft-load-status' },
  );
  const { getNFTListWithCache, batchLoadCacheNFT } = nftListStore.getState();

  const fetchData = useCallback(
    async (force?: boolean) => {
      if (!addr) {
        return;
      }
      try {
        await getNFTListWithCache(addr, force);
      } catch (e) {
        console.error('ServiceErrorType.NFT', e);
      }
    },
    [addr, getNFTListWithCache],
  );

  const batchLocalData = useCallback(async () => {
    if (!addr) {
      return;
    }
    try {
      await batchLoadCacheNFT([addr]);
    } catch (e) {
      console.error('nft batchLocalData error', e);
    }
  }, [addr, batchLoadCacheNFT]);

  const debounceReloadNftList = useMemo(
    () => debounce(batchLocalData, 2000),
    [batchLocalData],
  );

  useAppOrmSyncEvents({
    taskFor: ['nfts'],
    onRemoteDataUpserted: useCallback(
      ctx => {
        if (
          !addr ||
          !isSameAddress(ctx.owner_addr, addr) ||
          !ctx.success ||
          isLoading
        ) {
          return;
        }
        const currentUpdateCount =
          ctx.syncDetails.batchSize * ctx.syncDetails.round +
          ctx.syncDetails.count;
        const currentListLength = normalizedAddr
          ? nftListStore.getState().nftsMap[normalizedAddr]?.length || 0
          : 0;

        if (
          currentUpdateCount >= ctx.syncDetails.total ||
          currentUpdateCount > currentListLength
        ) {
          debounceReloadNftList();
        }
      },
      [addr, debounceReloadNftList, isLoading, normalizedAddr],
    ),
  });

  useEffect(() => {
    if (addr && visible) {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addr, visible]);

  return {
    isLoading,
    reload: fetchData,
  };
};

export const useQueryNft = (addr?: string, visible = true) => {
  const list = useNftListForAddress(addr);
  const controller = useSingleNftListController(addr, visible);

  return {
    ...controller,
    list,
  };
};

type CombineCollectionList = CollectionList & {
  address?: string;
};
export type NftItemWithCollection = CombineNFTItem | CombineCollectionList;
