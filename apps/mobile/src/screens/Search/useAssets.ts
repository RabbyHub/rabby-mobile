import {
  combinedTokensAtom,
  combinedDefiAtom,
  combinedNFTAtom,
  updateTokensAtom,
  updatePortfoliosAtom,
  updateNFTsAtom,
} from '@/screens/Home/hooks/store';
import { useSafeState } from '@/hooks/useSafeState';
import { useAtom } from 'jotai';
import { produce } from '@/core/utils/produce';
import { DisplayedProject } from '../Home/utils/project';
import { AbstractPortfolioToken } from '../Home/types';
import {
  queryTokensCache,
  setWalletTokens,
  sortWalletTokens,
  tagTokenList,
} from '../Home/utils/token';
import { preferenceService } from '@/core/services';
import { TokenItem } from '@rabby-wallet/rabby-api/dist/types';
import { filterDisplayToken } from '../Home/hooks/token';
import {
  loadPortfolioSnapshot,
  snapshot2Display,
} from '../Home/utils/portfolio';
import { tagProfiles } from '../Home/hooks/usePortfolio';
import { openapi } from '@/core/request';
import { useMyAccounts } from '@/hooks/account';

const walletProject = new DisplayedProject({
  id: 'Wallet',
  name: 'Wallet',
});

export const useQueryProjects = () => {
  const [isLoading, setLoading] = useSafeState(true);
  const { accounts } = useMyAccounts();

  const [tokens] = useAtom(combinedTokensAtom);
  const [portfolios] = useAtom(combinedDefiAtom);
  const [nftList] = useAtom(combinedNFTAtom);

  const [, updateTokens] = useAtom(updateTokensAtom);
  const [, updatePortfolios] = useAtom(updatePortfoliosAtom);
  const [, updateNftList] = useAtom(updateNFTsAtom);

  const loadCacheToken = async (address: string) => {
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
    const snapshot = await queryTokensCache(address);

    const tokenSettings =
      (await preferenceService.getUserTokenSettings(address)) || {};

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

      updateTokens({
        address,
        newTokens: filterDisplayToken(_tokens),
      });
      setLoading(false);
    }
  };

  const loadCacheDefi = async (address: string) => {
    if (!address) {
      return;
    }
    setLoading(true);
    const snapshotRes = await loadPortfolioSnapshot(address);
    const { list } = snapshot2Display(snapshotRes || []);
    const snapshotData = Object.values(list)?.sort(
      (m, n) => (n.netWorth || 0) - (m.netWorth || 0),
    );
    const tokenSetting = await preferenceService.getUserTokenSettings(address);

    updatePortfolios({
      address,
      newPortfolios: tagProfiles(snapshotData, tokenSetting),
    });
  };

  const loadNFT = async (address: string) => {
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
    // TODO: performance search
    const top10Account = accounts.slice(0, 10);
    top10Account.forEach(async account => {
      await loadCacheToken(account.address);
      await loadCacheDefi(account.address);
      await loadNFT(account.address);
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
