import { useCallback, useEffect, useState } from 'react';
import { DisplayNftItem } from '../types';
import { ITokenSetting } from '@/core/services/preference';
import { preferenceService } from '@/core/services';
import { useSafeState } from 'ahooks';
import { NFTItem, CollectionList } from '@rabby-wallet/rabby-api/dist/types';
import { syncNFTs } from '@/databases/hooks/assets';
import { singleNFTNounceAtom } from './refresh';
import { useAtom } from 'jotai';
import { NFTItemEntity } from '@/databases/entities/nftItem';

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
  const [singleNFTNounce, setSingleNFTNounce] = useAtom(singleNFTNounceAtom);

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
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    },
    [addr, setList],
  );

  const refreshTagNft = useCallback(async () => {
    const tokenSettings =
      (await preferenceService.getUserTokenSettings()) || {};
    setList(pre => tagNfts(pre || [], tokenSettings));
  }, [setList]);

  useEffect(() => {
    if (singleNFTNounce > 0) {
      refreshTagNft();
      setSingleNFTNounce(0);
    }
  }, [refreshTagNft, setSingleNFTNounce, singleNFTNounce]);

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

export type NftItemWithCollection = NFTItem | CollectionList;
export const collectionNftList = (nftList: NFTItem[]) => {
  const collectionList: NftItemWithCollection[] = [];
  nftList.forEach(item => {
    if (!item.collection_id || !item.collection) {
      collectionList.push(item);
      return;
    }
    const collection = collectionList.find(
      (citem): citem is CollectionList =>
        'nft_list' in citem &&
        citem.chain === item.chain &&
        citem.id === item.collection?.id &&
        !!citem.nft_list.length,
    );
    if (collection) {
      collection.nft_list.push({ ...item, collection: null });
    } else {
      collectionList.push({
        ...item.collection,
        nft_list: [{ ...item, collection: null }],
      } as unknown as CollectionList);
    }
  });
  return collectionList;
};
