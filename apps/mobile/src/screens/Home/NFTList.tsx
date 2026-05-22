import React, {
  useCallback,
  useState,
  useMemo,
  useEffect,
  useRef,
} from 'react';
import { ListRenderItem, StyleSheet, View, ViewStyle } from 'react-native';
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
import type { NftItemWithCollection } from './hooks/nft';
import { EmptyAssets } from './components/AssetRenderItems/EmptyAssets';
import { ItemLoader } from './components/Skeleton';
import {
  Tabs,
  useCurrentTabScrollY,
  useFocusedTab,
} from 'react-native-collapsible-tab-view';
import { useAnimatedReaction } from 'react-native-reanimated';
import { runOnJS } from 'react-native-reanimated';
import { useSingleHomeAccount, useSingleHomeChain } from './hooks/singleHome';
import { useAppForeground } from '@/hooks/useAppForeground';
import { debounce } from 'lodash';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { useAppOrmSyncEvents } from '@/databases/sync/_event';
import { apisAddrChainStatics } from './useChainInfo';
import nftListStore, {
  getNftAssetsIndexRowKey,
  getSingleNftsCacheKey,
  NftAssetsIndexResult,
  NftAssetsIndexRow,
  useNftCollection,
  useNftEntity,
  useNftListComputedStore,
} from '@/store/nfts';
import { useShallow } from 'zustand/react/shallow';
import { useSingleNftRefresh } from './hooks/refresh';

interface Props {
  onForeground?: () => void;
  onRefresh?: () => void;
  onReachTopStatusChange?: (status: boolean) => void;
}
const FOOTER_HEIGHT = 220;
const SPACING_HEIGHT = 8;

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
      type: 'empty-nft' | 'empty-assets';
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
    logoSize,
    chainLogoSize,
    onPress,
  }: {
    row: NftAssetsIndexRow;
    style?: ViewStyle;
    logoSize: number;
    chainLogoSize: number;
    onPress(item: NftItemWithCollection): void;
  }) => {
    const nft = useNftEntity(row.type === 'nft' ? row.nftId : undefined);
    const collection = useNftCollection(
      row.type === 'collection' ? row.collectionId : undefined,
    );
    const item = row.type === 'collection' ? collection : nft;

    if (!item) {
      return <ItemLoader />;
    }

    return (
      <NftRow
        style={style}
        logoSize={logoSize}
        chainLogoSize={chainLogoSize}
        item={item}
        onPress={() => onPress(item)}
      />
    );
  },
);

