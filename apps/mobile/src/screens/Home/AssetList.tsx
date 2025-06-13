import React, { useCallback, useState, forwardRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { RefreshControl } from 'react-native-gesture-handler';
import { FlashList } from '@shopify/flash-list';

import { navigate } from '@/utils/navigation';
import { createGetStyles2024 } from '@/utils/styles';
import {
  AbstractPortfolio,
  AbstractPortfolioToken,
  AbstractProject,
  ActionItem,
  DisplayNftItem,
} from './types';
import {
  ASSETS_EMPTY_ROW_HIGHT,
  ASSETS_ITEM_HEIGHT_NEW,
  ASSETS_SECTION_HEADER,
  ASSETS_SEPARATOR_HEIGHT,
  DEFI_ITEM_HEIGHT,
  RootNames,
  TOKEN_EMPTY_ROW_HIGHT,
} from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';
import { MenuAction } from '@/components2024/ContextMenuView/ContextMenuView';

import {
  TokenRow,
  DefiRow,
  NftRow,
  TokenRowSectionHeader,
} from './components/AssetRenderItems';
import { useTranslation } from 'react-i18next';
import { preferenceService } from '@/core/services';
import { toast } from '@/components2024/Toast';
import { DisplayedProject } from './utils/project';
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
import { NftItemWithCollection } from './hooks/nft';
import { EmptyAssets } from './components/AssetRenderItems/EmptyAssets';
import { DefiItemLoader, ItemLoader } from './components/Skeleton';
import { ScamTokenHeader } from './components/AssetRenderItems/ScamTokenHeader';
import { Tabs, useCurrentTabScrollY } from 'react-native-collapsible-tab-view';
import { useAnimatedReaction } from 'react-native-reanimated';
import { runOnJS } from 'react-native-reanimated';
import { Account } from '@/core/services/preference';

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
  dataList: ActionItem[];
  foldNftAmount: number;
  foldDefiAmount: string;
  totalFoldTokenValue: string;
  onRefresh?: () => void;
  onReachTopStatusChange?: (status: boolean) => void;
  foldHideList: boolean;
  foldNft: boolean;
  foldDefi: boolean;
  refreshing: boolean;
  setFoldHideList: React.Dispatch<React.SetStateAction<boolean>>;
  setFoldNft: React.Dispatch<React.SetStateAction<boolean>>;
  setFoldDefi: React.Dispatch<React.SetStateAction<boolean>>;
  setFoldScam: React.Dispatch<React.SetStateAction<boolean>>;
  setFirstRowType: React.Dispatch<React.SetStateAction<string>>;
  account: Account;
}
const FOOTER_HEIGHT = 56;
const SPACING_HEIGHT = 8;

