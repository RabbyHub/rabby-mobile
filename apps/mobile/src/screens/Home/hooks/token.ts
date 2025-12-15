import { useRef, useEffect, useCallback, useMemo } from 'react';
import { AbstractPortfolioToken } from '../types';
import { useSafeState } from '@/hooks/useSafeState';
import { findChain, makeChainServerIdSet } from '@/utils/chain';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { addressUtils } from '@rabby-wallet/base-utils';
import { preferenceService } from '@/core/services';
import { atom, useAtom } from 'jotai';
import { DisplayedProject } from '../utils/project';
import {
  queryTokensCache,
  setWalletTokens,
  sortWalletTokens,
  tagTokenList,
} from '../utils/token';
import { produce } from '@/core/utils/produce';
import { syncTokens } from '@/databases/hooks/assets';
import { TokenItemEntity } from '@/databases/entities/tokenitem';
import { useSingleTokenRefresh } from './refresh';
import { debounce } from 'lodash';
import { useAppOrmSyncEvents } from '@/databases/sync/_event';
import { apisAddrChainStatics } from '../useChainInfo';
import { useDebouncedValue } from '@/hooks/common/delayLikeValue';

const walletProject = new DisplayedProject({
  id: 'Wallet',
  name: 'Wallet',
});

const { isSameAddress } = addressUtils;
export const filterDisplayToken = (tokens: AbstractPortfolioToken[]) => {
  const allChainServerIds = makeChainServerIdSet();
  return tokens.filter(token => {
    return allChainServerIds.has(token.chain);
  });
};

export const testnetTokensAtom = atom({
  list: [] as AbstractPortfolioToken[],
});

export const useLocalTokens = (userAddr: string | undefined) => {
  const [tokenList, setTokenList] = useSafeState<TokenItem[]>([]);
  useEffect(() => {
    if (userAddr) {
      syncTokens(userAddr).then(tokens => {
        setTokenList(tokens);
      });
    }
  }, [userAddr, setTokenList]);
  return { tokenList };
};

