import { useMemoizedFn } from 'ahooks';
import { AbstractPortfolioToken } from '../types';
import { useTestnetTokens } from './token';
import { apiCustomTestnet } from '@/core/apis';
import { findChain } from '@/utils/chain';

export const useManageTestnetTokenList = () => {
  const [, setTestnetTokens] = useTestnetTokens();

  const addCustomToken = useMemoizedFn(
    async (token: AbstractPortfolioToken) => {
      const chain = findChain({
        serverId: token.chain,
      });
      if (!chain) {
        throw new Error(`not found chain ${token.chain}`);
      }
      await apiCustomTestnet.addCustomTestnetToken({
        chainId: chain.id,
        id: token._tokenId,
        symbol: token.symbol,
        decimals: token.decimals,
      });
      setTestnetTokens(prev => {
        return {
          list: [...prev.list, token],
        };
      });
    },
  );

  const removeCustomToken = useMemoizedFn(
    async (token: AbstractPortfolioToken) => {
      const chain = findChain({
        serverId: token.chain,
      });
      if (!chain) {
        throw new Error(`not found chain ${token.chain}`);
      }
      await apiCustomTestnet.removeCustomTestnetToken({
        chainId: chain.id,
        id: token._tokenId,
      });
      setTestnetTokens(prev => {
        return {
          list: prev.list.filter(item => item.id !== token.id),
        };
      });
    },
  );

  return {
    addCustomToken,
    removeCustomToken,
  };
};
