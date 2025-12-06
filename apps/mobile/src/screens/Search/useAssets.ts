import {
  useAssetsMap,
  useAssetsComputation,
  updateAssetListByAddress,
  getAssetsMapDirectly,
} from '@/screens/Home/hooks/store';
import { produce } from '@/core/utils/produce';
import { DisplayedProject } from '../Home/utils/project';
import { AbstractPortfolioToken } from '../Home/types';
import {
  setWalletTokens,
  sortWalletTokens,
  tagTokenList,
} from '../Home/utils/token';
import { preferenceService } from '@/core/services';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { filterDisplayToken } from '../Home/hooks/token';
import { portfolio2Display } from '../Home/utils/portfolio';
import { tagProfiles } from '../Home/hooks/usePortfolio';
import { tagNfts } from '../Home/hooks/nft';
import {
  syncNFTs,
  syncProtocols,
  syncTokens,
  syncSpecificProtocol,
} from '@/databases/hooks/assets';
import { TokenItemEntity } from '@/databases/entities/tokenitem';
import _, { debounce } from 'lodash';
import { ProtocolItemEntity } from '@/databases/entities/portocolItem';
import { NFTItemEntity } from '@/databases/entities/nftItem';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { useCallback, useMemo } from 'react';
import { useAppOrmSyncEvents } from '@/databases/sync/_event';
import { syncRemoteTokensAmount } from '@/databases/sync/assets';
import { fetchAllAccounts } from '@/core/apis/account';
import { sortAccountList } from '@/utils/sortAccountList';
import { zCreate } from '@/core/utils/reexports';
import { resolveValFromUpdater, UpdaterOrPartials } from '@/core/utils/store';
import { useShallow } from 'zustand/react/shallow';

type AssetsState = {
  loading: boolean;
  isFirstFetch: boolean;
  shortCache: boolean;
};

const assetsStateStore = zCreate<AssetsState>(() => ({
  loading: true,
  isFirstFetch: true,
  shortCache: true,
}));

function setLoading(valOrFunc: UpdaterOrPartials<AssetsState['loading']>) {
  assetsStateStore.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev.loading, valOrFunc, {
      strict: false,
    });

    return { ...prev, loading: newVal };
  });
}
function setIsFirstFetch(
  valOrFunc: UpdaterOrPartials<AssetsState['isFirstFetch']>,
) {
  assetsStateStore.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev.isFirstFetch, valOrFunc, {
      strict: false,
    });

    return { ...prev, isFirstFetch: newVal };
  });
}

function setShortCache(
  valOrFunc: UpdaterOrPartials<AssetsState['shortCache']>,
) {
  assetsStateStore.setState(prev => {
    const { newVal } = resolveValFromUpdater(prev.shortCache, valOrFunc, {
      strict: false,
    });

    return { ...prev, shortCache: newVal };
  });
}

async function getTop10AccountsWithBalance() {
  const accounts = await fetchAllAccounts();

  const highlightedAddresses = preferenceService.getPinAddresses();

  const sortedAccounts = sortAccountList(accounts, {
    highlightedAddresses,
  });

  const top10Accounts = sortedAccounts.slice(0, 10).filter(acc => acc.balance);

  return {
    sortedAccounts,
    top10Accounts,
  };
}

