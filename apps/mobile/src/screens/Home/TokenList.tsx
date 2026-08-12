import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ListRenderItem, StyleSheet, View, ViewStyle } from 'react-native';
import { RefreshControl } from 'react-native-gesture-handler';
import { useTranslation } from 'react-i18next';
import {
  Tabs,
  useCurrentTabScrollY,
  useFocusedTab,
} from 'react-native-collapsible-tab-view';
import { useIsFocused } from '@react-navigation/native';
import { runOnJS, useAnimatedReaction } from 'react-native-reanimated';
import { useShallow } from 'zustand/shallow';

import { navigateDeprecated } from '@/utils/navigation';
import { createGetStyles2024 } from '@/utils/styles';
import {
  ASSETS_ITEM_HEIGHT_NEW,
  ASSETS_SECTION_HEADER,
  RootNames,
} from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';
import { EmptyTokenRow } from './components/AssetRenderItems/EmptyToken';
import { EmptyAssets } from './components/AssetRenderItems/EmptyAssets';
import { ItemLoader } from './components/Skeleton';
import { ScamTokenHeader } from './components/AssetRenderItems/ScamTokenHeader';
import {
  TokenRowSectionLpTokenHeader,
  TokenRowV2,
} from './components/AssetRenderItems';
import {
  useSingleHomeAccount,
  useSingleHomeChain,
  useSingleHomeSelectData,
} from './hooks/singleHome';
import useTokenList, {
  EMPTY_TOKEN_ASSETS_INDEX_RESULT,
  EMPTY_TOKEN_ENTITY_IDS,
  getSingleAssetsCacheKey,
  ITokenItem,
  TokenEntityId,
  useTokenAssetsIndexStore,
  useTokenEntity,
  useTokenIndexStore,
} from '@/store/tokens';
import { formatNetworth } from '@/utils/math';
import { useAppForeground } from '@/hooks/useAppForeground';
import { withAnimatedTickerRefreshNudge } from '@/components/Animated/RefreshNudgedTickerText';
import { CustomTestnetAssetSection } from '@/screens/Address/components/MultiAssets/CustomTestnetAssets/CustomTestnetAssetSection';
import { CustomTestnetAssetDivider } from '@/screens/Address/components/MultiAssets/CustomTestnetAssets/CustomTestnetAssetDivider';
import { useSingleAddressCustomTestnetAssetSections } from '@/screens/Address/components/MultiAssets/CustomTestnetAssets/useCustomTestnetAssetSections';
import type { CustomTestnetAssetSectionData } from '@/screens/Address/components/MultiAssets/CustomTestnetAssets/types';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import { apiCustomTestnet } from '@/core/apis';
import { toast } from '@/components2024/Toast';
import { isWatchOrSafeAccount } from '@/utils/account';

type TokenListItem =
  | {
      type: 'unfold_token' | 'fold_token';
      tokenId: TokenEntityId;
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
      type: 'scam_token';
      data: {
        total: number;
        logoUrls: string[];
      };
    }
  | {
      type: 'empty-token';
    }
  | {
      type: 'empty-assets';
      data: string;
    }
  | {
      type: 'loading-skeleton';
      data: string;
    };

const TokenResourceRow = React.memo(
  ({
    tokenId,
    tokenStyle,
    loaderStyle,
    onTokenPress,
  }: {
    tokenId: TokenEntityId;
    tokenStyle?: ViewStyle;
    loaderStyle?: ViewStyle;
    onTokenPress(token: ITokenItem): void;
  }) => {
    const token = useTokenEntity(tokenId);

    if (!token) {
      return <ItemLoader style={loaderStyle} />;
    }

    return (
      <TokenRowV2
        data={token}
        style={tokenStyle}
        onTokenPress={onTokenPress}
        //logoSize={46}
        //chainLogoSize={18}
        scene="portfolio"
      />
    );
  },
);

const TokenFoldSectionHeader = React.memo(
  ({
    isEnabled,
    onValueChange,
    fold,
    str,
    style,
    buttonStyle,
    onPressFold,
  }: {
    isEnabled: boolean;
    onValueChange: (value: boolean) => void;
    fold: boolean;
    str: string;
    style: ViewStyle;
    buttonStyle: ViewStyle;
    onPressFold: () => void;
  }) => {
    return (
      <TokenRowSectionLpTokenHeader
        isEnabled={isEnabled}
        onValueChange={onValueChange}
        fold={fold}
        style={style}
        buttonStyle={buttonStyle}
        str={str}
        onPressFold={onPressFold}
      />
    );
  },
);

