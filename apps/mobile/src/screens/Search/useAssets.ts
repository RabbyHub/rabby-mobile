import {
  combinedTokensAtom,
  combinedDefiAtom,
  combinedNFTAtom,
  updateTokensAtom,
  updatePortfoliosAtom,
  updateNFTsAtom,
  lastUpdateTimeAtom,
} from '@/screens/Home/hooks/store';
import { useSafeState } from '@/hooks/useSafeState';
import { useAtom } from 'jotai';
import { produce } from '@/core/utils/produce';
import { DisplayedProject } from '../Home/utils/project';
import { AbstractPortfolioToken } from '../Home/types';
import {
  batchQueryTokens,
  setWalletTokens,
  sortWalletTokens,
  tagTokenList,
} from '../Home/utils/token';
import { preferenceService } from '@/core/services';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { filterDisplayToken } from '../Home/hooks/token';
import {
  batchLoadProjects,
  loadPortfolioSnapshot,
  portfolio2Display,
  snapshot2Display,
} from '../Home/utils/portfolio';
import { tagProfiles } from '../Home/hooks/usePortfolio';
import { openapi } from '@/core/request';
import { useAccounts, useMyAccounts } from '@/hooks/account';
import { chunk } from 'lodash';
import { getExpandListSwitch } from '@/hooks/useExpandList';
import { useMemo, useRef, useState } from 'react';
import { useSortAddressList } from '../Address/useSortAddressList';
import {
  combinePinTokens,
  filterNfts,
  filterPortfolios,
  filterTokens,
} from './useSearch';
import { usePinTokens } from './usePinTokens';

const walletProject = new DisplayedProject({
  id: 'Wallet',
  name: 'Wallet',
});

export const useAssets = (filterText?: string) => {
  const [isLoading, setLoading] = useSafeState(false);
  const { accounts } = useAccounts();
  const sortedAccounts = useSortAddressList(accounts);
  const [isFirstFetch, setIsFirstFetch] = useState(true);

  const [getUpdateTime, updateUpdateTime] = useAtom(lastUpdateTimeAtom);

  const [tokens] = useAtom(combinedTokensAtom);
  const [portfolios] = useAtom(combinedDefiAtom);
  const [nftList] = useAtom(combinedNFTAtom);
  const [, updateTokens] = useAtom(updateTokensAtom);
  const [, updatePortfolios] = useAtom(updatePortfoliosAtom);
  const [, updateNftList] = useAtom(updateNFTsAtom);
  const { data: pinTokens, handleFetchTokens } = usePinTokens();

  const projectDict = useRef<Record<string, DisplayedProject> | null>({});
  const realtimeIds = useRef<string[]>([]);

  const loadToken = async (address: string) => {
    if (!address) {
      return;
    }

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

    const tokenRes = await batchQueryTokens(address);

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

  const loadDefi = async (address: string) => {
    if (!address) {
      return;
    }
    projectDict.current = {};

    const snapshotRes = await loadPortfolioSnapshot(address);
    const { list, netWorth: snapshotNetWorth } = snapshot2Display(
      snapshotRes || [],
    );
    const snapshotData = Object.values(list)?.sort(
      (m, n) => (n.netWorth || 0) - (m.netWorth || 0),
    );
    const tokenSetting = await preferenceService.getUserTokenSettings();

    updatePortfolios({
      address,
      newPortfolios: tagProfiles(snapshotData, tokenSetting),
    });
    const { thresholdIndex, hasExpandSwitch } = getExpandListSwitch(
      snapshotData,
      snapshotNetWorth,
    );

    realtimeIds.current = hasExpandSwitch
      ? snapshotData.slice(0, thresholdIndex).map(x => x.id)
      : snapshotRes?.map(x => x.id) || [];

    const chunkIds = chunk(realtimeIds.current, 5);

    let realtimeData: DisplayedProject[] = [];

    await Promise.all(
      chunkIds.map(async ids => {
        const projectListRes = await batchLoadProjects(address, ids);

        const projects = projectListRes;

        if (!projects?.length) {
          return;
        }

        projects.forEach(project => {
          if (projectDict.current) {
            projectDict.current = produce(projectDict.current, draft => {
              project && portfolio2Display(project, draft);
            });
          }
        });
      }),
    );

    realtimeData = Object.values(projectDict.current)?.sort(
      (m, n) => (n.netWorth || 0) - (m.netWorth || 0),
    );
    updatePortfolios({
      address,
      newPortfolios: tagProfiles(realtimeData, tokenSetting),
    });
  };

  const loadNFT = async (address: string) => {
    try {
      const ntfs = await openapi.listNFT(address, true, true);
      updateNftList({
        address,
        newNFTs: ntfs,
      });
    } catch (e) {
      console.error(e);
    }
  };

  const initFetchTop10Assets = async (force?: boolean) => {
    const top10Account = sortedAccounts.slice(0, 10);
    setLoading(true);
    try {
      await handleFetchTokens();
      await Promise.all(
        top10Account.map(async account => {
          const lastUpdateTime = getUpdateTime(account.address) || 0;
          const currentTime = Date.now();

          if (force || currentTime - lastUpdateTime >= 10 * 60 * 1000) {
            try {
              await loadToken(account.address);
              await loadDefi(account.address);
              await loadNFT(account.address);
              console.log(
                '🔍 CUSTOM_LOGGER:=>: initFetchTop10Assets timeout)',
                account.address.slice(-8),
                'force:',
                force,
              );
              await updateUpdateTime({
                address: account.address,
                newLastUpdateTime: Date.now(),
              });
            } catch (error) {
              console.error(
                `Error fetching data for ${account.address}:`,
                error,
              );
            }
          }
        }),
      );
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
    isLoading,
    hasAssets: !!fTokens?.length || !!fPortfolios?.length || !!fNftList?.length,
    initFetchTop10Assets,
    refreshing: !!isLoading && !isFirstFetch,
  };
};
