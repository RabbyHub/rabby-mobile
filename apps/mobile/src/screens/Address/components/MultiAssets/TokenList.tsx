import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  ListRenderItem,
  View,
  Dimensions,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useCurrentTabScrollY } from 'react-native-collapsible-tab-view';
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
import { GestureDetector } from 'react-native-gesture-handler';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import { isTabsSwiping, useAccountInfo } from './hooks';
import { KeyringAccountWithAlias } from '@/hooks/account';
import { EmptyAssets } from '@/screens/Home/components/AssetRenderItems/EmptyAssets';
import { HomeTabName as TabName } from '@/hooks/navigation';
import useTokenList, {
  EMPTY_TOKEN_ASSETS_INDEX_RESULT,
  EMPTY_TOKEN_ENTITY_IDS,
  getMultiAssetsCacheKey,
  getTokenAssetsIndexRowKey,
  ITokenItem,
  TokenAssetsIndexRow,
  TokenEntityId,
  TokenGroupResourceValue,
  tokenEntityResourceStore,
  useTokenAssetsIndexStore,
  useTokenEntity,
  useTokenGroup,
  useTokenIndexStore,
} from '@/store/tokens';
import { formatNetworth } from '@/utils/math';
import { useFindAccountByAddress, useIsFocusedCurrentTab } from './hooks/share';
import { useSelectedChainItem } from '@/screens/Home/useChainInfo';
import {
  HOME_TOP_HEADER_SIZES,
  SHOULD_SHOW_CUSTOM_INDICATOR_WHEN_LOADING,
} from '@/constant/home';
import { TabsFlatList } from '@/components/customized/react-native-collapsible-tab-view/FlatList';
import {
  pulldownRefreshSizes,
  RefreshPlaceholderIOS,
  setPulldownRefreshStage,
  usePulldownRefreshGesture,
  usePulldownRefreshStyles,
} from '@/components/customized/ScrollViewLike/RefreshPlaceholderIOS';
import { RNGHRefreshControl } from '@/components/customized/reexports';
import { useAppForeground } from '@/hooks/useAppForeground';
import addressBalanceStore from '@/store/balance';
import { withAnimatedTickerRefreshNudge } from '@/components/Animated/RefreshNudgedTickerText';
import { CustomTestnetAssetSection } from './CustomTestnetAssets/CustomTestnetAssetSection';
import { CustomTestnetAssetDivider } from './CustomTestnetAssets/CustomTestnetAssetDivider';
import { useCustomTestnetAssetSections } from './CustomTestnetAssets/useCustomTestnetAssetSections';
import type { CustomTestnetAssetSectionData } from './CustomTestnetAssets/types';
import { AccountOverview } from '@/screens/Home/components/AccountOverview';
import { useIsFocused } from '@react-navigation/native';
import { apiCustomTestnet } from '@/core/apis';
import { toast } from '@/components2024/Toast';

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

const TokenResourceRow = React.memo(
  ({
    row,
    tokenDisplayMode,
    getAccountByAddress,
    onTokenPress,
    onGroupPress,
    style,
    hideChainLogo,
  }: {
    row: TokenAssetsIndexRow;
    tokenDisplayMode: string;
    getAccountByAddress(address?: string): KeyringAccountWithAlias | undefined;
    onTokenPress(token: ITokenItem): void;
    onGroupPress(group: TokenGroupResourceValue): void;
    style?: ViewStyle;
    hideChainLogo?: boolean;
  }) => {
    const token = useTokenEntity(
      row.type === 'token' ? row.tokenId : undefined,
    );
    const group = useTokenGroup(row.type === 'group' ? row.groupId : undefined);
    const data = row.type === 'group' ? group?.summary : token;
    const account =
      tokenDisplayMode === 'byAddress' && data
        ? getAccountByAddress(data.owner_addr)
        : undefined;

    const handlePress = useCallback(() => {
      if (!data) {
        return;
      }
      if (row.type === 'group' && group) {
        onGroupPress(group);
        return;
      }
      onTokenPress(data);
    }, [data, group, onGroupPress, onTokenPress, row]);

    if (!data) {
      return <MemoizedItemLoader />;
    }

    return (
      <MemoizedTokenRow
        data={data}
        onTokenPress={handlePress}
        logoSize={46}
        style={style}
        chainLogoSize={18}
        hideChainLogo={hideChainLogo}
        account={account}
        scene="portfolio"
      />
    );
  },
);

