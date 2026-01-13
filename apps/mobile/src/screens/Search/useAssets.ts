import {
  useAssetsMap,
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
import { portfolio2Display } from '../Home/utils/portfolio';
import { tagProfiles } from '../Home/hooks/usePortfolio';
import { tagNfts } from '../Home/hooks/nft';
import {
  syncNFTs,
  syncProtocols,
  syncSpecificProtocol,
} from '@/databases/hooks/assets';
import { TokenItemEntity } from '@/databases/entities/tokenitem';
import _, { debounce } from 'lodash';
import { ProtocolItemEntity } from '@/databases/entities/portocolItem';
import { NFTItemEntity } from '@/databases/entities/nftItem';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { useCallback } from 'react';
import { useAppOrmSyncEvents } from '@/databases/sync/_event';
import { getTop10MyAccounts } from '@/core/apis/account';
import { zCreate } from '@/core/utils/reexports';
import { resolveValFromUpdater, UpdaterOrPartials } from '@/core/utils/store';
import { useShallow } from 'zustand/react/shallow';
import { ITokenSetting } from '@/core/services/preference';

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

const batchLoadCacheTokens = async (
  addresses: string[],
  setting: ITokenSetting,
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
      const list = (m[n.chain] = m[n.chain] || []);
      list.push(n);

      return m;
    }, {} as Record<string, TokenItem[]>);
    _data = produce(_data, draft => {
      setWalletTokens(draft, chainTokens);
    });

    const sortedTokens: AbstractPortfolioToken[] = tagTokenList(
      sortWalletTokens(_data),
      setting,
      { filterChainServerIds: true },
    );
    return sortedTokens;
  });

  Object.keys(formatAssetMap).forEach(address => {
    updateAssetListByAddress(address, {
      type: 'tokens',
      data: formatAssetMap[address] || [],
    });
  });

  setLoading(false);
};

const batchLoadCacheDefi = async (
  addresses: string[],
  setting: ITokenSetting,
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
      data: formatProtocolMap[address] || [],
    });
  });
};
const batchLoadCacheNFT = async (
  addresses: string[],
  setting: ITokenSetting,
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
  const formatNFTMap = _.mapValues(nftGroup, group => tagNfts(group, setting));

  Object.keys(formatNFTMap).forEach(address => {
    updateAssetListByAddress(address, {
      type: 'nfts',
      data: formatNFTMap[address] || [],
    });
  });
};

export const useLoadAssets = () => {
  const { isLoading, isFirstFetch, shortCache } = assetsStateStore(
    useShallow(s => ({
      isLoading: s.loading,
      isFirstFetch: s.isFirstFetch,
      shortCache: s.shortCache,
    })),
  );

  const { portfoliosMap, nftsMap } = useAssetsMap();

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
      const addresses =
        options?.realTimeAddresses ||
        (await getTop10MyAccounts()).top10Addresses;
      removeUnNeedAssets(addresses);
      const { disableDefi, disableNFT } = options || {};
      if (!options?.ignoreLoading) {
        setLoading(true);
      }
      try {
        for (const address of addresses) {
          try {
            await Promise.all([
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
    [removeUnNeedAssets, loadDefi, loadNFT],
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
      const addresses =
        options?.realTimeAddresses ||
        (await getTop10MyAccounts()).top10Addresses;
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
    [removeUnNeedAssets, shortCache],
  );

  return {
    isLoading,
    getCacheTop10Assets,
    checkIsExpireAndUpdate,
    batchLoadCacheTokens,
    batchLoadCacheDefi,
    batchLoadCacheNFT,
    refreshing: !!isLoading && !isFirstFetch,
    loadSpecificDefi,
    portfoliosMap,
    nftsMap,
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

const debounceReloadTokenList = debounce(batchLoadCacheTokens, 2000);
const debounceReloadDefiList = debounce(batchLoadCacheDefi, 2000);
const debounceReloadNftList = debounce(batchLoadCacheNFT, 2000);
export const useInitDetectDBAssets = () => {
  useAppOrmSyncEvents({
    taskFor: ['token', 'protocols', 'nfts'],
    onRemoteDataUpserted: useCallback(ctx => {
      if (!ctx.success || assetsStateStore.getState().loading) {
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
            preferenceService.getUserTokenSettingsSync(),
          );
        }
      } else if (taskFor === 'protocols') {
        if (currentUpdateCount > currentAssetCount) {
          debounceReloadDefiList(
            [ctx.owner_addr],
            preferenceService.getUserTokenSettingsSync(),
          );
        }
      } else if (taskFor === 'nfts') {
        if (currentUpdateCount > currentAssetCount) {
          debounceReloadNftList(
            [ctx.owner_addr],
            preferenceService.getUserTokenSettingsSync(),
          );
        }
      }
    }, []),
  });
};