export const useAssets = ({
  hideCombined = false,
}: {
  hideCombined?: boolean;
} = {}) => {
  const { isLoading, isFirstFetch, shortCache } = assetsStateStore(
    useShallow(s => ({
      isLoading: s.loading,
      isFirstFetch: s.isFirstFetch,
      shortCache: s.shortCache,
    })),
  );

  const {
    top10Addresses,
    getTokenCombined,
    tokensMap,
    // setTokensMap,
    portfoliosMap,
    // setPortfoliosMap,
    nftsMap,
    // setNftsMap,
  } = useAssetsMap();

  const { tokens, portfolios, nfts } = useAssetsComputation({
    // tokensMap,
    // portfoliosMap,
    // nftsMap,
    top10Addresses,
    hideCombined,
  });

  const loadToken = useCallback(
    async (address: string, force?: boolean, updateReturn?: boolean) => {
      if (!address) {
        return;
      }
      try {
        const walletProject = new DisplayedProject({
          id: 'Wallet',
          name: 'Wallet',
        });

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

        const tokenRes = await syncTokens(
          address,
          force,
          updateReturn ? false : !force,
          true,
        );
        if (!tokenRes.length) {
          return;
        }
        const tokenSettings =
          (await preferenceService.getUserTokenSettings()) || {};

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

        updateAssetListByAddress(address, {
          type: 'tokens',
          data: filterDisplayToken(_tokens),
        });
      } catch (error) {
        console.error('ServiceErrorType.Tokens', error);
      }
    },
    [],
  );

  const loadDefi = useCallback(
    async (address: string, force?: boolean, updateReturn?: boolean) => {
      if (!address) {
        return;
      }
      try {
        let projectDict: Record<string, DisplayedProject> | null = {};
        const protocols = await syncProtocols(
          address,
          force,
          updateReturn ? false : !force,
        );
        if (!protocols.length) {
          return;
        }
        protocols.forEach(project => {
          if (projectDict) {
            projectDict = produce(projectDict, draft => {
              project && portfolio2Display(project, draft);
            });
          }
        });
        const realtimeData = Object.values(projectDict)?.sort(
          (m, n) => (n.netWorth || 0) - (m.netWorth || 0),
        );
        const tokenSetting = await preferenceService.getUserTokenSettings();
        updateAssetListByAddress(address, {
          type: 'portfolios',
          data: tagProfiles(realtimeData, tokenSetting),
        });
      } catch (error) {
        console.error('ServiceErrorType.Defi', error);
      }
    },
    [],
  );

  const loadNFT = useCallback(
    async (address: string, force?: boolean, updateReturn?: boolean) => {
      if (!address) {
        return;
      }
      try {
        const _nfts = await syncNFTs(
          address,
          force,
          updateReturn ? false : !force,
        );
        if (!_nfts.length) {
          return;
        }
        const tokenSetting = await preferenceService.getUserTokenSettings();

        updateAssetListByAddress(address, {
          type: 'nfts',
          data: tagNfts(_nfts, tokenSetting),
        });
      } catch (e) {
        console.error('ServiceErrorType.NFT', e);
      }
    },
    [],
  );

  const loadSpecificDefi = useCallback(
    async (_address: string, protocolId: string, chain: string) => {
      if (!_address || !protocolId || !chain) {
        return;
      }
      const address = _address.toLowerCase();
      try {
        const protocols = await syncSpecificProtocol(
          address,
          protocolId,
          chain,
        );
        const targetProtocol = protocols[0];

        const tokenSetting = await preferenceService.getUserTokenSettings();

        const currentPortfolios =
          getAssetsMapDirectly('portfolios')[address] || [];

        if (!targetProtocol || !targetProtocol.portfolio_item_list?.length) {
          updateAssetListByAddress(address, {
            type: 'portfolios',
            data: currentPortfolios.filter(item => item.id !== protocolId),
          });
          return;
        }

        const protocolIndex = currentPortfolios.findIndex(
          item => item.id === protocolId,
        );
        const protocolDisplayData = new DisplayedProject(
          targetProtocol,
          targetProtocol.portfolio_item_list,
        );

        let updatedPortfolios = [...currentPortfolios];
        if (protocolIndex > -1) {
          updatedPortfolios[protocolIndex] = protocolDisplayData;
        } else {
          updatedPortfolios.push(protocolDisplayData);
        }

        const sortedPortfolios = updatedPortfolios.sort(
          (a, b) => (b.netWorth || 0) - (a.netWorth || 0),
        );

        updateAssetListByAddress(address, {
          type: 'portfolios',
          data: tagProfiles(sortedPortfolios, tokenSetting),
        });
      } catch (error) {
        console.error('ServiceErrorType.SpecificDefi', error);
      }
    },
    [],
  );

  const batchLoadCacheTokens = useCallback(
    async (
      addresses: string[],
      setting: any,
      options?: {
        core?: boolean;
        maxLength?: number;
      },
    ) => {
      if (!addresses.length) {
        return;
      }
      setLoading(true);
      const cachedTokens = await TokenItemEntity.batchMultiAddressTokens(
        addresses,
        options?.core,
        options?.maxLength,
      );
      if (!cachedTokens.length) {
        setLoading(false);
        return;
      }
      const assetGroup = _.groupBy(cachedTokens, 'owner_addr');
      const formatAssetMap = _.mapValues(assetGroup, group => {
        const walletProject = new DisplayedProject({
          id: 'Wallet',
          name: 'Wallet',
        });

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

        const chainTokens = group.reduce((m, n) => {
          m[n.chain] = m[n.chain] || [];
          m[n.chain].push(n);

          return m;
        }, {} as Record<string, TokenItem[]>);
        _data = produce(_data, draft => {
          setWalletTokens(draft, chainTokens);
        });

        const _tokens: AbstractPortfolioToken[] = tagTokenList(
          sortWalletTokens(_data),
          setting,
        );
        return filterDisplayToken(_tokens);
      });

      Object.keys(formatAssetMap).forEach(address => {
        updateAssetListByAddress(address, {
          type: 'tokens',
          data: formatAssetMap[address],
        });
      });

      setLoading(false);
    },
    [],
  );

  const batchLoadCacheDefi = useCallback(
    async (
      addresses: string[],
      setting: any,
      options?: {
        maxLength?: number;
      },
    ) => {
      if (!addresses.length) {
        return;
      }
      const cachedDeFis = await ProtocolItemEntity.batchMultAddressPortocols(
        addresses,
        options?.maxLength,
      );
      if (!cachedDeFis.length) {
        return;
      }

      const protocolGroup = _.groupBy(cachedDeFis, 'owner_addr');
      const formatProtocolMap = _.mapValues(protocolGroup, group => {
        let projectDict: Record<string, DisplayedProject> | null = {};
        group.forEach(project => {
          if (projectDict) {
            projectDict = produce(projectDict, draft => {
              project && portfolio2Display(project, draft);
            });
          }
        });
        const realtimeData = Object.values(projectDict)?.sort(
          (m, n) => (n.netWorth || 0) - (m.netWorth || 0),
        );
        return tagProfiles(realtimeData, setting);
      });

      Object.keys(formatProtocolMap).forEach(address => {
        updateAssetListByAddress(address, {
          type: 'portfolios',
          data: formatProtocolMap[address],
        });
      });
    },
    [],
  );
  const batchLoadCacheNFT = useCallback(
    async (
      addresses: string[],
      setting: any,
      options?: {
        core?: boolean;
        maxLength?: number;
      },
    ) => {
      if (!addresses.length) {
        return;
      }
      const cacheNfts = await NFTItemEntity.batchMultAddressNFTs(
        addresses,
        options?.core,
        options?.maxLength,
      );
      if (!cacheNfts.length) {
        return;
      }

      const nftGroup = _.groupBy(cacheNfts, 'owner_addr');
      const formatNFTMap = _.mapValues(nftGroup, group =>
        tagNfts(group, setting),
      );

      Object.keys(formatNFTMap).forEach(address => {
        updateAssetListByAddress(address, {
          type: 'nfts',
          data: formatNFTMap[address],
        });
      });
    },
    [],
  );
  const removeUnNeedAssets = useCallback((addresses: string[]) => {
    const allAddresses = new Set([
      ...Object.keys(getAssetsMapDirectly('tokens')),
      ...Object.keys(getAssetsMapDirectly('portfolios')),
      ...Object.keys(getAssetsMapDirectly('nfts')),
    ]);

    allAddresses.forEach(address => {
      if (!addresses.find(i => isSameAddress(i, address))) {
        updateAssetListByAddress(address, { type: 'tokens', data: [] });
        updateAssetListByAddress(address, { type: 'portfolios', data: [] });
        updateAssetListByAddress(address, { type: 'nfts', data: [] });
      }
    });
  }, []);

  const checkIsExpireAndUpdate = useCallback(
    async (
      force?: boolean,
      options?: {
        disableToken?: boolean;
        disableDefi?: boolean;
        disableNFT?: boolean;
        realTimeAddresses?: string[];
        ignoreLoading?: boolean;
        updateReturn?: boolean;
      },
    ) => {
      const addresses = options?.realTimeAddresses || [
        ...new Set(top10Addresses),
      ];
      removeUnNeedAssets(addresses);
      const { disableToken, disableDefi, disableNFT } = options || {};
      if (!options?.ignoreLoading) {
        setLoading(true);
      }
      try {
        for (const address of addresses) {
          try {
            await Promise.all([
              !disableToken && loadToken(address, force, options?.updateReturn),
              !disableDefi && loadDefi(address, force, options?.updateReturn),
              !disableNFT && loadNFT(address, force, options?.updateReturn),
            ]);
          } catch (error) {
            console.error(
              `Error fetching data for ${address.slice(-4)}:`,
              error,
            );
          }
        }
        await new Promise(resolve => setTimeout(resolve, 0));
      } finally {
        setLoading(false);
        setIsFirstFetch(false);
      }
    },
    [top10Addresses, removeUnNeedAssets, loadToken, loadDefi, loadNFT],
  );
  const getCacheTop10Assets = useCallback(
    async (options?: {
      disableToken?: boolean;
      disableDefi?: boolean;
      disableNFT?: boolean;
      realTimeAddresses?: string[];
      core?: boolean;
      maxTokenLength?: number;
      maxDefiLength?: number;
      maxNFTLength?: number;
    }) => {
      const { disableToken, disableDefi, disableNFT } = options || {};
      const addresses = options?.realTimeAddresses || [
        ...new Set(top10Addresses),
      ];
      removeUnNeedAssets(addresses);
      const isCurrentShortCacheFetch = !!(
        options?.maxTokenLength ||
        options?.maxDefiLength ||
        options?.maxNFTLength
      );

      const hasTokensCache =
        Object.keys(getAssetsMapDirectly('tokens')).length > 0;
      const hasPortfoliosCache =
        Object.keys(getAssetsMapDirectly('portfolios')).length > 0;
      const hasNftsCache = Object.keys(getAssetsMapDirectly('nfts')).length > 0;

      let hasRequiredCache = true;
      if (!disableToken && !hasTokensCache) {
        hasRequiredCache = false;
      }
      if (!disableDefi && !hasPortfoliosCache) {
        hasRequiredCache = false;
      }
      if (!disableNFT && !hasNftsCache) {
        hasRequiredCache = false;
      }

      if (hasRequiredCache && !shortCache) {
        return;
      }
      if (shortCache && isCurrentShortCacheFetch && hasRequiredCache) {
        return;
      }
      setShortCache(
        !!(
          options?.maxTokenLength ||
          options?.maxDefiLength ||
          options?.maxNFTLength
        ),
      );

      const tokenSetting = await preferenceService.getUserTokenSettings();
      !disableToken &&
        (await batchLoadCacheTokens(addresses, tokenSetting, {
          core: options?.core,
          maxLength: options?.maxTokenLength,
        }));
      setTimeout(() => {
        Promise.all([
          !disableDefi &&
            batchLoadCacheDefi(addresses, tokenSetting, {
              maxLength: options?.maxDefiLength,
            }),
          !disableNFT &&
            batchLoadCacheNFT(addresses, tokenSetting, {
              core: options?.core,
              maxLength: options?.maxNFTLength,
            }),
        ]);
      }, 0);
    },
    [
      top10Addresses,
      removeUnNeedAssets,
      shortCache,
      batchLoadCacheTokens,
      batchLoadCacheDefi,
      batchLoadCacheNFT,
    ],
  );

  const updateTokensAmount = useCallback(
    (
      updateTokenList: {
        address: string;
        token: TokenItem;
      }[],
    ) => {
      syncRemoteTokensAmount(updateTokenList);

      updateTokenList.forEach(({ address, token }) => {
        const lowerAddress = address?.toLowerCase?.() || address;
        const preTokens = tokensMap[lowerAddress] || [];

        const updatedTokens = preTokens.map(t => {
          const sameChain =
            (t.chain || '').toLowerCase() === (token.chain || '').toLowerCase();
          const sameTokenId =
            (t as any)._tokenId === token.id || (t as any).id === token.id;
          if (sameChain && sameTokenId) {
            return {
              ...t,
              price: token.price,
              price_24h_change: token.price_24h_change,
              amount: token.amount,
            };
          }
          return t;
        });

        updateAssetListByAddress(lowerAddress, {
          type: 'tokens',
          data: updatedTokens,
        });
      });
    },
    [tokensMap],
  );

  return {
    tokens,
    portfolios,
    nfts,
    isLoading,
    getTokenCombined,
    hasAssets: !!tokens?.length || !!portfolios?.length,
    getCacheTop10Assets,
    checkIsExpireAndUpdate,
    batchLoadCacheTokens,
    batchLoadCacheDefi,
    batchLoadCacheNFT,
    refreshing: !!isLoading && !isFirstFetch,
    loadSpecificDefi,
    updateTokensAmount,
    // Export individual maps and setters for direct access
    tokensMap,
    // setTokensMap,
    portfoliosMap,
    // setPortfoliosMap,
    nftsMap,
    // setNftsMap,
  };
};

