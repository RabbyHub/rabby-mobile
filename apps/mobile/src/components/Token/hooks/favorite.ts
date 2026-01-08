import { useMemo, useEffect, useState, useRef, useCallback } from 'react';
import { ITokenItem } from '@/store/tokens';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { IManageToken } from '@/core/services/preference';
import { preferenceService } from '@/core/services';
import { openapi } from '@/core/request';
import { atom, useAtom } from 'jotai';

interface UseFavoriteTokensProps {
  focus?: boolean;
  address?: string;
  chainId?: string;
}

const convertToITokenItem = (
  token: TokenItem,
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

const chunkArray = (arr: IManageToken[], size: number): IManageToken[][] => {
  const chunks: IManageToken[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
};

export const favoriteTokensAtom = atom<ITokenItem[]>([]);

export const useFavoriteTokens = ({
  focus,
  address,
  chainId,
}: UseFavoriteTokensProps) => {
  const [data, setData] = useAtom(favoriteTokensAtom);
  const [hasData, setHasData] = useState(false);
  const [loading, setLoading] = useState(false);
  // token级别缓存，key为chainId:tokenId
  const cacheRef = useRef<Map<string, ITokenItem>>(new Map());
  const noData = useMemo(() => data.length === 0, [data]);

  const getFavoriteTokens = useCallback(
    async (force = false, _chainId?: string) => {
      try {
        if (!address) {
          return [];
        }
        if (noData) {
          setLoading(true);
        }
        const { pinedQueue = [] } =
          await preferenceService.getUserTokenSettings();
        setHasData(pinedQueue.length > 0);
        // 生成所有token的key
        const allKeys = pinedQueue
          .filter(t =>
            _chainId
              ? t.chainId.toLowerCase() === _chainId.toLowerCase()
              : true,
          )
          .filter(t => t.chainId && t.tokenId)
          .map(i => `${i.chainId}:${i.tokenId}`);
        let needFetchKeys = allKeys;
        if (!force) {
          needFetchKeys = allKeys.filter(key => !cacheRef.current.has(key));
        }
        // 分批请求未缓存的token
        let newTokenDetails: TokenItem[] = [];
        const batches = chunkArray(
          pinedQueue.filter(t =>
            needFetchKeys.includes(`${t.chainId}:${t.tokenId}`),
          ),
          50,
        );
        for (const batch of batches) {
          const batchKeys = batch.map(i => `${i.chainId}:${i.tokenId}`);
          if (batchKeys.length === 0) {
            continue;
          }
          const batchDetails = await openapi.customListToken(
            batchKeys,
            address,
          );
          // 更新缓存
          batchDetails.forEach(token => {
            const key = `${token.chain}:${token.id}`;
            cacheRef.current.set(key, convertToITokenItem(token, address));
          });
          newTokenDetails = [...newTokenDetails, ...batchDetails];
        }
        // force时，清理缓存并重新填充
        if (force) {
          cacheRef.current.clear();
          newTokenDetails.forEach(token => {
            const key = `${token.chain}:${token.id}`;
            cacheRef.current.set(key, convertToITokenItem(token, address));
          });
        }
        // 返回顺序与pinedQueue一致的完整token列表
        const result = allKeys
          .map(key => cacheRef.current.get(key))
          .filter(Boolean) as ITokenItem[];
        setLoading(false);
        return result;
      } catch (error) {
        console.error('getWatchlistTokens error', error);
        setLoading(false);
        return [];
      }
    },
    [address, noData],
  );

  const handleFetchTokens = useCallback(
    (force = false, _chainId?: string) => {
      return getFavoriteTokens(force, _chainId).then(setData);
    },
    [getFavoriteTokens, setData],
  );

  useEffect(() => {
    if (address && focus) {
      handleFetchTokens();
    }
  }, [address, focus, handleFetchTokens]);

  const filteredData = useMemo(() => {
    return data
      .filter(token => (chainId ? token.chain === chainId : true))
      .sort((a, b) => {
        if (a.is_core && !b.is_core) {
          return -1;
        }
        if (!a.is_core && b.is_core) {
          return 1;
        }
        const aValue = (a.price ?? 0) * (a.amount ?? 0);
        const bValue = (b.price ?? 0) * (b.amount ?? 0);
        return bValue - aValue;
      });
  }, [data, chainId]);

  return {
    data: filteredData,
    handleFetchTokens,
    hasData,
    loading,
  };
};
