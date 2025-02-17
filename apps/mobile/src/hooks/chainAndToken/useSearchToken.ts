import { useEffect, useRef, useState, useCallback } from 'react';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { DisplayedToken } from '@/utils/token';
import { AbstractPortfolioToken } from '@/screens/Home/types';

import { requestOpenApiWithChainId } from '@/utils/openapi';
import { findChainByServerID } from '@/utils/chain';
import { devLog } from '@/utils/logger';

const useSearchToken = (
  queryCond: {
    address: string | undefined;
    keyword?: string;
    chainServerId?: string;
  },
  options?: {
    withBalance?: boolean;
    isTestnet?: boolean;
  },
) => {
  const { address, keyword = '', chainServerId } = queryCond;

  const { withBalance = false, isTestnet = false } = options || {};

  const [result, setResult] = useState<AbstractPortfolioToken[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const addressRef = useRef(address);
  const kwRef = useRef('');

  const searchToken = useCallback(
    async ({
      address,
      q,
      chainId,
    }: {
      address: string;
      q: string;
      chainId?: string;
    }) => {
      let list: TokenItem[] = [];
      setIsLoading(true);
      const chainItem = !chainId ? null : findChainByServerID(chainId);

      try {
        if (q.length === 42 && q.toLowerCase().startsWith('0x')) {
          list = await requestOpenApiWithChainId(
            ctx => ctx.openapi.searchToken(address, q, chainId, true),
            {
              isTestnet: isTestnet !== false || chainItem?.isTestnet,
            },
          );
        } else {
          list = await requestOpenApiWithChainId(
            ctx => ctx.openapi.searchToken(address, q, chainId),
            {
              isTestnet: isTestnet !== false || chainItem?.isTestnet,
            },
          );
          if (withBalance) {
            list = list.filter(item => item.amount > 0);
          }
        }
      } catch (err) {
        devLog('searchToken error', err);
      } finally {
        setIsLoading(false);
      }

      if (addressRef.current === address && kwRef.current === q) {
        setResult([
          ...(list.map(
            item => new DisplayedToken(item),
          ) as AbstractPortfolioToken[]),
        ]);
      }
    },
    [isTestnet, withBalance],
  );

  useEffect(() => {
    addressRef.current = address;
  }, [address]);

  useEffect(() => {
    kwRef.current = keyword;
  }, [keyword]);

  useEffect(() => {
    if (!address || !keyword) {
      setIsLoading(false);
      return;
    }
    searchToken({
      address,
      q: keyword,
      chainId: chainServerId,
    });
  }, [keyword, address, chainServerId, searchToken]);

  return {
    list: result,
    isLoading,
  };
};

export default useSearchToken;
