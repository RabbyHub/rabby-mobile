import { preferenceService } from '@/core/services';
import { useMemoizedFn } from 'ahooks';
import { AbstractPortfolioToken } from '../types';

export const useManageTokenList = () => {
  const addCustomToken = useMemoizedFn(
    async (token: AbstractPortfolioToken) => {
      const isAdded = await preferenceService.addCustomizedToken({
        address: token._tokenId,
        chain: token.chain,
      });
      if (isAdded) {
        // setMainnetTokens(prev => {
        //   return {
        //     ...prev,
        //     customize: [...prev.customize, token],
        //   };
        // });
      }
    },
  );

  const removeCustomToken = useMemoizedFn(
    async (token: AbstractPortfolioToken) => {
      await preferenceService.removeCustomizedToken({
        address: token._tokenId,
        chain: token.chain,
      });
      // setMainnetTokens(prev => {
      //   return {
      //     ...prev,
      //     customize: (prev.customize || []).filter(item => {
      //       return item.id !== token.id;
      //     }),
      //   };
      // });
    },
  );

  const addBlockedToken = useMemoizedFn(
    async (token: AbstractPortfolioToken) => {
      await preferenceService.addBlockedToken({
        address: token._tokenId,
        chain: token.chain,
      });
      // setMainnetTokens(prev => {
      //   return {
      //     ...prev,
      //     blocked: [...prev.blocked, token],
      //     list: prev.list.filter(item => item.id !== token.id),
      //   };
      // });
    },
  );

  const removeBlockedToken = useMemoizedFn(
    async (token: AbstractPortfolioToken) => {
      await preferenceService.removeBlockedToken({
        address: token._tokenId,
        chain: token.chain,
      });
      // setMainnetTokens(prev => {
      //   return {
      //     ...prev,
      //     blocked: (prev.blocked || []).filter(item => {
      //       return item.id !== token.id;
      //     }),
      //     list: [...prev.list, token],
      //   };
      // });
    },
  );

  return {
    addCustomToken,
    removeCustomToken,
    addBlockedToken,
    removeBlockedToken,
  };
};
