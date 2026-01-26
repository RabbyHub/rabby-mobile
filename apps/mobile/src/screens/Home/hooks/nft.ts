import { useCallback, useEffect, useMemo, useState } from 'react';
import { DisplayNftItem } from '../types';
import { useSafeState } from 'ahooks';
import { NFTItem, CollectionList } from '@rabby-wallet/rabby-api/dist/types';
import { syncNFTs } from '@/databases/hooks/assets';
import { useSingleNftRefresh } from './refresh';
import { NFTItemEntity } from '@/databases/entities/nftItem';
import { debounce } from 'lodash';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { useAppOrmSyncEvents } from '@/databases/sync/_event';
import { CombineNFTItem } from './store';
import { apisAddrChainStatics } from '../useChainInfo';
import { useDebouncedValue } from '@/hooks/common/delayLikeValue';

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
export const useQueryNft = (addr?: string, visible = true) => {
  const [isLoading, setIsLoading] = useState(true);
  const [list, setList] = useSafeState<DisplayNftItem[]>([]);

  const debouncedList = useDebouncedValue(list, 500);
  useEffect(() => {
    if (!addr || !debouncedList) return;
    apisAddrChainStatics.updateNft(addr, debouncedList);
  }, [addr, debouncedList]);

  const fetchData = useCallback(
    async (force?: boolean) => {
      if (!addr) {
        return;
      }
      try {
        const cacheNfts = await NFTItemEntity.batchQueryNFTs(addr);
        setList(tagNfts(cacheNfts));
        const nfts = await syncNFTs(addr, force);
        setList(tagNfts(nfts));
      } catch (e) {
        console.error('ServiceErrorType.NFT', e);
      } finally {
        setIsLoading(false);
      }
    },
    [addr, setList],
  );

  const batchLocalData = useCallback(async () => {
    if (!addr) {
      return;
    }
    try {
      const cacheNfts = await NFTItemEntity.batchQueryNFTs(addr);
      setList(tagNfts(cacheNfts));
    } catch (e) {
      console.error('nft batchLocalData error', e);
    }
  }, [addr, setList]);

  const refreshTagNft = useCallback(async () => {
    setList(pre => tagNfts(pre || []));
  }, [setList]);

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

        if (
          currentUpdateCount >= ctx.syncDetails.total ||
          currentUpdateCount > (list?.length || 0)
        ) {
          debounceReloadNftList();
        }
      },
      [addr, isLoading, list?.length, debounceReloadNftList],
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
    list: list || [],
    reload: fetchData,
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
