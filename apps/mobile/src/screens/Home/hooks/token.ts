import { useRef, useEffect, useCallback, useMemo } from 'react';
import { AbstractPortfolioToken } from '../types';
import { useSafeState } from '@/hooks/useSafeState';
import { findChain } from '@/utils/chain';
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
import { singleTokenNonceAtom } from './refresh';
import { debounce } from 'lodash';
import { useAppOrmSyncEvents } from '@/databases/sync/_event';

const walletProject = new DisplayedProject({
  id: 'Wallet',
  name: 'Wallet',
});

const { isSameAddress } = addressUtils;
export const filterDisplayToken = (tokens: AbstractPortfolioToken[]) => {
  return tokens.filter(token => {
    return findChain({
      serverId: token.chain,
    });
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
  visible = true,
  updateNonce = 0,
  chainServerId?: string,
  _force?: boolean,
) => {
  const abortProcess = useRef<AbortController>();
  const [isLoading, setLoading] = useSafeState(true);
  const [mainnetTokens, setMainnetTokens] = useSafeState<
    AbstractPortfolioToken[]
  >([]);

  const [singleTokenNonce, setSingleTokenNonce] = useAtom(singleTokenNonceAtom);
  const userAddrRef = useRef('');
  const chainIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (updateNonce !== 0) {
      loadProcess(_force);
    }
    return () => {
      abortProcess.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateNonce]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    if (userAddr) {
      timer = setTimeout(() => {
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
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userAddr, visible, chainServerId]);

  const loadProcess = useCallback(
    async (force?: boolean) => {
      if (!userAddr) {
        return;
      }
      try {
        console.log('CUSTOM_LOGGER:=>: loadProcess token');
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

        let _tokens: AbstractPortfolioToken[] = [];

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
              m[n.chain] = m[n.chain] || [];
              m[n.chain].push(n);

              return m;
            }, {} as Record<string, TokenItem[]>);
            _data = produce(_data, draft => {
              setWalletTokens(draft, chainTokens);
            });

            _tokens = tagTokenList(sortWalletTokens(_data), tokenSettings);
            setMainnetTokens(filterDisplayToken(_tokens));
            setLoading(false);
          }
        }

        const tokenRes = await syncTokens(userAddr, force);

        const tokensDict: Record<string, TokenItem[]> = {};
        tokenRes.forEach(token => {
          if (!tokensDict[token.chain]) {
            tokensDict[token.chain] = [];
          }
          tokensDict[token.chain].push(token);
        });

        _data = produce(_data, draft => {
          setWalletTokens(draft, tokensDict);
        });

        _tokens = tagTokenList(sortWalletTokens(_data), tokenSettings);

        setMainnetTokens([...filterDisplayToken(_tokens)]);
      } catch (error) {
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setMainnetTokens, userAddr],
  );

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
      let _tokens: AbstractPortfolioToken[] = [];

      const cachedTokens = await TokenItemEntity.batchQueryTokens(userAddr);
      const tokenSettings =
        (await preferenceService.getUserTokenSettings()) || {};
      if (cachedTokens.length) {
        const chainTokens = cachedTokens.reduce((m, n) => {
          m[n.chain] = m[n.chain] || [];
          m[n.chain].push(n);
          return m;
        }, {} as Record<string, TokenItem[]>);
        _data = produce(_data, draft => {
          setWalletTokens(draft, chainTokens);
        });
        _tokens = tagTokenList(sortWalletTokens(_data), tokenSettings);

        setMainnetTokens(filterDisplayToken(_tokens));
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
    setMainnetTokens(pre => tagTokenList(pre || [], tokenSettings));
  }, [setMainnetTokens]);

  useEffect(() => {
    if (singleTokenNonce > 0) {
      refreshTagToken();
      setSingleTokenNonce(0);
    }
  }, [refreshTagToken, setSingleTokenNonce, singleTokenNonce]);

  return {
    isLoading,
    tokens: mainnetTokens,
    updateData: loadProcess,
  };
};
