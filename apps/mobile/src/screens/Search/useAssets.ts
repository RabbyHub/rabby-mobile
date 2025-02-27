import { useAssetsMap } from '@/screens/Home/hooks/store';
import { useSafeState } from '@/hooks/useSafeState';
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
import { useMemo, useState } from 'react';
import { useSortAddressList } from '../Address/useSortAddressList';
import {
  combinePinTokens,
  filterNfts,
  filterPortfolios,
  filterTokens,
} from './useSearch';
import { usePinTokens } from './usePinTokens';
import { tagNfts } from '../Home/hooks/nft';
import { syncNFTs, syncProtocols, syncTokens } from '@/databases/hooks/assets';
import { TokenItemEntity } from '@/databases/entities/tokenitem';
import _ from 'lodash';
import { PortocolItemEntity } from '@/databases/entities/portocolItem';
import { NFTItemEntity } from '@/databases/entities/nftItem';

export const useAssets = (filterText?: string) => {
  const [isLoading, setLoading] = useSafeState(false);
  const { accounts } = useMyAccounts({
    disableAutoFetch: true,
  });
  const sortedAccounts = useSortAddressList(accounts);
  const [isFirstFetch, setIsFirstFetch] = useState(true);
  const {
    tokens,
    portfolios,
    nftList,
    assetsMap,
    setAssetsMap,
    updateNFTs,
    updatePortfolios,
    updateTokens,
  } = useAssetsMap();

  const { data: pinTokens, handleFetchTokens } = usePinTokens();
  const loadToken = async (address: string, force?: boolean) => {
    if (!address) {
      return;
    }
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
  };

  const loadDefi = async (address: string, force?: boolean) => {
    if (!address) {
      return;
    }
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
  };

  const loadNFT = async (address: string, force?: boolean) => {
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
      console.error(e);
    }
  };

  const batchLoadCacheTokens = async (addresses: string[], setting: any) => {
    if (!addresses.length) {
      return;
    }
    const cachedTokens = await TokenItemEntity.batchMultAddressTokens(
      addresses,
    );
    if (!cachedTokens.length) {
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
  };

  const batchLoadCacheDefi = async (addresses: string[], setting: any) => {
    if (!addresses.length) {
      return;
    }
    const cachedPortcols = await PortocolItemEntity.batchMultAddressPortocols(
      addresses,
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
  };
  const batchLoadCacheNFT = async (addresses: string[], setting: any) => {
    if (!addresses.length) {
      return;
    }
    const cacheNfts = await NFTItemEntity.batchMultAddressNFTs(addresses);
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
  };

  const checkIsExpireAndUpdate = async (
    force?: boolean,
    options?: {
      disableToken?: boolean;
      disableDefi?: boolean;
      disableNFT?: boolean;
    },
  ) => {
    const top10Account = sortedAccounts.slice(0, 10).filter(acc => acc.balance);
    const addresses = [
      ...new Set([...top10Account.map(i => i.address.toLowerCase())]),
    ];
    const { disableToken, disableDefi, disableNFT } = options || {};
    setLoading(true);
    try {
      await handleFetchTokens();
      for (const address of addresses) {
        try {
          await Promise.all([
            !disableToken && loadToken(address, force),
            !disableDefi && loadDefi(address, force),
            !disableNFT && loadNFT(address, force),
          ]);
        } catch (error) {
          console.error(`Error fetching data for ${address.slice(-4)}:`, error);
        }
      }
      await new Promise(resolve => setTimeout(resolve, 0));
    } finally {
      setLoading(false);
      setIsFirstFetch(false);
    }
  };
  const getCacheTop10Assets = async (options?: {
    disableToken?: boolean;
    disableDefi?: boolean;
    disableNFT?: boolean;
  }) => {
    const { disableToken, disableDefi, disableNFT } = options || {};
    const top10Account = sortedAccounts.slice(0, 10).filter(acc => acc.balance);
    const addresses = [
      ...new Set([...top10Account.map(i => i.address.toLowerCase())]),
    ];
    const tokenSetting = await preferenceService.getUserTokenSettings();
    !disableToken && (await batchLoadCacheTokens(addresses, tokenSetting));
    Promise.all([
      !disableDefi && batchLoadCacheDefi(addresses, tokenSetting),
      !disableNFT && batchLoadCacheNFT(addresses, tokenSetting),
    ]);
  };

  const fTokens = useMemo(
    () => filterTokens(combinePinTokens(pinTokens, tokens), filterText),
    [filterText, pinTokens, tokens],
  );
  const fPortfolios = useMemo(
    () => filterPortfolios(portfolios, filterText),
    [filterText, portfolios],
  );
  const fNftList = useMemo(
    () => filterNfts(nftList, filterText),
    [filterText, nftList],
  );
  return {
    tokens: fTokens,
    portfolios: fPortfolios,
    nftList: fNftList,
    assetsMap,
    isLoading,
    hasAssets: !!fTokens?.length || !!fPortfolios?.length || !!fNftList?.length,
    getCacheTop10Assets,
    checkIsExpireAndUpdate,
    refreshing: !!isLoading && !isFirstFetch,
  };
};
