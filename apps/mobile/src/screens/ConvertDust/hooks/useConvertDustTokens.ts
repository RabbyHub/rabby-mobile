import { useEffect, useMemo, useState } from 'react';

import { openapi } from '@/core/request';
import useTokenList, {
  EMPTY_TOKEN_LIST,
  getTokenSelectCacheKey,
  useTokenListComputedStore,
} from '@/store/tokens';
import type { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { DUST_FILTER_VALUE_MAP, type DustFilter } from '../constant';

export function useConvertDustTokenList({
  address,
  chainServerId,
  receiveTokenId,
  selectedFilter,
}: {
  address?: string;
  chainServerId?: string;
  receiveTokenId?: string;
  selectedFilter: DustFilter;
}) {
  const lowerAddress = address?.toLowerCase();
  const addresses = useMemo(() => (address ? [address] : []), [address]);
  const getTokenList = useTokenList(state => state.getTokenList);
  const isLoading = useTokenList(state => {
    if (!lowerAddress) {
      return false;
    }
    return !!state.isLoadingByAddress[lowerAddress]?.loading;
  });
  const registerTokenSelect = useTokenListComputedStore(
    state => state.registerTokenSelect,
  );
  const tokenSelectKey = useMemo(
    () => getTokenSelectCacheKey(addresses, chainServerId),
    [addresses, chainServerId],
  );

  useEffect(() => {
    if (!address) {
      return;
    }
    getTokenList(address);
  }, [address, getTokenList]);

  useEffect(() => {
    registerTokenSelect(addresses, chainServerId);
  }, [addresses, chainServerId, registerTokenSelect]);

  const tokens = useTokenListComputedStore(
    state => state.tokenSelectCache[tokenSelectKey] || EMPTY_TOKEN_LIST,
  );
  const threshold = DUST_FILTER_VALUE_MAP[selectedFilter];

  const dustTokens = useMemo(
    () =>
      tokens.filter(token => {
        const usdValue = token.usd_value || token.price * token.amount || 0;
        return (
          token.chain === chainServerId &&
          token.id !== receiveTokenId &&
          usdValue > 0 &&
          usdValue < threshold
        );
      }),
    [chainServerId, receiveTokenId, threshold, tokens],
  );

  return {
    tokens: dustTokens,
    isLoading,
  };
}

export function useConvertDustReceiveToken({
  address,
  chainServerId,
  nativeTokenAddress,
}: {
  address?: string;
  chainServerId?: string;
  nativeTokenAddress?: string;
}) {
  const [receiveToken, setReceiveToken] = useState<TokenItem | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!address || !chainServerId || !nativeTokenAddress) {
      setReceiveToken(null);
      return;
    }

    openapi
      .getToken(address, chainServerId, nativeTokenAddress)
      .then(token => {
        if (!cancelled) {
          setReceiveToken(token);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setReceiveToken(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [address, chainServerId, nativeTokenAddress]);

  return receiveToken;
}
