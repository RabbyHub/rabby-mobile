import React, {
  useCallback,
  useState,
  useEffect,
  useMemo,
  useRef,
  memo,
} from 'react';
import { View } from 'react-native';
import { RefreshControl } from 'react-native-gesture-handler';

import { createGetStyles2024 } from '@/utils/styles';
import { AbstractProject, ActionItem } from './types';
import {
  ASSETS_ITEM_HEIGHT_NEW,
  ASSETS_SECTION_HEADER,
} from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';

import { FullDefiRenderItem } from './components/AssetRenderItems';
import { useTranslation } from 'react-i18next';
import { DisplayedProject } from './utils/project';
import { EmptyAssets } from './components/AssetRenderItems/EmptyAssets';
import { DefiItemLoader } from './components/Skeleton';
import {
  Tabs,
  useCurrentTabScrollY,
  useFocusedTab,
} from 'react-native-collapsible-tab-view';
import { useAnimatedReaction } from 'react-native-reanimated';
import { runOnJS } from 'react-native-reanimated';
import { Account } from '@/core/services/preference';
import { getItemId } from './utils/listRenderId';
import { usePortfolios } from './hooks/usePortfolio';
import useLoadMoreData from '../Address/components/MultiAssets/hooks/useLoadMoreData';
import { PerpsSingleAssetPosition } from '../Perps/components/PerpsMultiAssetPosition';

export const icons = {
  unfoldDark: require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_unfold_dark.png'),
  unfoldLight: require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_unfold.png'),
  foldDark: require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_fold_dark.png'),
  foldLight: require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_fold.png'),
  pinDark: require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_token_favorite_dark.png'),
  pinLight: require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_token_favorite.png'),
  unpinDark: require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_token_unfavorite_dark.png'),
  unpinLight: require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_token_unfavorite.png'),
};
const MemoFullDefiRenderItem = memo(FullDefiRenderItem);

interface Props {
  onRefresh?: () => void;
  onReachTopStatusChange?: (status: boolean) => void;
  chain?: string;
  account: Account;
  updatePortfolio?: (portfolios: DisplayedProject[]) => void;
}
const FOOTER_HEIGHT = 220;
const SPACING_HEIGHT = 16;

export const PortfolioList = ({
  onRefresh,
  onReachTopStatusChange,
  chain,
  account: currentAccount,
  updatePortfolio: updatePortfolioCallback,
}: Props) => {
  const { styles } = useTheme2024({
    getStyle: getStyles,
  });
  const { t } = useTranslation();
  const focusedTab = useFocusedTab();
  const hasBeenFocusedRef = useRef(false);

  const isFocused = useMemo(() => {
    const currentFocused = focusedTab === 'defi';
    if (currentFocused) {
      hasBeenFocusedRef.current = true;
    }
    return hasBeenFocusedRef.current;
  }, [focusedTab]);

  const [showScrollIndicator, setShowScrollIndicator] = useState(false);

  const {
    data: _rawPortfolios,
    // hasValue: hasPortfolios,
    updateData: updatePortfolio,
    isLoading: loadingPortfolio,
    refreshing,
  } = usePortfolios(currentAccount?.address?.toLowerCase(), false);

  // useEffect(() => {
  //   if (_rawPortfolios && !loadingPortfolio) {
  //     updatePortfolioCallback?.(_rawPortfolios);
  //   }
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, [_rawPortfolios?.length, loadingPortfolio, updatePortfolioCallback]);

  const _portfolios = useMemo(
    () =>
      _rawPortfolios.filter(item =>
        chain && item?.chain ? item.chain === chain : true,
      ),
    [_rawPortfolios, chain],
  );

  const {
    data: portfolios,
    loadMore: loadMorePortfolios,
    hasMore: hasMorePortfolios,
  } = useLoadMoreData(_portfolios);

  const dataList = useMemo(() => {
    const unFoldDefiList: ActionItem[] = portfolios.map(item => ({
      type: 'unfold_defi',
      data: item as unknown as DisplayedProject,
    }));
    const itemData: Array<{
      show: boolean;
      data: ActionItem[];
    }> = [
      {
        show: true,
        data: unFoldDefiList,
      },
      {
        show: !!loadingPortfolio && !portfolios.length,
        data: Array.from({ length: 2 }, (_, index) => ({
          type: 'loading-defi-skeleton',
          data: 'index-defi' + index.toString(),
        })),
      },
      {
        show: !loadingPortfolio && portfolios.length === 0,
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
  }, [loadingPortfolio, portfolios, t]);

  useEffect(() => {
    if (isFocused) {
      updatePortfolio();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocused, currentAccount?.address]);

  const renderItem = useCallback(
    props => {
      const { item: _data } = props;
      const { type, data } = _data;
      switch (type) {
        case 'unfold_defi':
          return (
            <MemoFullDefiRenderItem
              data={data as unknown as AbstractProject}
              showAccount={false}
              disableAction={refreshing}
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
    [currentAccount, refreshing, styles.emptyAssets],
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
        ListHeaderComponent={
          <PerpsSingleAssetPosition account={currentAccount} />
        }
        showsVerticalScrollIndicator={showScrollIndicator}
        showsHorizontalScrollIndicator={false}
        style={[styles.bgContainer, styles.list]}
        onEndReached={loadMorePortfolios}
        onEndReachedThreshold={0.5}
        windowSize={4}
        maxToRenderPerBatch={4}
        removeClippedSubviews
        refreshControl={
          <RefreshControl
            style={styles.bgContainer}
            onRefresh={() => {
              updatePortfolio?.(true);
              onRefresh?.();
            }}
            refreshing={false}
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
    backgroundColor: 'transparent',
    height: '100%',
    marginTop: -100,
  },
  defiLoading: {
    marginTop: 16,
  },
}));
