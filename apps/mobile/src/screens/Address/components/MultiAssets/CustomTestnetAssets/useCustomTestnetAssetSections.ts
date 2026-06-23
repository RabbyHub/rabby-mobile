import { useCallback, useMemo } from 'react';

import { apiCustomTestnet } from '@/core/apis';
import { customTestnetService } from '@/core/services/shared';
import { customTestnetTokenToTokenItem } from '@/utils/token';

import type {
  CustomTestnetAssetSectionData,
  LoadCustomTestnetAssetTokens,
} from './types';
import type { ITokenItem } from '@/types/assets';

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
