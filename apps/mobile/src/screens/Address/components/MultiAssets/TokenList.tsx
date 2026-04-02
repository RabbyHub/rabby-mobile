import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { ListRenderItem, View, Dimensions } from 'react-native';
import { Tabs, useCurrentTabScrollY } from 'react-native-collapsible-tab-view';
import { useShallow } from 'zustand/shallow';

import { ASSETS_ITEM_HEIGHT_NEW, RootNames } from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';
import {
  TokenRowSectionLpTokenHeader,
  TokenRowV2,
} from '@/screens/Home/components/AssetRenderItems';
import { navigateDeprecated } from '@/utils/navigation';
import { createGetStyles2024 } from '@/utils/styles';
import { ItemLoader } from '@/screens/Search/components/Skeleton';
import { ScamTokenHeader } from '@/screens/Home/components/AssetRenderItems/ScamTokenHeader';
import { GestureDetector, RefreshControl } from 'react-native-gesture-handler';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import { isTabsSwiping, useAccountInfo } from './hooks';
import { useCurrency } from '@/hooks/useCurrency';
import { KeyringAccountWithAlias } from '@/hooks/account';
import { EmptyAssets } from '@/screens/Home/components/AssetRenderItems/EmptyAssets';
import { TAB_HEADER_FULL_HEIGHT, TabName } from './TabsMultiAssets';
import { ListRenderFooter } from './RenderRow/Common';
import useTokenList, {
  getMultiAssetsCacheKey,
  ITokenItem,
  useTokenListComputedStore,
} from '@/store/tokens';
import { formatNetworth } from '@/utils/math';
import { useFindAccountByAddress, useIsFocusedCurrentTab } from './hooks/share';
import { useSelectedChainItem } from '@/screens/Home/useChainInfo';
import { HOME_TOP_HEADER_SIZES } from '@/constant/home';
import { IS_ANDROID } from '@/core/native/utils';
import { TabsFlatList } from '@/components/customized/react-native-collapsible-tab-view/FlatList';
import { trackHomeTabViewToken } from '@/utils/analytics0331';
import {
  pulldownRefreshSizes,
  RefreshPlaceholderIOS,
  setPulldownRefreshStage,
  SHOULD_SHOW_CUSTOM_INDICATOR_WHEN_LOADING,
  usePulldownRefreshGesture,
  usePulldownRefreshStyles,
} from '@/components/customized/ScrollViewLike/RefreshPlaceholderIOS';
import { RNGHRefreshControl } from '@/components/customized/reexports';

const MemoizedTokenRow = React.memo(TokenRowV2);
const MemoizedScamTokenHeader = React.memo(ScamTokenHeader);
const MemoizedTokenRowSectionHeader = React.memo(TokenRowSectionLpTokenHeader);

const MemoizedItemLoader = React.memo(ItemLoader);
export const MemoizedTokenItemLoader = React.memo((props: RNViewProps) => {
  return (
    <View {...props} style={[{ paddingHorizontal: 16 }, props.style]}>
      <MemoizedItemLoader />
    </View>
  );
});

type TokenListItem =
  | {
      type: 'unfold_token' | 'fold_token';
      data: ITokenItem;
      isLast?: boolean;
    }
  | {
      type: 'toggle_token_fold';
    }
  | {
      type: 'scam_header';
      data: {
        total: number;
        logoUrls: string[];
      };
    }
  | {
      type: 'empty-assets';
      data: string;
    };

const { batchGetTokenList } = useTokenList.getState();

