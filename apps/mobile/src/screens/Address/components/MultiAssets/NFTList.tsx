import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, ViewStyle } from 'react-native';

import {
  ASSETS_ITEM_HEIGHT_NEW,
  ASSETS_SECTION_HEADER,
  RootNames,
} from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';
import {
  NftRow,
  TokenRowSectionHeader,
} from '@/screens/Home/components/AssetRenderItems';
import { DisplayNftItem } from '@/screens/Home/types';
import { createGetStyles2024 } from '@/utils/styles';
import { ItemLoader } from '@/screens/Search/components/Skeleton';
import { EmptyAssets } from '@/screens/Home/components/AssetRenderItems/EmptyAssets';
import { useTriggerTagAssets } from '@/screens/Home/hooks/refresh';
import { GestureDetector } from 'react-native-gesture-handler';
import {
  pulldownRefreshSizes,
  RefreshPlaceholderIOS,
  setPulldownRefreshStage,
  usePulldownRefreshGesture,
  usePulldownRefreshStyles,
} from '@/components/customized/ScrollViewLike/RefreshPlaceholderIOS';
import { RNGHRefreshControl } from '@/components/customized/reexports';
import type { NftItemWithCollection } from '@/screens/Home/hooks/nft';
import { useCurrentTabScrollY } from 'react-native-collapsible-tab-view';
import { useFocusedTab } from 'react-native-collapsible-tab-view';
import { TabsFlatList } from '@/components/customized/react-native-collapsible-tab-view/FlatList';
import { HomeTabName as TabName } from '@/hooks/navigation';
import { ListRenderSeparator } from './RenderRow/Common';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import { navigateDeprecated } from '@/utils/navigation';
import {
  useCheckIsExpireAndUpdate,
  useFindAccountByAddress,
  useIsFocusedCurrentTab,
} from './hooks/share';
import { isTabsSwiping, useAccountInfo } from './hooks';
import type { KeyringAccountWithAlias } from '@/hooks/account';
import nftListStore, {
  getMultiNftsCacheKey,
  getNftAssetsIndexRowKey,
  NftAssetsIndexResult,
  NftAssetsIndexRow,
  useNftCollection,
  useNftEntity,
  useNftListComputedStore,
  useOnNftRefresh,
} from '@/store/nfts';
import { useSelectedChainItem } from '@/screens/Home/useChainInfo';
import {
  HOME_TOP_HEADER_SIZES,
  SHOULD_SHOW_CUSTOM_INDICATOR_WHEN_LOADING,
} from '@/constant/home';
import { IS_ANDROID } from '@/core/native/utils';
import { useAppForeground } from '@/hooks/useAppForeground';
import { useShallow } from 'zustand/react/shallow';

export const MemoizedNFTItemLoader = React.memo((props: RNViewProps) => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  return (
    <View {...props} style={[{ paddingHorizontal: 16 }, props.style]}>
      <ItemLoader style={styles.removeLeft} />
    </View>
  );
});

const emptyNftIndexResult: NftAssetsIndexResult = {
  unFoldRows: [],
  foldRows: [],
};

type NFTListItem =
  | {
      type: 'unfold_nft' | 'fold_nft';
      row: NftAssetsIndexRow;
    }
  | {
      type: 'toggle_nft_fold';
    }
  | {
      type: 'empty-nft';
      data: string;
    }
  | {
      type: 'loading-skeleton';
      data: string;
    };

const NftResourceRow = React.memo(
  ({
    row,
    style,
    getAccountByAddress,
    onPress,
  }: {
    row: NftAssetsIndexRow;
    style?: ViewStyle;
    getAccountByAddress(address: string): KeyringAccountWithAlias | undefined;
    onPress(item: NftItemWithCollection): void;
  }) => {
    const nft = useNftEntity(row.type === 'nft' ? row.nftId : undefined);
    const collection = useNftCollection(
      row.type === 'collection' ? row.collectionId : undefined,
    );
    const item = row.type === 'collection' ? collection : nft;

    if (!item) {
      return <MemoizedNFTItemLoader />;
    }

    return (
      <NftRow
        style={style}
        logoSize={40}
        chainLogoSize={16}
        disableMenu
        item={item}
        account={getAccountByAddress(item.address || '')}
        onPress={() => onPress(item)}
      />
    );
  },
);

