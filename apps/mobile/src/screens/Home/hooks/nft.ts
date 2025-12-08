import { useCallback, useEffect, useMemo, useState } from 'react';
import { DisplayNftItem } from '../types';
import { ITokenSetting } from '@/core/services/preference';
import { preferenceService } from '@/core/services';
import { useSafeState } from 'ahooks';
import { NFTItem, CollectionList } from '@rabby-wallet/rabby-api/dist/types';
import { syncNFTs } from '@/databases/hooks/assets';
import { useSingleNftRefresh } from './refresh';
import { useAtom } from 'jotai';
import { NFTItemEntity } from '@/databases/entities/nftItem';
import { debounce } from 'lodash';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { useAppOrmSyncEvents } from '@/databases/sync/_event';
import { CombineNFTItem } from './store';

export const tagNfts = (
  nfts: NFTItem[],
  tokenSetting: ITokenSetting,
): DisplayNftItem[] => {
  const { foldNfts, unfoldNfts } = tokenSetting;

  return nfts.map(i => {
    const isFold = (() => {
      if (foldNfts?.some(nft => nft.chain === i.chain && nft.id === i.id)) {
        return true;
      }
      if (unfoldNfts?.some(nft => nft.chain === i.chain && nft.id === i.id)) {
        return false;
      }
      if (!i.is_core) {
        return true;
      }
      return false;
    })();

    const isManualFold = foldNfts?.some(
      nft => nft.chain === i.chain && nft.id === i.id,
    );

    return Object.assign(i, {
      _isFold: isFold,
      _isManualFold: isManualFold,
    });
  });
};
export const useQueryNft = (addr?: string, visible = true) => {
  const [isLoading, setIsLoading] = useState(true);
  const [list, setList] = useSafeState<DisplayNftItem[]>([]);
  // const [singleNFTNonce, setSingleNFTNonce] = useAtom(singleNFTNonceAtom);
  const fetchData = useCallback(
    async (force?: boolean) => {
      if (!addr) {
        return;
      }
      try {
        const cacheNfts = await NFTItemEntity.batchQueryNFTs(addr);
        const tokenSetting = await preferenceService.getUserTokenSettings();
        setList(tagNfts(cacheNfts, tokenSetting));
        const nfts = await syncNFTs(addr, force);
        setList(tagNfts(nfts, tokenSetting));
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
      const tokenSetting = await preferenceService.getUserTokenSettings();
      setList(tagNfts(cacheNfts, tokenSetting));
    } catch (e) {
      console.error('nft batchLocalData error', e);
    }
  }, [addr, setList]);

  const refreshTagNft = useCallback(async () => {
    const tokenSettings =
      (await preferenceService.getUserTokenSettings()) || {};
    setList(pre => tagNfts(pre || [], tokenSettings));
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
export const collectionNftList = (
  nftList: CombineNFTItem[],
  forSingleAddress?: boolean,
) => {
  const collectionList: NftItemWithCollection[] = [];
  nftList.forEach(item => {
    if (!item.collection_id || !item.collection) {
      collectionList.push(item);
      return;
    }
    const collection = collectionList.find(
      (_item): _item is CombineCollectionList =>
        'nft_list' in _item &&
        (forSingleAddress
          ? true
          : isSameAddress(_item.address || '', item.address || '')) &&
        _item.chain === item.chain &&
        _item.id === item.collection?.id &&
        !!_item.nft_list.length,
    );
    if (collection) {
      collection.nft_list.push({ ...item, collection: null });
    } else {
      collectionList.push({
        ...item.collection,
        address: item.address,
        nft_list: [{ ...item, collection: null }],
      } as unknown as CombineCollectionList);
    }
  });
  return collectionList;
};
