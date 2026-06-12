import React, { useCallback, useState, useEffect, useMemo, memo } from 'react';
import { ListRenderItem, View } from 'react-native';
import { RefreshControl } from 'react-native-gesture-handler';

import { createGetStyles2024 } from '@/utils/styles';
import { ActionItem } from './types';
import {
  ASSETS_ITEM_HEIGHT_NEW,
  ASSETS_SECTION_HEADER,
} from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';

import {
  FullDefiRenderItem,
  TokenRowSectionHeader,
} from './components/AssetRenderItems';
import { useTranslation } from 'react-i18next';
import { EmptyAssets } from './components/AssetRenderItems/EmptyAssets';
import { DefiItemLoader } from './components/Skeleton';
import {
  Tabs,
  useCurrentTabScrollY,
  useFocusedTab,
} from 'react-native-collapsible-tab-view';
import { useAnimatedReaction } from 'react-native-reanimated';
import { runOnJS } from 'react-native-reanimated';
import { getItemId } from './utils/listRenderId';
import useLoadMoreData from '../Address/components/MultiAssets/hooks/useLoadMoreData';
import { useSingleHomeAccount, useSingleHomeChain } from './hooks/singleHome';
import { getAllDefiCount } from './utils/converAssets';
import useProtocols, {
  getSingleProtocolsCacheKey,
  ICacheProtocolItem,
  useProtocolListComputedStore,
} from '@/store/protocols';
import { useShallow } from 'zustand/react/shallow';
import { useAppForeground } from '@/hooks/useAppForeground';
import { withAnimatedTickerRefreshNudge } from '@/components/Animated/RefreshNudgedTickerText';

const emptyCacheProtocolItem: ICacheProtocolItem = {
  fold: [],
  unFold: [],
};

const MemoFullDefiRenderItem = memo(FullDefiRenderItem);

interface Props {
  onForeground?: () => void;
  onRefresh?: () => void | Promise<void>;
  onReachTopStatusChange?: (status: boolean) => void;
}
const FOOTER_HEIGHT = 220;
const SPACING_HEIGHT = 8;

