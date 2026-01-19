import {
  useAssetsMap,
  updateAssetListByAddress,
  getAssetsMapDirectly,
} from '@/screens/Home/hooks/store';
import { tagNfts } from '../Home/hooks/nft';
import { syncNFTs } from '@/databases/hooks/assets';
import _, { debounce } from 'lodash';
import { NFTItemEntity } from '@/databases/entities/nftItem';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { useCallback } from 'react';
import { useAppOrmSyncEvents } from '@/databases/sync/_event';
import { getTop10MyAccounts } from '@/core/apis/account';
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

const batchLoadCacheNFT = async (
  addresses: string[],
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
  const formatNFTMap = _.mapValues(nftGroup, group => tagNfts(group));

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
        updateAssetListByAddress(address, {
          type: 'nfts',
          data: tagNfts(_nfts),
        });
      } catch (e) {
        console.error('ServiceErrorType.NFT', e);
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
        updateAssetListByAddress(address, { type: 'nfts', data: [] });
      }
    });
  }, []);

  const checkIsExpireAndUpdate = useCallback(
    async (
      force?: boolean,
      options?: {
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
      const { disableNFT } = options || {};
      if (!options?.ignoreLoading) {
        setLoading(true);
      }
      try {
        for (const address of addresses) {
          try {
            await Promise.all([
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
    [removeUnNeedAssets, loadNFT],
  );
  const getCacheTop10Assets = useCallback(
    async (options?: {
      disableNFT?: boolean;
      realTimeAddresses?: string[];
      core?: boolean;
      maxNFTLength?: number;
    }) => {
      const { disableNFT } = options || {};
      const addresses =
        options?.realTimeAddresses ||
        (await getTop10MyAccounts()).top10Addresses;
      removeUnNeedAssets(addresses);
      const isCurrentShortCacheFetch = !!options?.maxNFTLength;

      const hasNftsCache = Object.keys(getAssetsMapDirectly('nfts')).length > 0;

      let hasRequiredCache = true;
      if (!disableNFT && !hasNftsCache) {
        hasRequiredCache = false;
      }

      if (hasRequiredCache && !shortCache) {
        return;
      }
      if (shortCache && isCurrentShortCacheFetch && hasRequiredCache) {
        return;
      }
      setShortCache(!!options?.maxNFTLength);

      setTimeout(() => {
        Promise.all([
          !disableNFT &&
            batchLoadCacheNFT(addresses, {
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
    batchLoadCacheNFT,
    refreshing: !!isLoading && !isFirstFetch,
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
      if (taskFor === 'nfts') {
        currentAssetCount =
          getAssetsMapDirectly('nfts')[ctx.owner_addr]?.length || 0;
      }
      if (taskFor === 'nfts') {
        if (currentUpdateCount > currentAssetCount) {
          debounceReloadNftList([ctx.owner_addr]);
        }
      }
    }, []),
  });
};