interface Props {
  noAssetsOnAnyChain: boolean;
  onForeground?: () => void;
  onRefresh?: () => void | Promise<void>;
}
const FOOTER_HEIGHT = 220;
const SPACING_HEIGHT = 8;
const TOKEN_LOADING_SKELETON_COUNT = 5;
const EMPTY_CUSTOM_TESTNET_SECTIONS: CustomTestnetAssetSectionData[] = [];

type BuildTokenListItemsParams = {
  unFoldTokenIds: TokenEntityId[];
  foldTokenIds: TokenEntityId[];
  scamTokenIds: TokenEntityId[];
  scamTokenPreviewLogoUrls: string[];
  foldHideList: boolean;
  foldScam: boolean;
  hasFoldTokens: boolean;
  isLpTokenEnabled: boolean;
  isLoading: boolean;
  isAllLoading: boolean;
  noAnyAssets: boolean;
  emptyAssetsText: string;
  visibleCustomTestnetSections: CustomTestnetAssetSectionData[];
};

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

const appendTokenItems = (
  items: TokenListItem[],
  tokenIds: TokenEntityId[],
  type: 'unfold_token' | 'fold_token',
) => {
  tokenIds.forEach(tokenId => {
    items.push({ type, tokenId });
  });
};

const appendScamTokenItems = (
  items: TokenListItem[],
  {
    scamTokenIds,
    scamTokenPreviewLogoUrls,
    foldScam,
  }: Pick<
    BuildTokenListItemsParams,
    'scamTokenIds' | 'scamTokenPreviewLogoUrls' | 'foldScam'
  >,
) => {
  if (scamTokenIds.length === 0) {
    return;
  }

  if (foldScam) {
    items.push({
      type: 'scam_token',
      data: {
        total: scamTokenIds.length,
        logoUrls: scamTokenPreviewLogoUrls,
      },
    });
    return;
  }

  appendTokenItems(items, scamTokenIds, 'fold_token');
};

const appendFoldSectionItems = (
  items: TokenListItem[],
  params: BuildTokenListItemsParams,
) => {
  if (!params.hasFoldTokens && !params.isLpTokenEnabled) {
    return;
  }

  items.push({ type: 'toggle_token_fold' });

  if (params.foldHideList) {
    return;
  }

  appendTokenItems(items, params.foldTokenIds, 'fold_token');
  appendScamTokenItems(items, params);
  appendCustomTestnetItems(items, params.visibleCustomTestnetSections);
};

const appendLoadingSkeletonItems = (
  items: TokenListItem[],
  params: BuildTokenListItemsParams,
) => {
  /**
   * 两类 loading：
   * 1. 初始加载无token时需要展示loading
   * 2. lpToken筛选打开时，并且当前无lpTokens数据时展示loading
   */
  const shouldShowInitialLoading =
    params.isLoading &&
    items.length === 0 &&
    params.visibleCustomTestnetSections.length === 0;

  const shouldShowLpLoading =
    params.isAllLoading &&
    params.isLpTokenEnabled &&
    params.foldTokenIds.length === 0;

  if (!shouldShowInitialLoading && !shouldShowLpLoading) {
    return;
  }

  items.push(
    ...Array.from({ length: TOKEN_LOADING_SKELETON_COUNT }, (_, index) => ({
      type: 'loading-skeleton' as const,
      data: `index-token-${index.toString()}`,
    })),
  );
};

const appendEmptyAssetsItem = (
  items: TokenListItem[],
  params: BuildTokenListItemsParams,
) => {
  const hasNoTokenItems =
    params.unFoldTokenIds.length +
      params.foldTokenIds.length +
      params.scamTokenIds.length ===
      0 && !params.hasFoldTokens;

  if (
    params.isLoading ||
    !hasNoTokenItems ||
    (items.length !== 0 && params.visibleCustomTestnetSections.length === 0)
  ) {
    return;
  }

  if (params.noAnyAssets) {
    // Keep this branch explicit because the old empty-state logic distinguished
    // all-asset emptiness even though both branches currently render the same row.
    items.push({
      type: 'empty-assets',
      data: params.emptyAssetsText,
    });
    return;
  }

  items.push({
    type: 'empty-assets',
    data: params.emptyAssetsText,
  });
};

