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
import { useMemo, useRef, useState } from 'react';
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
    updateNFTs,
    updatePortfolios,
    updateTokens,
  } = useAssetsMap();

  const { data: pinTokens, handleFetchTokens } = usePinTokens();
  const abortRef = useRef(false);
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

    const tokenSettings =
      (await preferenceService.getUserTokenSettings()) || {};

    const tokenRes = await syncTokens(address, force);

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
    const protocols = await syncProtocols(address, force);
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
      const nfts = await syncNFTs(address, force);
      const tokenSetting = await preferenceService.getUserTokenSettings();

      updateNFTs({
        address,
        newNFTs: tagNfts(nfts, tokenSetting),
      });
    } catch (e) {
      console.error(e);
    }
  };

  const interrupt = () => {
    abortRef.current = true;
  };

  const getCacheTop10Assets = async (
    force?: boolean,
    options?: {
      disableToken?: boolean;
      disableDefi?: boolean;
      disableNFT?: boolean;
    },
  ) => {
    const top10Account = sortedAccounts.slice(0, 10);
    const addresses = [
      ...new Set([...top10Account.map(i => i.address.toLowerCase())]),
    ];
    const { disableToken, disableDefi, disableNFT } = options || {};
    setLoading(true);
    try {
      await handleFetchTokens();
      for (const address of addresses) {
        if (abortRef.current) {
          console.log('Fetching interrupted.');
          setLoading(false);
          setIsFirstFetch(false);
          break;
        }

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
    interrupt,
    refreshing: !!isLoading && !isFirstFetch,
  };
};
