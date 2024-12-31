import { useRef, useEffect } from 'react';
import { AbstractPortfolioToken } from '../types';
import { useSafeState } from '@/hooks/useSafeState';
import { findChain } from '@/utils/chain';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { addressUtils } from '@rabby-wallet/base-utils';
import { preferenceService } from '@/core/services';
import { atom } from 'jotai';
import { DisplayedProject } from '../utils/project';
import {
  queryTokensCache,
  setWalletTokens,
  sortWalletTokens,
  tagTokenList,
  batchQueryTokens,
} from '../utils/token';
import { log } from './usePortfolio';
import { produce } from '@/core/utils/produce';
import { useTokensAtom } from './store';
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
  isTestnet = false,
) => {
  const abortProcess = useRef<AbortController>();
  const [isLoading, setLoading] = useSafeState(true);
  const [mainnetTokens, setMainnetTokens] = useTokensAtom(userAddr);
  const userAddrRef = useRef('');
  const chainIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (updateNonce !== 0) {
      loadProcess();
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
          loadProcess();
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

  const loadProcess = async () => {
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
    const snapshot = await queryTokensCache(userAddr, isTestnet);

    const tokenSettings =
      (await preferenceService.getUserTokenSettings(userAddr)) || {};

    if (currentAbort.signal.aborted || !snapshot) {
      log('--Terminate-tokens-snapshot-', userAddr);
      setLoading(false);
      return;
    }

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

    const tokenRes = await batchQueryTokens(userAddr, chainServerId, isTestnet);

    if (currentAbort.signal.aborted || !tokenRes) {
      log('--Terminate-tokens-', userAddr);
      setLoading(false);
      return;
    }

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
  };

  return {
    isLoading,
    tokens: mainnetTokens,
    updateData: loadProcess,
  };
};

export const useRefreshTags = (userAddr?: string) => {
  const [, setMainnetTokens] = useTokensAtom(userAddr);

  const refreshTags = async () => {
    if (!userAddr) {
      return;
    }
    const tokenSettings =
      (await preferenceService.getUserTokenSettings(userAddr)) || {};
    setMainnetTokens(pre => tagTokenList(pre || [], tokenSettings));
  };
  return {
    refreshTags,
  };
};
