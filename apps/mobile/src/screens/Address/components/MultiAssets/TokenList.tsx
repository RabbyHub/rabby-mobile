import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  type SectionListRenderItem,
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
  getMultiAssetsCacheKey,
  getTokenAssetsIndexRowKey,
  ITokenItem,
  TokenAssetsIndexRow,
  TokenGroupResourceValue,
  tokenEntityResourceStore,
  tokenGroupResourceStore,
  useTokenAssetsIndexStore,
} from '@/store/tokens';
import { useFindAccountByAddress, useIsFocusedCurrentTab } from './hooks/share';
import { useSelectedChainItem } from '@/screens/Home/useChainInfo';
import {
  HOME_TOP_HEADER_SIZES,
  SHOULD_SHOW_CUSTOM_INDICATOR_WHEN_LOADING,
} from '@/constant/home';
import { TabsSectionList } from '@/components/customized/react-native-collapsible-tab-view/SectionList';
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
import { useRegressionScenario } from '@/devtools/regressionScenarios/react';
import { useActivityStore } from '@/hooks/storeActivity/useActivityStore';
import { IS_ANDROID } from '@/core/native/utils';
import { beginAssetDataLoadDiagnostic } from '@/core/utils/assetDataLoadDiagnostics';
import { formatNetworth } from '@/utils/math';
import { useScrollToTopOnChainChange } from '@/hooks/useScrollToTopOnChainChange';
import {
  TokenProjectionSectionList,
  type TokenProjectionSection,
  type TokenProjectionSectionItem,
  type TokenProjectionSectionSpec,
} from '@/screens/Home/components/TokenProjectionSectionList';
import { resolveAssetProjectionViewState } from '@/store/assetProjectionAvailability';
import type { AssetSyncTrigger } from '@/store/assetSyncCoordinator';

const MemoizedTokenRow = React.memo(TokenRowV2);
const MemoizedScamTokenHeader = React.memo(ScamTokenHeader);
const MemoizedTokenRowSectionHeader = React.memo(TokenRowSectionLpTokenHeader);

const MemoizedItemLoader = React.memo(ItemLoader);
const TOKEN_LIST_INITIAL_RENDER_COUNT = 8;
const TOKEN_LIST_RENDER_BATCH_SIZE = 6;
const TOKEN_LIST_WINDOW_SIZE = 7;
const TOKEN_LIST_BATCHING_PERIOD_MS = 32;

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
    const tokenId = row.type === 'token' ? row.tokenId : undefined;
    const groupId = row.type === 'group' ? row.groupId : undefined;
    const token = useActivityStore(
      tokenEntityResourceStore.useStore,
      state => (tokenId ? state.valueMap[tokenId] : undefined),
      Object.is,
      { storeLabel: 'home-multi-assets-token-entities' },
    );
    const group = useActivityStore(
      tokenGroupResourceStore.useStore,
      state => (groupId ? state.valueMap[groupId] : undefined),
      Object.is,
      { storeLabel: 'home-multi-assets-token-groups' },
    );
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
        logoSize={40}
        style={style}
        chainLogoSize={18}
        hideChainLogo={hideChainLogo}
        account={account}
        scene="portfolio"
      />
    );
  },
);

type TokenListExtraItem =
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
      type: 'empty-assets';
      data: string;
    }
  | {
      type: 'loading-skeleton';
      data: string;
    };

type TokenListItem = TokenProjectionSectionItem<TokenListExtraItem>;

const { batchGetTokenList } = useTokenList.getState();
const EMPTY_CUSTOM_TESTNET_SECTIONS: CustomTestnetAssetSectionData[] = [];
const ADDITIONAL_TOGGLE_ITEMS: TokenListExtraItem[] = [
  { type: 'additional_token_toggle' },
];
const LOADING_ITEMS: TokenListExtraItem[] = Array.from(
  { length: 5 },
  (_, index) => ({
    type: 'loading-skeleton',
    data: `index-token-${index.toString()}`,
  }),
);

