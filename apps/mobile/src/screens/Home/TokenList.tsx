import React, {
  useCallback,
  useEffect,
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
  getSingleAssetsCacheKey,
  ITokenItem,
  prepareSingleAddressTokenAssetsProjection,
  TokenEntityId,
  tokenEntityResourceStore,
  useTokenAssetsIndexStore,
} from '@/store/tokens';
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
import { useActivityStore } from '@/hooks/storeActivity/useActivityStore';
import {
  useRegressionScenario,
  useRegressionScenarioAssertion,
} from '@/devtools/regressionScenarios/react';
import { IS_ANDROID } from '@/core/native/utils';
import { formatNetworth } from '@/utils/math';

type TokenRowListItem = {
  type: 'default-token' | 'additional-token' | 'low-value-token';
  tokenId: TokenEntityId;
};

type TokenListItem =
  | TokenRowListItem
  | {
      type: 'additional_token_toggle';
    }
  | {
      type: 'low_value_tokens';
      data: {
        total: number;
        logoUrls: string[];
      };
    }
  | {
      type: 'custom_testnet_assets';
      data: CustomTestnetAssetSectionData;
    }
  | {
      type: 'custom_testnet_divider';
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
    const token = useActivityStore(
      tokenEntityResourceStore.useStore,
      state => state.valueMap[tokenId],
      Object.is,
      { storeLabel: 'single-address-token-entities' },
    );

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

interface Props {
  noAssetsOnAnyChain: boolean;
  onForeground?: () => void;
  onRefresh?: () => void | Promise<void>;
}
const FOOTER_HEIGHT = 220;
const SPACING_HEIGHT = 8;
const TOKEN_LOADING_SKELETON_COUNT = 5;
const TOKEN_LIST_INITIAL_RENDER_COUNT = 8;
const TOKEN_LIST_RENDER_BATCH_SIZE = 6;
const TOKEN_LIST_WINDOW_SIZE = 7;
const TOKEN_LIST_BATCHING_PERIOD_MS = 32;
const EMPTY_CUSTOM_TESTNET_SECTIONS: CustomTestnetAssetSectionData[] = [];

type BuildTokenListItemsParams = {
  tokenIds: TokenEntityId[];
  defaultVisibleTokenCount: number;
  additionalTokenCount: number;
  lowValueTokenCount: number;
  lowValueTokenPreviewLogoUrls: string[];
  hasAdditionalTokens: boolean;
  hasLpTokens: boolean;
  isLpTokenEnabled: boolean;
  showAllTokens: boolean;
  showLowValueTokens: boolean;
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
  type: TokenRowListItem['type'],
) => {
  tokenIds.forEach(tokenId => {
    items.push({ type, tokenId });
  });
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
    params.tokenIds.length === params.defaultVisibleTokenCount;

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
  const hasNoTokenItems = params.tokenIds.length === 0 && !params.hasLpTokens;

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
  const hasAdditionalSection =
    params.hasAdditionalTokens || params.isLpTokenEnabled;
  const additionalEnd =
    params.defaultVisibleTokenCount + params.additionalTokenCount;
  const defaultTokenIds = params.tokenIds.slice(
    0,
    params.defaultVisibleTokenCount,
  );
  const additionalTokenIds = params.tokenIds.slice(
    params.defaultVisibleTokenCount,
    additionalEnd,
  );
  const lowValueTokenIds = params.tokenIds.slice(additionalEnd);

  appendTokenItems(items, defaultTokenIds, 'default-token');
  if (hasAdditionalSection) {
    items.push({ type: 'additional_token_toggle' });
  }
  if (hasAdditionalSection && params.showAllTokens) {
    appendTokenItems(items, additionalTokenIds, 'additional-token');
    if (params.lowValueTokenCount > 0) {
      if (params.showLowValueTokens) {
        appendTokenItems(items, lowValueTokenIds, 'low-value-token');
      } else {
        items.push({
          type: 'low_value_tokens',
          data: {
            total: params.lowValueTokenCount,
            logoUrls: params.lowValueTokenPreviewLogoUrls,
          },
        });
      }
    }
    appendCustomTestnetItems(items, params.visibleCustomTestnetSections);
  }
  appendLoadingSkeletonItems(items, params);
  appendEmptyAssetsItem(items, params);
  if (!hasAdditionalSection) {
    appendCustomTestnetItems(items, params.visibleCustomTestnetSections);
  }

  return items;
};

const getTokenListItemKey = (item: TokenListItem) => {
  if (
    item.type === 'default-token' ||
    item.type === 'additional-token' ||
    item.type === 'low-value-token'
  ) {
    return `token-${item.tokenId}`;
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
  if (item.type === 'low_value_tokens') {
    return `low-value-tokens-${item.data.total}`;
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

  const [showAllTokens, setShowAllTokens] = useState(false);
  const [showLowValueTokens, setShowLowValueTokens] = useState(false);
  const [isLpTokenEnabled, setIsLpTokenEnabled] = useState(false);
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);
  const [customTestnetCollapseKey, setCustomTestnetCollapseKey] = useState(0);
  const [hasRequestedTokenList, setHasRequestedTokenList] = useState(false);
  const [isTokenListRequestSettled, setIsTokenListRequestSettled] =
    useState(false);
  const tokenListRequestIdRef = useRef(0);
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
    tokenListRequestIdRef.current += 1;
    setHasRequestedTokenList(false);
    setIsTokenListRequestSettled(false);
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

  const isTokenProjectionReady = useActivityStore(
    useTokenAssetsIndexStore,
    state =>
      !!singleAssetsKey &&
      !!state.singleAssetsConfigByKey[singleAssetsKey] &&
      !!state.singleAssetsResultByKey[singleAssetsKey],
    Object.is,
    { storeLabel: 'single-address-token-assets-index-readiness' },
  );

  const {
    tokenIds,
    defaultVisibleTokenCount,
    additionalTokenCount,
    lowValueTokenCount,
    additionalCoreUsdValue,
    lowValueTokenPreviewLogoUrls,
    hasAdditionalTokens,
    hasLpTokens,
  } = useActivityStore(
    useTokenAssetsIndexStore,
    useShallow(
      state =>
        (singleAssetsKey
          ? state.singleAssetsResultByKey[singleAssetsKey]
          : undefined) || EMPTY_TOKEN_ASSETS_INDEX_RESULT,
    ),
    Object.is,
    { storeLabel: 'single-address-token-assets-index' },
  );
  const additionalTokenUsdValue = useMemo(
    () => formatNetworth(additionalCoreUsdValue),
    [additionalCoreUsdValue],
  );
  const { isLoading, isAllLoading } = useActivityStore(
    useTokenList,
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
    Object.is,
    { storeLabel: 'single-address-token-list' },
  );
  const hasDefaultTokenData = tokenIds.length > 0 || hasLpTokens;
  const isTokenProjectionLoading = !!singleAssetsKey && !isTokenProjectionReady;
  const shouldHideCustomTestnetSectionsWhileLoading =
    (isLoading || isAllLoading || isTokenProjectionLoading) &&
    !hasDefaultTokenData;
  const visibleCustomTestnetSections =
    shouldShowCustomTestnetSections &&
    hasRequestedTokenList &&
    !shouldHideCustomTestnetSectionsWhileLoading
      ? customTestnetSections
      : EMPTY_CUSTOM_TESTNET_SECTIONS;
  const hasVisibleTokenContent =
    hasDefaultTokenData || visibleCustomTestnetSections.length > 0;
  const isTokenContentReady =
    isTokenProjectionReady &&
    (hasVisibleTokenContent ||
      (hasRequestedTokenList &&
        isTokenListRequestSettled &&
        !isLoading &&
        !isAllLoading));
  const getTokenList = useTokenList.getState().getTokenList;

  const refreshTokenList = useCallback(() => {
    if (!currentAddress) {
      return;
    }
    const requestId = tokenListRequestIdRef.current + 1;
    tokenListRequestIdRef.current = requestId;
    setHasRequestedTokenList(true);
    setIsTokenListRequestSettled(false);
    void getTokenList(currentAddress).then(
      () => {
        if (tokenListRequestIdRef.current === requestId) {
          setIsTokenListRequestSettled(true);
        }
      },
      () => {
        if (tokenListRequestIdRef.current === requestId) {
          setIsTokenListRequestSettled(true);
        }
      },
    );
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
      tokenIds,
      defaultVisibleTokenCount,
      additionalTokenCount,
      lowValueTokenCount,
      lowValueTokenPreviewLogoUrls,
      hasAdditionalTokens,
      hasLpTokens,
      isLpTokenEnabled,
      showAllTokens,
      showLowValueTokens,
      isLoading: isLoading || isTokenProjectionLoading,
      isAllLoading,
      noAnyAssets,
      emptyAssetsText,
      visibleCustomTestnetSections,
    });
  }, [
    emptyAssetsText,
    additionalTokenCount,
    defaultVisibleTokenCount,
    hasAdditionalTokens,
    hasLpTokens,
    isAllLoading,
    isLoading,
    isLpTokenEnabled,
    lowValueTokenCount,
    lowValueTokenPreviewLogoUrls,
    isTokenProjectionLoading,
    noAnyAssets,
    showAllTokens,
    showLowValueTokens,
    tokenIds,
    visibleCustomTestnetSections,
  ]);

  const regressionScenario = useRegressionScenario<'SingleAddressHome'>();
  const regressionRunId = regressionScenario.active
    ? regressionScenario.runId
    : null;
  const isSingleAddressRegression =
    regressionScenario.active &&
    regressionScenario.scenario === 'single-address';
  const [readyRegressionRunId, setReadyRegressionRunId] = useState<
    string | null
  >(null);
  useEffect(() => {
    if (!isSingleAddressRegression || !isFocused || !isTokenContentReady) {
      setReadyRegressionRunId(null);
      return;
    }

    const timer = setTimeout(() => {
      setReadyRegressionRunId(regressionRunId);
    }, 350);
    return () => clearTimeout(timer);
  }, [
    isFocused,
    isSingleAddressRegression,
    isTokenContentReady,
    regressionRunId,
    tokenIds.length,
  ]);
  useRegressionScenarioAssertion(
    'single-address-tokens-ready',
    isSingleAddressRegression &&
      readyRegressionRunId === regressionRunId &&
      isFocused &&
      isTokenContentReady
      ? {
          backgroundRefreshing: isLoading || isAllLoading,
          requestSettled: isTokenListRequestSettled,
          tokenCount: tokenIds.length,
        }
      : null,
  );

  const [showScrollIndicator, setShowScrollIndicator] = useState(false);

  const tokenRowStyle = useMemo(
    () =>
      StyleSheet.flatten([styles.renderItemWrapper, !isLight && styles.bg2]),
    [isLight, styles.bg2, styles.renderItemWrapper],
  );
  const additionalHeaderButtonStyle = useMemo(
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

  const handleLpTokenEnabledChange = useCallback(
    (nextEnabled: boolean) => {
      if (currentAddress) {
        prepareSingleAddressTokenAssetsProjection({
          address: currentAddress,
          chainServerId: selectedChain,
          isLpTokenEnabled: nextEnabled,
        });
      }
      setIsLpTokenEnabled(nextEnabled);
    },
    [currentAddress, selectedChain],
  );

  const handleToggleAdditionalTokens = useCallback(() => {
    if (showAllTokens) {
      setShowLowValueTokens(false);
      handleLpTokenEnabledChange(false);
    }
    setShowAllTokens(visible => !visible);
  }, [handleLpTokenEnabledChange, showAllTokens]);

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
    (item: TokenRowListItem) => (
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

  const renderAdditionalHeaderItem = useCallback(
    () => (
      <TokenRowSectionLpTokenHeader
        isEnabled={isLpTokenEnabled}
        onValueChange={handleLpTokenEnabledChange}
        fold={!showAllTokens}
        str={additionalTokenUsdValue}
        onPressFold={handleToggleAdditionalTokens}
        style={styles.sectionHeader}
        buttonStyle={additionalHeaderButtonStyle}
      />
    ),
    [
      additionalTokenUsdValue,
      additionalHeaderButtonStyle,
      handleLpTokenEnabledChange,
      handleToggleAdditionalTokens,
      isLpTokenEnabled,
      showAllTokens,
      styles.sectionHeader,
    ],
  );

  const renderLowValueTokenItem = useCallback(
    (item: Extract<TokenListItem, { type: 'low_value_tokens' }>) => (
      <View style={styles.rowWrap}>
        <ScamTokenHeader
          total={item.data.total}
          logoUrls={item.data.logoUrls}
          style={tokenRowStyle}
          onPress={() => setShowLowValueTokens(true)}
        />
      </View>
    ),
    [styles.rowWrap, tokenRowStyle],
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
        case 'default-token':
        case 'additional-token':
        case 'low-value-token':
          return renderTokenItem(item);
        case 'additional_token_toggle':
          return renderAdditionalHeaderItem();
        case 'low_value_tokens':
          return renderLowValueTokenItem(item);
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
      renderAdditionalHeaderItem,
      renderLowValueTokenItem,
      renderTokenItem,
      styles.removeLeft,
      styles.rowWrap,
      styles.singleCustomTestnetDivider,
    ],
  );

  const keyExtractor = useCallback(getTokenListItemKey, []);
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
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        initialNumToRender={TOKEN_LIST_INITIAL_RENDER_COUNT}
        windowSize={TOKEN_LIST_WINDOW_SIZE}
        maxToRenderPerBatch={TOKEN_LIST_RENDER_BATCH_SIZE}
        updateCellsBatchingPeriod={TOKEN_LIST_BATCHING_PERIOD_MS}
        removeClippedSubviews={IS_ANDROID}
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
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
