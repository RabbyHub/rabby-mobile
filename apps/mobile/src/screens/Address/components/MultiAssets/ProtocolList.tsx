import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Tabs } from 'react-native-collapsible-tab-view';

import { useTheme2024 } from '@/hooks/theme';
import {
  FullDefiRenderItem,
  TokenRowSectionHeader,
} from '@/screens/Home/components/AssetRenderItems';
import { AbstractProject, ActionItem } from '@/screens/Home/types';
import { createGetStyles2024 } from '@/utils/styles';
import { useLoadAssets } from '@/screens/Search/useAssets';
import { EmptyAssets } from '@/screens/Home/components/AssetRenderItems/EmptyAssets';
import { DefiItemLoader } from '@/screens/Home/components/Skeleton';
import { DisplayedProject } from '@/screens/Home/utils/project';
import { RefreshControl } from 'react-native-gesture-handler';
import { getItemId } from '@/screens/Home/utils/listRenderId';
import { KeyringAccountWithAlias } from '@/hooks/account';
import useLoadMoreData from './hooks/useLoadMoreData';
import { TAB_HEADER_FULL_HEIGHT, TabName } from './TabsMultiAssets';
import {
  ListRenderFooter as ListRenderFooterComponent,
  ListRenderSeparator,
} from './RenderRow/Common';
import {
  useCheckIsExpireAndUpdate,
  useFindAccountByAddress,
  useIsFocusedCurrentTab,
} from './hooks/share';
import { useTriggerTagAssets } from '@/screens/Home/hooks/refresh';
import { getAllDefiCount } from '@/screens/Home/utils/converAssets';
import {
  CombineDefiItem,
  useAssetsPortfolios,
  useOnDeFiRefresh,
} from '@/screens/Home/hooks/store';
import { PerpsMultiAssetPosition } from '@/screens/Perps/components/PerpsMultiAssetPosition';
import { useSelectedChainItem } from '@/screens/Home/useChainInfo';

const MemoizedFullDefiRenderItem = React.memo(FullDefiRenderItem);
const MemoizedEmptyAssets = React.memo(EmptyAssets);

export const MemoizedDefiItemLoader = React.memo(DefiItemLoader);

interface Props {
  chain?: string;
}
export const ProtocolList = () => {
  const { t } = useTranslation();
  const { styles } = useTheme2024({ getStyle: getStyles });

  const selectedChainItem = useSelectedChainItem();
  const chain = selectedChainItem?.chain;
  const [foldDefi, setFoldDefi] = useState(true);

  const { isFocused, isFocusing } = useIsFocusedCurrentTab(TabName.defi);
  const { deFiRefresh } = useTriggerTagAssets();
  useOnDeFiRefresh();

  const getAccountByAddress = useFindAccountByAddress();
  const { triggerUpdate } = useCheckIsExpireAndUpdate({
    isFocused,
    isFocusing,
    disableToken: true,
    disableNFT: true,
  });

  const { checkIsExpireAndUpdate, isLoading } = useLoadAssets();

  const { portfolios: _rawPortfolios } = useAssetsPortfolios({
    hideCombined: false,
  });

  const portfolios = useMemo(() => {
    const list = _rawPortfolios.filter(item =>
      chain && item?.chain ? item.chain === chain : true,
    );
    const foldList: CombineDefiItem[] = [];
    const unFoldList: CombineDefiItem[] = [];
    list.forEach(item => {
      if (item._isFold) {
        foldList.push(item);
      } else {
        unFoldList.push(item);
      }
    });
    return {
      unFoldList,
      foldList,
    };
  }, [_rawPortfolios, chain]);

  const {
    data: portfoliosData,
    loadMore: loadMorePortfolios,
    hasMore: hasMorePortfolios,
  } = useLoadMoreData(portfolios.unFoldList);

  const shouldDefaultExpand = useMemo(
    () => portfolios.unFoldList.length <= 5,
    [portfolios.unFoldList.length],
  );

  const portfolioListData = useMemo(() => {
    const foldDeFiList: ActionItem[] = portfolios.foldList.map(item => ({
      type: 'fold_defi',
      data: item as unknown as DisplayedProject,
    }));

    const foldDeFiValue = getAllDefiCount(
      portfolios.foldList as unknown as DisplayedProject[],
    );

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
        show: !!foldDeFiList.length,
        data: [
          {
            type: 'toggle_defi_fold',
            data: foldDeFiValue,
          },
          ...(foldDefi ? [] : foldDeFiList),
        ],
      },
      {
        show:
          !!isLoading &&
          !portfolios.unFoldList.length &&
          !portfolios.foldList.length,
        data: Array.from({ length: 2 }, (_, index) => ({
          type: 'loading-defi-skeleton',
          data: index.toString(),
        })),
      },
      {
        show:
          !isLoading &&
          portfolios.unFoldList.length === 0 &&
          portfolios.foldList.length === 0,
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
  }, [
    foldDefi,
    isLoading,
    t,
    portfolios.foldList,
    portfolios.unFoldList.length,
    portfoliosData,
  ]);

  const hasNotAssets = useMemo(() => {
    return (
      portfolios.unFoldList.length === 0 &&
      portfolios.foldList.length === 0 &&
      !isLoading &&
      isFocused
    );
  }, [
    portfolios.foldList.length,
    portfolios.unFoldList.length,
    isLoading,
    isFocused,
  ]);

  const renderItem = useCallback(
    ({ item }) => {
      const { type, data } = item;
      switch (type) {
        case 'unfold_defi':
        case 'fold_defi':
          return (
            <MemoizedFullDefiRenderItem
              data={data as unknown as AbstractProject}
              showAccount
              style={styles.fullDefi}
              disableAction={isLoading}
              defaultExpand={type === 'fold_defi' ? false : shouldDefaultExpand}
              account={
                getAccountByAddress(
                  data?.address,
                ) as unknown as KeyringAccountWithAlias
              }
            />
          );
        case 'toggle_defi_fold':
          return (
            <TokenRowSectionHeader
              style={styles.tokenSectionHeader}
              str={data}
              fold={foldDefi}
              onPressFold={() => setFoldDefi(pre => !pre)}
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
      foldDefi,
      styles.defiLoading,
      styles.emptyAssets,
      styles.fullDefi,
      styles.tokenSectionHeader,
      getAccountByAddress,
      isLoading,
      shouldDefaultExpand,
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
        deFiRefresh(),
      ]);
    } catch (error) {
      console.error('Refresh failed:', error);
    }
  }, [checkIsExpireAndUpdate, triggerUpdate, deFiRefresh]);

  // if (!isFocusing) {
  //   return null;
  // }
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
      windowSize={5}
      maxToRenderPerBatch={15}
      removeClippedSubviews
      ItemSeparatorComponent={ListRenderSeparator}
      ListHeaderComponent={<PerpsMultiAssetPosition />}
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
    // marginTop: 8,
  },
  tokenSectionHeader: {
    paddingLeft: 0,
    paddingRight: 0,
    backgroundColor: 'transparent',
  },
}));
