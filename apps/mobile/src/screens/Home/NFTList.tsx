import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ListRenderItem, ViewStyle } from 'react-native';
import { StyleSheet, View } from 'react-native';
import { RefreshControl } from 'react-native-gesture-handler';

import { navigateDeprecated } from '@/utils/navigation';
import { createGetStyles2024 } from '@/utils/styles';
import { DisplayNftItem } from './types';
import {
  ASSETS_ITEM_HEIGHT_NEW,
  ASSETS_SECTION_HEADER,
  RootNames,
} from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';

import { NftRow, TokenRowSectionHeader } from './components/AssetRenderItems';
import { useTranslation } from 'react-i18next';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import { NftItemWithCollection, useSingleNftListController } from './hooks/nft';
import { EmptyAssets } from './components/AssetRenderItems/EmptyAssets';
import { ItemLoader } from './components/Skeleton';
import {
  Tabs,
  useCurrentTabScrollY,
  useFocusedTab,
} from 'react-native-collapsible-tab-view';
import { useIsFocused } from '@react-navigation/native';
import { useAnimatedReaction } from 'react-native-reanimated';
import { runOnJS } from 'react-native-reanimated';
import { useSingleHomeAccount, useSingleHomeChain } from './hooks/singleHome';
import { Text } from '@/components/Typography';
import { useAppForeground } from '@/hooks/useAppForeground';
import { withAnimatedTickerRefreshNudge } from '@/components/Animated/RefreshNudgedTickerText';
import {
  EMPTY_NFT_ASSETS_INDEX_RESULT,
  getNftAssetsIndexRowKey,
  getSingleNftsCacheKey,
  nftCollectionResourceStore,
  nftEntityResourceStore,
  type NftAssetsIndexRow,
  useNftListComputedStore,
} from '@/store/nfts';
import { useActivityStore } from '@/hooks/storeActivity/useActivityStore';
import {
  useRegressionScenario,
  useRegressionScenarioAssertion,
} from '@/devtools/regressionScenarios/react';
import { IS_ANDROID } from '@/core/native/utils';
import { useScrollToTopOnChainChange } from '@/hooks/useScrollToTopOnChainChange';

type NftListItem =
  | NftAssetsIndexRow
  | {
      type: 'empty-assets' | 'empty-nft' | 'loading-skeleton';
      data: string;
    }
  | {
      type: 'nft_header';
    }
  | {
      type: 'toggle-nft';
    };

const NftResourceRow = React.memo(
  ({
    row,
    rowStyle,
    loaderStyle,
    onPress,
  }: {
    row: NftAssetsIndexRow;
    rowStyle: ViewStyle;
    loaderStyle: ViewStyle;
    onPress: (item: NftItemWithCollection) => void;
  }) => {
    const nft = useActivityStore(
      nftEntityResourceStore.useStore,
      state => (row.type === 'nft' ? state.valueMap[row.nftId] : undefined),
      Object.is,
      { storeLabel: 'single-address-nft-entities' },
    );
    const collection = useActivityStore(
      nftCollectionResourceStore.useStore,
      state =>
        row.type === 'collection'
          ? state.valueMap[row.collectionId]
          : undefined,
      Object.is,
      { storeLabel: 'single-address-nft-collections' },
    );
    const item = row.type === 'collection' ? collection : nft;

    if (!item) {
      return <ItemLoader style={loaderStyle} />;
    }

    return (
      <NftRow
        style={rowStyle}
        logoSize={46}
        chainLogoSize={18}
        item={item}
        onPress={() => onPress(item)}
      />
    );
  },
);

const getNftListItemId = (item: NftListItem) => {
  if (item.type === 'nft' || item.type === 'collection') {
    return `nft-row/${getNftAssetsIndexRowKey(item)}`;
  }
  return `${item.type}/${'data' in item ? item.data : ''}`;
};

interface Props {
  onForeground?: () => void;
  onRefresh?: () => void | Promise<void>;
}
const FOOTER_HEIGHT = 220;
const SPACING_HEIGHT = 8;

