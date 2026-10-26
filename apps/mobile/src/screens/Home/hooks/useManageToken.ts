import {
  addBlockedToken as addBlockedTokenPreference,
  addCustomizedToken,
  removeBlockedToken as removeBlockedTokenPreference,
  removeCustomizedToken,
} from '@/core/serviceApi/preference';
import { useMemoizedFn } from 'ahooks';
import type { AbstractPortfolioToken } from '../types';

export const useManageTokenList = () => {
  const addCustomToken = useMemoizedFn(
    async (token: AbstractPortfolioToken) => {
      const isAdded = await addCustomizedToken({
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
      await removeCustomizedToken({
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
      await addBlockedTokenPreference({
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
      await removeBlockedTokenPreference({
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
