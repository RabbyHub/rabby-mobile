import { useCallback, useEffect, useMemo } from 'react';
import { DisplayNftItem } from '../types';
import { NFTItem, CollectionList } from '@rabby-wallet/rabby-api/dist/types';
import { useSingleNftRefresh } from './refresh';
import { debounce } from 'lodash';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { useAppOrmSyncEvents } from '@/databases/sync/_event';
import type { CombineNFTItem } from './store';
import { apisAddrChainStatics } from '../useChainInfo';
import { useDebouncedValue } from '@/hooks/common/delayLikeValue';
import nftListStore from '@/store/nfts';
import { useActivityStore } from '@/hooks/storeActivity/useActivityStore';

const EMPTY_NFT_LIST: DisplayNftItem[] = [];

export const tagNfts = (nfts: NFTItem[]): DisplayNftItem[] => {
  return nfts.map(i => {
    const isFold = (() => {
      if (!i.is_core) {
        return true;
      }
      return false;
    })();

    return Object.assign(i, {
      _isFold: isFold,
      _isManualFold: false,
    });
  });
};

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

export const useNftChainStaticsSync = (addr?: string) => {
  const list = useNftListForAddress(addr);
  const debouncedList = useDebouncedValue(list, 500);

  useEffect(() => {
    if (!addr) {
      return;
    }
    apisAddrChainStatics.updateNft(addr, debouncedList);
  }, [addr, debouncedList]);
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
  const {
    getNFTListWithCache,
    batchLoadCacheNFT,
    refreshTagNft: refreshTagNftByStore,
  } = nftListStore.getState();

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

  const refreshTagNft = useCallback(async () => {
    refreshTagNftByStore();
  }, [refreshTagNftByStore]);

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

  useSingleNftRefresh({
    onRefresh: refreshTagNft,
  });
  // useEffect(() => {
  //   if (singleNFTNonce > 0) {
  //     refreshTagNft();
  //     setSingleNFTNonce(0);
  //   }
  // }, [refreshTagNft, setSingleNFTNonce, singleNFTNonce]);

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
  useNftChainStaticsSync(addr);

  return {
    ...controller,
    list,
  };
};

type CombineCollectionList = CollectionList & {
  address?: string;
};
export type NftItemWithCollection = CombineNFTItem | CombineCollectionList;

export function varyNftListByFold<T extends any>(
  nftList: CombineNFTItem[],
  mapperItem: (collection: NftItemWithCollection, item: CombineNFTItem) => T,
  options?: {
    forSingleAddress: boolean;
  },
) {
  const { forSingleAddress = false } = options || {};

  const retValues = {
    foldList: [] as T[],
    unFoldList: [] as T[],
  };

  const collectionMap: Record<string, CombineCollectionList> = {};
  nftList.forEach(item => {
    const targetList = item._isFold ? retValues.foldList : retValues.unFoldList;
    if (!item.collection_id || !item.collection) {
      targetList.push(mapperItem(item, item));
      return;
    }
    const key = `${forSingleAddress ? '' : item.address}-${item.chain}-${
      item.collection?.id
    }`;
    if (collectionMap[key]) {
      collectionMap[key].nft_list.push({ ...item, collection: null });
    } else {
      const newCollection: CombineCollectionList = {
        ...item.collection,
        address: item.address,
        nft_list: [{ ...item, collection: null }],
      } as unknown as CombineCollectionList;
      collectionMap[key] = newCollection;
      targetList.push(mapperItem(newCollection, item));
    }
  });

  return retValues;
}
