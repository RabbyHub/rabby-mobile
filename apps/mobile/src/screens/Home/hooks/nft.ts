import { openapi } from '@/core/request';
import { useCallback, useEffect, useState } from 'react';
import { useNFTsAtom } from './store';
import { DisplayNftItem } from '../types';
import { ITokenSetting } from '@/core/services/preference';
import { preferenceService } from '@/core/services';

export const tagNfts = (
  nfts: DisplayNftItem[],
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
  const [list, setList] = useNFTsAtom(addr);

  const fetchData = useCallback(
    async (id: string) => {
      try {
        console.log('🔍 CUSTOM_LOGGER:=>: nft==loadProcess)', id);
        setIsLoading(true);
        const ntfs = await openapi.listNFT(id, true, true);
        const tokenSetting = await preferenceService.getUserTokenSettings();
        setList(tagNfts(ntfs, tokenSetting));
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    },
    [setList],
  );

  const reload = async () => {
    if (addr) {
      await fetchData(addr);
    }
  };

  useEffect(() => {
    if (addr && visible) {
      fetchData(addr);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addr, visible]);

  return {
    isLoading,
    list: list || [],
    reload,
  };
};