const buildTokenListItems = (params: BuildTokenListItemsParams) => {
  const items: TokenListItem[] = [];

  appendTokenItems(items, params.unFoldTokenIds, 'unfold_token');
  appendFoldSectionItems(items, params);
  appendLoadingSkeletonItems(items, params);
  appendEmptyAssetsItem(items, params);

  if (!params.hasFoldTokens) {
    appendCustomTestnetItems(items, params.visibleCustomTestnetSections);
  }

  return items;
};

const getTokenListItemKey = (item: TokenListItem) => {
  if (item.type === 'unfold_token' || item.type === 'fold_token') {
    return `${item.type}-${item.tokenId}`;
  }
  if (item.type === 'scam_token') {
    return `scam-token-${item.data.total}`;
  }
  if (item.type === 'custom_testnet_assets') {
    return `custom-testnet-assets-${item.data.chain.id}`;
  }
  if (item.type === 'custom_testnet_divider') {
    return 'custom-testnet-divider';
  }
  if (item.type === 'loading-skeleton') {
    return `loading-${item.data}`;
  }
  if (item.type === 'empty-assets') {
    return `empty-assets-${item.data}`;
  }
  return item.type;
};

export const TokenList = ({
  noAssetsOnAnyChain,
  onForeground,
  onRefresh,
}: Props) => {
  const { styles, isLight } = useTheme2024({
    getStyle: getStyles,
  });
  const { t } = useTranslation();
  const { currentAccount } = useSingleHomeAccount();
  const { selectedChain } = useSingleHomeChain();

  const [foldHideList, setFoldHideList] = useState(true);
  const [foldScam, setFoldScam] = useState(true);
  const [isLpTokenEnabled, setIsLpTokenEnabled] = useState(false);
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);
  const [customTestnetCollapseKey, setCustomTestnetCollapseKey] = useState(0);
  const [hasRequestedTokenList, setHasRequestedTokenList] = useState(false);
  const customTestnetAddTokenModalIdRef = useRef<ReturnType<
    typeof createGlobalBottomSheetModal2024
  > | null>(null);
  const isScreenFocused = useIsFocused();

  const focusedTab = useFocusedTab();
  const isFocused = useMemo(() => {
    return focusedTab === 'tokens';
  }, [focusedTab]);

  const closeCustomTestnetAddTokenModal = useCallback(() => {
    const modalId = customTestnetAddTokenModalIdRef.current;
    if (!modalId) {
      return;
    }
    removeGlobalBottomSheetModal2024(modalId);
    customTestnetAddTokenModalIdRef.current = null;
  }, []);

  useEffect(() => {
    if (!isScreenFocused || !isFocused) {
      closeCustomTestnetAddTokenModal();
    }
  }, [closeCustomTestnetAddTokenModal, isFocused, isScreenFocused]);

  useEffect(() => {
    return closeCustomTestnetAddTokenModal;
  }, [closeCustomTestnetAddTokenModal]);

  useEffect(() => {
    if (!isScreenFocused) {
      setCustomTestnetCollapseKey(key => key + 1);
    }
  }, [isScreenFocused]);

  const currentAddress = currentAccount?.address;
  const lowerAddress = currentAddress?.toLowerCase();
  useEffect(() => {
    setHasRequestedTokenList(false);
  }, [lowerAddress]);

  const {
    sections: customTestnetSections,
    loadTokens: loadCustomTestnetTokens,
    loadToken: loadCustomTestnetToken,
  } = useSingleAddressCustomTestnetAssetSections(currentAddress);
  const shouldShowCustomTestnetSections =
    !!currentAccount &&
    !isWatchOrSafeAccount(currentAccount) &&
    !selectedChain &&
    !isLpTokenEnabled;

  useEffect(() => {
    if (!currentAddress) {
      return;
    }
    useTokenIndexStore
      .getState()
      .syncFromTokenListMap(useTokenList.getState().tokenListMap, [
        currentAddress,
      ]);
  }, [currentAddress]);

  const tokenIds = useTokenIndexStore(
    useShallow(state => {
      if (!lowerAddress) {
        return EMPTY_TOKEN_ENTITY_IDS;
      }
      return state.addressTokenIds[lowerAddress] || EMPTY_TOKEN_ENTITY_IDS;
    }),
  );
  const singleAssetsKey = useMemo(() => {
    if (!lowerAddress) {
      return null;
    }
    return getSingleAssetsCacheKey(
      lowerAddress,
      selectedChain,
      isLpTokenEnabled,
    );
  }, [isLpTokenEnabled, lowerAddress, selectedChain]);

  useLayoutEffect(() => {
    if (!singleAssetsKey) {
      return;
    }
    useTokenAssetsIndexStore.getState().syncSingleAssetsResult({
      key: singleAssetsKey,
      tokenIds,
      chainServerId: selectedChain,
      isLpTokenEnabled,
    });
  }, [isLpTokenEnabled, selectedChain, singleAssetsKey, tokenIds]);

  const {
    unFoldTokenIds,
    foldTokenIds,
    scamTokenIds,
    scamTokenPreviewLogoUrls,
    foldCoreUsdValue,
    hasFoldTokens,
  } = useTokenAssetsIndexStore(
    useShallow(
      state =>
        (singleAssetsKey
          ? state.singleAssetsResultByKey[singleAssetsKey]
          : undefined) || EMPTY_TOKEN_ASSETS_INDEX_RESULT,
    ),
  );
  const foldTokenUsdValue = useMemo(
    () => formatNetworth(foldCoreUsdValue),
    [foldCoreUsdValue],
  );

  const { isLoading, isAllLoading } = useTokenList(
    useShallow(state => {
      if (!lowerAddress) {
        return {
          isLoading: false,
          isAllLoading: false,
        };
      }
      const loadingState = state.isLoadingByAddress[lowerAddress];
      return {
        isLoading: !!loadingState?.loading,
        isAllLoading: !!loadingState?.allLoading,
      };
    }),
  );
  const hasDefaultTokenData =
    unFoldTokenIds.length + foldTokenIds.length + scamTokenIds.length > 0;
  const shouldHideCustomTestnetSectionsWhileLoading =
    (isLoading || isAllLoading) && !hasDefaultTokenData;
  const visibleCustomTestnetSections =
    shouldShowCustomTestnetSections &&
    hasRequestedTokenList &&
    !shouldHideCustomTestnetSectionsWhileLoading
      ? customTestnetSections
      : EMPTY_CUSTOM_TESTNET_SECTIONS;
  const getTokenList = useTokenList(s => s.getTokenList);

  const refreshTokenList = useCallback(() => {
    if (!currentAddress) {
      return;
    }
    setHasRequestedTokenList(true);
    getTokenList(currentAddress);
  }, [currentAddress, getTokenList]);

  useEffect(() => {
    if (!isFocused) {
      return;
    }
    refreshTokenList();
  }, [isFocused, refreshTokenList]);

  useAppForeground({
    enabled: isFocused,
    onForeground: () => {
      if (isLoading || isAllLoading || !isFocused || !currentAddress) {
        return;
      }
      onForeground?.();
      refreshTokenList();
    },
  });

  const { selectData } = useSingleHomeSelectData();
  const noAnyAssets = !selectData.rawNetWorth || noAssetsOnAnyChain;
  const emptyAssetsText = useMemo(
    () =>
      t('page.singleHome.sectionHeader.NoData', {
        name: t('page.singleHome.sectionHeader.Token'),
      }),
    [t],
  );

  const dataList = useMemo(() => {
    return buildTokenListItems({
      unFoldTokenIds,
      foldTokenIds,
      scamTokenIds,
      scamTokenPreviewLogoUrls,
      foldHideList,
      foldScam,
      hasFoldTokens,
      isLpTokenEnabled,
      isLoading,
      isAllLoading,
      noAnyAssets,
      emptyAssetsText,
      visibleCustomTestnetSections,
    });
  }, [
    emptyAssetsText,
    foldHideList,
    foldScam,
    foldTokenIds,
    hasFoldTokens,
    isAllLoading,
    isLoading,
    isLpTokenEnabled,
    noAnyAssets,
    scamTokenIds,
    scamTokenPreviewLogoUrls,
    unFoldTokenIds,
    visibleCustomTestnetSections,
  ]);

  const [showScrollIndicator, setShowScrollIndicator] = useState(false);

  const tokenRowStyle = useMemo(
    () =>
      StyleSheet.flatten([styles.renderItemWrapper, !isLight && styles.bg2]),
    [isLight, styles.bg2, styles.renderItemWrapper],
  );
  const foldHeaderButtonStyle = useMemo(
    () => StyleSheet.flatten([styles.buttonHeader, !isLight && styles.bg2]),
    [isLight, styles.bg2, styles.buttonHeader],
  );

  const handleOpenTokenDetail = useCallback(
    (token: ITokenItem) => {
      navigateDeprecated(RootNames.TokenDetail, {
        token,
        isSingleAddress: true,
        account: currentAccount as any,
      });
    },
    [currentAccount],
  );

  const handleOpenCustomTestnetTokenDetail = useCallback(
    (token: ITokenItem) => {
      navigateDeprecated(RootNames.TokenDetail, {
        token,
        isSingleAddress: true,
        account: currentAccount as any,
        isCustomTestnetToken: true,
      });
    },
    [currentAccount],
  );

  const getCustomTestnetAccountByAddress = useCallback(() => undefined, []);

  const handleCustomTestnetTokenButtonPress = useCallback(
    (data: CustomTestnetAssetSectionData, onConfirmCB?: () => void) => {
      const closeModal = () => {
        closeCustomTestnetAddTokenModal();
      };

      closeCustomTestnetAddTokenModal();
      customTestnetAddTokenModalIdRef.current =
        createGlobalBottomSheetModal2024({
          name: MODAL_NAMES.CUSTOM_TESTNET_ADD_TOKEN,
          chain: data.chain,
          onCancel: closeModal,
          onConfirm: () => {
            closeModal();
            onConfirmCB?.();
          },
        });
    },
    [closeCustomTestnetAddTokenModal],
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

  const handleToggleTokenFold = useCallback(() => {
    if (!foldHideList) {
      setFoldScam(true);
      setIsLpTokenEnabled(false);
    }
    setFoldHideList(pre => !pre);
  }, [foldHideList]);

  const handleRefresh = useCallback(async () => {
    if (!currentAddress) {
      return;
    }
    setIsManualRefreshing(true);
    try {
      const balanceRefresh = Promise.resolve().then(() => onRefresh?.());
      const tokenRefresh = getTokenList(currentAddress, true);
      withAnimatedTickerRefreshNudge(() => balanceRefresh).catch(error => {
        console.error('Refresh balance failed:', error);
      });
      await tokenRefresh;
    } finally {
      setIsManualRefreshing(false);
    }
  }, [currentAddress, getTokenList, onRefresh]);

  const renderTokenItem = useCallback(
    (item: Extract<TokenListItem, { type: 'unfold_token' | 'fold_token' }>) => (
      <View style={styles.rowWrap}>
        <TokenResourceRow
          tokenId={item.tokenId}
          tokenStyle={tokenRowStyle}
          loaderStyle={styles.removeLeft}
          onTokenPress={handleOpenTokenDetail}
        />
      </View>
    ),
    [handleOpenTokenDetail, styles.removeLeft, styles.rowWrap, tokenRowStyle],
  );

  const renderScamTokenItem = useCallback(
    (item: Extract<TokenListItem, { type: 'scam_token' }>) => (
      <View style={styles.rowWrap}>
        <ScamTokenHeader
          total={item.data.total}
          logoUrls={item.data.logoUrls}
          style={tokenRowStyle}
          onPress={() => {
            setFoldScam(false);
          }}
        />
      </View>
    ),
    [styles.rowWrap, tokenRowStyle],
  );

  const renderFoldHeaderItem = useCallback(
    () => (
      <TokenFoldSectionHeader
        isEnabled={isLpTokenEnabled}
        onValueChange={setIsLpTokenEnabled}
        fold={foldHideList}
        str={foldTokenUsdValue}
        style={styles.sectionHeader}
        buttonStyle={foldHeaderButtonStyle}
        onPressFold={handleToggleTokenFold}
      />
    ),
    [
      foldHeaderButtonStyle,
      foldHideList,
      foldTokenUsdValue,
      handleToggleTokenFold,
      isLpTokenEnabled,
      styles.sectionHeader,
    ],
  );

  const renderCustomTestnetSectionItem = useCallback(
    (item: Extract<TokenListItem, { type: 'custom_testnet_assets' }>) => (
      <View style={styles.customTestnetSectionWrap}>
        <CustomTestnetAssetSection
          data={item.data}
          tokenButtonLabel={t('page.singleHome.sectionHeader.Token')}
          loadTokens={loadCustomTestnetTokens}
          loadToken={loadCustomTestnetToken}
          getAccountByAddress={getCustomTestnetAccountByAddress}
          tokenDisplayMode="byAsset"
          hideAccount
          onTokenPress={handleOpenCustomTestnetTokenDetail}
          onTokenButtonPress={handleCustomTestnetTokenButtonPress}
          onTokenRemove={handleCustomTestnetTokenRemove}
          collapseKey={customTestnetCollapseKey}
        />
      </View>
    ),
    [
      customTestnetCollapseKey,
      getCustomTestnetAccountByAddress,
      handleCustomTestnetTokenButtonPress,
      handleCustomTestnetTokenRemove,
      handleOpenCustomTestnetTokenDetail,
      loadCustomTestnetToken,
      loadCustomTestnetTokens,
      styles.customTestnetSectionWrap,
      t,
    ],
  );

  const renderEmptyItem = useCallback(
    (
      item: Extract<TokenListItem, { type: 'empty-token' | 'empty-assets' }>,
    ) => {
      if (item.type === 'empty-token') {
        return (
          <EmptyTokenRow
            currentAccount={currentAccount}
            // onReceive={handleOnReceive}
          />
        );
      }

      return (
        <EmptyAssets
          style={styles.emptyAssets}
          desc={item.data ?? undefined}
          type={item.type}
        />
      );
    },
    [currentAccount, styles.emptyAssets],
  );

  const renderItem = useCallback<ListRenderItem<TokenListItem>>(
    ({ item }) => {
      switch (item.type) {
        case 'unfold_token':
        case 'fold_token':
          return renderTokenItem(item);
        case 'scam_token':
          return renderScamTokenItem(item);
        case 'toggle_token_fold':
          return renderFoldHeaderItem();
        case 'custom_testnet_assets':
          return renderCustomTestnetSectionItem(item);
        case 'custom_testnet_divider':
          return (
            <CustomTestnetAssetDivider
              style={styles.singleCustomTestnetDivider}
            />
          );
        case 'empty-token':
        case 'empty-assets':
          return renderEmptyItem(item);
        case 'loading-skeleton':
          return (
            <View style={styles.rowWrap}>
              <ItemLoader style={styles.removeLeft} />
            </View>
          );
        default:
          return null;
      }
    },
    [
      renderCustomTestnetSectionItem,
      renderEmptyItem,
      renderFoldHeaderItem,
      renderScamTokenItem,
      renderTokenItem,
      styles.removeLeft,
      styles.rowWrap,
      styles.singleCustomTestnetDivider,
    ],
  );

  const keyExtractor = useCallback(getTokenListItemKey, []);
  const listExtraData = useMemo(
    () => ({
      foldHideList,
      foldScam,
      foldTokenIds,
      isLpTokenEnabled,
      scamTokenIds,
    }),
    [foldHideList, foldScam, foldTokenIds, isLpTokenEnabled, scamTokenIds],
  );

  const ListRenderSeparator = useCallback(() => {
    return <View style={{ height: SPACING_HEIGHT }} />;
  }, []);

  const ListRenderFooter = useCallback(() => {
    return <View style={{ height: FOOTER_HEIGHT }} />;
  }, []);

  const scrollY = useCurrentTabScrollY();
  const handleScrollIndicatorChange = useCallback(
    (showIndicator: boolean) => setShowScrollIndicator(showIndicator),
    [],
  );

  useAnimatedReaction(
    () => scrollY.value >= 89,
    (showIndicator, previousShowIndicator) => {
      if (showIndicator === previousShowIndicator) {
        return;
      }
      runOnJS(handleScrollIndicatorChange)(showIndicator);
    },
  );

  return (
    <View style={styles.container}>
      <Tabs.FlatList
        data={dataList}
        extraData={listExtraData}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ItemSeparatorComponent={ListRenderSeparator}
        ListFooterComponent={ListRenderFooter}
        showsVerticalScrollIndicator={showScrollIndicator}
        showsHorizontalScrollIndicator={false}
        style={[styles.bgContainer, styles.list]}
        refreshControl={
          <RefreshControl
            style={styles.bgContainer}
            onRefresh={handleRefresh}
            refreshing={isScreenFocused && isManualRefreshing}
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
  bgContainer: {
    // backgroundColor: ctx.colors2024['neutral-bg-1'],
  },
  rowWrap: {
    paddingHorizontal: 12,
  },
  removeLeft: {
    marginLeft: 0,
  },
  renderItemWrapper: {
    backgroundColor: ctx.colors2024['neutral-bg-1'],
    borderRadius: 14,
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
  customTestnetSectionWrap: {
    paddingHorizontal: 12,
  },
  singleCustomTestnetDivider: {
    marginBottom: 9,
    paddingHorizontal: 32.5,
  },
  emptyAssets: {
    //backgroundColor: 'transparent',
    //height: '100%',
    //marginTop: -100,
  },
}));
