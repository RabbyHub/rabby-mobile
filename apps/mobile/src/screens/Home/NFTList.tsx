import React, {
  useCallback,
  useState,
  useMemo,
  useEffect,
  useRef,
} from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { RefreshControl } from 'react-native-gesture-handler';

import { navigateDeprecated } from '@/utils/navigation';
import { createGetStyles2024 } from '@/utils/styles';
import { AbstractProject, ActionItem, DisplayNftItem } from './types';
import {
  ASSETS_ITEM_HEIGHT_NEW,
  ASSETS_SECTION_HEADER,
  DEFI_ITEM_HEIGHT,
  RootNames,
} from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';
import { MenuAction } from '@/components2024/ContextMenuView/ContextMenuView';

import { NftRow, TokenRowSectionHeader } from './components/AssetRenderItems';
import { useTranslation } from 'react-i18next';
import { preferenceService } from '@/core/services';
import { toast } from '@/components2024/Toast';
import { StackActions, useNavigation } from '@react-navigation/native';
import { useTriggerTagAssets } from './hooks/refresh';
import { EmptyTokenRow } from './components/AssetRenderItems/EmptyToken';
import { useSwitchSceneCurrentAccount } from '@/hooks/accountsSwitcher';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamsList } from '@/navigation-type';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import {
  collectionNftList,
  NftItemWithCollection,
  useQueryNft,
} from './hooks/nft';
import { EmptyAssets } from './components/AssetRenderItems/EmptyAssets';
import { DefiItemLoader, ItemLoader } from './components/Skeleton';
import {
  Tabs,
  useCurrentTabScrollY,
  useFocusedTab,
} from 'react-native-collapsible-tab-view';
import { useAnimatedReaction } from 'react-native-reanimated';
import { runOnJS } from 'react-native-reanimated';
import { Account } from '@/core/services/preference';
import { getItemId } from './utils/listRenderId';
import { CollectionList } from '@rabby-wallet/rabby-api/dist/types';

export const icons = {
  unfoldDark: require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_unfold_dark.png'),
  unfoldLight: require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_unfold.png'),
  foldDark: require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_fold_dark.png'),
  foldLight: require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_fold.png'),
  pinDark: require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_token_favorite_dark.png'),
  pinLight: require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_token_favorite.png'),
  unpinDark: require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_token_unfavorite_dark.png'),
  unpinLight: require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_token_unfavorite.png'),
};

interface Props {
  onRefresh?: () => void;
  onReachTopStatusChange?: (status: boolean) => void;
  chain?: string;
  account: Account;
}
const FOOTER_HEIGHT = 56;
const SPACING_HEIGHT = 8;