const NFTListInner = ({ onForeground, onRefresh }: Props) => {
  const { styles, isLight, colors2024 } = useTheme2024({
    getStyle: getStyles,
  });
  const { t } = useTranslation();
  const { currentAccount } = useSingleHomeAccount();

  const { selectedChain } = useSingleHomeChain();

  const [showAllNfts, setShowAllNfts] = useState(false);
  const [showScrollIndicator, setShowScrollIndicator] = useState(false);
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);
  const isScreenFocused = useIsFocused();

  const focusedTab = useFocusedTab();
  const isFocused = focusedTab === 'nft';

  useScrollToTopOnChainChange({
    chain: selectedChain,
    isCurrentTab: isFocused,
  });

  const userAddr = currentAccount?.address?.toLowerCase();
  const { reload: reloadNftList, isLoading: loadingNft } =
    useSingleNftListController(userAddr, false);

  const singleNftsKey = useMemo(() => {
    if (!userAddr) {
      return null;
    }
    return getSingleNftsCacheKey(userAddr, selectedChain);
  }, [selectedChain, userAddr]);

  const nftIndex = useActivityStore(
    useNftListComputedStore,
    state =>
      singleNftsKey
        ? state.singleNftsIndexCache[singleNftsKey] ||
          EMPTY_NFT_ASSETS_INDEX_RESULT
        : EMPTY_NFT_ASSETS_INDEX_RESULT,
    Object.is,
    { storeLabel: 'single-address-computed-nfts' },
  );
  const nftRowCount = nftIndex.rows.length;
  const isNftContentReady = nftRowCount > 0 || !loadingNft;

  const refreshNftList = useCallback(() => {
    reloadNftList?.();
  }, [reloadNftList]);

  useAppForeground({
    enabled: isFocused,
    onForeground: () => {
      if (loadingNft || !isFocused || !userAddr) {
        return;
      }
      onForeground?.();
      refreshNftList();
    },
  });

  const dataList = useMemo(() => {
    const defaultRows = nftIndex.rows.slice(0, nftIndex.defaultVisibleRowCount);
    const foldedRows = nftIndex.rows.slice(nftIndex.defaultVisibleRowCount);
    const itemData: Array<{
      show: boolean;
      data: NftListItem[];
    }> = [
      {
        show: true,
        data: defaultRows,
      },
      {
        show: foldedRows.length > 0,
        data: [{ type: 'toggle-nft' }, ...(showAllNfts ? foldedRows : [])],
      },
      {
        show: !!loadingNft && nftRowCount === 0,
        data: Array.from({ length: 5 }, (_, index) => ({
          type: 'loading-skeleton',
          data: 'index-nft' + index.toString(),
        })),
      },
      {
        show: !loadingNft && nftRowCount === 0,
        data: [
          {
            type: 'empty-nft',
            data: t('page.singleHome.sectionHeader.NoData', {
              name: t('page.singleHome.sectionHeader.Nft'),
            }),
          },
        ],
      },
    ];
    return itemData
      .filter(item => item.show)
      .map(item => item.data)
      .flat();
  }, [loadingNft, nftIndex, nftRowCount, showAllNfts, t]);

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
    if (!isSingleAddressRegression || !isFocused || !isNftContentReady) {
      setReadyRegressionRunId(null);
      return;
    }

    const timer = setTimeout(() => {
      setReadyRegressionRunId(regressionRunId);
    }, 350);
    return () => clearTimeout(timer);
  }, [
    isFocused,
    isNftContentReady,
    isSingleAddressRegression,
    nftIndex.rows.length,
    regressionRunId,
  ]);
  useRegressionScenarioAssertion(
    'single-address-nfts-ready',
    isSingleAddressRegression &&
      readyRegressionRunId === regressionRunId &&
      isFocused &&
      isNftContentReady
      ? {
          backgroundRefreshing: loadingNft,
          nftCount: nftIndex.rows.length,
        }
      : null,
  );

  const handlePressNft = useCallback(
    (item: NftItemWithCollection) => {
      if ('nft_list' in item && item.nft_list.length) {
        const id = createGlobalBottomSheetModal2024({
          name: MODAL_NAMES.COLLECTION_NFTS,
          data: item,
          bottomSheetModalProps: {
            // enableContentPanningGesture: true,
            enablePanDownToClose: true,
            handleStyle: {
              backgroundColor: colors2024['neutral-bg-2'],
            },
          },
          titleText: `${item.name}(${item.nft_list.length})`,
          onPressItem: (v: DisplayNftItem) => {
            navigateDeprecated(RootNames.NftDetail, {
              token: v,
              isSingleAddress: true,
              account: currentAccount as any,
            });
            removeGlobalBottomSheetModal2024(id);
          },
          onClose: () => {
            removeGlobalBottomSheetModal2024(id);
          },
        });
      } else {
        navigateDeprecated(RootNames.NftDetail, {
          token: item as DisplayNftItem,
          isSingleAddress: true,
          account: currentAccount as any,
        });
      }
    },
    [colors2024, currentAccount],
  );

  const nftRowStyle = useMemo(
    () =>
      StyleSheet.flatten([styles.renderItemWrapper, !isLight && styles.bg2]),
    [isLight, styles.bg2, styles.renderItemWrapper],
  );

  const renderItem = useCallback<ListRenderItem<NftListItem>>(
    ({ item }) => {
      const { type } = item;
      switch (type) {
        case 'nft':
        case 'collection':
          return (
            <View style={styles.rowWrap}>
              <NftResourceRow
                row={item}
                rowStyle={nftRowStyle}
                loaderStyle={styles.removeLeft}
                onPress={handlePressNft}
              />
            </View>
          );
        case 'nft_header':
          return (
            <Text style={styles.symbol}>
              {t('page.singleHome.sectionHeader.Nft')}
            </Text>
          );
        case 'toggle-nft':
          return (
            <TokenRowSectionHeader
              str={String(
                nftIndex.rows.length - nftIndex.defaultVisibleRowCount,
              )}
              fold={!showAllNfts}
              style={styles.sectionHeader}
              buttonStyle={StyleSheet.flatten([
                styles.buttonHeader,
                !isLight && styles.bg2,
              ])}
              onPressFold={() => setShowAllNfts(visible => !visible)}
            />
          );
        case 'empty-assets':
        case 'empty-nft':
          return (
            <EmptyAssets
              style={styles.emptyAssets}
              desc={item.data}
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
    [handlePressNft, isLight, nftIndex, nftRowStyle, showAllNfts, styles, t],
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
        keyExtractor={getNftListItemId}
        renderItem={renderItem}
        initialNumToRender={15}
        windowSize={15}
        maxToRenderPerBatch={15}
        removeClippedSubviews={IS_ANDROID}
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
        // estimatedItemSize={ASSETS_ITEM_HEIGHT_NEW + ASSETS_SEPARATOR_HEIGHT}
        ItemSeparatorComponent={ListRenderSeparator}
        ListFooterComponent={ListRenderFooter}
        showsVerticalScrollIndicator={showScrollIndicator}
        showsHorizontalScrollIndicator={false}
        style={[styles.bgContainer, styles.list]}
        refreshControl={
          <RefreshControl
            style={styles.bgContainer}
            onRefresh={async () => {
              setIsManualRefreshing(true);
              try {
                const balanceRefresh = Promise.resolve().then(() =>
                  onRefresh?.(),
                );
                const nftRefresh = reloadNftList?.(true);
                withAnimatedTickerRefreshNudge(() => balanceRefresh).catch(
                  error => {
                    console.error('Refresh balance failed:', error);
                  },
                );
                await nftRefresh;
              } finally {
                setIsManualRefreshing(false);
              }
            }}
            refreshing={isScreenFocused && isManualRefreshing}
          />
        }
      />
    </View>
  );
};

export const NFTList = ({ onRefresh }: Props) => {
  const focusedTab = useFocusedTab();
  const hasBeenFocusedRef = useRef(false);
  if (focusedTab === 'nft') {
    hasBeenFocusedRef.current = true;
  }

  if (!hasBeenFocusedRef.current) {
    return null;
  }

  return <NFTListInner onRefresh={onRefresh} />;
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
    height: ASSETS_SECTION_HEADER,
  },
  buttonHeader: {
    backgroundColor: ctx.colors2024['neutral-bg-1'],
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
