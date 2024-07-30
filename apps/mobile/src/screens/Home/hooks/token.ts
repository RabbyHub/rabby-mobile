import { useRef, useEffect, useCallback } from 'react';
import { Dayjs } from 'dayjs';

import { AbstractPortfolioToken } from '../types';
import { useSafeState } from '@/hooks/useSafeState';
import { Token } from '@/core/services/preference';
import { CHAINS } from '@/constant/chains';
import { findChainByEnum, findChainByServerID } from '@/utils/chain';
import {
  PortfolioItem,
  PortfolioItemToken,
  TokenItem,
} from '@rabby-wallet/rabby-api/dist/types';
import { addressUtils } from '@rabby-wallet/base-utils';
import { isTestnet as checkIsTestnet } from '@/utils/chain';
import { openapi, testOpenapi } from '@/core/request';
import { preferenceService } from '@/core/services';
import { atom, useAtom } from 'jotai';
import { getMissedTokenPrice } from '../utils/portfolio';
import { DisplayedToken, DisplayedProject } from '../utils/project';
import {
  queryTokensCache,
  setWalletTokens,
  sortWalletTokens,
  batchQueryTokens,
  batchQueryHistoryTokens,
} from '../utils/token';
import { log } from './usePortfolio';
import { produce } from '@/core/utils/produce';

export const walletProject = new DisplayedProject({
  id: 'Wallet',
  name: 'Wallet',
});

const { isSameAddress } = addressUtils;

const filterDisplayToken = (
  tokens: AbstractPortfolioToken[],
  blocked: Token[],
) => {
  const ChainValues = Object.values(CHAINS);
  return tokens.filter(token => {
    const chain = ChainValues.find(chain => chain.serverId === token.chain);
    return (
      token.is_core &&
      !blocked.find(
        item =>
          isSameAddress(token._tokenId, item.address) &&
          item.chain === token.chain,
      ) &&
      findChainByEnum(chain?.enum)
    );
  });
};

export const mainnetTokensAtom = atom({
  list: [] as AbstractPortfolioToken[],
  customize: [] as AbstractPortfolioToken[],
  blocked: [] as AbstractPortfolioToken[],
});
export const testnetTokensAtom = atom({
  list: [] as AbstractPortfolioToken[],
  customize: [] as AbstractPortfolioToken[],
  blocked: [] as AbstractPortfolioToken[],
});