export const NFTList = ({
  onRefresh,
  onReachTopStatusChange,
  chain,
  account: currentAccount,
}: Props) => {
  const { styles, isLight, colors2024 } = useTheme2024({
    getStyle: getStyles,
  });
  const { t } = useTranslation();
  const navigation =
    useNavigation<NativeStackScreenProps<RootStackParamsList>['navigation']>();

  const [foldNft, setFoldNft] = useState(true);
  const [showScrollIndicator, setShowScrollIndicator] = useState(false);

  const focusedTab = useFocusedTab();
  const hasBeenFocusedRef = useRef(false);

  const isFocused = useMemo(() => {
    const currentFocused = focusedTab === 'nft';
    if (currentFocused) {
      hasBeenFocusedRef.current = true;
    }
    return hasBeenFocusedRef.current;
  }, [focusedTab]);

  const {
    list: _rawNftList,
    reload: reloadNftList,
    isLoading: loadingNft,
  } = useQueryNft(currentAccount?.address?.toLowerCase(), false);

  useEffect(() => {
    if (isFocused) {
      reloadNftList?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocused]);

  const nftList = useMemo(() => {
    return _rawNftList.filter(item =>
      chain && item?.chain ? item.chain === chain : true,
    );
  }, [_rawNftList, chain]);

  const foldNftList: ActionItem[] = useMemo(
    () =>
      collectionNftList(nftList.filter(i => i._isFold)).map(item => ({
        type: 'fold_nft',
        data: item,
      })),
    [nftList],
  );
  const unFoldNftList: ActionItem[] = useMemo(
    () =>
      collectionNftList(nftList.filter(i => !i._isFold)).map(item => ({
        type: 'unfold_nft',
        data: item,
      })),
    [nftList],
  );

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
        show: !!loadingNft && !nftList.length,
        data: Array.from({ length: 5 }, (_, index) => ({
          type: 'loading-skeleton',
          data: 'index-nft' + index.toString(),
        })),
      },
      {
        show: !loadingNft && nftList.length === 0,
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
  }, [foldNft, foldNftList, loadingNft, nftList.length, t, unFoldNftList]);

  const { singleNFTRefresh } = useTriggerTagAssets();

  const { switchSceneCurrentAccount } = useSwitchSceneCurrentAccount();

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

  const getNftMenuAction = useCallback(
    (data: NftItemWithCollection): MenuAction[] => {
      const isFold = (data as CollectionList)?.nft_list?.every(
        i => (i as unknown as AbstractProject)._isFold,
      );
      return [
        {
          title: isFold
            ? t('page.tokenDetail.action.unfold')
            : t('page.tokenDetail.action.fold'),
          icon: isFold
            ? isLight
              ? icons.unfoldLight
              : icons.unfoldDark
            : isLight
            ? icons.foldLight
            : icons.foldDark,
          androidIconName: isFold
            ? 'ic_rabby_menu_unfold'
            : 'ic_rabby_menu_fold',
          key: 'fold',
          action() {
            if (isFold) {
              if (data.chain) {
                if ('nft_list' in data && data.nft_list.length) {
                  data.nft_list.forEach(i => {
                    preferenceService.manualUnFoldNft({
                      chain: i.chain,
                      id: i.id,
                    });
                  });
                } else {
                  preferenceService.manualUnFoldNft({
                    chain: data.chain,
                    id: data.id,
                  });
                }
                toast.success(t('page.tokenDetail.actionsTips.unfold_success'));
              }
            } else {
              if (data.chain) {
                if ('nft_list' in data && data.nft_list.length) {
                  data.nft_list.forEach(i => {
                    preferenceService.manualFoldNft({
                      chain: i.chain,
                      id: i.id,
                    });
                  });
                } else {
                  preferenceService.manualFoldNft({
                    chain: data.chain,
                    id: data.id,
                  });
                }
                toast.success(t('page.tokenDetail.actionsTips.fold_success'));
              }
            }
            singleNFTRefresh();
          },
        },
      ];
    },
    [isLight, singleNFTRefresh, t],
  );

  const handleOnReceive = useCallback(async () => {
    if (!currentAccount?.address) {
      return;
    }
    await switchSceneCurrentAccount('MakeTransactionAbout', currentAccount);
    navigation.dispatch(
      StackActions.push(RootNames.StackTransaction, {
        screen: RootNames.Receive,
        params: {
          account: currentAccount,
        },
      }),
    );
  }, [currentAccount, navigation, switchSceneCurrentAccount]);

  const handleOnImport = useCallback(async () => {
    navigation.dispatch(
      StackActions.push(RootNames.StackAddress, {
        screen: RootNames.ImportMethods,
        params: {
          isNotNewUserProc: true,
          isFromEmptyAddress: true,
        },
      }),
    );
  }, [navigation]);

  const renderItem = useCallback(
    (_type, _data) => {
      const { type, data } = _data;
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
                menuActions={getNftMenuAction(data)}
                logoSize={46}
                chainLogoSize={18}
                item={data}
                onPress={() => handlePressNft(data)}
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
        case 'empty-token':
          return (
            <EmptyTokenRow
              onReceive={handleOnReceive}
              onImport={handleOnImport}
            />
          );
        case 'empty-assets':
        case 'empty-defi':
        case 'empty-nft':
          return <EmptyAssets desc={data} type={type} />;
        case 'loading-skeleton':
          return (
            <View style={styles.rowWrap}>
              <ItemLoader style={styles.removeLeft} />
            </View>
          );
        case 'loading-defi-skeleton':
          return <DefiItemLoader />;
        default:
          return null;
      }
    },
    [
      foldNft,
      foldNftList.length,
      getNftMenuAction,
      handleOnImport,
      handleOnReceive,
      handlePressNft,
      isLight,
      styles.bg2,
      styles.buttonHeader,
      styles.removeLeft,
      styles.renderItemWrapper,
      styles.rowWrap,
      styles.sectionHeader,
      styles.symbol,
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
        keyExtractor={getItemId}
        renderItem={({ item }) => renderItem(item.type, item)}
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
              onRefresh?.();
            }}
            refreshing={false}
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
  defiGroups: {
    flexDirection: 'row',
    height: DEFI_ITEM_HEIGHT,
    gap: 12,
    paddingHorizontal: 16,
  },
  renderDefiItemWrapper: {
    backgroundColor: ctx.colors2024['neutral-bg-1'],
    borderRadius: 16,
    height: DEFI_ITEM_HEIGHT,
    paddingLeft: 12,
    paddingRight: 16,
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
}));