export const AssetList = forwardRef<FlashList<any>, Props>(
  (
    {
      onRefresh,
      dataList,
      foldNftAmount,
      foldDefiAmount,
      totalFoldTokenValue,
      onReachTopStatusChange,
      foldHideList,
      setFoldHideList,
      foldNft,
      setFoldNft,
      foldDefi,
      setFoldDefi,
      setFoldScam,
      refreshing,
      setFirstRowType,
      account: currentAccount,
    },
    ref,
  ) => {
    const { styles, isLight, colors2024 } = useTheme2024({
      getStyle: getStyles,
    });
    const { t } = useTranslation();
    const navigation =
      useNavigation<
        NativeStackScreenProps<RootStackParamsList>['navigation']
      >();

    const [showScrollIndicator, setShowScrollIndicator] = useState(false);

    const {
      singleDeFiRefresh,
      singleNFTRefresh,
      singleTokenRefresh,
      tokenRefresh,
      deFiRefresh,
    } = useTriggerTagAssets();

    const { switchSceneCurrentAccount } = useSwitchSceneCurrentAccount();

    const handleOpenTokenDetail = React.useCallback(
      (token: AbstractPortfolioToken) => {
        navigate(RootNames.TokenDetail, {
          token: token,
          isSingleAddress: true,
          account: currentAccount as any,
        });
      },
      [currentAccount],
    );
    const handleOpenDefiDetail = useCallback(
      (data: AbstractProject, itemList: AbstractPortfolio[]) => {
        navigate(RootNames.DeFiDetail, {
          data,
          portfolioList: itemList,
          account: currentAccount,
          cache: true,
          isSingleAddress: true,
        });
      },
      [currentAccount],
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
              navigate(RootNames.NftDetail, {
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
          navigate(RootNames.NftDetail, {
            token: item as DisplayNftItem,
            isSingleAddress: true,
            account: currentAccount as any,
          });
        }
      },
      [colors2024, currentAccount],
    );
    const getTokenMenuActions = useCallback(
      (data: AbstractPortfolioToken): MenuAction[] => {
        return [
          {
            title: data._isFold
              ? t('page.tokenDetail.action.unfold')
              : t('page.tokenDetail.action.fold'),
            icon: data._isFold
              ? isLight
                ? icons.unfoldLight
                : icons.unfoldDark
              : isLight
              ? icons.foldLight
              : icons.foldDark,
            androidIconName: data._isFold
              ? 'ic_rabby_menu_unfold'
              : 'ic_rabby_menu_fold',
            key: 'fold',
            action() {
              if (data._isFold) {
                preferenceService.manualUnFoldToken({
                  tokenId: data._tokenId,
                  chainId: data.chain,
                });
                toast.success(t('page.tokenDetail.actionsTips.unfold_success'));
              } else {
                preferenceService.manualFoldToken({
                  tokenId: data._tokenId,
                  chainId: data.chain,
                });
                toast.success(t('page.tokenDetail.actionsTips.fold_success'));
              }
              singleTokenRefresh();
              tokenRefresh();
            },
          },
          {
            title: data._isPined
              ? t('page.tokenDetail.action.unfavorite')
              : t('page.tokenDetail.action.favorite'),
            icon: data._isPined
              ? isLight
                ? icons.unpinLight
                : icons.unpinDark
              : isLight
              ? icons.pinLight
              : icons.pinDark,
            androidIconName: data._isPined
              ? 'ic_rabby_menu_token_unfavorite'
              : 'ic_rabby_menu_token_favorite',
            key: 'favorite',
            action() {
              if (data._isPined) {
                preferenceService.removePinedToken({
                  tokenId: data._tokenId,
                  chainId: data.chain,
                });
              } else {
                preferenceService.pinToken({
                  tokenId: data._tokenId,
                  chainId: data.chain,
                });
              }
              singleTokenRefresh();
              tokenRefresh();
            },
          },
        ];
      },
      [isLight, singleTokenRefresh, t, tokenRefresh],
    );
    const getDefiOrNftMenuAction = useCallback(
      (
        type: 'nft' | 'defi',
        data: DisplayedProject | NftItemWithCollection,
      ): MenuAction[] => {
        const isFold =
          'nft_list' in data && data.nft_list.length
            ? data.nft_list?.every(i => i._isFold)
            : data._isFold;
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
                if (type === 'defi') {
                  preferenceService.manualUnFoldDefi(data.id);
                  toast.success(
                    t('page.tokenDetail.actionsTips.unfold_success'),
                  );
                } else if (type === 'nft' && data.chain) {
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
                  toast.success(
                    t('page.tokenDetail.actionsTips.unfold_success'),
                  );
                }
              } else {
                if (type === 'defi') {
                  preferenceService.manualFoldDefi(data.id);
                  toast.success(t('page.tokenDetail.actionsTips.fold_success'));
                } else if (type === 'nft' && data.chain) {
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
              if (type === 'defi') {
                singleDeFiRefresh();
                deFiRefresh();
              } else if (type === 'nft') {
                singleNFTRefresh();
              }
            },
          },
        ];
      },
      [deFiRefresh, isLight, singleDeFiRefresh, singleNFTRefresh, t],
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

    const handleOnBuy = useCallback(async () => {
      if (!currentAccount?.address) {
        return;
      }
      await switchSceneCurrentAccount('MakeTransactionAbout', currentAccount);
      navigation.push(RootNames.StackTransaction, {
        screen: RootNames.Buy,
        params: {},
      });
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
          case 'unfold_token':
          case 'fold_token':
            return (
              <View style={styles.rowWrap}>
                <TokenRow
                  data={data}
                  style={StyleSheet.flatten([
                    styles.renderItemWrapper,
                    !isLight && styles.bg2,
                  ])}
                  onTokenPress={handleOpenTokenDetail}
                  menuActions={getTokenMenuActions(data)}
                  logoSize={46}
                  chainLogoSize={18}
                />
              </View>
            );
          case 'unfold_defi':
          case 'fold_defi':
            return (
              <View style={styles.defiGroups}>
                <DefiRow
                  data={data[0]}
                  style={StyleSheet.flatten([
                    styles.renderDefiItemWrapper,
                    !isLight && styles.bg2,
                  ])}
                  menuActions={getDefiOrNftMenuAction('defi', data[0])}
                  logoSize={40}
                  onPress={() =>
                    handleOpenDefiDetail(data[0], [
                      ...(data[0]._portfolios || []),
                    ])
                  }
                />
                {data[1] && (
                  <DefiRow
                    data={data[1]}
                    style={StyleSheet.flatten([
                      styles.renderDefiItemWrapper,
                      !isLight && styles.bg2,
                    ])}
                    menuActions={getDefiOrNftMenuAction('defi', data[1])}
                    logoSize={40}
                    onPress={() =>
                      handleOpenDefiDetail(data[1], [
                        ...(data[1]._portfolios || []),
                      ])
                    }
                  />
                )}
              </View>
            );
          case 'scam_token':
            return (
              <View style={styles.rowWrap}>
                <ScamTokenHeader
                  total={data.total}
                  logoUrls={data.logoUrls}
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
          case 'unfold_nft':
          case 'fold_nft':
            return (
              <View style={styles.rowWrap}>
                <NftRow
                  style={StyleSheet.flatten([
                    styles.renderItemWrapper,
                    !isLight && styles.bg2,
                  ])}
                  menuActions={getDefiOrNftMenuAction('nft', data)}
                  logoSize={46}
                  chainLogoSize={18}
                  item={data}
                  onPress={() => handlePressNft(data)}
                />
              </View>
            );
          case 'toggle_token_fold':
            return (
              <TokenRowSectionHeader
                str={totalFoldTokenValue}
                fold={foldHideList}
                style={styles.sectionHeader}
                buttonStyle={StyleSheet.flatten([
                  styles.buttonHeader,
                  !isLight && styles.bg2,
                ])}
                onPressFold={() => {
                  if (!foldHideList) {
                    setFoldScam(true);
                  }
                  setFoldHideList(pre => !pre);
                }}
              />
            );
          case 'defi_header':
            return (
              <Text style={styles.symbol}>
                {t('page.singleHome.sectionHeader.Defi')}
              </Text>
            );
          case 'toggle_defi_fold':
            return (
              <TokenRowSectionHeader
                str={foldDefiAmount}
                fold={foldDefi}
                style={styles.sectionHeader}
                buttonStyle={StyleSheet.flatten([
                  styles.buttonHeader,
                  !isLight && styles.bg2,
                ])}
                onPressFold={() => setFoldDefi(pre => !pre)}
              />
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
                str={'' + foldNftAmount}
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
                onBuy={handleOnBuy}
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
        foldDefi,
        foldDefiAmount,
        foldHideList,
        foldNft,
        foldNftAmount,
        getDefiOrNftMenuAction,
        getTokenMenuActions,
        handleOnBuy,
        handleOnImport,
        handleOnReceive,
        handleOpenDefiDetail,
        handleOpenTokenDetail,
        handlePressNft,
        isLight,
        setFoldDefi,
        setFoldHideList,
        setFoldNft,
        setFoldScam,
        styles.bg2,
        styles.buttonHeader,
        styles.defiGroups,
        styles.removeLeft,
        styles.renderDefiItemWrapper,
        styles.renderItemWrapper,
        styles.rowWrap,
        styles.sectionHeader,
        styles.symbol,
        t,
        totalFoldTokenValue,
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
        <Tabs.FlashList
          ref={ref}
          data={dataList}
          renderItem={({ item }) => renderItem(item.type, item)}
          estimatedItemSize={ASSETS_ITEM_HEIGHT_NEW + ASSETS_SEPARATOR_HEIGHT}
          ItemSeparatorComponent={ListRenderSeparator}
          getItemType={item => {
            if (item.type === 'empty-token') {
              return 'empty_token';
            }
            if (item.type === 'empty-assets') {
              return 'empty_assets';
            }
            if (item.type === 'empty-defi') {
              return 'empty_defi';
            }
            if (
              item.type === 'fold_defi' ||
              item.type === 'unfold_defi' ||
              item.type === 'loading-defi-skeleton'
            ) {
              return 'defi';
            }
            if (item?.type?.includes('_header')) {
              return 'asset_header';
            }
            if (item?.type?.includes('toggle_')) {
              return 'header';
            }
            return 'body';
          }}
          overrideItemLayout={(layout, item) => {
            const type = item.type;
            switch (type) {
              case 'asset_header':
                layout.size = ASSETS_SECTION_HEADER;
                break;
              case 'header':
                layout.size = ASSETS_SECTION_HEADER;
                break;
              case 'empty_token':
                layout.size = TOKEN_EMPTY_ROW_HIGHT;
                break;
              case 'empty_assets':
              case 'empty_defi':
                layout.size = ASSETS_EMPTY_ROW_HIGHT;
                break;
              case 'defi':
                layout.size = DEFI_ITEM_HEIGHT;
                break;
              default:
                layout.size = ASSETS_ITEM_HEIGHT_NEW;
            }
          }}
          onViewableItemsChanged={({ viewableItems }) => {
            if (viewableItems[0]?.item?.type) {
              setFirstRowType(viewableItems[0].item.type);
            }
          }}
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
              refreshing={refreshing}
            />
          }
        />
      </View>
    );
  },
);

const getStyles = createGetStyles2024(ctx => ({
  container: {
    flex: 1,
    marginTop: -ASSETS_SECTION_HEADER,
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
