import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Tabs } from 'react-native-collapsible-tab-view';

import { useTheme2024 } from '@/hooks/theme';
import {
  FullDefiRenderItem,
  TokenRowSectionHeader,
} from '@/screens/Home/components/AssetRenderItems';
import { ActionItem } from '@/screens/Home/types';
import { createGetStyles2024 } from '@/utils/styles';
import { EmptyAssets } from '@/screens/Home/components/AssetRenderItems/EmptyAssets';
import { DefiItemLoader } from '@/screens/Home/components/Skeleton';
import { RefreshControl } from 'react-native-gesture-handler';
import { getItemId } from '@/screens/Home/utils/listRenderId';
import { KeyringAccountWithAlias } from '@/hooks/account';
import useLoadMoreData from './hooks/useLoadMoreData';
import { TAB_HEADER_FULL_HEIGHT, TabName } from './TabsMultiAssets';
import {
  ListRenderFooter as ListRenderFooterComponent,
  ListRenderSeparator,
} from './RenderRow/Common';
import { useFindAccountByAddress, useIsFocusedCurrentTab } from './hooks/share';
import { getAllDefiCount } from '@/screens/Home/utils/converAssets';
import { PerpsMultiAssetPosition } from '@/screens/Perps/components/PerpsMultiAssetPosition';
import { useSelectedChainItem } from '@/screens/Home/useChainInfo';
import useProtocols, {
  getMultiProtocolsCacheKey,
  ICacheProtocolItem,
  useProtocolListComputedStore,
} from '@/store/protocols';
import { useShallow } from 'zustand/react/shallow';
import { useAccountInfo } from './hooks';
import { useAccountsBalanceTrigger } from '@/hooks/useAccountsBalance';

const emptyCacheProtocolItem: ICacheProtocolItem = {
  fold: [],
  unFold: [],
};

const MemoizedFullDefiRenderItem = React.memo(FullDefiRenderItem);
const MemoizedEmptyAssets = React.memo(EmptyAssets);

export const MemoizedDefiItemLoader = React.memo(DefiItemLoader);

export const ProtocolList = () => {
  const { t } = useTranslation();
  const { styles } = useTheme2024({ getStyle: getStyles });

  const { myTop10Addresses } = useAccountInfo();
  const selectedChainItem = useSelectedChainItem();
  const chain = selectedChainItem?.chain;
  const [foldDefi, setFoldDefi] = useState(true);

  const { isFocused } = useIsFocusedCurrentTab(TabName.defi);
  const getAccountByAddress = useFindAccountByAddress();
  const { triggerUpdate } = useAccountsBalanceTrigger();

  const multiProtocolsKey = useMemo(() => {
    return getMultiProtocolsCacheKey(myTop10Addresses, chain);
  }, [chain, myTop10Addresses]);

  const registerMultiAssets = useProtocolListComputedStore(
    s => s.registerMultiProtocols,
  );

  const multiProtocols = useProtocolListComputedStore(
    useShallow(
      state =>
        state.multiProtocolsCache[multiProtocolsKey] || emptyCacheProtocolItem,
    ),
  );
  console.log('CUSTOM_LOGGER:=>: multiProtocols', multiProtocols.unFold.length);
  const updateMultiProtocols = useProtocols(state => state.batchGetProtocols);

  const isLoading = useProtocols(state => state.isLoading);

  const portfolios = useMemo(() => {
    const foldList = multiProtocols.fold;
    const unFoldList = multiProtocols.unFold;
    return {
      unFoldList,
      foldList,
    };
  }, [multiProtocols.fold, multiProtocols.unFold]);

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
      data: item,
    }));

    const foldDeFiValue = getAllDefiCount(portfolios.foldList);

    const itemData: Array<{
      show: boolean;
      data: ActionItem[];
    }> = [
      {
        show: true,
        data: [
          ...portfoliosData.map(item => ({
            type: 'unfold_defi' as const,
            data: item,
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

  useEffect(() => {
    registerMultiAssets(myTop10Addresses, chain);
  }, [myTop10Addresses, chain, registerMultiAssets]);

  useEffect(() => {
    updateMultiProtocols(myTop10Addresses);
  }, [myTop10Addresses, updateMultiProtocols]);

  const renderItem = useCallback(
    ({ item }) => {
      const { type, data } = item as ActionItem;
      switch (type) {
        case 'unfold_defi':
        case 'fold_defi':
          return (
            <MemoizedFullDefiRenderItem
              data={data}
              showAccount
              style={styles.fullDefi}
              disableAction={isLoading}
              defaultExpand={type === 'fold_defi' ? false : shouldDefaultExpand}
              account={
                getAccountByAddress(
                  data?.owner_addr,
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
        updateMultiProtocols(myTop10Addresses, true),
      ]);
    } catch (error) {
      console.error('Refresh failed:', error);
    }
  }, [triggerUpdate, updateMultiProtocols, myTop10Addresses]);

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
