import { useCallback, useEffect, useMemo } from 'react';
import PQueue from 'p-queue';

import { apiCustomTestnet } from '@/core/apis';
import { useCustomTestnetAssetSectionsData } from '@/store/customTestnet';
import { customTestnetTokenToTokenItem } from '@/utils/token';

import type {
  CustomTestnetAssetSectionToken,
  LoadCustomTestnetAssetToken,
  LoadCustomTestnetAssetTokens,
} from './types';
import { makeMetadataTokenItem } from './utils';
import type { ITokenItem } from '@/types/assets';
import type { TestnetChain } from '@/types/customTestnet';

const EMPTY_ADDRESSES: string[] = [];
const CUSTOM_TESTNET_TOKEN_REQUEST_TIMEOUT = 8000;

const customTestnetTokenListQueue = new PQueue({
  intervalCap: 5,
  concurrency: 5,
  interval: 1000,
});

let hasInitializedCustomTestnetServiceForAssetList = false;

const withTimeoutFallback = async <T>(promise: Promise<T>, fallback: T) => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>(resolve => {
        timer = setTimeout(() => {
          resolve(fallback);
        }, CUSTOM_TESTNET_TOKEN_REQUEST_TIMEOUT);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
};

const makeFallbackTokenItem = (
  chain: TestnetChain,
  token: CustomTestnetAssetSectionToken,
  ownerAddress: string,
): ITokenItem => makeMetadataTokenItem(token, chain.serverId, ownerAddress);

// for multi-address
export function useCustomTestnetAssetSections(addresses: string[]) {
  useEffect(() => {
    if (hasInitializedCustomTestnetServiceForAssetList) {
      return;
    }
    hasInitializedCustomTestnetServiceForAssetList = true;
    apiCustomTestnet.initCustomTestnetService();
  }, []);

  const sections = useCustomTestnetAssetSectionsData(addresses);

  const loadTokenItems = useCallback(
    async (
      address: string,
      chain: TestnetChain,
      token: CustomTestnetAssetSectionToken,
    ): Promise<ITokenItem[]> => {
      const fallbackToken = makeFallbackTokenItem(chain, token, address);
      const tokenItem = await customTestnetTokenListQueue.add(async () => {
        try {
          const tokenWithBalance = await withTimeoutFallback(
            apiCustomTestnet.getCustomTestnetToken({
              address,
              chainId: token.chainId,
              tokenId: token.id,
            }),
            null,
          );

          if (!tokenWithBalance) {
            return fallbackToken;
          }

          const nextTokenItem = customTestnetTokenToTokenItem(tokenWithBalance);
          return {
            ...nextTokenItem,
            owner_addr: address,
            usd_value: 0,
            cex_ids: [],
          } satisfies ITokenItem;
        } catch (error) {
          console.error('Load custom testnet asset token failed:', error);
          return fallbackToken;
        }
      });

      return tokenItem ? [tokenItem] : [];
    },
    [],
  );

  const loadTokens = useCallback<LoadCustomTestnetAssetTokens>(
    async ({ chain, tokens: fallbackTokens }) => {
      if (!addresses.length) {
        return [];
      }

      const tokenGroups = await Promise.all(
        addresses.flatMap(address =>
          fallbackTokens.map(token => loadTokenItems(address, chain, token)),
        ),
      );

      return tokenGroups.flat();
    },
    [addresses, loadTokenItems],
  );

  const loadToken = useCallback<LoadCustomTestnetAssetToken>(
    async ({ chain, token }) => {
      if (!addresses.length) {
        return [];
      }

      const tokenGroups = await Promise.all(
        addresses.map(address => loadTokenItems(address, chain, token)),
      );

      return tokenGroups.flat();
    },
    [addresses, loadTokenItems],
  );

  return {
    sections,
    loadTokens,
    loadToken,
  };
}

export function useSingleAddressCustomTestnetAssetSections(address?: string) {
  const addresses = useMemo(
    () => (address ? [address] : EMPTY_ADDRESSES),
    [address],
  );

  return useCustomTestnetAssetSections(addresses);
}