export const useTokens = (
  userAddr: string | undefined,
  timeAt?: Dayjs,
  visible = true,
  updateNonce = 0,
  chainServerId?: string,
  isTestnet: boolean = chainServerId
    ? !!findChainByServerID(chainServerId)?.isTestnet
    : false,
) => {
  const abortProcess = useRef<AbortController>();
  const [data, setData] = useSafeState(walletProject);
  const [isLoading, setLoading] = useSafeState(true);
  const historyTime = useRef<number>();
  const historyLoad = useRef<boolean>(false);
  const [mainnetTokens, setMainnetTokens] = useAtom(mainnetTokensAtom);
  const [testnetTokens, setTestnetTokens] = useAtom(testnetTokensAtom);
  const userAddrRef = useRef('');
  const chainIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (updateNonce === 0) {
      return;
    }
    loadProcess();
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
    } else {
      setData(undefined);
    }

    return () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userAddr, visible, chainServerId]);

  useEffect(() => {
    if (timeAt) {
      historyTime.current = timeAt.unix();

      if (!isLoading) {
        loadHistory();
      }
    } else {
      historyTime.current = 0;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeAt, isLoading]);

  const loadProcess = async () => {
    if (!userAddr) {
      return;
    }

    // await dispatch.account.resetTokenList();
    const currentAbort = new AbortController();
    abortProcess.current = currentAbort;
    historyLoad.current = false;

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
    setData(_data);
    const snapshot = await queryTokensCache(userAddr, isTestnet);

    const blocked = (await preferenceService.getBlockedToken()).filter(
      token => {
        if (isTestnet) {
          return checkIsTestnet(token.chain);
        } else {
          return !checkIsTestnet(token.chain);
        }
      },
    );

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

      setData(_data);
      _tokens = sortWalletTokens(_data);
      if (isTestnet) {
        setTestnetTokens(prev => {
          return {
            ...prev,
            list: filterDisplayToken(_tokens, blocked),
          };
        });
      } else {
        setMainnetTokens(prev => {
          return {
            ...prev,
            list: filterDisplayToken(_tokens, blocked),
          };
        });
      }
      setLoading(false);
    }

    const tokenRes = await batchQueryTokens(userAddr, chainServerId, isTestnet);

    if (currentAbort.signal.aborted || !tokenRes) {
      log('--Terminate-tokens-', userAddr);
      setLoading(false);
      return;
    }

    // customize and blocked tokens

    const customizeTokens = (
      await preferenceService.getCustomizedToken()
    ).filter(token => {
      if (isTestnet) {
        return checkIsTestnet(token.chain);
      } else {
        return !checkIsTestnet(token.chain);
      }
    });
    const customTokenList: TokenItem[] = [];
    const blockedTokenList: TokenItem[] = [];
    tokenRes.forEach(token => {
      if (
        customizeTokens.find(
          t =>
            isSameAddress(token.id, t.address) &&
            token.chain === t.chain &&
            !token.is_core,
        )
      ) {
        // customize with balance
        customTokenList.push(token);
      }
      if (
        blocked.find(
          t =>
            isSameAddress(token.id, t.address) &&
            token.chain === t.chain &&
            token.is_core,
        )
      ) {
        blockedTokenList.push(token);
      }
    });
    const apiProvider = isTestnet ? testOpenapi : openapi;
    const noBalanceBlockedTokens = blocked.filter(token => {
      return !blockedTokenList.find(
        t => isSameAddress(token.address, t.id) && token.chain === t.chain,
      );
    });
    const noBalanceCustomizeTokens = customizeTokens.filter(token => {
      return !customTokenList.find(
        t => isSameAddress(token.address, t.id) && token.chain === t.chain,
      );
    });
    if (noBalanceCustomizeTokens.length > 0) {
      const noBalanceCustomTokens = await apiProvider.customListToken(
        noBalanceCustomizeTokens.map(item => `${item.chain}:${item.address}`),
        userAddr,
      );
      customTokenList.push(
        ...noBalanceCustomTokens.filter(token => !token.is_core),
      );
    }
    if (noBalanceBlockedTokens.length > 0) {
      const blockedTokens = await apiProvider.customListToken(
        noBalanceBlockedTokens.map(item => `${item.chain}:${item.address}`),
        userAddr,
      );
      blockedTokenList.push(...blockedTokens.filter(token => token.is_core));
    }
    const formattedCustomTokenList = customTokenList.map(
      token => new DisplayedToken(token) as AbstractPortfolioToken,
    );
    const formattedBlockedTokenList = blockedTokenList.map(
      token => new DisplayedToken(token) as AbstractPortfolioToken,
    );
    if (isTestnet) {
      setTestnetTokens(prev => {
        return {
          ...prev,
          blocked: formattedBlockedTokenList,
          customize: formattedCustomTokenList,
        };
      });
    } else {
      setMainnetTokens(prev => {
        return {
          ...prev,
          blocked: formattedBlockedTokenList,
          customize: formattedCustomTokenList,
        };
      });
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

    setData(_data);
    _tokens = sortWalletTokens(_data);
    if (isTestnet) {
      setTestnetTokens(prev => {
        return {
          ...prev,
          list: [
            ...filterDisplayToken(_tokens, blocked),
            ...formattedCustomTokenList,
          ],
        };
      });
    } else {
      setMainnetTokens(prev => {
        return {
          ...prev,
          list: [
            ...filterDisplayToken(_tokens, blocked),
            ...formattedCustomTokenList,
          ],
        };
      });
    }
    setLoading(false);

    loadHistory(_data, currentAbort);

    log('<<==Tokens-end==>>', userAddr);
  };

  const loadHistory = async (
    pre?: DisplayedProject,
    currentAbort = new AbortController(),
  ) => {
    if (!historyTime.current || !userAddr || historyLoad.current) {
      log('middle-tokens-end');
      return;
    }

    abortProcess.current = currentAbort;
    historyLoad.current = true;

    let _data = pre || data!;

    log('===token===batchhistory====', userAddr);
    // setTokenChangeLoading(true);

    if (currentAbort.signal.aborted || !_data?.netWorth) {
      setLoading(false);
      return;
    }

    const historyTokenRes = await batchQueryHistoryTokens(
      userAddr,
      historyTime.current,
      isTestnet,
    );

    if (currentAbort.signal.aborted) {
      setLoading(false);
      return;
    }

    const historyPortfolios: PortfolioItem[] = [];

    historyTokenRes?.forEach(token => {
      const chain = token.chain;
      const index = historyPortfolios.findIndex(p => p.pool.id === chain);
      if (index === -1) {
        historyPortfolios.push({
          pool: {
            id: chain,
          },
          asset_token_list: [token as PortfolioItemToken],
        } as PortfolioItem);
      } else {
        historyPortfolios[index].asset_token_list?.push(
          token as PortfolioItemToken,
        );
      }
    });

    _data = produce(_data, draft => {
      draft.patchHistory(historyPortfolios);
    });

    const tokenList = sortWalletTokens(_data);
    if (isTestnet) {
      setTestnetTokens(prev => {
        return {
          ...prev,
          list: tokenList,
        };
      });
    } else {
      setMainnetTokens(prev => {
        return {
          ...prev,
          list: tokenList,
        };
      });
    }
    setData(_data);

    if (currentAbort.signal.aborted) {
      setLoading(false);
      return;
    }

    const missedTokens = tokenList.reduce((m, n) => {
      if (n._tokenId && !n._historyPatched) {
        m[n.chain] = m[n.chain] || new Set();
        m[n.chain].add(n._tokenId);
      }

      return m;
    }, {} as Record<string, Set<string>>);

    const priceDicts = await getMissedTokenPrice(
      missedTokens,
      historyTime.current,
    );

    if (currentAbort.signal.aborted || !priceDicts) {
      setLoading(false);
      return;
    }

    _data = produce(_data, draft => {
      Object.entries(priceDicts).forEach(([c, dict]) => {
        if (!draft._portfolioDict[c]._historyPatched) {
          draft._portfolioDict[c].patchPrice(dict);
          if (draft._portfolioDict[c].netWorthChange) {
            draft.netWorthChange += draft._portfolioDict[c].netWorthChange;
          }
        }
        draft.afterHistoryPatched();
      });
    }) as DisplayedProject;

    if (currentAbort.signal.aborted) {
      setLoading(false);
      return;
    }

    setData(_data);
    if (isTestnet) {
      setTestnetTokens(prev => {
        return {
          ...prev,
          list: sortWalletTokens(_data),
        };
      });
    } else {
      setMainnetTokens(prev => {
        return {
          ...prev,
          list: sortWalletTokens(_data),
        };
      });
    }
  };

  useEffect(() => {
    return () => {
      abortProcess.current?.abort();
    };
  }, []);

  return {
    netWorth: data?.netWorth || 0,
    isLoading,
    tokens: isTestnet ? testnetTokens.list : mainnetTokens.list,
    customizeTokens: isTestnet
      ? testnetTokens.customize
      : mainnetTokens.customize,
    blockedTokens: isTestnet ? testnetTokens.blocked : mainnetTokens.blocked,
    hasValue: !!data?._portfolios?.length,
    updateData: loadProcess,
    walletProject: data,
  };
};