export const PortfolioList = ({
  onForeground,
  onRefresh,
  onReachTopStatusChange,
}: Props) => {
  const { styles } = useTheme2024({
    getStyle: getStyles,
  });
  const { t } = useTranslation();
  const { currentAccount } = useSingleHomeAccount();
  const { selectedChain } = useSingleHomeChain();

  const lowerAddress = useMemo(
    () => currentAccount?.address?.toLowerCase(),
    [currentAccount?.address],
  );

  const focusedTab = useFocusedTab();

  const isFocused = useMemo(() => {
    const currentFocused = focusedTab === 'defi';
    return currentFocused;
  }, [focusedTab]);

  const [showScrollIndicator, setShowScrollIndicator] = useState(false);
  const [foldDefi, setFoldDefi] = useState(true);
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);

  const loadingPortfolio = useProtocols(state => {
    if (!lowerAddress) {
      return false;
    }
    return !!state.isLoadingByAddress[lowerAddress];
  });

  const updatePortfolio = useProtocols(state => state.getProtocols);

  const singleProtocolsKey = useMemo(() => {
    if (!lowerAddress) {
      return null;
    }
    return getSingleProtocolsCacheKey(lowerAddress, selectedChain);
  }, [lowerAddress, selectedChain]);

  const registerSingleProtocols = useProtocolListComputedStore(
    state => state.registerSingleProtocols,
  );

  const _portfolios = useProtocolListComputedStore(
    useShallow(state =>
      singleProtocolsKey
        ? state.singleProtocolsCache[singleProtocolsKey] ||
          emptyCacheProtocolItem
        : emptyCacheProtocolItem,
    ),
  );

  const filteredPortfolios = useMemo(() => {
    const foldList = _portfolios?.fold || [];
    const unFoldList = _portfolios?.unFold || [];
    const foldDeFiValue = getAllDefiCount(foldList);
    return {
      unFoldList,
      foldList,
      foldDeFiValue,
    };
  }, [_portfolios]);

  const {
    data: portfolios,
    loadMore: loadMorePortfolios,
    hasMore: hasMorePortfolios,
  } = useLoadMoreData(filteredPortfolios.unFoldList);

  const shouldDefaultExpand = useMemo(
    () => filteredPortfolios.unFoldList.length <= 5,
    [filteredPortfolios.unFoldList.length],
  );

  const dataList = useMemo(() => {
    const unFoldDefiList: ActionItem[] = portfolios.map(item => ({
      type: 'unfold_defi',
      data: item,
    }));

    const foldDeFiList: ActionItem[] = filteredPortfolios.foldList.map(
      item => ({
        type: 'fold_defi',
        data: item,
      }),
    );

    const itemData: Array<{
      show: boolean;
      data: ActionItem[];
    }> = [
      {
        show: true,
        data: unFoldDefiList,
      },
      {
        show: !!foldDeFiList.length,
        data: [
          {
            type: 'toggle_defi_fold',
            data: filteredPortfolios.foldDeFiValue,
          },
          ...(foldDefi ? [] : foldDeFiList),
        ],
      },
      {
        show:
          !!loadingPortfolio && !portfolios.length && !unFoldDefiList.length,
        data: Array.from({ length: 2 }, (_, index) => ({
          type: 'loading-defi-skeleton',
          data: 'index-defi' + index.toString(),
        })),
      },
      {
        show:
          !loadingPortfolio &&
          portfolios.length === 0 &&
          unFoldDefiList.length === 0,
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
    filteredPortfolios.foldDeFiValue,
    filteredPortfolios.foldList,
    foldDefi,
    loadingPortfolio,
    portfolios,
    t,
  ]);

  const refreshPortfolioList = useCallback(() => {
    if (!lowerAddress) {
      return;
    }
    updatePortfolio(lowerAddress);
  }, [lowerAddress, updatePortfolio]);

  useEffect(() => {
    if (isFocused) {
      refreshPortfolioList();
    }
  }, [isFocused, refreshPortfolioList]);

  useAppForeground({
    enabled: isFocused,
    onForeground: () => {
      if (loadingPortfolio || !isFocused || !lowerAddress) {
        return;
      }
      onForeground?.();
      refreshPortfolioList();
    },
  });

  useEffect(() => {
    if (!lowerAddress) {
      return;
    }
    registerSingleProtocols(lowerAddress, selectedChain);
  }, [lowerAddress, selectedChain, registerSingleProtocols]);

  const renderItem = useCallback<ListRenderItem<ActionItem>>(
    props => {
      const { item: _data } = props;
      const { type, data } = _data;
      switch (type) {
        case 'unfold_defi':
          return (
            <MemoFullDefiRenderItem
              data={data}
              showAccount={false}
              disableAction={loadingPortfolio}
              defaultExpand={shouldDefaultExpand}
              account={currentAccount}
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
        case 'fold_defi':
          return (
            <MemoFullDefiRenderItem
              data={data}
              showAccount={false}
              disableAction={loadingPortfolio}
              defaultExpand={false}
              account={currentAccount}
            />
          );
        case 'empty-defi':
          return (
            <EmptyAssets
              style={styles.emptyAssets}
              desc={data || ''}
              type={type}
            />
          );
        case 'loading-defi-skeleton':
          return <DefiItemLoader />;
        default:
          return null;
      }
    },
    [
      currentAccount,
      foldDefi,
      loadingPortfolio,
      shouldDefaultExpand,
      styles.emptyAssets,
      styles.tokenSectionHeader,
    ],
  );
  const ListRenderSeparator = useCallback(() => {
    return <View style={{ height: SPACING_HEIGHT }} />;
  }, []);

  const ListRenderFooter = useCallback(() => {
    return hasMorePortfolios ? (
      <DefiItemLoader style={styles.defiLoading} />
    ) : (
      <View style={{ height: FOOTER_HEIGHT }} />
    );
  }, [hasMorePortfolios, styles.defiLoading]);

  const scrollY = useCurrentTabScrollY();
  const handleScroll = useCallback(
    (currentScrollY: number) => {
      if (currentScrollY <= 0) {
        onReachTopStatusChange?.(true);
      } else {
        onReachTopStatusChange?.(false);
      }
      setShowScrollIndicator(currentScrollY >= 89);
    },
    [onReachTopStatusChange, setShowScrollIndicator],
  );

  useAnimatedReaction(
    () => scrollY.value,
    currentScrollY => {
      runOnJS(handleScroll)(currentScrollY);
    },
  );
  return (
    <View style={styles.container}>
      <Tabs.FlatList
        data={dataList}
        keyExtractor={getItemId}
        renderItem={renderItem}
        // estimatedItemSize={ASSETS_ITEM_HEIGHT_NEW + ASSETS_SEPARATOR_HEIGHT}
        ItemSeparatorComponent={ListRenderSeparator}
        ListFooterComponent={ListRenderFooter}
        showsVerticalScrollIndicator={showScrollIndicator}
        showsHorizontalScrollIndicator={false}
        style={[styles.bgContainer, styles.list]}
        onEndReached={loadMorePortfolios}
        onEndReachedThreshold={0.5}
        windowSize={4}
        maxToRenderPerBatch={15}
        removeClippedSubviews
        refreshControl={
          <RefreshControl
            style={styles.bgContainer}
            onRefresh={async () => {
              if (!lowerAddress) {
                return;
              }
              setIsManualRefreshing(true);
              try {
                const balanceRefresh = Promise.resolve().then(() =>
                  onRefresh?.(),
                );
                const portfolioRefresh = updatePortfolio?.(lowerAddress, true);
                await withAnimatedTickerRefreshNudge(
                  () => balanceRefresh,
                ).catch(error => {
                  console.error('Refresh balance failed:', error);
                });
                await portfolioRefresh;
              } finally {
                setIsManualRefreshing(false);
              }
            }}
            refreshing={isManualRefreshing}
          />
        }
      />
    </View>
  );
};

const getStyles = createGetStyles2024(ctx => ({
  container: {
    flex: 1,
    paddingTop: 10,
  },
  list: {
    flex: 1,
  },
  stickyHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: ASSETS_SECTION_HEADER,
    // paddingHorizontal: 16,
    zIndex: 1,
  },
  bgContainer: {
    // backgroundColor: ctx.colors2024['neutral-bg-1'],
  },
  rowWrap: {
    paddingHorizontal: 16,
  },
  removeLeft: {
    marginLeft: 0,
  },
  renderItemWrapper: {
    backgroundColor: ctx.colors2024['neutral-bg-1'],
    borderRadius: 16,
    height: ASSETS_ITEM_HEIGHT_NEW,
    paddingLeft: 12,
    width: '100%',
  },
  bg2: {
    backgroundColor: ctx.colors2024['neutral-bg-2'],
  },
  sectionHeader: {
    backgroundColor: ctx.colors2024['neutral-bg-gray'],
    // paddingRight: 8,
    height: ASSETS_SECTION_HEADER,
  },
  buttonHeader: {
    backgroundColor: ctx.colors2024['neutral-bg-1'],
  },
  assetHeader: {
    backgroundColor: ctx.colors2024['neutral-bg-gray'],
    height: ASSETS_SECTION_HEADER,
    paddingBottom: 8,
    paddingLeft: 12 + 16,
    paddingRight: 16,
    width: '100%',
  },
  symbol: {
    fontSize: 16,
    height: ASSETS_SECTION_HEADER,
    lineHeight: ASSETS_SECTION_HEADER,
    paddingLeft: 9 + 16,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    color: ctx.colors2024['neutral-secondary'],
    backgroundColor: ctx.colors2024['neutral-bg-gray'],
  },
  emptyAssets: {
    //backgroundColor: 'transparent',
    //height: '100%',
    //marginTop: -100,
  },
  defiLoading: {
    marginTop: 16,
  },
  tokenSectionHeader: {
    backgroundColor: 'transparent',
  },
}));
