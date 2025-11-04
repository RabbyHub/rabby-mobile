import React, {
  useCallback,
  useState,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { RefreshControl } from 'react-native-gesture-handler';

import { createGetStyles2024 } from '@/utils/styles';
import { AbstractProject, ActionItem } from './types';
import {
  ASSETS_ITEM_HEIGHT_NEW,
  ASSETS_SECTION_HEADER,
  DEFI_ITEM_HEIGHT,
} from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';

import { TokenRowSectionHeader } from './components/AssetRenderItems';
import { FullDefiRenderItem } from './components/AssetRenderItems/FullDefiRenderItem';
import { useTranslation } from 'react-i18next';
import { DisplayedProject } from './utils/project';
import { EmptyAssets } from './components/AssetRenderItems/EmptyAssets';
import { DefiItemLoader, ItemLoader } from './components/Skeleton';
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
import { getAllDefiCount } from './utils/converAssets';
import { useCurrency } from '@/hooks/useCurrency';

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

interface Props {
  onRefresh?: () => void;
  onReachTopStatusChange?: (status: boolean) => void;
  chain?: string;
  account: Account;
}
const FOOTER_HEIGHT = 56;
const SPACING_HEIGHT = 8;

export const PortfolioList = ({
  onRefresh,
  onReachTopStatusChange,
  chain,
  account: currentAccount,
}: Props) => {
  const { styles, isLight } = useTheme2024({
    getStyle: getStyles,
  });
  const { t } = useTranslation();
  const [foldDefi, setFoldDefi] = useState(true);
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
  } = usePortfolios(currentAccount?.address?.toLowerCase(), false);

  const { currency } = useCurrency();

  const portfolios = useMemo(
    () =>
      _rawPortfolios.filter(item =>
        chain && item?.chain ? item.chain === chain : true,
      ),
    [_rawPortfolios, chain],
  );

  const dataList = useMemo(() => {
    const foldAndIncludeBalanceDefiList = portfolios.filter(
      i => i._isFold && !i._isExcludeBalance && i.netWorth > 0,
    );
    const foldAndExcludeBalanceDefiList = portfolios.filter(
      i => i._isFold && (i._isExcludeBalance || i.netWorth === 0),
    );
    const foldDefiList: ActionItem[] = [
      ...foldAndIncludeBalanceDefiList,
      ...foldAndExcludeBalanceDefiList,
    ].map(item => ({
      type: 'fold_defi',
      data: item,
    }));
    const unFoldDefiList: ActionItem[] = portfolios
      .filter(i => !i._isFold)
      .map(item => ({
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
        show: !!foldDefiList.length,
        data: [
          {
            type: 'toggle_defi_fold',
          },
          ...(foldDefi ? [] : foldDefiList),
        ],
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
  }, [foldDefi, loadingPortfolio, portfolios, t]);

  useEffect(() => {
    if (isFocused) {
      updatePortfolio();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocused]);

  const foldDefiAmount = useMemo(() => {
    return getAllDefiCount(
      portfolios.filter(i => i._isFold),
      currency.usd_rate,
      currency.symbol,
    );
  }, [currency.symbol, currency.usd_rate, portfolios]);

  const renderItem = useCallback(
    (_type, _data: ActionItem) => {
      const { type, data } = _data;
      switch (type) {
        case 'unfold_defi':
        case 'fold_defi':
          return (
            <FullDefiRenderItem
              data={data as unknown as AbstractProject}
              showAccount={false}
              account={currentAccount}
            />
          );
        case 'defi_header':
          return (
            <Text style={styles.symbol}>
              {t('page.singleHome.sectionHeader.Defi')}
            </Text>
          );
        case 'toggle_defi_fold':
          return (
            <TokenRowSectionHeader
              str={foldDefiAmount}
              fold={foldDefi}
              style={styles.sectionHeader}
              buttonStyle={StyleSheet.flatten([
                styles.buttonHeader,
                !isLight && styles.bg2,
              ])}
              onPressFold={() => setFoldDefi(pre => !pre)}
            />
          );
        case 'empty-assets':
        case 'empty-defi':
          return <EmptyAssets desc={data || ''} type={type} />;
        case 'loading-skeleton':
          return (
            <View style={styles.rowWrap}>
              <ItemLoader style={styles.removeLeft} />
            </View>
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
      foldDefiAmount,
      isLight,
      styles.bg2,
      styles.buttonHeader,
      styles.removeLeft,
      styles.rowWrap,
      styles.sectionHeader,
      styles.symbol,
      t,
    ],
  );
  const ListRenderSeparator = useCallback(() => {
    return <View style={{ height: SPACING_HEIGHT }} />;
  }, []);

  const ListRenderFooter = useCallback(() => {
    return <View style={{ height: FOOTER_HEIGHT }} />;
  }, []);

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
        renderItem={({ item }) => renderItem(item.type, item)}
        // estimatedItemSize={ASSETS_ITEM_HEIGHT_NEW + ASSETS_SEPARATOR_HEIGHT}
        ItemSeparatorComponent={ListRenderSeparator}
        ListFooterComponent={ListRenderFooter}
        showsVerticalScrollIndicator={showScrollIndicator}
        showsHorizontalScrollIndicator={false}
        style={[styles.bgContainer, styles.list]}
        refreshControl={
          <RefreshControl
            style={styles.bgContainer}
            onRefresh={() => {
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
  defiGroups: {
    flexDirection: 'row',
    height: DEFI_ITEM_HEIGHT,
    gap: 12,
    paddingHorizontal: 16,
  },
  renderDefiItemWrapper: {
    backgroundColor: ctx.colors2024['neutral-bg-1'],
    borderRadius: 16,
    height: DEFI_ITEM_HEIGHT,
    paddingLeft: 12,
    paddingRight: 16,
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
}));