export const useTokens = (
  userAddr: string | undefined,
  options?: {
    visible: boolean;
    chainServerId?: string;
    force?: boolean;
  },
) => {
  const { visible = true, chainServerId, force: _force } = options || {};
  const abortProcess = useRef<AbortController>();
  const [isLoading, setLoading] = useSafeState(true);
  const [mainnetTokens, setMainnetTokens] = useSafeState<
    AbstractPortfolioToken[]
  >([]);

  const debouncdMainnetTokens = useDebouncedValue(mainnetTokens, 500);
  useEffect(() => {
    if (!userAddr || !debouncdMainnetTokens) return;
    apisAddrChainStatics.updateToken(userAddr, debouncdMainnetTokens);
  }, [userAddr, debouncdMainnetTokens]);

  const userAddrRef = useRef('');
  const chainIdRef = useRef<string | undefined>(undefined);

  const loadProcess = useCallback(
    async (force?: boolean) => {
      if (!userAddr) {
        return;
      }
      try {
        let _data = produce(walletProject, draft => {
          draft.netWorth = 0;
          draft._netWorth = '$0';
          draft._netWorthChange = '-';
          draft.netWorthChange = 0;
          draft._netWorthChangePercent = '';
          draft._portfolioDict = {};
          draft._portfolios = [];
          draft._serverUpdatedAt = Math.ceil(new Date().getTime() / 1000);
        });

        const cachedTokens = force
          ? []
          : await TokenItemEntity.batchQueryTokens(userAddr);

        const tokenSettings =
          (await preferenceService.getUserTokenSettings()) || {};
        if (
          force ||
          cachedTokens.length ||
          (await TokenItemEntity.isExpired(userAddr))
        ) {
          const snapshot = cachedTokens.length
            ? cachedTokens
            : await queryTokensCache(userAddr);
          if (snapshot?.length) {
            const chainTokens = snapshot.reduce((m, n) => {
              const list = (m[n.chain] = m[n.chain] || []);
              list.push(n);

              return m;
            }, {} as Record<string, TokenItem[]>);
            _data = produce(_data, draft => {
              setWalletTokens(draft, chainTokens);
            });

            const sortedTokens = tagTokenList(
              sortWalletTokens(_data),
              tokenSettings,
              {
                filterChainServerIds: true,
              },
            );
            setMainnetTokens(sortedTokens);
            setLoading(false);
          }
        }

        const tokenRes = await syncTokens(userAddr, force);

        const tokensDict: Record<string, TokenItem[]> = {};
        tokenRes.forEach(token => {
          const list = (tokensDict[token.chain] =
            tokensDict[token.chain] || []);
          list.push(token);
        });

        _data = produce(_data, draft => {
          setWalletTokens(draft, tokensDict);
        });

        const sortedTokens = tagTokenList(
          sortWalletTokens(_data),
          tokenSettings,
          {
            filterChainServerIds: true,
          },
        );
        setMainnetTokens(sortedTokens);
      } catch (error) {
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setMainnetTokens, userAddr],
  );

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (userAddr) {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        if (
          visible &&
          (!isSameAddress(userAddr, userAddrRef.current) ||
            chainServerId !== chainIdRef.current)
        ) {
          abortProcess.current?.abort();
          userAddrRef.current = userAddr;
          chainIdRef.current = chainServerId;
          loadProcess(_force);
        }
      });
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [userAddr, visible, chainServerId, loadProcess, _force]);

  const batchLocalData = useCallback(async () => {
    if (!userAddr) {
      return;
    }
    try {
      const currentAbort = new AbortController();
      abortProcess.current = currentAbort;
      let _data = produce(walletProject, draft => {
        draft.netWorth = 0;
        draft._netWorth = '$0';
        draft._netWorthChange = '-';
        draft.netWorthChange = 0;
        draft._netWorthChangePercent = '';
        draft._portfolioDict = {};
        draft._portfolios = [];
        draft._serverUpdatedAt = Math.ceil(new Date().getTime() / 1000);
      });

      const cachedTokens = await TokenItemEntity.batchQueryTokens(userAddr);
      const tokenSettings =
        (await preferenceService.getUserTokenSettings()) || {};
      if (cachedTokens.length) {
        const chainTokens = cachedTokens.reduce((m, n) => {
          const list = (m[n.chain] = m[n.chain] || []);
          list.push(n);
          return m;
        }, {} as Record<string, TokenItem[]>);
        _data = produce(_data, draft => {
          setWalletTokens(draft, chainTokens);
        });
        const sortedTokens = tagTokenList(
          sortWalletTokens(_data),
          tokenSettings,
          {
            filterChainServerIds: true,
          },
        );

        setMainnetTokens(sortedTokens);
      }
    } catch (error) {
      console.error('token batchLocalData error', error);
    }
  }, [setMainnetTokens, userAddr]);

  const debounceUpdateTokens = useMemo(
    () => debounce(batchLocalData, 2000),
    [batchLocalData],
  );

  useAppOrmSyncEvents({
    taskFor: ['token'],
    onRemoteDataUpserted: useCallback(
      ctx => {
        if (
          !userAddr ||
          !isSameAddress(ctx.owner_addr, userAddr) ||
          !ctx.success ||
          isLoading
        ) {
          return;
        }
        const currentUpdateCount =
          ctx.syncDetails.batchSize * ctx.syncDetails.round +
          ctx.syncDetails.count;

        if (
          currentUpdateCount >= ctx.syncDetails.total ||
          currentUpdateCount > (mainnetTokens?.length || 0)
        ) {
          debounceUpdateTokens();
        }
      },
      [userAddr, isLoading, mainnetTokens?.length, debounceUpdateTokens],
    ),
  });

  const refreshTagToken = useCallback(async () => {
    const tokenSettings =
      (await preferenceService.getUserTokenSettings()) || {};
    setMainnetTokens(pre =>
      tagTokenList(pre || [], tokenSettings, { filterChainServerIds: true }),
    );
  }, [setMainnetTokens]);

  useSingleTokenRefresh({
    onRefresh: refreshTagToken,
  });

  return {
    isLoading,
    tokens: mainnetTokens,
    updateData: loadProcess,
  };
};
