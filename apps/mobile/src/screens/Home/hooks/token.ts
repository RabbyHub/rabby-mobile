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
import { log, tagProfiles } from './usePortfolio';
import { produce } from '@/core/utils/produce';
import { IAssets, useAssetsMap, useTokensAtom } from './store';
import { usePinTokens } from '@/screens/Search/usePinTokens';
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
  const [isLoading, setLoading] = useSafeState(false);
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
    console.log('🔍 CUSTOM_LOGGER:=>: token==loadProcess)', userAddr);
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
      (await preferenceService.getUserTokenSettings()) || {};

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

export const useRefreshTags = () => {
  const [, setAssetsMap] = useAssetsMap();
  const { handleFetchTokens } = usePinTokens();

  const refreshTags = async () => {
    const tokenSettings =
      (await preferenceService.getUserTokenSettings()) || {};
    handleFetchTokens();
    setAssetsMap(prevAssetsMap => {
      const updatedAssetsMap: { [address: string]: IAssets } = {};
      Object.entries(prevAssetsMap).forEach(([address, assets]) => {
        updatedAssetsMap[address] = {
          ...assets,
          tokens: tagTokenList(assets.tokens || [], tokenSettings),
          portfolios: tagProfiles(assets.portfolios || [], tokenSettings),
        };
      });

      return updatedAssetsMap;
    });
  };
  return {
    refreshTags,
  };
};