export const TokenList = () => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();
  const regressionScenario = useRegressionScenario<'Home'>();
  const regressionScenarioActive = regressionScenario.active;
  const regressionScenarioId = regressionScenario.active
    ? regressionScenario.scenario
    : null;
  const regressionScenarioRunId = regressionScenario.active
    ? regressionScenario.runId
    : null;
  const regressionScenarioReport = regressionScenario.active
    ? regressionScenario.report
    : null;
  const { myTop10Accounts, myTop10Addresses } = useAccountInfo();
  const selectedChainItem = useSelectedChainItem();
  const chain = useMemo(() => {
    return selectedChainItem?.chain;
  }, [selectedChainItem?.chain]);

  const [showAllTokens, setShowAllTokens] = useState(false);
  const [showLowValueTokens, setShowLowValueTokens] = useState(false);
  const [isLpTokenEnabled, setIsLpTokenEnabled] = useState(false);
  const [customTestnetCollapseKey, setCustomTestnetCollapseKey] = useState(0);
  const [hasSettledTokenRequest, setHasSettledTokenRequest] = useState(false);
  const tokenRequestIdRef = useRef(0);
  const lastTokenScopeRef = useRef<string | null>(null);
  const customTestnetAddTokenModalIdRef = useRef<ReturnType<
    typeof createGlobalBottomSheetModal2024
  > | null>(null);

  const tokenDisplayMode = useActivityStore(
    useTokenList,
    state => state.tokenDisplayMode,
    Object.is,
    { storeLabel: 'home-multi-assets-token-preferences' },
  );

  const getAccountByAddress = useFindAccountByAddress(myTop10Accounts);
  const {
    sections: customTestnetSections,
    loadTokens: loadCustomTestnetTokens,
    loadToken: loadCustomTestnetToken,
  } = useCustomTestnetAssetSections(myTop10Addresses);
  const shouldShowCustomTestnetSections = !chain && !isLpTokenEnabled;
  const { triggerUpdate } = addressBalanceStore.useAccountsBalanceTrigger();

  const { isFocused, isFocusing } = useIsFocusedCurrentTab(TabName.token);

  useScrollToTopOnChainChange({
    chain,
    isCurrentTab: isFocusing,
  });

  const isScreenFocused = useIsFocused();

  const closeCustomTestnetAddTokenModal = useCallback(() => {
    const modalId = customTestnetAddTokenModalIdRef.current;
    if (!modalId) {
      return;
    }
    removeGlobalBottomSheetModal2024(modalId);
    customTestnetAddTokenModalIdRef.current = null;
  }, []);

  useEffect(() => {
    if (!isScreenFocused || !isFocusing) {
      closeCustomTestnetAddTokenModal();
    }
  }, [closeCustomTestnetAddTokenModal, isFocusing, isScreenFocused]);

  useEffect(() => {
    return closeCustomTestnetAddTokenModal;
  }, [closeCustomTestnetAddTokenModal]);

  useEffect(() => {
    if (!isScreenFocused) {
      setCustomTestnetCollapseKey(key => key + 1);
    }
  }, [isScreenFocused]);

  const multiAssetsKey = useMemo(
    () =>
      getMultiAssetsCacheKey(myTop10Addresses, chain, false, tokenDisplayMode),
    [myTop10Addresses, chain, tokenDisplayMode],
  );

  useLayoutEffect(() => {
    const trace = beginAssetDataLoadDiagnostic(
      'multi-address-token-projection',
      myTop10Addresses.join('|'),
      {
        addressCount: myTop10Addresses.length,
        chainServerId: chain || 'all',
        tokenDisplayMode,
      },
    );
    const projectionKey = useTokenAssetsIndexStore
      .getState()
      .ensureMultiAssetsResult({
        addresses: myTop10Addresses,
        chainServerId: chain,
        isLpTokenEnabled: false,
        tokenDisplayMode,
      });
    trace.finish({
      projectionKeyMatches: projectionKey === multiAssetsKey,
    });
  }, [chain, multiAssetsKey, myTop10Addresses, tokenDisplayMode]);

  const tokenProjectionMetadata = useActivityStore(
    useTokenAssetsIndexStore,
    useShallow(state => {
      const result =
        state.multiAssetsResultByKey[multiAssetsKey] ||
        EMPTY_TOKEN_ASSETS_INDEX_RESULT;
      return {
        availability:
          state.multiAssetsAvailabilityByKey[multiAssetsKey] || 'unresolved',
        additionalCoreUsdValue: result.additionalCoreUsdValue,
        lowValueTokenPreviewLogoUrls: result.lowValueTokenPreviewLogoUrls,
        lpLowValueTokenPreviewLogoUrls: result.lpLowValueTokenPreviewLogoUrls,
        hasAdditionalTokens: result.hasAdditionalTokens,
        hasLpTokens: result.hasLpTokens,
        primaryTokenCount: result.segments.primary.tokenIds.length,
        additionalDefaultTokenCount:
          result.segments.additionalDefault.tokenIds.length,
        additionalLpTokenCount: result.segments.additionalLp.tokenIds.length,
        lowValueDefaultTokenCount:
          result.segments.lowValueDefault.tokenIds.length,
        lowValueLpTokenCount: result.segments.lowValueLp.tokenIds.length,
      };
    }),
    Object.is,
    { storeLabel: 'home-multi-assets-token-assets-index' },
  );
  const {
    availability: tokenProjectionAvailability,
    additionalCoreUsdValue,
    lowValueTokenPreviewLogoUrls,
    lpLowValueTokenPreviewLogoUrls,
    hasAdditionalTokens,
    hasLpTokens,
    primaryTokenCount,
    additionalDefaultTokenCount,
    additionalLpTokenCount,
    lowValueDefaultTokenCount,
    lowValueLpTokenCount,
  } = tokenProjectionMetadata;
  const selectedAdditionalTokenCount = isLpTokenEnabled
    ? additionalLpTokenCount
    : additionalDefaultTokenCount;
  const selectedLowValueTokenCount = isLpTokenEnabled
    ? lowValueLpTokenCount
    : lowValueDefaultTokenCount;
  const selectedLowValueTokenPreviewLogoUrls = isLpTokenEnabled
    ? lpLowValueTokenPreviewLogoUrls
    : lowValueTokenPreviewLogoUrls;
  const projectedTokenCount =
    primaryTokenCount +
    selectedAdditionalTokenCount +
    selectedLowValueTokenCount;
  const additionalTokenUsdValue = useMemo(
    () => formatNetworth(additionalCoreUsdValue),
    [additionalCoreUsdValue],
  );

  const isLoading = useActivityStore(
    useTokenList,
    state => state.isLoading,
    Object.is,
    { storeLabel: 'home-multi-assets-token-loading' },
  );
  // LP availability only controls the additional-token selector. Until the
  // currently selected segments contain rows, the list still has no visible
  // data and must remain in its loading/empty state.
  const hasDefaultTokenData = projectedTokenCount > 0;
  const tokenProjectionViewState = resolveAssetProjectionViewState({
    availability: tokenProjectionAvailability,
    hasData: hasDefaultTokenData,
    hasSettledRequest: hasSettledTokenRequest && !isLoading,
  });
  const shouldHideCustomTestnetSectionsWhileLoading =
    tokenProjectionViewState === 'loading';
  const visibleCustomTestnetSections =
    shouldShowCustomTestnetSections &&
    !shouldHideCustomTestnetSectionsWhileLoading
      ? customTestnetSections
      : EMPTY_CUSTOM_TESTNET_SECTIONS;

  const requestTokenList = useCallback(
    (force = false, trigger: AssetSyncTrigger = 'on-demand') => {
      const requestId = tokenRequestIdRef.current + 1;
      tokenRequestIdRef.current = requestId;
      setHasSettledTokenRequest(false);
      const request = batchGetTokenList(myTop10Addresses, force, trigger);
      void request.then(
        () => {
          if (tokenRequestIdRef.current === requestId) {
            setHasSettledTokenRequest(true);
          }
        },
        () => {
          if (tokenRequestIdRef.current === requestId) {
            setHasSettledTokenRequest(true);
          }
        },
      );
      return request;
    },
    [myTop10Addresses],
  );

  useEffect(() => {
    const nextScope = myTop10Addresses
      .map(address => address.toLowerCase())
      .sort()
      .join('|');
    const trigger: AssetSyncTrigger = lastTokenScopeRef.current
      ? lastTokenScopeRef.current === nextScope
        ? 'on-demand'
        : 'scope-change'
      : 'initial';
    lastTokenScopeRef.current = nextScope;
    void requestTokenList(false, trigger);
    return () => {
      tokenRequestIdRef.current += 1;
    };
  }, [myTop10Addresses, requestTokenList]);

  const handleForeground = useCallback(() => {
    if (isLoading || !isFocusing || !myTop10Addresses) {
      return;
    }
    triggerUpdate(false);
    void requestTokenList(false, 'resume');
  }, [
    isFocusing,
    isLoading,
    myTop10Addresses,
    requestTokenList,
    triggerUpdate,
  ]);

  useAppForeground({
    enabled: isFocusing,
    onForeground: handleForeground,
  });

  const hasNoAssets = tokenProjectionViewState === 'empty' && isFocused;

  const lastScenarioViewStateKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (
      !regressionScenarioActive ||
      regressionScenarioId !== 'home-assets' ||
      !regressionScenarioRunId ||
      !regressionScenarioReport ||
      !isFocused
    ) {
      return;
    }

    const stateKey = [
      regressionScenarioRunId,
      tokenProjectionViewState,
      projectedTokenCount,
      tokenProjectionAvailability,
    ].join(':');
    if (lastScenarioViewStateKeyRef.current === stateKey) {
      return;
    }
    lastScenarioViewStateKeyRef.current = stateKey;
    regressionScenarioReport('assertion', {
      assertion: 'home-assets-token-view-state',
      passed: true,
      state: tokenProjectionViewState,
      availability: tokenProjectionAvailability,
      tokenCount: projectedTokenCount,
      hasLpTokens,
    });
  }, [
    hasLpTokens,
    isFocused,
    projectedTokenCount,
    regressionScenarioActive,
    regressionScenarioId,
    regressionScenarioReport,
    regressionScenarioRunId,
    tokenProjectionAvailability,
    tokenProjectionViewState,
  ]);

  const [scenarioReadyCheckTick, setScenarioReadyCheckTick] = useState(0);
  useEffect(() => {
    if (
      !regressionScenarioActive ||
      regressionScenarioId !== 'home-assets' ||
      !isFocused
    ) {
      return;
    }

    const timer = setTimeout(() => {
      setScenarioReadyCheckTick(Date.now());
    }, 350);
    return () => clearTimeout(timer);
  }, [
    isFocused,
    multiAssetsKey,
    regressionScenarioActive,
    regressionScenarioId,
    regressionScenarioRunId,
  ]);

  const lastReadyReportKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (
      !regressionScenarioActive ||
      regressionScenarioId !== 'home-assets' ||
      !regressionScenarioRunId ||
      !regressionScenarioReport ||
      !isFocused ||
      !scenarioReadyCheckTick ||
      tokenProjectionViewState === 'loading'
    ) {
      return;
    }

    const tokenCount = projectedTokenCount;
    const customTestnetSectionCount = visibleCustomTestnetSections.length;
    const readyKey = [
      regressionScenarioRunId,
      multiAssetsKey,
      tokenCount,
      customTestnetSectionCount,
      hasLpTokens ? 'has-lp' : 'no-lp',
    ].join(':');
    if (lastReadyReportKeyRef.current === readyKey) {
      return;
    }
    lastReadyReportKeyRef.current = readyKey;

    regressionScenarioReport('assertion', {
      assertion: 'home-assets-token-ready',
      passed: true,
      state:
        tokenCount > 0 || customTestnetSectionCount > 0
          ? 'data'
          : hasNoAssets
          ? 'empty-assets'
          : 'empty-token',
      accountCount: myTop10Addresses.length,
      tokenCount,
      customTestnetSectionCount,
      selectedChain: chain || null,
      tokenDisplayMode,
      isLpTokenEnabled,
    });
  }, [
    chain,
    hasLpTokens,
    hasNoAssets,
    isFocused,
    tokenProjectionViewState,
    isLpTokenEnabled,
    multiAssetsKey,
    myTop10Addresses.length,
    regressionScenarioActive,
    regressionScenarioId,
    regressionScenarioReport,
    regressionScenarioRunId,
    scenarioReadyCheckTick,
    tokenDisplayMode,
    projectedTokenCount,
    visibleCustomTestnetSections.length,
  ]);

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

  // const ListRenderFooter = useCallback(() => {
  //   return hasMorePortfolios ? (
  //     <MemoizedDefiItemLoader style={[styles.loadingMore]} />
  //   ) : (
  //     <ListRenderFooterComponent />
  //   );
  // }, [hasMorePortfolios, styles.loadingMore]);

  const onRefresh = useCallback(async () => {
    const balanceRefresh = triggerUpdate(true);
    const tokenRefresh = requestTokenList(true, 'pull-refresh');

    withAnimatedTickerRefreshNudge(() => balanceRefresh).catch(error => {
      console.error('Refresh balance failed:', error);
    });

    try {
      await tokenRefresh;
    } catch (error) {
      console.error('Refresh failed:', error);
    }
  }, [requestTokenList, triggerUpdate]);

  const handleLpTokenEnabledChange = useCallback((nextEnabled: boolean) => {
    setIsLpTokenEnabled(nextEnabled);
  }, []);

  const handleToggleAdditionalTokens = useCallback(() => {
    if (showAllTokens) {
      setShowLowValueTokens(false);
      handleLpTokenEnabledChange(false);
    }
    setShowAllTokens(visible => !visible);
  }, [handleLpTokenEnabledChange, showAllTokens]);

  const emptyAssetsText = useMemo(
    () =>
      t('page.singleHome.sectionHeader.NoData', {
        name: t('page.singleHome.sectionHeader.Token'),
      }),
    [t],
  );
  const emptyItems = useMemo<TokenListExtraItem[]>(
    () => [{ type: 'empty-assets', data: emptyAssetsText }],
    [emptyAssetsText],
  );
  const lowValueSummaryItems = useMemo<TokenListExtraItem[]>(
    () => [
      {
        type: 'low_value_tokens',
        data: {
          total: selectedLowValueTokenCount,
          logoUrls: selectedLowValueTokenPreviewLogoUrls,
        },
      },
    ],
    [selectedLowValueTokenCount, selectedLowValueTokenPreviewLogoUrls],
  );
  const customTestnetItems = useMemo<TokenListExtraItem[]>(() => {
    if (!visibleCustomTestnetSections.length) {
      return [];
    }
    return [
      { type: 'custom_testnet_divider' },
      ...visibleCustomTestnetSections.map(data => ({
        type: 'custom_testnet_assets' as const,
        data,
      })),
    ];
  }, [visibleCustomTestnetSections]);
  const additionalSegmentKey = isLpTokenEnabled
    ? ('additionalLp' as const)
    : ('additionalDefault' as const);
  const lowValueSegmentKey = isLpTokenEnabled
    ? ('lowValueLp' as const)
    : ('lowValueDefault' as const);
  const hasAdditionalSection = hasAdditionalTokens || isLpTokenEnabled;
  const sectionSpecs = useMemo<
    TokenProjectionSectionSpec<TokenListExtraItem>[]
  >(() => {
    const specs: TokenProjectionSectionSpec<TokenListExtraItem>[] = [];
    const hasNoTokenItems =
      projectedTokenCount + visibleCustomTestnetSections.length === 0;

    if (tokenProjectionViewState === 'loading' && hasNoTokenItems) {
      return [{ key: 'loading', data: LOADING_ITEMS }];
    }

    if (hasNoAssets) {
      specs.push({ key: 'empty', data: emptyItems });
    }

    specs.push({ key: 'primary', segmentKey: 'primary' });
    if (hasAdditionalSection) {
      specs.push({ key: 'additional-toggle', data: ADDITIONAL_TOGGLE_ITEMS });
    }
    if (hasAdditionalSection && showAllTokens) {
      specs.push({ key: 'additional', segmentKey: additionalSegmentKey });
      if (selectedLowValueTokenCount > 0) {
        specs.push(
          showLowValueTokens
            ? { key: 'low-value', segmentKey: lowValueSegmentKey }
            : { key: 'low-value-summary', data: lowValueSummaryItems },
        );
      }
      if (customTestnetItems.length) {
        specs.push({ key: 'custom-testnet', data: customTestnetItems });
      }
    }
    if (!hasAdditionalSection && customTestnetItems.length) {
      specs.push({ key: 'custom-testnet', data: customTestnetItems });
    }

    return specs;
  }, [
    additionalSegmentKey,
    customTestnetItems,
    emptyItems,
    hasAdditionalSection,
    tokenProjectionViewState,
    hasNoAssets,
    lowValueSegmentKey,
    lowValueSummaryItems,
    projectedTokenCount,
    selectedLowValueTokenCount,
    showAllTokens,
    showLowValueTokens,
    visibleCustomTestnetSections.length,
  ]);

  const renderItem = useCallback<
    SectionListRenderItem<
      TokenListItem,
      TokenProjectionSection<TokenListExtraItem>
    >
  >(
    ({ item, index, section }) => {
      switch (item.type) {
        case 'token':
        case 'group': {
          const isLast = index === section.data.length - 1;
          return (
            <View style={[styles.rowWrap, isLast ? styles.lastRowWrap : null]}>
              <TokenResourceRow
                row={item}
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
        case 'additional_token_toggle':
          return (
            <MemoizedTokenRowSectionHeader
              style={styles.tokenSectionHeader}
              fold={!showAllTokens}
              str={additionalTokenUsdValue}
              onPressFold={handleToggleAdditionalTokens}
              isEnabled={isLpTokenEnabled}
              onValueChange={handleLpTokenEnabledChange}
            />
          );
        case 'low_value_tokens':
          return (
            <View style={styles.rowWrap}>
              <MemoizedScamTokenHeader
                total={item.data.total}
                logoUrls={item.data.logoUrls}
                style={{ ...styles.renderItemWrapper, flexGrow: 0 }}
                onPress={() => setShowLowValueTokens(true)}
              />
            </View>
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
      getAccountByAddress,
      handleGroupPress,
      handleCustomTestnetTokenPress,
      handleCustomTestnetTokenButtonPress,
      handleCustomTestnetTokenRemove,
      handleCustomTestnetTokenGroupPress,
      renderCustomTestnetAccount,
      handleTokenPress,
      handleLpTokenEnabledChange,
      handleToggleAdditionalTokens,
      additionalTokenUsdValue,
      isLpTokenEnabled,
      loadCustomTestnetToken,
      loadCustomTestnetTokens,
      styles,
      showAllTokens,
      t,
    ],
  );

  const keyExtractor = useCallback((item: TokenListItem) => {
    if (item.type === 'token' || item.type === 'group') {
      return `token-${getTokenAssetsIndexRowKey(item)}`;
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
      <TokenProjectionSectionList
        projectionKey={multiAssetsKey}
        scene="multi-address"
        sectionSpecs={sectionSpecs}
        ListComponent={TabsSectionList}
        storeLabel="home-multi-assets-token-section-list"
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
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        stickySectionHeadersEnabled={false}
        initialNumToRender={TOKEN_LIST_INITIAL_RENDER_COUNT}
        windowSize={TOKEN_LIST_WINDOW_SIZE}
        maxToRenderPerBatch={TOKEN_LIST_RENDER_BATCH_SIZE}
        updateCellsBatchingPeriod={TOKEN_LIST_BATCHING_PERIOD_MS}
        removeClippedSubviews={IS_ANDROID}
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
      />
    </GestureDetector>
  );
};

const getStyles = createGetStyles2024(() => ({
  container: {
    flex: 1,
  },
  list: {
    paddingHorizontal: 12,
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
  customTestnetSection: {
    marginBottom: 8,
  },
  renderItemWrapper: {
    height: ASSETS_ITEM_HEIGHT_NEW,
  },
}));
