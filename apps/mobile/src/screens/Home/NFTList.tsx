import React, { useCallback, useState, useMemo, useRef } from 'react';
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
import {
  NftItemWithCollection,
  useNftChainStaticsSync,
  useSingleNftListController,
} from './hooks/nft';
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

type NftListItem =
  | {
      type: 'unfold_nft' | 'fold_nft';
      row: NftAssetsIndexRow;
    }
  | {
      type: 'toggle_nft_fold';
    }
  | {
      type: 'empty-assets' | 'empty-nft' | 'loading-skeleton';
      data: string;
    }
  | {
      type: 'nft_header';
    };

const NftChainStaticsSubscriber = React.memo(
  ({ address }: { address?: string }) => {
    useNftChainStaticsSync(address);
    return null;
  },
);

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
  if ('row' in item) {
    return `${item.type}/${getNftAssetsIndexRowKey(item.row)}`;
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

  const [foldNft, setFoldNft] = useState(true);
  const [showScrollIndicator, setShowScrollIndicator] = useState(false);
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);
  const isScreenFocused = useIsFocused();

  const focusedTab = useFocusedTab();
  const isFocused = focusedTab === 'nft';

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
    const unFoldNftList: NftListItem[] = nftIndex.unFoldRows.map(row => ({
      type: 'unfold_nft',
      row,
    }));
    const foldNftList: NftListItem[] = nftIndex.foldRows.map(row => ({
      type: 'fold_nft',
      row,
    }));
    const nftRowCount = unFoldNftList.length + foldNftList.length;
    const itemData: Array<{
      show: boolean;
      data: NftListItem[];
    }> = [
      {
        show: true,
        data: [...unFoldNftList],
      },
      {
        show: !!foldNftList.length,
        data: [{ type: 'toggle_nft_fold' }, ...(foldNft ? [] : foldNftList)],
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
  }, [foldNft, loadingNft, nftIndex.foldRows, nftIndex.unFoldRows, t]);

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
        case 'unfold_nft':
        case 'fold_nft':
          return (
            <View style={styles.rowWrap}>
              <NftResourceRow
                row={item.row}
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
        case 'toggle_nft_fold':
          return (
            <TokenRowSectionHeader
              str={'' + nftIndex.foldRows.length}
              fold={foldNft}
              style={styles.sectionHeader}
              buttonStyle={StyleSheet.flatten([
                styles.buttonHeader,
                !isLight && styles.bg2,
              ])}
              onPressFold={() => setFoldNft(pre => !pre)}
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
    [
      foldNft,
      handlePressNft,
      isLight,
      nftIndex.foldRows.length,
      nftRowStyle,
      styles,
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
      <NftChainStaticsSubscriber address={userAddr} />
      <Tabs.FlatList
        data={dataList}
        keyExtractor={getNftListItemId}
        renderItem={renderItem}
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
    // paddingRight: 8,
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