const NFTListInner = ({
  onForeground,
  onRefresh,
  onReachTopStatusChange,
}: Props) => {
  const { styles, isLight, colors2024 } = useTheme2024({
    getStyle: getStyles,
  });
  const { t } = useTranslation();
  const { currentAccount } = useSingleHomeAccount();

  const { selectedChain } = useSingleHomeChain();

  const [foldNft, setFoldNft] = useState(true);
  const [showScrollIndicator, setShowScrollIndicator] = useState(false);

  const focusedTab = useFocusedTab();
  const isFocused = focusedTab === 'nft';

  const userAddr = currentAccount?.address?.toLowerCase();
  const [loadingNft, setLoadingNft] = useState(true);
  const getNFTListWithCache = nftListStore(s => s.getNFTListWithCache);
  const batchLoadCacheNFT = nftListStore(s => s.batchLoadCacheNFT);
  const refreshTagNftByStore = nftListStore(s => s.refreshTagNft);
  const registerSingleNfts = useNftListComputedStore(
    state => state.registerSingleNfts,
  );

  const singleNftsKey = useMemo(() => {
    if (!userAddr) {
      return null;
    }
    return getSingleNftsCacheKey(userAddr, selectedChain);
  }, [selectedChain, userAddr]);

  useEffect(() => {
    if (!userAddr) {
      return;
    }
    registerSingleNfts(userAddr, selectedChain);
  }, [registerSingleNfts, selectedChain, userAddr]);

  const { unFoldRows, foldRows } = useNftListComputedStore(
    useShallow(state =>
      singleNftsKey
        ? state.singleNftsIndexCache[singleNftsKey] || emptyNftIndexResult
        : emptyNftIndexResult,
    ),
  );

  const loadingNftRef = useRef(loadingNft);
  useEffect(() => {
    loadingNftRef.current = loadingNft;
  }, [loadingNft]);

  const reloadNftList = useCallback(
    async (force?: boolean) => {
      if (!userAddr) {
        setLoadingNft(false);
        return;
      }
      setLoadingNft(true);
      try {
        await getNFTListWithCache(userAddr, force);
      } catch (e) {
        console.error('ServiceErrorType.NFT', e);
      } finally {
        setLoadingNft(false);
      }
    },
    [getNFTListWithCache, userAddr],
  );

  useEffect(() => {
    if (!userAddr) {
      return;
    }

    const updateNftChainStatics = (
      state: ReturnType<typeof nftListStore.getState> = nftListStore.getState(),
    ) => {
      apisAddrChainStatics.updateNft(userAddr, state.nftsMap[userAddr] || []);
    };

    updateNftChainStatics();
    const unsubscribe = nftListStore.subscribe(updateNftChainStatics);
    return unsubscribe;
  }, [userAddr]);

  const batchLocalData = useCallback(async () => {
    if (!userAddr) {
      return;
    }
    try {
      await batchLoadCacheNFT([userAddr]);
    } catch (e) {
      console.error('nft batchLocalData error', e);
    }
  }, [batchLoadCacheNFT, userAddr]);

  const debounceReloadNftList = useMemo(
    () => debounce(batchLocalData, 2000),
    [batchLocalData],
  );

  useEffect(() => {
    return () => {
      debounceReloadNftList.cancel();
    };
  }, [debounceReloadNftList]);

  useAppOrmSyncEvents({
    taskFor: ['nfts'],
    onRemoteDataUpserted: useCallback(
      ctx => {
        if (
          !userAddr ||
          !isSameAddress(ctx.owner_addr, userAddr) ||
          !ctx.success ||
          loadingNftRef.current
        ) {
          return;
        }
        const currentList = nftListStore.getState().nftsMap[userAddr] || [];
        const currentUpdateCount =
          ctx.syncDetails.batchSize * ctx.syncDetails.round +
          ctx.syncDetails.count;

        if (
          currentUpdateCount >= ctx.syncDetails.total ||
          currentUpdateCount > currentList.length
        ) {
          debounceReloadNftList();
        }
      },
      [debounceReloadNftList, userAddr],
    ),
  });

  const refreshNftList = useCallback(() => {
    reloadNftList?.();
  }, [reloadNftList]);

  useEffect(() => {
    if (isFocused) {
      refreshNftList();
    }
  }, [isFocused, refreshNftList]);

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

  useSingleNftRefresh({
    onRefresh: refreshTagNftByStore,
  });

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
        show: !!loadingNft && !unFoldRows.length && !foldRows.length,
        data: Array.from({ length: 5 }, (_, index) => ({
          type: 'loading-skeleton',
          data: 'index-nft' + index.toString(),
        })),
      },
      {
        show: !loadingNft && unFoldRows.length === 0 && foldRows.length === 0,
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
  }, [foldNft, foldRows, loadingNft, t, unFoldRows]);

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

  const renderItem = useCallback<ListRenderItem<NFTListItem>>(
    ({ item }) => {
      const { type } = item;
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
                logoSize={46}
                chainLogoSize={18}
                row={item.row}
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
    [foldNft, foldRows.length, handlePressNft, isLight, styles],
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
              reloadNftList?.(true);
              onRefresh?.();
            }}
            refreshing={false}
          />
        }
      />
    </View>
  );
};

export const NFTList = ({ onRefresh, onReachTopStatusChange }: Props) => {
  const focusedTab = useFocusedTab();
  const hasBeenFocusedRef = useRef(false);
  if (focusedTab === 'nft') {
    hasBeenFocusedRef.current = true;
  }

  if (!hasBeenFocusedRef.current) {
    return null;
  }

  return (
    <NFTListInner
      onRefresh={onRefresh}
      onReachTopStatusChange={onReachTopStatusChange}
    />
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
