import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Tabs, useFocusedTab } from 'react-native-collapsible-tab-view';

import { useTheme2024 } from '@/hooks/theme';
import { FullDefiRenderItem } from '@/screens/Home/components/AssetRenderItems';
import { AbstractProject, ActionItem } from '@/screens/Home/types';
import { createGetStyles2024 } from '@/utils/styles';
import { useAssets } from '@/screens/Search/useAssets';
import { ItemLoader } from '@/screens/Search/components/Skeleton';
import { useAccountInfo } from './hooks';
import { EmptyAssets } from '@/screens/Home/components/AssetRenderItems/EmptyAssets';
import { DefiItemLoader } from '@/screens/Home/components/Skeleton';
import useAccountsBalance from '@/hooks/useAccountsBalance';
import { DisplayedProject } from '@/screens/Home/utils/project';
import { RefreshControl } from 'react-native-gesture-handler';
import { useTriggerUpdate } from './hooks/triggerUpdate';
import { getItemId } from '@/screens/Home/utils/listRenderId';
import { KeyringAccountWithAlias, useMyAccounts } from '@/hooks/account';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import useLoadMoreData from './hooks/useLoadMoreData';
import { TabName } from './TabsMultiAssets';
import {
  ListHeaderComponent,
  ListRenderFooter as ListRenderFooterComponent,
  ListRenderSeparator,
} from './RenderRow/Common';

const MemoizedFullDefiRenderItem = React.memo(FullDefiRenderItem);
const MemoizedEmptyAssets = React.memo(EmptyAssets);
const MemoizedItemLoader = React.memo(ItemLoader);
const MemoizedDefiItemLoader = React.memo(DefiItemLoader);