const NFTListInner = () => {
  const { t } = useTranslation();
  const { styles, isLight, colors2024 } = useTheme2024({ getStyle: getStyles });
  const { myTop10Addresses } = useAccountInfo();

  const selectedChainItem = useSelectedChainItem();
  const chain = selectedChainItem?.chain;

  const [foldNft, setFoldNft] = useState(true);

  const getAccountByAddress = useFindAccountByAddress();
  const { isFocused, isFocusing } = useIsFocusedCurrentTab(TabName.nft);

  const { nftRefresh } = useTriggerTagAssets();
  useOnNftRefresh();
  const { triggerUpdate } = useCheckIsExpireAndUpdate({
    isFocused,
    isFocusing,
  });

  const isLoading = nftListStore(s => s.isLoading);
  const batchGetNFTList = nftListStore(s => s.batchGetNFTList);
  const registerMultiNfts = useNftListComputedStore(
    state => state.registerMultiNfts,
  );

  const multiNftsKey = useMemo(() => {
    return getMultiNftsCacheKey(myTop10Addresses, chain);
  }, [chain, myTop10Addresses]);

  useEffect(() => {
    registerMultiNfts(myTop10Addresses, chain);
  }, [chain, myTop10Addresses, registerMultiNfts]);

  const { unFoldRows, foldRows } = useNftListComputedStore(
    useShallow(
      state => state.multiNftsIndexCache[multiNftsKey] || emptyNftIndexResult,
    ),
  );

  const dataList = useMemo(() => {
    const itemData: Array<{
      show: boolean;
      data: NFTListItem[];
    }> = [
      {
        show: true,
        data: unFoldRows.map(row => ({
          type: 'unfold_nft',
          row,
        })),
      },
      {
        show: !!foldRows.length,
        data: [
          { type: 'toggle_nft_fold' },
          ...(foldNft
            ? []
            : foldRows.map(row => ({
                type: 'fold_nft' as const,
                row,
              }))),
        ],
      },
      {
        show: !!isLoading && !unFoldRows.length && !foldRows.length,
        data: Array.from({ length: 5 }, (_, index) => ({
          type: 'loading-skeleton',
          data: 'index-nft' + index.toString(),
        })),
      },
      {
        show: !isLoading && unFoldRows.length === 0 && foldRows.length === 0,
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
  }, [foldNft, foldRows, isLoading, t, unFoldRows]);

  const hasNotAssets = useMemo(() => {
    return (
      unFoldRows.length === 0 &&
      foldRows.length === 0 &&
      !isLoading &&
      isFocused
    );
  }, [foldRows.length, isLoading, isFocused, unFoldRows.length]);

  const handlePressNft = useCallback(
    (item: NftItemWithCollection) => {
      if (!item.address) {
        return;
      }
      if (isTabsSwiping.value) {
        return;
      }
      const currentAccount = getAccountByAddress(item.address || '');
      if ('nft_list' in item && item.nft_list.length) {
        const id = createGlobalBottomSheetModal2024({
          name: MODAL_NAMES.COLLECTION_NFTS,
          data: item,
          account: currentAccount,
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
    [colors2024, getAccountByAddress],
  );

  const renderItem = useCallback(
    ({ item }) => {
      const { type } = item as NFTListItem;
      switch (type) {
        case 'unfold_nft':
        case 'fold_nft':
          return (
            <View style={styles.rowWrap}>
              <NftResourceRow
                style={StyleSheet.flatten([
                  styles.renderItemWrapper,
                  !isLight && styles.bg2,
                ])}
                row={item.row}
                getAccountByAddress={getAccountByAddress}
                onPress={handlePressNft}
              />
            </View>
          );
        case 'toggle_nft_fold':
          return (
            <TokenRowSectionHeader
              str={'' + foldRows.length}
              fold={foldNft}
              style={styles.sectionHeader}
              buttonStyle={StyleSheet.flatten([
                styles.buttonHeader,
                !isLight && styles.bg2,
              ])}
              onPressFold={() => setFoldNft(pre => !pre)}
            />
          );
        case 'empty-nft':
          return (
            <EmptyAssets
              style={styles.emptyAssets}
              desc={item.data}
              type={type}
            />
          );
        case 'loading-skeleton':
          return <MemoizedNFTItemLoader style={styles.loadingItem} />;
        default:
          return null;
      }
    },
    [
      foldNft,
      foldRows.length,
      getAccountByAddress,
      handlePressNft,
      isLight,
      styles,
    ],
  );

  const keyExtractor = useCallback((item: NFTListItem) => {
    if (item.type === 'unfold_nft' || item.type === 'fold_nft') {
      return `${item.type}-${getNftAssetsIndexRowKey(item.row)}`;
    }
    if (item.type === 'loading-skeleton') {
      return `loading-${item.data}`;
    }
    return `${item.type}-${'data' in item ? item.data || '' : ''}`;
  }, []);

  const onRefresh = useCallback(async () => {
    try {
      await Promise.all([
        triggerUpdate(true),
        batchGetNFTList(true, {}),
        nftRefresh(),
      ]);
    } catch (error) {
      console.error('Refresh failed:', error);
    }
  }, [batchGetNFTList, triggerUpdate, nftRefresh]);

  const handleForeground = useCallback(() => {
    if (isLoading || !isFocusing || !myTop10Addresses) {
      return;
    }
    triggerUpdate(false);
    batchGetNFTList(false, {});
  }, [isLoading, isFocusing, myTop10Addresses, triggerUpdate, batchGetNFTList]);

  useAppForeground({
    enabled: isFocusing,
    onForeground: handleForeground,
  });

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
    console.debug('[PulldownRefresh] NFTList isLoading changed', isLoading);
    if (!isLoading) {
      setPulldownRefreshStage({
        state: isLoading ? 'refreshing' : 'finished',
        svIsRefreshing,
        pullDistance,
        svIsManualRefreshing,
        indicatorSpaceHeight: pulldownRefreshSizes.homeHeaderHeight,
      });
    }
  }, [isLoading, svIsRefreshing, pullDistance, svIsManualRefreshing]);

  const pulldownRefreshReturns = usePulldownRefreshStyles({
    indicatorSpaceHeight: pulldownRefreshSizes.homeHeaderHeight,
    pullDistanceMaxValue: HOME_TOP_HEADER_SIZES.tabInnerHomeTopOffset,
    states: { pullDistance, svIsRefreshing, svIsManualRefreshing },
  });

  return (
    <GestureDetector gesture={panGestureRef.current}>
      <TabsFlatList
        keyExtractor={keyExtractor}
        data={
          hasNotAssets
            ? [
                {
                  type: 'empty-nft',
                  data: t('page.singleHome.sectionHeader.NoData', {
                    name: t('page.singleHome.sectionHeader.Nft'),
                  }),
                },
              ]
            : dataList
        }
        renderItem={renderItem}
        initialNumToRender={15}
        windowSize={15}
        key={isFocused ? 'nft-focused' : 'nft-unfocused'}
        maxToRenderPerBatch={15}
        removeClippedSubviews={IS_ANDROID}
        ItemSeparatorComponent={ListRenderSeparator}
        ListHeaderComponent={
          <RefreshPlaceholderIOS
            hooksReturn={pulldownRefreshReturns}
            animatedStyle={pulldownRefreshReturns.refreshPlaceholderStyle}
            __PICK_MANUAL__
          />
        }
        // ListFooterComponent={ListRenderFooter}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        style={[
          styles.container,
          pulldownRefreshReturns.scrollableStyle.container,
        ]}
        contentContainerStyle={[
          styles.list,
          pulldownRefreshReturns.scrollableStyle.list,
        ]}
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
      />
    </GestureDetector>
  );
};

export const NFTList = () => {
  const focusedTab = useFocusedTab();
  const hasBeenFocusedRef = useRef(false);
  if (focusedTab === TabName.nft) {
    hasBeenFocusedRef.current = true;
  }

  if (!hasBeenFocusedRef.current) {
    return null;
  }

  return <NFTListInner />;
};

const getStyles = createGetStyles2024(ctx => ({
  container: {
    flex: 1,
    // marginTop: HOME_TOP_HEADER_SIZES.scrollableListTopOffset,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 48,
  },
  bgContainer: {
    paddingHorizontal: 16,
  },
  sectionHeader: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 18,
    fontWeight: '500',
    lineHeight: 22,
    height: ASSETS_SECTION_HEADER,
    color: ctx.colors2024['neutral-secondary'],
    paddingLeft: 0,
    paddingRight: 0,
    backgroundColor: 'transparent',
  },
  emptyAssets: {
    marginHorizontal: 0,
  },
  rowWrap: {
    // paddingHorizontal: 16,
  },
  renderItemWrapper: {
    height: ASSETS_ITEM_HEIGHT_NEW,
  },
  bg2: {
    backgroundColor: ctx.colors2024['neutral-bg-2'],
  },
  buttonHeader: {
    backgroundColor: ctx.isLight
      ? ctx.colors2024['neutral-bg-1']
      : ctx.colors2024['neutral-bg-2'],
  },
  footerGap: {
    height: 70,
  },
  removeLeft: {
    marginLeft: 0,
  },
  loadingItem: {
    paddingHorizontal: 0,
  },
}));