export const useAssetsRefreshing = () => {
  // const isLoading = useAtomValue(loadingAtom);
  // const isFirstFetch = useAtomValue(isFirstFetchAtom);
  const { isLoading, isFirstFetch } = assetsStateStore(
    useShallow(s => ({ isLoading: s.loading, isFirstFetch: s.isFirstFetch })),
  );
  return {
    refreshing: !!isLoading && !isFirstFetch,
  };
};

export const useInitDetectDBAssets = () => {
  const {
    isLoading,
    batchLoadCacheTokens,
    batchLoadCacheDefi,
    batchLoadCacheNFT,
  } = useAssets({ hideCombined: true });

  const debounceReloadTokenList = useMemo(
    () => debounce(batchLoadCacheTokens, 2000),
    [batchLoadCacheTokens],
  );
  const debounceReloadDefiList = useMemo(
    () => debounce(batchLoadCacheDefi, 2000),
    [batchLoadCacheDefi],
  );
  const debounceReloadNftList = useMemo(
    () => debounce(batchLoadCacheNFT, 2000),
    [batchLoadCacheNFT],
  );

  useAppOrmSyncEvents({
    taskFor: ['token', 'protocols', 'nfts'],
    onRemoteDataUpserted: useCallback(
      ctx => {
        if (!ctx.success || isLoading) {
          return;
        }
        const { taskFor } = ctx;
        const currentUpdateCount =
          ctx.syncDetails.batchSize * ctx.syncDetails.round +
          ctx.syncDetails.count;

        let currentAssetCount = 0;
        if (taskFor === 'token') {
          currentAssetCount =
            getAssetsMapDirectly('tokens')[ctx.owner_addr]?.length || 0;
        } else if (taskFor === 'protocols') {
          currentAssetCount =
            getAssetsMapDirectly('portfolios')[ctx.owner_addr]?.length || 0;
        } else if (taskFor === 'nfts') {
          currentAssetCount =
            getAssetsMapDirectly('nfts')[ctx.owner_addr]?.length || 0;
        }

        if (taskFor === 'token') {
          if (currentUpdateCount > currentAssetCount) {
            debounceReloadTokenList(
              [ctx.owner_addr],
              preferenceService.getUserTokenSettings(),
            );
          }
        } else if (taskFor === 'protocols') {
          if (currentUpdateCount > currentAssetCount) {
            debounceReloadDefiList(
              [ctx.owner_addr],
              preferenceService.getUserTokenSettings(),
            );
          }
        } else if (taskFor === 'nfts') {
          if (currentUpdateCount > currentAssetCount) {
            debounceReloadNftList(
              [ctx.owner_addr],
              preferenceService.getUserTokenSettings(),
            );
          }
        }
      },
      [
        isLoading,
        debounceReloadDefiList,
        debounceReloadNftList,
        debounceReloadTokenList,
      ],
    ),
  });
};
