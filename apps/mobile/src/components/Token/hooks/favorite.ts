import { useMemo, useEffect } from 'react';
import { useWatchlistTokens } from '@/screens/Watchlist/hooks/useWatchlistTokens';
import { ITokenItem } from '@/store/tokens';
import { TokenDetailWithPriceCurve } from '@rabby-wallet/rabby-api/dist/types';

interface UseFavoriteTokensProps {
  chainId: string;
  existTokens?: ITokenItem[];
  focus?: boolean;
}

const convertToITokenItem = (
  token: TokenDetailWithPriceCurve,
  ownerAddr: string = '',
): ITokenItem => {
  return {
    amount: token.amount || 0,
    chain: token.chain,
    decimals: token.decimals || 18,
    display_symbol: token.display_symbol || null,
    id: token.id,
    is_core: token.is_core || false,
    is_verified: token.is_verified || false,
    is_wallet: token.is_wallet || false,
    logo_url: token.logo_url || '',
    name: token.name || '',
    optimized_symbol: token.optimized_symbol || '',
    price: token.price || 0,
    symbol: token.symbol || '',
    usd_value: (token.price || 0) * (token.amount || 0),
    owner_addr: ownerAddr,
    raw_amount: token.raw_amount,
    price_24h_change: token.price_24h_change || null,
    cex_ids: token.cex_ids || [],
    time_at: token.time_at || 0,
    credit_score: token.credit_score,
    is_suspicious: token.is_suspicious,
    is_scam: token.is_scam,
    low_credit_score: token.low_credit_score,
    fdv: token.fdv,
    is_infinity: token.is_infinity,
    content_type: token.content_type,
    content: token.content,
    inner_id: token.inner_id,
    raw_amount_hex_str: token.raw_amount_hex_str,
    isPin: (token as any).isPin,
    trade_volume_level: (token as any).trade_volume_level,
    support_market_data: token.support_market_data,
    protocol_id: token.protocol_id,
  };
};

export const useFavoriteTokens = ({
  chainId,
  existTokens,
  focus = false,
}: UseFavoriteTokensProps) => {
  const {
    data: watchlistTokens,
    handleFetchTokens,
    loading,
  } = useWatchlistTokens();

  useEffect(() => {
    if (focus) {
      handleFetchTokens(
        false,
        existTokens?.map(token => ({
          chainId: token.chain,
          tokenId: token.id,
        })),
        chainId,
      );
    }
  }, [chainId, existTokens, focus, handleFetchTokens]);

  const favoriteTokens = useMemo(() => {
    const chainIdLower = chainId?.toLowerCase();

    const existTokensFiltered = (existTokens || []).filter(token =>
      chainIdLower ? token.chain.toLowerCase() === chainIdLower : true,
    );

    const watchlistTokensFiltered = watchlistTokens
      .filter(token =>
        chainIdLower ? token.chain.toLowerCase() === chainIdLower : true,
      )
      .map(token => convertToITokenItem(token));

    const tokenMap = new Map<string, ITokenItem>();

    existTokensFiltered.forEach(token => {
      const key = `${token.chain}:${token.id}`.toLowerCase();
      tokenMap.set(key, token);
    });

    watchlistTokensFiltered.forEach(token => {
      const key = `${token.chain}:${token.id}`.toLowerCase();
      if (!tokenMap.has(key)) {
        tokenMap.set(key, token);
      }
    });

    return Array.from(tokenMap.values()).sort((a, b) => {
      return b.usd_value - a.usd_value;
    });
  }, [existTokens, watchlistTokens, chainId]);

  return {
    data: favoriteTokens,
    loading,
  };
};
