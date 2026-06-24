import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
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
        logoSize={46}
        chainLogoSize={18}
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
  onReachTopStatusChange?: (status: boolean) => void;
}
const FOOTER_HEIGHT = 220;
const SPACING_HEIGHT = 8;
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

export const TokenList = ({
  noAssetsOnAnyChain,
  onForeground,
  onRefresh,
  onReachTopStatusChange,
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
  const [customTokenListVersion, setCustomTokenListVersion] = useState(0);
  const [customTestnetCollapseKey, setCustomTestnetCollapseKey] = useState(0);
  const [hasRequestedTokenList, setHasRequestedTokenList] = useState(false);
  const isScreenFocused = useIsFocused();

  const focusedTab = useFocusedTab();
  const isFocused = useMemo(() => {
    return focusedTab === 'tokens';
  }, [focusedTab]);

  useEffect(() => {
    if (!isFocused) {
      setCustomTestnetCollapseKey(key => key + 1);
    }
  }, [isFocused]);

  const currentAddress = currentAccount?.address;
  const lowerAddress = currentAddress?.toLowerCase();
  useEffect(() => {
    setHasRequestedTokenList(false);
  }, [lowerAddress]);

  const {
    sections: customTestnetSections,
    loadTokens: loadCustomTestnetTokens,
    loadToken: loadCustomTestnetToken,
  } = useSingleAddressCustomTestnetAssetSections(
    currentAddress,
    customTokenListVersion,
  );
  const shouldShowCustomTestnetSections = !selectedChain && !isLpTokenEnabled;

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
  const visibleCustomTestnetSections =
    shouldShowCustomTestnetSections &&
    hasRequestedTokenList &&
    !isLoading &&
    !isAllLoading
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

  const dataList = useMemo(() => {
    const items: TokenListItem[] = [];
    const hasNoTokenItems =
      unFoldTokenIds.length + foldTokenIds.length + scamTokenIds.length === 0;

    unFoldTokenIds.forEach(tokenId => {
      items.push({ type: 'unfold_token', tokenId });
    });

    const hasFoldContent = foldTokenIds.length + scamTokenIds.length > 0;
    const hasFoldSection = hasFoldContent || isLpTokenEnabled;
    if (hasFoldSection) {
      items.push({ type: 'toggle_token_fold' });
      if (!foldHideList) {
        foldTokenIds.forEach(tokenId => {
          items.push({ type: 'fold_token', tokenId });
        });
        if (scamTokenIds.length > 0) {
          if (foldScam) {
            items.push({
              type: 'scam_token',
              data: {
                total: scamTokenIds.length,
                logoUrls: scamTokenPreviewLogoUrls,
              },
            });
          } else {
            scamTokenIds.forEach(tokenId => {
              items.push({ type: 'fold_token', tokenId });
            });
          }
        }

        if (hasFoldContent) {
          appendCustomTestnetItems(items, visibleCustomTestnetSections);
        }
      }
    }

    if (
      (isLoading &&
        items.length === 0 &&
        visibleCustomTestnetSections.length === 0) ||
      (isAllLoading && isLpTokenEnabled)
    ) {
      items.push(
        ...Array.from({ length: 5 }, (_, index) => ({
          type: 'loading-skeleton' as const,
          data: `index-token-${index.toString()}`,
        })),
      );
    }

    if (
      !isLoading &&
      hasNoTokenItems &&
      (items.length === 0 || visibleCustomTestnetSections.length > 0)
    ) {
      if (noAnyAssets) {
        // items.push({ type: 'empty-token' });
        items.push({
          type: 'empty-assets',
          data: t('page.singleHome.sectionHeader.NoData', {
            name: t('page.singleHome.sectionHeader.Token'),
          }),
        });
      } else {
        items.push({
          type: 'empty-assets',
          data: t('page.singleHome.sectionHeader.NoData', {
            name: t('page.singleHome.sectionHeader.Token'),
          }),
        });
      }
    }

    if (!hasFoldContent) {
      appendCustomTestnetItems(items, visibleCustomTestnetSections);
    }

    return items;
  }, [
    foldHideList,
    foldScam,
    foldTokenIds,
    isAllLoading,
    isLoading,
    isLpTokenEnabled,
    noAnyAssets,
    scamTokenIds,
    scamTokenPreviewLogoUrls,
    t,
    unFoldTokenIds,
    visibleCustomTestnetSections,
  ]);

  const [showScrollIndicator, setShowScrollIndicator] = useState(false);

  const tokenRowStyle = useMemo(
    () =>
      StyleSheet.flatten([styles.renderItemWrapper, !isLight && styles.bg2]),
    [isLight, styles.bg2, styles.renderItemWrapper],
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
    (data: CustomTestnetAssetSectionData) => {
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
          setCustomTokenListVersion(version => version + 1);
          closeModal();
        },
      });
    },
    [],
  );

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

  const renderItem = useCallback<ListRenderItem<TokenListItem>>(
    ({ item }) => {
      const { type } = item;
      switch (type) {
        case 'unfold_token':
        case 'fold_token':
          return (
            <View style={styles.rowWrap}>
              <TokenResourceRow
                tokenId={item.tokenId}
                tokenStyle={tokenRowStyle}
                loaderStyle={styles.removeLeft}
                onTokenPress={handleOpenTokenDetail}
              />
            </View>
          );
        case 'scam_token':
          return (
            <View style={styles.rowWrap}>
              <ScamTokenHeader
                total={item.data.total}
                logoUrls={item.data.logoUrls}
                style={StyleSheet.flatten([
                  styles.renderItemWrapper,
                  !isLight && styles.bg2,
                ])}
                onPress={() => {
                  setFoldScam(false);
                }}
              />
            </View>
          );
        case 'toggle_token_fold':
          return (
            <TokenFoldSectionHeader
              isEnabled={isLpTokenEnabled}
              onValueChange={setIsLpTokenEnabled}
              fold={foldHideList}
              str={foldTokenUsdValue}
              style={styles.sectionHeader}
              buttonStyle={StyleSheet.flatten([
                styles.buttonHeader,
                !isLight && styles.bg2,
              ])}
              onPressFold={() => {
                if (!foldHideList) {
                  setFoldScam(true);
                  setIsLpTokenEnabled(false);
                }
                setFoldHideList(pre => !pre);
              }}
            />
          );
        case 'custom_testnet_assets':
          return (
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
                collapseKey={customTestnetCollapseKey}
              />
            </View>
          );
        case 'custom_testnet_divider':
          return (
            <CustomTestnetAssetDivider
              style={styles.singleCustomTestnetDivider}
            />
          );
        case 'empty-token':
          return (
            <EmptyTokenRow
              currentAccount={currentAccount}
              // onReceive={handleOnReceive}
            />
          );
        case 'empty-assets':
          return (
            <EmptyAssets
              style={styles.emptyAssets}
              desc={item.data ?? undefined}
              type={type}
            />
          );
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
      currentAccount,
      customTestnetCollapseKey,
      foldHideList,
      foldTokenUsdValue,
      handleOpenTokenDetail,
      handleOpenCustomTestnetTokenDetail,
      handleCustomTestnetTokenButtonPress,
      isLight,
      isLpTokenEnabled,
      getCustomTestnetAccountByAddress,
      loadCustomTestnetToken,
      loadCustomTestnetTokens,
      styles,
      t,
      tokenRowStyle,
    ],
  );

  const keyExtractor = useCallback((item: TokenListItem) => {
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
  }, []);

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
  customTestnetSectionWrap: {
    paddingHorizontal: 16,
  },
  singleCustomTestnetDivider: {
    marginBottom: 9,
    paddingHorizontal: 32.5,
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
}));
