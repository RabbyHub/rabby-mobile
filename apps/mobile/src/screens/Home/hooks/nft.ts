import { useCallback, useEffect, useState } from 'react';
import { DisplayNftItem } from '../types';
import { ITokenSetting } from '@/core/services/preference';
import { preferenceService } from '@/core/services';
import { useSafeState } from 'ahooks';
import { NFTItem } from '@rabby-wallet/rabby-api/dist/types';
import { syncNFTs } from '@/databases/hooks/assets';

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
  const [isLoading, setIsLoading] = useState(false);
  const [list, setList] = useSafeState<DisplayNftItem[]>([]);

  const fetchData = useCallback(
    async (force?: boolean) => {
      if (!addr) {
        return;
      }
      try {
        setIsLoading(true);
        const nfts = await syncNFTs(addr, force);
        const tokenSetting = await preferenceService.getUserTokenSettings();
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
    if (addr && visible) {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addr, visible]);

  return {
    isLoading,
    list: list || [],
    reload: fetchData,
    refreshTagNft,
  };
};