interface Props {
  chain?: string;
  onRefresh?: () => void;
  updatePortfolio?: (portfolios: AbstractProject[]) => void;
}
export const ProtocolList = ({
  chain,
  onRefresh: onRefreshProps,
  updatePortfolio,
}: Props) => {
  const { t } = useTranslation();
  const { styles } = useTheme2024({ getStyle: getStyles });

  const hasBeenFocusedRef = useRef(false);

  const { top10Addresses } = useAccountInfo();
  const { triggerUpdate, getTotalBalance } = useAccountsBalance({
    cacheTime: 10 * 60 * 1000,
    accountsNoUnique: true,
  });
  const { accounts } = useMyAccounts();
  const focusedTab = useFocusedTab();
  const { triggerUpdate: triggerRefresh, setTriggerUpdate: setTriggerRefresh } =
    useTriggerUpdate();

  const getAccountByAddress = useCallback(
    (address: string) => {
      return accounts.find(account => isSameAddress(account?.address, address));
    },
    [accounts],
  );

  const isFocused = useMemo(() => {
    const currentFocused = focusedTab === TabName.defi;
    if (currentFocused) {
      hasBeenFocusedRef.current = true;
    }
    return hasBeenFocusedRef.current;
  }, [focusedTab]);

  const {
    portfolios: _rawPortfolios,
    checkIsExpireAndUpdate,
    isLoading,
  } = useAssets({ hideCombined: !isFocused });

  useEffect(() => {
    if (_rawPortfolios && !isLoading) {
      updatePortfolio?.(_rawPortfolios);
    }
    // TODO: FIXIT
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [_rawPortfolios?.length, isLoading, updatePortfolio]);

  const portfolios = useMemo(
    () =>
      _rawPortfolios.filter(item =>
        chain && item?.chain ? item.chain === chain : true,
      ),
    [_rawPortfolios, chain],
  );

  console.log('CUSTOM_LOGGER:=>: portfolios', portfolios.length, isFocused);

  const top10Balance = useMemo(() => {
    return getTotalBalance(top10Addresses);
  }, [top10Addresses, getTotalBalance]);

  const {
    data: portfoliosData,
    loadMore: loadMorePortfolios,
    hasMore: hasMorePortfolios,
  } = useLoadMoreData(portfolios);

  const portfolioListData = useMemo(() => {
    const itemData: Array<{
      show: boolean;
      data: ActionItem[];
    }> = [
      {
        show: true,
        data: [
          ...portfoliosData.map(item => ({
            type: 'unfold_defi' as const,
            data: item as unknown as DisplayedProject,
          })),
        ],
      },
      {
        show: !!isLoading && !portfolios.length,
        data: Array.from({ length: 2 }, (_, index) => ({
          type: 'loading-defi-skeleton',
          data: index.toString(),
        })),
      },
      {
        show: !isLoading && portfolios.length === 0,
        data: [
          {
            type: 'empty-defi',
            data: t('page.singleHome.sectionHeader.NoData', {
              name: t('page.singleHome.sectionHeader.Defi'),
            }),
          },
        ],
      },
    ];
    return itemData
      .filter(item => item.show)
      .map(item => item.data)
      .flat();
  }, [isLoading, t, portfoliosData, portfolios.length]);

  const hasNotAssets = useMemo(() => {
    return portfolios.length === 0 && !isLoading && isFocused;
  }, [portfolios.length, isLoading, isFocused]);

  const renderItem = useCallback(
    ({ item }) => {
      const { type, data } = item;
      switch (type) {
        case 'unfold_defi':
          return (
            <MemoizedFullDefiRenderItem
              data={data as unknown as AbstractProject}
              showAccount
              style={styles.fullDefi}
              disableAction={isLoading}
              account={
                getAccountByAddress(
                  data?.address,
                ) as unknown as KeyringAccountWithAlias
              }
            />
          );
        case 'empty-defi':
          return (
            <MemoizedEmptyAssets
              style={styles.emptyAssets}
              desc={data}
              type={type}
            />
          );
        case 'loading-defi-skeleton':
          return <MemoizedDefiItemLoader style={styles.defiLoading} />;
        default:
          return null;
      }
    },
    [
      isLoading,
      getAccountByAddress,
      styles.defiLoading,
      styles.emptyAssets,
      styles.fullDefi,
    ],
  );

  const initRef = useRef(false);

  useEffect(() => {
    initRef.current = false;
  }, [top10Addresses.length]);

  useEffect(() => {
    const cacheTop10AssetsId = setTimeout(() => {
      if (!isFocused) {
        return;
      }
      if (initRef.current) {
        return;
      }
      initRef.current = true;
      checkIsExpireAndUpdate(false, {
        disableNFT: true,
        disableToken: true,
        realTimeAddresses: top10Addresses,
        ignoreLoading: !top10Balance,
      });
    }, 50);
    return () => {
      cacheTop10AssetsId && clearTimeout(cacheTop10AssetsId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocused, !top10Balance, top10Addresses.length]);

  const ListRenderFooter = useCallback(() => {
    return hasMorePortfolios ? (
      <MemoizedItemLoader style={[styles.loadingMore]} />
    ) : (
      <ListRenderFooterComponent />
    );
  }, [hasMorePortfolios, styles.loadingMore]);

  const onRefresh = useCallback(async () => {
    try {
      await Promise.all([
        triggerUpdate(true),
        checkIsExpireAndUpdate(true, { disableToken: true, disableNFT: true }),
      ]);
      onRefreshProps?.();
    } catch (error) {
      console.error('Refresh failed:', error);
    }
  }, [checkIsExpireAndUpdate, triggerUpdate, onRefreshProps]);

  useEffect(() => {
    if (triggerRefresh) {
      onRefresh();
      setTriggerRefresh(false);
    }
  }, [onRefresh, setTriggerRefresh, triggerRefresh]);

  return (
    <Tabs.FlatList
      keyExtractor={getItemId}
      data={
        hasNotAssets
          ? [
              {
                type: 'empty-defi',
                data: t('page.singleHome.sectionHeader.NoData', {
                  name: t('page.singleHome.sectionHeader.Defi'),
                }),
              },
            ]
          : portfolioListData
      }
      renderItem={renderItem}
      initialNumToRender={15}
      windowSize={15}
      maxToRenderPerBatch={15}
      removeClippedSubviews
      ItemSeparatorComponent={ListRenderSeparator}
      ListHeaderComponent={ListHeaderComponent}
      ListFooterComponent={ListRenderFooter}
      showsVerticalScrollIndicator={false}
      showsHorizontalScrollIndicator={false}
      style={styles.container}
      contentContainerStyle={styles.list}
      onEndReached={loadMorePortfolios}
      onEndReachedThreshold={0.5}
      refreshControl={
        <RefreshControl
          style={styles.bgContainer}
          onRefresh={onRefresh}
          refreshing={false}
        />
      }
    />
  );
};

const getStyles = createGetStyles2024(() => ({
  container: {
    flex: 1,
  },
  list: {
    paddingHorizontal: 16,
  },
  bgContainer: {
    paddingHorizontal: 16,
  },
  emptyAssets: {
    marginHorizontal: 0,
  },
  emptyTokenHolder: {
    paddingHorizontal: 0,
  },
  defiLoading: {
    paddingHorizontal: 0,
  },
  loadingMore: {
    marginTop: 16,
  },
  fullDefi: {
    marginHorizontal: 0,
    marginTop: 8,
  },
}));
