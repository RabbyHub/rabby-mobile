import { useCallback, useMemo } from 'react';
import PQueue from 'p-queue';

import { apiCustomTestnet } from '@/core/apis';
import { customTestnetService } from '@/core/services/shared';
import { customTestnetTokenToTokenItem } from '@/utils/token';

import type {
  CustomTestnetAssetSectionData,
  LoadCustomTestnetAssetTokens,
} from './types';
import type { ITokenItem } from '@/types/assets';

const EMPTY_ADDRESSES: string[] = [];

const customTestnetTokenListQueue = new PQueue({
  intervalCap: 5,
  concurrency: 5,
  interval: 1000,
});

// for multi-address
export function useCustomTestnetAssetSections(addresses: string[]) {
  const sections = useMemo<CustomTestnetAssetSectionData[]>(() => {
    const chains = apiCustomTestnet.getCustomTestnetList();
    const customTokens = customTestnetService.store.customTokenList || [];

    return chains
      .map(chain => {
        const tokens = customTokens
          .filter(token => token.chainId === chain.id)
          .map(token => ({
            id: token.id,
            chainId: token.chainId,
            symbol: token.symbol,
            decimals: token.decimals,
          }));

        return {
          chain,
          tokens: [
            {
              id: chain.nativeTokenAddress,
              chainId: chain.id,
              symbol: chain.nativeTokenSymbol,
              decimals: chain.nativeTokenDecimals,
              isNative: true,
            },
            ...tokens,
          ],
        };
      })
      .filter(section => section.tokens.length > 0);
  }, []);

  const loadTokens = useCallback<LoadCustomTestnetAssetTokens>(
    async ({ chainId }) => {
      if (!addresses.length) {
        return [];
      }

      const tokenGroups = await Promise.all(
        addresses.map(async address => {
          const tokenItems = await customTestnetTokenListQueue.add(
            async (): Promise<ITokenItem[]> => {
              const tokens = await apiCustomTestnet.getCustomTestnetTokenList({
                address,
                chainId,
              });

              return tokens.map(token => {
                const tokenItem = customTestnetTokenToTokenItem(token);
                return {
                  ...tokenItem,
                  owner_addr: address,
                  usd_value: 0,
                  cex_ids: [],
                } satisfies ITokenItem;
              });
            },
          );

          return tokenItems || [];
        }),
      );

      return tokenGroups.flat();
    },
    [addresses],
  );

  return {
    sections,
    loadTokens,
  };
}

export function useSingleAddressCustomTestnetAssetSections(address?: string) {
  const addresses = useMemo(
    () => (address ? [address] : EMPTY_ADDRESSES),
    [address],
  );

  return useCustomTestnetAssetSections(addresses);
}