const TokenFoldSectionHeader = React.memo(
  ({
    style,
    fold,
    str,
    onPressFold,
    isEnabled,
    onValueChange,
  }: {
    style: ViewStyle;
    fold: boolean;
    str: string;
    onPressFold: () => void;
    isEnabled: boolean;
    onValueChange: (value: boolean) => void;
  }) => {
    return (
      <MemoizedTokenRowSectionHeader
        style={style}
        fold={fold}
        str={str}
        onPressFold={onPressFold}
        isEnabled={isEnabled}
        onValueChange={onValueChange}
      />
    );
  },
);

type TokenListItem =
  | {
      type: 'unfold_token' | 'fold_token';
      row: TokenAssetsIndexRow;
      isLast?: boolean;
    }
  | {
      type: 'toggle_token_fold';
    }
  | {
      type: 'custom_testnet_assets';
      data: CustomTestnetAssetSectionData;
    }
  | {
      type: 'custom_testnet_divider';
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
    }
  | {
      type: 'loading-skeleton';
      data: string;
    };

const { batchGetTokenList } = useTokenList.getState();
const EMPTY_CUSTOM_TESTNET_SECTIONS: CustomTestnetAssetSectionData[] = [];

const appendCustomTestnetItems = (
  items: TokenListItem[],
  sections: CustomTestnetAssetSectionData[],
) => {
  if (!sections.length) {
    return;
  }
  items.push({ type: 'custom_testnet_divider' });
  sections.forEach(section => {
    items.push({
      type: 'custom_testnet_assets',
      data: section,
    });
  });
};

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
  const [customTestnetCollapseKey, setCustomTestnetCollapseKey] = useState(0);

  const tokenDisplayMode = useTokenList(s => s.tokenDisplayMode);

  const getAccountByAddress = useFindAccountByAddress();
  const {
    sections: customTestnetSections,
    loadTokens: loadCustomTestnetTokens,
    loadToken: loadCustomTestnetToken,
  } = useCustomTestnetAssetSections(myTop10Addresses);
  const shouldShowCustomTestnetSections = !chain && !isLpTokenEnabled;
  const { triggerUpdate } = addressBalanceStore.useAccountsBalanceTrigger();

  const { isFocused, isFocusing } = useIsFocusedCurrentTab(TabName.token);

  const isScreenFocused = useIsFocused();

  useEffect(() => {
    if (!isScreenFocused) {
      setCustomTestnetCollapseKey(key => key + 1);
    }
  }, [isScreenFocused]);

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
    useTokenIndexStore
      .getState()
      .syncFromTokenListMap(
        useTokenList.getState().tokenListMap,
        myTop10Addresses,
      );
  }, [myTop10Addresses]);

  const tokenIds = useTokenIndexStore(
    useShallow(state => {
      if (!myTop10Addresses.length) {
        return EMPTY_TOKEN_ENTITY_IDS;
      }

      const ids: TokenEntityId[] = [];
      const seen = new Set<TokenEntityId>();
      myTop10Addresses.forEach(address => {
        const addressTokenIds =
          state.addressTokenIds[address.toLowerCase()] ||
          EMPTY_TOKEN_ENTITY_IDS;
        addressTokenIds.forEach(tokenId => {
          if (seen.has(tokenId)) {
            return;
          }
          seen.add(tokenId);
          ids.push(tokenId);
        });
      });
      return ids;
    }),
  );
  useLayoutEffect(() => {
    useTokenAssetsIndexStore.getState().syncMultiAssetsResult({
      key: multiAssetsKey,
      tokenIds,
      chainServerId: chain,
      isLpTokenEnabled,
      tokenDisplayMode,
    });
  }, [chain, isLpTokenEnabled, multiAssetsKey, tokenDisplayMode, tokenIds]);

  const {
    unFoldRows: tokenRows,
    foldRows,
    scamRows,
    scamTokenPreviewLogoUrls,
    foldCoreUsdValue,
    hasFoldTokens,
  } = useTokenAssetsIndexStore(
    useShallow(
      state =>
        state.multiAssetsResultByKey[multiAssetsKey] ||
        EMPTY_TOKEN_ASSETS_INDEX_RESULT,
    ),
  );
  const foldTokenUsdValue = useMemo(
    () => formatNetworth(foldCoreUsdValue),
    [foldCoreUsdValue],
  );

  const isLoading = useTokenList(s => s.isLoading);
  const hasDefaultTokenData =
    tokenRows.length + foldRows.length + scamRows.length > 0;
  const shouldHideCustomTestnetSectionsWhileLoading =
    isLoading && !hasDefaultTokenData;
  const visibleCustomTestnetSections =
    shouldShowCustomTestnetSections &&
    !shouldHideCustomTestnetSectionsWhileLoading
      ? customTestnetSections
      : EMPTY_CUSTOM_TESTNET_SECTIONS;

  useEffect(() => {
    batchGetTokenList(myTop10Addresses);
  }, [myTop10Addresses]);

  const handleForeground = useCallback(() => {
    if (isLoading || !isFocusing || !myTop10Addresses) {
      return;
    }
    triggerUpdate(false);
    batchGetTokenList(myTop10Addresses);
  }, [isFocusing, isLoading, myTop10Addresses, triggerUpdate]);

  useAppForeground({
    enabled: isFocusing,
    onForeground: handleForeground,
  });

  const hasNoAssets =
    tokenRows.length + foldRows.length + scamRows.length === 0 &&
    !isLoading &&
    isFocused;

  const handleOpenTokenDetail = useCallback(
    (
      token: ITokenItem,
      account?: KeyringAccountWithAlias,
      options?: {
        isCustomTestnetToken?: boolean;
      },
    ) => {
      if (isTabsSwiping.value) {
        return;
      }
      navigateDeprecated(RootNames.TokenDetail, {
        token: token,
        unHold: false,
        needUseCacheToken: true,
        account,
        isCustomTestnetToken: options?.isCustomTestnetToken,
      });
    },
    [],
  );

  const handleTokenPress = useCallback(
    (token: ITokenItem) => {
      if (isTabsSwiping.value) {
        return;
      }

      handleOpenTokenDetail(
        token,
        tokenDisplayMode === 'byAddress'
          ? getAccountByAddress(token.owner_addr)
          : undefined,
      );
    },
    [getAccountByAddress, handleOpenTokenDetail, tokenDisplayMode],
  );

  const handleCustomTestnetTokenPress = useCallback(
    (token: ITokenItem) => {
      if (isTabsSwiping.value) {
        return;
      }

      handleOpenTokenDetail(token, getAccountByAddress(token.owner_addr), {
        isCustomTestnetToken: true,
      });
    },
    [getAccountByAddress, handleOpenTokenDetail],
  );

  const handleOpenTokenGroupDetail = useCallback(
    (
      groupItems: ITokenItem[],
      options?: {
        amountOnly?: boolean;
      },
    ) => {
      if (!groupItems.length) {
        return;
      }

      const maxHeight = Dimensions.get('window').height - 160;
      const listHeight = groupItems.length * (ASSETS_ITEM_HEIGHT_NEW + 8) + 28;
      const snapPoint = Math.min(maxHeight, listHeight + 100);
      const modalId = createGlobalBottomSheetModal2024({
        name: MODAL_NAMES.TOKEN_GROUP_DETAIL,
        tokens: groupItems,
        amountOnly: options?.amountOnly,
        isCustomTestnetToken: options?.amountOnly,
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
    [colors2024],
  );

  const handleGroupPress = useCallback(
    (group: TokenGroupResourceValue) => {
      if (isTabsSwiping.value) {
        return;
      }

      const groupItems = group.memberTokenIds
        .map(tokenId => tokenEntityResourceStore.getValue(tokenId))
        .filter((token): token is ITokenItem => !!token);

      if (!groupItems.length) {
        handleOpenTokenDetail(group.summary);
        return;
      }
      if (groupItems.length === 1) {
        handleOpenTokenDetail(
          groupItems[0]!,
          getAccountByAddress(groupItems[0]!.owner_addr),
        );
        return;
      }
      handleOpenTokenGroupDetail(groupItems);
    },
    [getAccountByAddress, handleOpenTokenDetail, handleOpenTokenGroupDetail],
  );

  const handleCustomTestnetTokenGroupPress = useCallback(
    (groupItems: ITokenItem[]) => {
      if (isTabsSwiping.value) {
        return;
      }
      if (groupItems.length === 1 && groupItems[0]) {
        handleCustomTestnetTokenPress(groupItems[0]);
        return;
      }
      handleOpenTokenGroupDetail(groupItems, { amountOnly: true });
    },
    [handleCustomTestnetTokenPress, handleOpenTokenGroupDetail],
  );

  const renderCustomTestnetAccount = useCallback(
    (account: KeyringAccountWithAlias, textStyle: TextStyle) => (
      <AccountOverview account={account} logoSize={14} textStyle={textStyle} />
    ),
    [],
  );

  const handleCustomTestnetTokenButtonPress = useCallback(
    (data: CustomTestnetAssetSectionData, onConfirmCB?: () => void) => {
      let modalId: ReturnType<typeof createGlobalBottomSheetModal2024> | null =
        null;
      const closeModal = () => {
        if (!modalId) {
          return;
        }
        removeGlobalBottomSheetModal2024(modalId);
        modalId = null;
      };

      modalId = createGlobalBottomSheetModal2024({
        name: MODAL_NAMES.CUSTOM_TESTNET_ADD_TOKEN,
        chain: data.chain,
        onCancel: closeModal,
        onConfirm: () => {
          closeModal();
          onConfirmCB?.();
        },
      });
    },
    [],
  );

  const handleCustomTestnetTokenRemove = useCallback(
    async (token: ITokenItem, data: CustomTestnetAssetSectionData) => {
      try {
        await apiCustomTestnet.removeCustomTestnetToken({
          chainId: data.chain.id,
          id: token.id,
        });
        toast.success(t('global.Deleted'));
      } catch (error: any) {
        toast.show(
          error?.message || t('page.customTestnet.addToken.removeFailed'),
        );
        throw error;
      }
    },
    [t],
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
    const balanceRefresh = triggerUpdate(true);
    const tokenRefresh = batchGetTokenList(myTop10Addresses, true);

    withAnimatedTickerRefreshNudge(() => balanceRefresh).catch(error => {
      console.error('Refresh balance failed:', error);
    });

    try {
      await tokenRefresh;
    } catch (error) {
      console.error('Refresh failed:', error);
    }
  }, [myTop10Addresses, triggerUpdate]);

  const dataList = useMemo(() => {
    const items: TokenListItem[] = [];
    const hasNoTokenItems =
      tokenRows.length +
        foldRows.length +
        scamRows.length +
        visibleCustomTestnetSections.length ===
        0 && !hasFoldTokens;
    //const hasDefaultTokenSections =
    //tokenRows.length + foldRows.length + scamRows.length > 0;
    const hasFoldSection = hasFoldTokens || isLpTokenEnabled;

    if (isLoading && hasNoTokenItems) {
      items.push(
        ...Array.from({ length: 5 }, (_, index) => ({
          type: 'loading-skeleton' as const,
          data: `index-token-${index.toString()}`,
        })),
      );
      return items;
    }

    if (hasNoAssets) {
      items.push({
        type: 'empty-assets',
        data: t('page.singleHome.sectionHeader.NoData', {
          name: t('page.singleHome.sectionHeader.Token'),
        }),
      });
    }

    tokenRows.forEach((row, index) => {
      items.push({
        type: 'unfold_token',
        row,
        isLast: index === tokenRows.length - 1,
      });
    });

    if (hasFoldSection) {
      items.push({ type: 'toggle_token_fold' });
    }

    if (hasFoldSection && !foldHideList) {
      foldRows.forEach(row => {
        items.push({ type: 'fold_token', row });
      });

      if (scamRows.length > 0) {
        if (foldScam) {
          items.push({
            type: 'scam_header',
            data: {
              total: scamRows.length,
              logoUrls: scamTokenPreviewLogoUrls,
            },
          });
        } else {
          scamRows.forEach(row => {
            items.push({ type: 'fold_token', row });
          });
        }
      }

      appendCustomTestnetItems(items, visibleCustomTestnetSections);
    }

    if (!hasFoldSection) {
      appendCustomTestnetItems(items, visibleCustomTestnetSections);
    }

    return items;
  }, [
    tokenRows,
    foldRows,
    scamRows,
    visibleCustomTestnetSections,
    hasFoldTokens,
    isLpTokenEnabled,
    isLoading,
    hasNoAssets,
    foldHideList,
    t,
    foldScam,
    scamTokenPreviewLogoUrls,
  ]);

  const renderItem = useCallback<ListRenderItem<TokenListItem>>(
    ({ item }) => {
      switch (item.type) {
        case 'unfold_token': {
          return (
            <View
              style={[styles.rowWrap, item.isLast ? styles.lastRowWrap : null]}>
              <TokenResourceRow
                row={item.row}
                tokenDisplayMode={tokenDisplayMode}
                getAccountByAddress={getAccountByAddress}
                onTokenPress={handleTokenPress}
                onGroupPress={handleGroupPress}
                style={styles.renderItemWrapper}
                hideChainLogo={tokenDisplayMode === 'bySymbol'}
              />
            </View>
          );
        }
        case 'fold_token': {
          return (
            <View style={styles.foldRowWrap}>
              <TokenResourceRow
                row={item.row}
                tokenDisplayMode={tokenDisplayMode}
                getAccountByAddress={getAccountByAddress}
                onTokenPress={handleTokenPress}
                onGroupPress={handleGroupPress}
                style={styles.renderItemWrapper}
                hideChainLogo={tokenDisplayMode === 'bySymbol'}
              />
            </View>
          );
        }
        case 'toggle_token_fold':
          return (
            <TokenFoldSectionHeader
              style={styles.tokenSectionHeader}
              fold={foldHideList}
              str={foldTokenUsdValue}
              onPressFold={handleToggleTokenFold}
              isEnabled={isLpTokenEnabled}
              onValueChange={setIsLpTokenEnabled}
            />
          );
        case 'custom_testnet_assets':
          return (
            <CustomTestnetAssetSection
              style={styles.customTestnetSection}
              data={item.data}
              tokenButtonLabel={t('page.singleHome.sectionHeader.Token')}
              loadTokens={loadCustomTestnetTokens}
              loadToken={loadCustomTestnetToken}
              getAccountByAddress={getAccountByAddress}
              tokenDisplayMode={tokenDisplayMode}
              renderAccount={renderCustomTestnetAccount}
              onTokenPress={handleCustomTestnetTokenPress}
              onTokenGroupPress={handleCustomTestnetTokenGroupPress}
              onTokenButtonPress={handleCustomTestnetTokenButtonPress}
              onTokenRemove={handleCustomTestnetTokenRemove}
              collapseKey={customTestnetCollapseKey}
            />
          );
        case 'custom_testnet_divider':
          return <CustomTestnetAssetDivider />;
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
        case 'loading-skeleton':
          return <MemoizedItemLoader style={styles.loadingItem} />;
        default:
          return null;
      }
    },
    [
      tokenDisplayMode,
      customTestnetCollapseKey,
      foldHideList,
      foldTokenUsdValue,
      getAccountByAddress,
      handleGroupPress,
      handleCustomTestnetTokenPress,
      handleCustomTestnetTokenButtonPress,
      handleCustomTestnetTokenRemove,
      handleOpenScamToken,
      handleCustomTestnetTokenGroupPress,
      renderCustomTestnetAccount,
      handleTokenPress,
      handleToggleTokenFold,
      isLpTokenEnabled,
      loadCustomTestnetToken,
      loadCustomTestnetTokens,
      styles,
      t,
    ],
  );

  const keyExtractor = useCallback((item: TokenListItem) => {
    if (item.type === 'unfold_token' || item.type === 'fold_token') {
      return `${item.type}-${getTokenAssetsIndexRowKey(item.row)}`;
    }
    if (item.type === 'scam_header') {
      return `scam-header-${item.data.total}`;
    }
    if (item.type === 'custom_testnet_assets') {
      return `custom-testnet-assets-${item.data.chain.id}`;
    }
    if (item.type === 'custom_testnet_divider') {
      return 'custom-testnet-divider';
    }
    if (item.type === 'empty-assets') {
      return `empty-assets-${item.data}`;
    }
    if (item.type === 'loading-skeleton') {
      return `loading-skeleton-${item.data}`;
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
    marginBottom: 8,
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
  customTestnetSection: {
    marginBottom: 8,
  },
  renderItemWrapper: {
    height: ASSETS_ITEM_HEIGHT_NEW,
  },
}));
