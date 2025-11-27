import React, { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Tabs } from 'react-native-collapsible-tab-view';

import { useTheme2024 } from '@/hooks/theme';
import { FullDefiRenderItem } from '@/screens/Home/components/AssetRenderItems';
import { AbstractProject, ActionItem } from '@/screens/Home/types';
import { createGetStyles2024 } from '@/utils/styles';
import { useAssets } from '@/screens/Search/useAssets';
import { EmptyAssets } from '@/screens/Home/components/AssetRenderItems/EmptyAssets';
import { DefiItemLoader } from '@/screens/Home/components/Skeleton';
import { DisplayedProject } from '@/screens/Home/utils/project';
import { RefreshControl } from 'react-native-gesture-handler';
import { getItemId } from '@/screens/Home/utils/listRenderId';
import { KeyringAccountWithAlias } from '@/hooks/account';
import useLoadMoreData from './hooks/useLoadMoreData';
import { TAB_HEADER_FULL_HEIGHT, TabName } from './TabsMultiAssets';
import {
  ListHeaderComponent,
  ListRenderFooter as ListRenderFooterComponent,
  ListRenderSeparator,
} from './RenderRow/Common';
import {
  useCheckIsExpireAndUpdate,
  useFindAccountByAddress,
  useIsFocusedCurrentTab,
} from './hooks/share';
import { useAssetsComputation } from '@/screens/Home/hooks/store';

const MemoizedFullDefiRenderItem = React.memo(FullDefiRenderItem);
const MemoizedEmptyAssets = React.memo(EmptyAssets);
const MemoizedDefiItemLoader = React.memo(DefiItemLoader);

interface Props {
  chain?: string;
  updatePortfolio?: (portfolios: AbstractProject[]) => void;
}
export const ProtocolList = React.memo(({ chain, updatePortfolio }: Props) => {
  const { t } = useTranslation();
  const { styles } = useTheme2024({ getStyle: getStyles });

  const { isFocused, isFocusing } = useIsFocusedCurrentTab(TabName.defi);
  const getAccountByAddress = useFindAccountByAddress();
  const { triggerUpdate } = useCheckIsExpireAndUpdate({
    isFocused,
    isFocusing,
    disableToken: true,
    disableNFT: true,
  });

  const { checkIsExpireAndUpdate, isLoading } = useAssets();

  const { portfolios: _rawPortfolios } = useAssetsComputation({
    hideCombined: !isFocusing,
  });

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

  const ListRenderFooter = useCallback(() => {
    return hasMorePortfolios ? (
      <MemoizedDefiItemLoader style={[styles.loadingMore]} />
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
    } catch (error) {
      console.error('Refresh failed:', error);
    }
  }, [checkIsExpireAndUpdate, triggerUpdate]);

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
      initialNumToRender={5}
      windowSize={5}
      maxToRenderPerBatch={5}
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
});

const getStyles = createGetStyles2024(() => ({
  container: {
    flex: 1,
    marginTop: TAB_HEADER_FULL_HEIGHT,
  },
  list: {
    paddingHorizontal: 16,
    marginTop: -TAB_HEADER_FULL_HEIGHT,
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
    paddingHorizontal: 0,
    marginTop: 16,
  },
  fullDefi: {
    marginHorizontal: 0,
    marginTop: 8,
  },
}));
