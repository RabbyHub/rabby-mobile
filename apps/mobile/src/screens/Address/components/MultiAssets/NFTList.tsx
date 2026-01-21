import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

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
import { ActionItem, DisplayNftItem } from '@/screens/Home/types';
import { createGetStyles2024 } from '@/utils/styles';
import { useLoadAssets } from '@/screens/Search/useAssets';
import { ItemLoader } from '@/screens/Search/components/Skeleton';
import { EmptyAssets } from '@/screens/Home/components/AssetRenderItems/EmptyAssets';
import { useTriggerTagAssets } from '@/screens/Home/hooks/refresh';
import { RefreshControl } from 'react-native-gesture-handler';
import { getItemId } from '@/screens/Home/utils/listRenderId';
import {
  NftItemWithCollection,
  varyNftListByFold,
} from '@/screens/Home/hooks/nft';
import { Tabs } from 'react-native-collapsible-tab-view';
import { TAB_HEADER_FULL_HEIGHT, TabName } from './TabsMultiAssets';
import {
  ListHeaderComponent,
  ListRenderFooter,
  ListRenderSeparator,
} from './RenderRow/Common';
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
import { isTabsSwiping } from './hooks';
import { useAssetsNFTs, useOnNftRefresh } from '@/screens/Home/hooks/store';
import { useSelectedChainItem } from '@/screens/Home/useChainInfo';

export const MemoizedNFTItemLoader = React.memo((props: RNViewProps) => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  return (
    <View {...props} style={[{ paddingHorizontal: 16 }, props.style]}>
      <ItemLoader style={styles.removeLeft} />
    </View>
  );
});

export const NFTList = () => {
  const { t } = useTranslation();
  const { styles, isLight, colors2024 } = useTheme2024({ getStyle: getStyles });

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

  const { checkIsExpireAndUpdate, isLoading } = useLoadAssets();

  const { nfts: _rawNftList } = useAssetsNFTs({
    hideCombined: false,
  });

  const nftList = useMemo(() => {
    return _rawNftList?.filter(item =>
      chain && item?.chain ? item.chain === chain : true,
    );
  }, [_rawNftList, chain]);

  const { foldNftList, unFoldNftList } = useMemo(() => {
    const result = varyNftListByFold<ActionItem>(
      nftList,
      (collection, item) => ({
        type: item._isFold ? 'fold_nft' : 'unfold_nft',
        data: collection,
      }),
    );

    return {
      foldNftList: result.foldList,
      unFoldNftList: result.unFoldList,
    };
  }, [nftList]);

  const dataList = useMemo(() => {
    const itemData: Array<{
      show: boolean;
      data: ActionItem[];
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
        show: !!isLoading && !nftList.length,
        data: Array.from({ length: 5 }, (_, index) => ({
          type: 'loading-skeleton',
          data: 'index-nft' + index.toString(),
        })),
      },
      {
        show: !isLoading && nftList?.length === 0,
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
  }, [foldNft, foldNftList, isLoading, nftList.length, t, unFoldNftList]);

  const hasNotAssets = useMemo(() => {
    return nftList.length === 0 && !isLoading && isFocused;
  }, [nftList.length, isLoading, isFocused]);

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
      const { type, data } = item;
      switch (type) {
        case 'unfold_nft':
        case 'fold_nft':
          return (
            <View style={styles.rowWrap}>
              <NftRow
                style={StyleSheet.flatten([
                  styles.renderItemWrapper,
                  !isLight && styles.bg2,
                ])}
                logoSize={40}
                chainLogoSize={16}
                disableMenu
                item={data}
                account={getAccountByAddress(data.address)}
                onPress={() => handlePressNft(data)}
              />
            </View>
          );
        case 'toggle_nft_fold':
          return (
            <TokenRowSectionHeader
              str={'' + foldNftList.length}
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
            <EmptyAssets style={styles.emptyAssets} desc={data} type={type} />
          );
        case 'loading-skeleton':
          return <MemoizedNFTItemLoader style={styles.loadingItem} />;
        default:
          return null;
      }
    },
    [
      foldNft,
      foldNftList.length,
      getAccountByAddress,
      handlePressNft,
      isLight,
      styles,
    ],
  );

  const onRefresh = useCallback(async () => {
    try {
      await Promise.all([
        triggerUpdate(true),
        checkIsExpireAndUpdate(true, {}),
        nftRefresh(),
      ]);
    } catch (error) {
      console.error('Refresh failed:', error);
    }
  }, [checkIsExpireAndUpdate, triggerUpdate, nftRefresh]);

  // if (!isFocusing) {
  //   return null;
  // }
  return (
    <Tabs.FlatList
      keyExtractor={getItemId}
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
      removeClippedSubviews
      ItemSeparatorComponent={ListRenderSeparator}
      ListHeaderComponent={ListHeaderComponent}
      ListFooterComponent={ListRenderFooter}
      showsVerticalScrollIndicator={false}
      showsHorizontalScrollIndicator={false}
      style={styles.container}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl
          style={styles.bgContainer}
          onRefresh={onRefresh}
          refreshing={false}
        />
      }
    />
  );
};

const getStyles = createGetStyles2024(ctx => ({
  container: {
    flex: 1,
    marginTop: TAB_HEADER_FULL_HEIGHT,
  },
  list: {
    paddingHorizontal: 16,
    marginTop: -TAB_HEADER_FULL_HEIGHT,
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
