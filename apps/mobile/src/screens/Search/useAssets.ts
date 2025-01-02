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
import { KeyringAccountWithAlias, useMyAccounts } from '@/hooks/account';
import { chunk } from 'lodash';
import { getExpandListSwitch } from '@/hooks/useExpandList';
import { useRef } from 'react';
import { useSortAddressList } from '../Address/useSortAddressList';

const walletProject = new DisplayedProject({
  id: 'Wallet',
  name: 'Wallet',
});

export const useQueryProjects = () => {
  const [isLoading, setLoading] = useSafeState(true);
  const { accounts } = useMyAccounts();
  const sortedAccounts = useSortAddressList(accounts);

  const [getUpdateTime, updateUpdateTime] = useAtom(lastUpdateTimeAtom);

  const [tokens] = useAtom(combinedTokensAtom);
  const [portfolios] = useAtom(combinedDefiAtom);
  const [nftList] = useAtom(combinedNFTAtom);
  const [, updateTokens] = useAtom(updateTokensAtom);
  const [, updatePortfolios] = useAtom(updatePortfoliosAtom);
  const [, updateNftList] = useAtom(updateNFTsAtom);

  const projectDict = useRef<Record<string, DisplayedProject> | null>({});
  const realtimeIds = useRef<string[]>([]);

  const loadCacheToken = async (
    address: string,
    account: KeyringAccountWithAlias,
  ) => {
    if (!address) {
      return;
    }

    setLoading(true);
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
      (await preferenceService.getUserTokenSettings(address)) || {};

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
      account,
      newTokens: filterDisplayToken(_tokens),
    });

    setLoading(false);
  };

  const loadCacheDefi = async (
    address: string,
    account: KeyringAccountWithAlias,
  ) => {
    if (!address) {
      return;
    }
    projectDict.current = {};
    setLoading(true);

    const snapshotRes = await loadPortfolioSnapshot(address);
    const { list, netWorth: snapshotNetWorth } = snapshot2Display(
      snapshotRes || [],
    );
    const snapshotData = Object.values(list)?.sort(
      (m, n) => (n.netWorth || 0) - (m.netWorth || 0),
    );
    const tokenSetting = await preferenceService.getUserTokenSettings(address);

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
    setLoading(false);
  };

  const loadNFT = async (address: string, account: KeyringAccountWithAlias) => {
    try {
      setLoading(true);
      const ntfs = await openapi.listNFT(address, true, true);
      updateNftList({
        address,
        newNFTs: ntfs,
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const initFetchTop10Assets = () => {
    const top10Account = sortedAccounts.slice(0, 10);
    top10Account.forEach(async account => {
      const lastUpdateTime = getUpdateTime(account.address) || 0;
      const currentTime = Date.now();

      if (currentTime - lastUpdateTime >= 10 * 60 * 1000) {
        await loadCacheToken(account.address, account);
        await loadCacheDefi(account.address, account);
        await loadNFT(account.address, account);
        console.log(
          '🔍 CUSTOM_LOGGER:=>: initFetchTop10Assets timeout)',
          account.address.slice(-8),
        );
        await updateUpdateTime({
          address: account.address,
          newLastUpdateTime: Date.now(),
        });
      }
    });
  };

  return {
    tokens,
    portfolios,
    nftList,
    isLoading,
    hasAssets: !!tokens?.length || !!portfolios?.length || !!nftList?.length,
    initFetchTop10Assets,
  };
};
