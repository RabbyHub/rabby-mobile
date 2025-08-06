import { useAssetsMap } from '@/screens/Home/hooks/store';
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
import { useMyAccounts } from '@/hooks/account';
import { useSortAddressList } from '../Address/useSortAddressList';
import { tagNfts } from '../Home/hooks/nft';
import { syncNFTs, syncProtocols, syncTokens } from '@/databases/hooks/assets';
import { TokenItemEntity } from '@/databases/entities/tokenitem';
import _, { debounce } from 'lodash';
import { PortocolItemEntity } from '@/databases/entities/portocolItem';
import { NFTItemEntity } from '@/databases/entities/nftItem';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { atom, useAtom, useAtomValue } from 'jotai';
import { useMemoizedFn } from 'ahooks';
import { useCallback, useMemo } from 'react';
import { useAppOrmSyncEvents } from '@/databases/sync/_event';
import { useUserTokenSettings } from '@/hooks/useTokenSettings';

export const loadingAtom = atom(true);
export const isFirstFetchAtom = atom(true);
export const shortCacheAtom = atom(true);
export const useAssets = ({
  hideCombined = false,
}: {
  hideCombined?: boolean;
} = {}) => {
  const [isLoading, setLoading] = useAtom(loadingAtom);
  const { accounts } = useMyAccounts({
    disableAutoFetch: true,
  });
  const sortedAccounts = useSortAddressList(accounts);
  const [isFirstFetch, setIsFirstFetch] = useAtom(isFirstFetchAtom);
  const [shortCache, setShortCache] = useAtom(shortCacheAtom);
  const {
    tokens,
    portfolios,
    assetsMap,
    setAssetsMap,
    updateNFTs,
    updatePortfolios,
    updateTokens,
    getTokenCombined,
  } = useAssetsMap({ hideCombined });

  const loadToken = useMemoizedFn(async (address: string, force?: boolean) => {
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

      const tokenRes = await syncTokens(address, force, !force);
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

      updateTokens({
        address,
        newTokens: filterDisplayToken(_tokens),
      });
    } catch (error) {
      console.error('ServiceErrorType.Tokens', error);
    }
  });

  const loadDefi = useMemoizedFn(async (address: string, force?: boolean) => {
    if (!address) {
      return;
    }
    try {
      let projectDict: Record<string, DisplayedProject> | null = {};
      const protocols = await syncProtocols(address, force, !force);
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
      updatePortfolios({
        address,
        newPortfolios: tagProfiles(realtimeData, tokenSetting),
      });
    } catch (error) {
      console.error('ServiceErrorType.Defi', error);
    }
  });

  const loadNFT = useMemoizedFn(async (address: string, force?: boolean) => {
    try {
      const nfts = await syncNFTs(address, force, !force);
      if (!nfts.length) {
        return;
      }
      const tokenSetting = await preferenceService.getUserTokenSettings();

      updateNFTs({
        address,
        newNFTs: tagNfts(nfts, tokenSetting),
      });
    } catch (e) {
      console.error('ServiceErrorType.NFT', e);
    }
  });

  const batchLoadCacheTokens = useMemoizedFn(
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
      const cachedTokens = await TokenItemEntity.batchMultAddressTokens(
        addresses,
        options?.core,
        options?.maxLength,
      );
      if (!cachedTokens.length) {
        setLoading(false);
        return;
      }
      const assestGroup = _.groupBy(cachedTokens, 'owner_addr');
      const formatAssetMap = _.mapValues(assestGroup, group => {
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
      setAssetsMap(_pre => {
        const curr = { ...(_pre || {}) };
        Object.keys(formatAssetMap).forEach(address => {
          if (curr[address]) {
            curr[address].tokens = formatAssetMap[address];
          } else {
            curr[address] = {
              tokens: formatAssetMap[address],
            };
          }
        });
        return curr;
      });
      setLoading(false);
    },
  );

  const batchLoadCacheDefi = useMemoizedFn(
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
      const cachedPortcols = await PortocolItemEntity.batchMultAddressPortocols(
        addresses,
        options?.maxLength,
      );
      if (!cachedPortcols) {
        return;
      }

      const protocolGroup = _.groupBy(cachedPortcols, 'owner_addr');
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
      setAssetsMap(_pre => {
        const curr = { ...(_pre || {}) };
        Object.keys(formatProtocolMap).forEach(address => {
          if (curr[address]) {
            curr[address].portfolios = formatProtocolMap[address];
          } else {
            curr[address] = {
              portfolios: formatProtocolMap[address],
            };
          }
        });
        return curr;
      });
    },
  );
  const batchLoadCacheNFT = useMemoizedFn(
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
      setAssetsMap(_pre => {
        const curr = { ...(_pre || {}) };
        Object.keys(formatNFTMap).forEach(address => {
          if (curr[address]) {
            curr[address].nfts = formatNFTMap[address];
          } else {
            curr[address] = {
              nfts: formatNFTMap[address],
            };
          }
        });
        return curr;
      });
    },
  );
  const removeUnNeedAssets = useMemoizedFn((addresses: string[]) => {
    setAssetsMap(pre => {
      const curr = { ...pre };
      Object.keys(pre).forEach(address => {
        if (!addresses.find(i => isSameAddress(i, address))) {
          delete curr[address];
        }
      });
      return curr;
    });
  });

  const checkIsExpireAndUpdate = useMemoizedFn(
    async (
      force?: boolean,
      options?: {
        disableToken?: boolean;
        disableDefi?: boolean;
        disableNFT?: boolean;
        realTimeAddresses?: string[];
        ignoreLoading?: boolean;
      },
    ) => {
      const top10Account = sortedAccounts
        .slice(0, 10)
        .filter(acc => acc.balance);
      const addresses = options?.realTimeAddresses || [
        ...new Set([...top10Account.map(i => i.address.toLowerCase())]),
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
              !disableToken && loadToken(address, force),
              !disableDefi && loadDefi(address, force),
              !disableNFT && loadNFT(address, force),
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
  );
  const getCacheTop10Assets = useMemoizedFn(
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
      const top10Account = sortedAccounts
        .slice(0, 10)
        .filter(acc => acc.balance);
      const addresses = options?.realTimeAddresses || [
        ...new Set([...top10Account.map(i => i.address.toLowerCase())]),
      ];
      removeUnNeedAssets(addresses);
      const isCurrentShortCacheFetch = !!(
        options?.maxTokenLength ||
        options?.maxDefiLength ||
        options?.maxNFTLength
      );

      // 有cache，不查了
      if (Object.keys(assetsMap).length && !shortCache) {
        return;
      }
      if (
        shortCache &&
        isCurrentShortCacheFetch &&
        Object.keys(assetsMap).length
      ) {
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
  );

  return {
    tokens,
    portfolios,
    assetsMap,
    isLoading,
    getTokenCombined,
    hasAssets: !!tokens?.length || !!portfolios?.length,
    getCacheTop10Assets,
    checkIsExpireAndUpdate,
    batchLoadCacheTokens,
    batchLoadCacheDefi,
    batchLoadCacheNFT,
    refreshing: !!isLoading && !isFirstFetch,
  };
};

export const useAssetsRefreshing = () => {
  const isLoading = useAtomValue(loadingAtom);
  const isFirstFetch = useAtomValue(isFirstFetchAtom);
  return {
    refreshing: !!isLoading && !isFirstFetch,
  };
};

export const useInitDetectDBAssets = () => {
  const {
    assetsMap,
    isLoading,
    batchLoadCacheTokens,
    batchLoadCacheDefi,
    batchLoadCacheNFT,
  } = useAssets({ hideCombined: true });
  const { userTokenSettings } = useUserTokenSettings();

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

        if (taskFor === 'token') {
          if (
            currentUpdateCount >
            (assetsMap[ctx.owner_addr]?.tokens?.length || 0)
          ) {
            debounceReloadTokenList([ctx.owner_addr], userTokenSettings);
          }
        } else if (taskFor === 'protocols') {
          if (
            currentUpdateCount >
            (assetsMap[ctx.owner_addr]?.portfolios?.length || 0)
          ) {
            debounceReloadDefiList([ctx.owner_addr], userTokenSettings);
          }
        } else if (taskFor === 'nfts') {
          if (
            currentUpdateCount > (assetsMap[ctx.owner_addr]?.nfts?.length || 0)
          ) {
            debounceReloadNftList([ctx.owner_addr], userTokenSettings);
          }
        }
      },
      [
        assetsMap,
        isLoading,
        debounceReloadDefiList,
        debounceReloadNftList,
        debounceReloadTokenList,
        userTokenSettings,
      ],
    ),
  });
};