export const TokenList = () => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();
  const { myTop10Addresses } = useAccountInfo();
  const selectedChainItem = useSelectedChainItem();
  const chain = useMemo(() => {
    return selectedChainItem?.chain;
  }, [selectedChainItem?.chain]);

  const [foldHideList, setFoldHideList] = useState(true);
  const [foldScam, setFoldScam] = useState(true);
  const [isLpTokenEnabled, setIsLpTokenEnabled] = useState(false);

  const { currency } = useCurrency();
  const tokenDisplayMode = useTokenList(s => s.tokenDisplayMode);
  const tokenDisplayModeRef = useRef(tokenDisplayMode);

  const getAccountByAddress = useFindAccountByAddress();
  const { isFocused, isFocusing } = useIsFocusedCurrentTab(TabName.token);

  const emptyResult = useMemo(
    () => ({
      unFoldTokens: [] as ITokenItem[],
      foldTokens: [] as ITokenItem[],
      scamTokens: [] as ITokenItem[],
    }),
    [],
  );

  const registerMultiAssets = useTokenListComputedStore(
    state => state.registerMultiAssets,
  );

  const multiAssetsKey = useMemo(
    () =>
      getMultiAssetsCacheKey(
        myTop10Addresses,
        chain,
        isLpTokenEnabled,
        tokenDisplayMode,
      ),
    [myTop10Addresses, chain, isLpTokenEnabled, tokenDisplayMode],
  );

  useEffect(() => {
    registerMultiAssets(
      myTop10Addresses,
      chain,
      isLpTokenEnabled,
      tokenDisplayMode,
    );
  }, [
    myTop10Addresses,
    chain,
    isLpTokenEnabled,
    registerMultiAssets,
    tokenDisplayMode,
  ]);

  const {
    unFoldTokens: tokens,
    foldTokens,
    scamTokens,
  } = useTokenListComputedStore(
    useShallow(state => state.multiAssetsCache[multiAssetsKey] || emptyResult),
  );

  const isLoading = useTokenList(s => s.isLoading);

  const foldTokenUsdValue = useMemo(() => {
    const usdValue = foldTokens
      .filter(item => item.is_core)
      .reduce((total, item) => {
        return total + item.usd_value;
      }, 0);
    return formatNetworth(usdValue * currency.usd_rate, false, currency.symbol);
  }, [foldTokens, currency]);

  useEffect(() => {
    batchGetTokenList(myTop10Addresses);
  }, [myTop10Addresses]);

  useEffect(() => {
    tokenDisplayModeRef.current = tokenDisplayMode;
  }, [tokenDisplayMode]);

  useEffect(() => {
    if (!isFocusing) {
      return;
    }

    trackHomeTabViewToken(tokenDisplayModeRef.current).catch(error => {
      console.error('trackHomeTabViewToken failed', error);
    });
  }, [isFocusing]);

  const hasNoAssets =
    tokens.length + foldTokens.length + scamTokens.length === 0 &&
    !isLoading &&
    isFocused;

  const handleOpenTokenDetail = useCallback(
    (token: ITokenItem, account?: KeyringAccountWithAlias) => {
      if (isTabsSwiping.value) {
        return;
      }
      navigateDeprecated(RootNames.TokenDetail, {
        token: token,
        unHold: false,
        needUseCacheToken: true,
        account,
      });
    },
    [],
  );

  const handleTokenPress = useCallback(
    (token: ITokenItem) => {
      if (isTabsSwiping.value) {
        return;
      }
      if (tokenDisplayMode === 'byAddress') {
        handleOpenTokenDetail(token, getAccountByAddress(token.owner_addr));
        return;
      }
      const groupItems = (token as { groupItems?: ITokenItem[] }).groupItems;
      if (!groupItems?.length) {
        handleOpenTokenDetail(token);
        return;
      }
      if (groupItems.length === 1) {
        handleOpenTokenDetail(
          groupItems[0]!,
          getAccountByAddress(groupItems[0]!.owner_addr),
        );
        return;
      }
      const maxHeight = Dimensions.get('window').height - 160;
      const listHeight = groupItems.length * (ASSETS_ITEM_HEIGHT_NEW + 8) + 28;
      const snapPoint = Math.min(maxHeight, listHeight + 100);
      const modalId = createGlobalBottomSheetModal2024({
        name: MODAL_NAMES.TOKEN_GROUP_DETAIL,
        tokens: groupItems,
        onCancel: () => {
          removeGlobalBottomSheetModal2024(modalId);
        },
        bottomSheetModalProps: {
          snapPoints: [snapPoint],
          handleStyle: {
            backgroundColor: colors2024['neutral-bg-0'],
          },
          enableContentPanningGesture: true,
          enablePanDownToClose: true,
          enableDismissOnClose: true,
        },
      });
    },
    [colors2024, getAccountByAddress, handleOpenTokenDetail, tokenDisplayMode],
  );

  const handleOpenScamToken = useCallback(() => {
    setFoldScam(false);
  }, []);

  const handleToggleTokenFold = useCallback(() => {
    if (!foldHideList) {
      setFoldScam(true);
      setIsLpTokenEnabled(false);
    }
    setFoldHideList(pre => !pre);
  }, [foldHideList]);

  // const ListRenderFooter = useCallback(() => {
  //   return hasMorePortfolios ? (
  //     <MemoizedDefiItemLoader style={[styles.loadingMore]} />
  //   ) : (
  //     <ListRenderFooterComponent />
  //   );
  // }, [hasMorePortfolios, styles.loadingMore]);

  const onRefresh = useCallback(async () => {
    try {
      batchGetTokenList(myTop10Addresses, true);
    } catch (error) {
      console.error('Refresh failed:', error);
    }
  }, [myTop10Addresses]);

  const dataList = useMemo(() => {
    const items: TokenListItem[] = [];

    if (hasNoAssets) {
      items.push({
        type: 'empty-assets',
        data: t('page.singleHome.sectionHeader.NoData', {
          name: t('page.singleHome.sectionHeader.Token'),
        }),
      });
      return items;
    }

    tokens.forEach((token, index) => {
      items.push({
        type: 'unfold_token',
        data: token,
        isLast: index === tokens.length - 1,
      });
    });

    items.push({ type: 'toggle_token_fold' });

    if (!foldHideList) {
      foldTokens.forEach(token => {
        items.push({ type: 'fold_token', data: token });
      });

      if (scamTokens.length > 0) {
        if (foldScam) {
          items.push({
            type: 'scam_header',
            data: {
              total: scamTokens.length,
              logoUrls: scamTokens.slice(0, 3).map(i => i.logo_url),
            },
          });
        } else {
          scamTokens.forEach(token => {
            items.push({ type: 'fold_token', data: token });
          });
        }
      }
    }

    return items;
  }, [foldTokens, scamTokens, tokens, foldHideList, foldScam, hasNoAssets, t]);

  const renderItem = useCallback<ListRenderItem<TokenListItem>>(
    ({ item }) => {
      switch (item.type) {
        case 'unfold_token': {
          const account =
            tokenDisplayMode === 'byAddress'
              ? getAccountByAddress(item.data.owner_addr)
              : undefined;
          return (
            <View
              style={[styles.rowWrap, item.isLast ? styles.lastRowWrap : null]}>
              <MemoizedTokenRow
                data={item.data}
                onTokenPress={handleTokenPress}
                logoSize={46}
                style={styles.renderItemWrapper}
                chainLogoSize={18}
                hideChainLogo={tokenDisplayMode === 'bySymbol'}
                account={account}
                scene="portfolio"
              />
            </View>
          );
        }
        case 'fold_token': {
          const foldAccount =
            tokenDisplayMode === 'byAddress'
              ? getAccountByAddress(item.data.owner_addr)
              : undefined;
          return (
            <View style={styles.foldRowWrap}>
              <MemoizedTokenRow
                data={item.data}
                onTokenPress={handleTokenPress}
                logoSize={46}
                style={styles.renderItemWrapper}
                chainLogoSize={18}
                hideChainLogo={tokenDisplayMode === 'bySymbol'}
                account={foldAccount}
                scene="portfolio"
              />
            </View>
          );
        }
        case 'toggle_token_fold':
          return (
            <MemoizedTokenRowSectionHeader
              style={styles.tokenSectionHeader}
              fold={foldHideList}
              str={foldTokenUsdValue}
              onPressFold={handleToggleTokenFold}
              isEnabled={isLpTokenEnabled}
              onValueChange={setIsLpTokenEnabled}
            />
          );
        case 'scam_header':
          return (
            <View style={styles.foldRowWrap}>
              <MemoizedScamTokenHeader
                total={item.data.total}
                logoUrls={item.data.logoUrls}
                style={{ ...styles.renderItemWrapper, flexGrow: 0 }}
                onPress={handleOpenScamToken}
              />
            </View>
          );
        case 'empty-assets':
          return (
            <EmptyAssets
              style={styles.emptyAssets}
              desc={item.data}
              type={'empty-assets'}
            />
          );
        default:
          return null;
      }
    },
    [
      tokenDisplayMode,
      foldHideList,
      foldTokenUsdValue,
      getAccountByAddress,
      handleOpenScamToken,
      handleTokenPress,
      handleToggleTokenFold,
      isLpTokenEnabled,
      styles,
    ],
  );

  const keyExtractor = useCallback((item: TokenListItem) => {
    if (item.type === 'unfold_token' || item.type === 'fold_token') {
      const groupKey = (item.data as { groupKey?: string }).groupKey;
      if (groupKey) {
        return `${item.type}-${groupKey}`;
      }
      return `${item.type}-${item.data.owner_addr}-${item.data.chain}-${item.data.id}`;
    }
    if (item.type === 'scam_header') {
      return `scam-header-${item.data.total}`;
    }
    if (item.type === 'empty-assets') {
      return `empty-assets-${item.data}`;
    }
    return item.type;
  }, []);

  const scrollY = useCurrentTabScrollY();
  const {
    panGestureRef,
    isRefreshing,
    svs: { pullDistance, svIsRefreshing, svIsManualRefreshing },
  } = usePulldownRefreshGesture({
    scrollViewYValue: scrollY,
    onJsPulldownRefresh: ctx => {
      ctx.svIsManualRefreshing.value = true;
      return onRefresh();
    },
  });

  useEffect(() => {
    console.debug('[PulldownRefresh] TokenList isLoading changed', isLoading);
    if (!isLoading) {
      setPulldownRefreshStage({
        state: isLoading ? 'refreshing' : 'finished',
        indicatorSpaceHeight: pulldownRefreshSizes.homeHeaderHeight,
        svIsRefreshing,
        svIsManualRefreshing,
        pullDistance,
      });
    }
  }, [isLoading, svIsRefreshing, svIsManualRefreshing, pullDistance]);

  const pulldownRefreshReturns = usePulldownRefreshStyles({
    indicatorSpaceHeight: pulldownRefreshSizes.homeHeaderHeight,
    pullDistanceMaxValue: HOME_TOP_HEADER_SIZES.tabInnerHomeTopOffset,
    states: { pullDistance, svIsRefreshing, svIsManualRefreshing },
  });

  return (
    <GestureDetector gesture={panGestureRef.current}>
      <TabsFlatList
        style={[
          styles.container,
          pulldownRefreshReturns.scrollableStyle.container,
        ]}
        contentContainerStyle={[
          styles.list,
          pulldownRefreshReturns.scrollableStyle.list,
        ]}
        ListHeaderComponent={
          <RefreshPlaceholderIOS
            hooksReturn={pulldownRefreshReturns}
            animatedStyle={pulldownRefreshReturns.refreshPlaceholderStyle}
            __PICK_MANUAL__
          />
        }
        // ListFooterComponent={ListRenderFooter}
        bounces={false}
        overScrollMode={'never'}
        scrollEventThrottle={16}
        simultaneousHandlers={[panGestureRef]}
        {...(!SHOULD_SHOW_CUSTOM_INDICATOR_WHEN_LOADING && {
          refreshControl: (
            <RNGHRefreshControl
              style={{ paddingHorizontal: 16 }}
              refreshing={isRefreshing}
              onRefresh={onRefresh}
            />
          ),
        })}
        data={dataList}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
      />
    </GestureDetector>
  );
};

const getStyles = createGetStyles2024(() => ({
  container: {
    flex: 1,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 48,
  },
  tokenSectionHeader: {
    paddingLeft: 0,
    paddingRight: 0,
    backgroundColor: 'transparent',
    marginBottom: 12,
  },
  emptyAssets: {
    marginHorizontal: 0,
  },
  loadingItem: {
    height: ASSETS_ITEM_HEIGHT_NEW,
  },
  rowWrap: {
    height: ASSETS_ITEM_HEIGHT_NEW,
    marginBottom: 8,
  },
  lastRowWrap: {
    marginBottom: 12,
  },
  foldRowWrap: {
    height: ASSETS_ITEM_HEIGHT_NEW,
    marginBottom: 8,
  },
  renderItemWrapper: {
    height: ASSETS_ITEM_HEIGHT_NEW,
  },
}));
