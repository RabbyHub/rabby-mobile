import { useRef, useEffect, useCallback } from 'react';
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
import { log } from './usePortfolio';
import { produce } from '@/core/utils/produce';
import { syncTokens } from '@/databases/hooks/assets';
import { TokenItemEntity } from '@/databases/entities/tokenitem';
import { singleTokenNounceAtom } from './refresh';

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

export const useTokens = (
  userAddr: string | undefined,
  visible = true,
  updateNonce = 0,
  chainServerId?: string,
  _force?: boolean,
) => {
  const abortProcess = useRef<AbortController>();
  const [isLoading, setLoading] = useSafeState(false);
  const [mainnetTokens, setMainnetTokens] = useSafeState<
    AbstractPortfolioToken[]
  >([]);

  const [singleTokenNounce, setSingleTokenNounce] = useAtom(
    singleTokenNounceAtom,
  );
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
      const currentAbort = new AbortController();
      abortProcess.current = currentAbort;

      setLoading(true);
      log('======Start-Tokens======', userAddr);
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

      const tokenSettings =
        (await preferenceService.getUserTokenSettings()) || {};
      if ((await TokenItemEntity.isExpired(userAddr)) || force) {
        const snapshot = await queryTokensCache(userAddr);
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

      setLoading(false);
      log('<<==Tokens-end==>>', userAddr);
    },
    [setLoading, setMainnetTokens, userAddr],
  );

  const refreshTagToken = useCallback(async () => {
    const tokenSettings =
      (await preferenceService.getUserTokenSettings()) || {};
    setMainnetTokens(pre => tagTokenList(pre || [], tokenSettings));
  }, [setMainnetTokens]);

  useEffect(() => {
    if (singleTokenNounce > 0) {
      refreshTagToken();
      setSingleTokenNounce(0);
    }
  }, [refreshTagToken, setSingleTokenNounce, singleTokenNounce]);

  return {
    isLoading,
    tokens: mainnetTokens,
    updateData: loadProcess,
  };
};
