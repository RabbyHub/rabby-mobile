import React, { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { RefreshControl } from 'react-native-gesture-handler';

import { useCurrentAccount } from '@/hooks/account';
import { navigate } from '@/utils/navigation';
import { createGetStyles2024 } from '@/utils/styles';
import { BottomSheetModalTokenDetail } from '@/components/TokenDetailPopup/BottomSheetModalTokenDetail';
import { useQueryProjects } from './hooks';
import useSortToken from './hooks/useSortTokens';
import { getTotalFoldToken } from './utils/converAssets';
import {
  AbstractPortfolio,
  AbstractPortfolioToken,
  AbstractProject,
  ActionItem,
} from './types';
import { findChain } from '@/utils/chain';
import { useGeneralTokenDetailSheetModal } from '@/components/TokenDetailPopup/hooks';
import {
  ASSETS_ITEM_HEIGHT_NEW,
  ASSETS_SECTION_HEADER,
  RootNames,
} from '@/constant/layout';
import { useGetBinaryMode, useTheme2024 } from '@/hooks/theme';
import { PositionLoader } from './components/Skeleton';
import { EmptyHolder } from '@/components/EmptyHolder';
import { MenuAction } from '@/components2024/ContextMenuView/ContextMenuView';

import {
  TokenRow,
  DefiRow,
  NftRow,
  TokenRowSectionHeader,
} from './components/AssetRenderItems';
import { NFTItem } from '@rabby-wallet/rabby-api/dist/types';
import { HomeTopArea } from './components/HomeTopArea';
import { useTranslation } from 'react-i18next';
import { useRefreshTags } from './hooks/token';
import { preferenceService } from '@/core/services';
import { toast } from '@/components2024/Toast';
import {
  AssestAllHeader,
  AsssetKey,
} from './components/AssetRenderItems/SectionHeaders';

interface Props {
  onRefresh(): void;
}

export const AssetContainer: React.FC<Props> = ({ onRefresh }) => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();
  const isDarkTheme = useGetBinaryMode() === 'dark';

  const { currentAccount } = useCurrentAccount();
  const {
    tokens,
    refreshPositions,
    portfolios,
    nftList,
    loading,
    refreshing,
    hasAssets,
  } = useQueryProjects(currentAccount?.address);
  const sortTokens = useSortToken(tokens);

  const [foldHideList, setFoldHideList] = useState(true);
  const [foldNft, setFoldNft] = useState(true);
  const [foldDefi, setFoldDefi] = useState(true);

  const {
    sheetModalRef: tokenDetailModalRef,
    openTokenDetailPopup,
    cleanFocusingToken,
    focusingToken,
    isTestnetToken,
  } = useGeneralTokenDetailSheetModal();

  const dataList = useMemo(() => {
    const unFoldTokenList: ActionItem[] = sortTokens
      .filter(i => !i._isFold)
      .map(item => ({
        type: 'unfold_token',
        data: item,
      }));
    const foldTokenList: ActionItem[] = sortTokens
      .filter(i => i._isFold)
      .map(item => ({
        type: 'fold_token',
        data: item,
      }));
    const foldDefiList: ActionItem[] = portfolios
      .filter(i => i._isFold)
      .map(item => ({
        type: 'fold_defi',
        data: item,
      }));
    const unFoldDefiList: ActionItem[] = portfolios
      .filter(i => !i._isFold)
      .map(item => ({
        type: 'unfold_defi',
        data: item,
      }));
    const foldNftList: ActionItem[] = nftList
      .filter(i => i._isFold)
      .map(item => ({
        type: 'fold_nft',
        data: item,
      }));
    const unFoldNftList: ActionItem[] = nftList
      .filter(i => !i._isFold)
      .map(item => ({
        type: 'unfold_nft',
        data: item,
      }));
    const itemData: Array<{
      show: boolean;
      data: ActionItem[];
    }> = [
      {
        show: hasAssets,
        data: [
          {
            type: 'asset_header',
          },
          ...unFoldTokenList,
        ],
      },
      {
        show: !!foldTokenList.length,
        data: [
          { type: 'toggle_token_fold' },
          ...(foldHideList ? [] : foldTokenList),
        ],
      },
      {
        show: !!unFoldDefiList.length,
        data: [{ type: 'defi_header' }, ...unFoldDefiList],
      },
      {
        show: !!foldDefiList.length,
        data: [
          {
            type: 'toggle_defi_fold',
          },
          ...(foldDefi ? [] : foldDefiList),
        ],
      },
      {
        show: !!unFoldNftList.length,
        data: [{ type: 'nft_header' }, ...unFoldNftList],
      },
      {
        show: !!foldNftList.length,
        data: [{ type: 'toggle_nft_fold' }, ...(foldNft ? [] : foldNftList)],
      },
    ];
    return itemData
      .filter(item => item.show)
      .map(item => item.data)
      .flat();
  }, [
    foldDefi,
    foldHideList,
    foldNft,
    hasAssets,
    nftList,
    portfolios,
    sortTokens,
  ]);

  const handleOpenTokenDetail = React.useCallback(
    (token: AbstractPortfolioToken) => {
      if (
        findChain({
          serverId: token.chain,
        })?.isTestnet
      ) {
        openTokenDetailPopup(token);
      } else {
        navigate(RootNames.TokenDetail, {
          token: token,
          // todo fix ts
          account: currentAccount as any,
        });
      }
    },
    [currentAccount, openTokenDetailPopup],
  );
  const handleOpenDefiDetail = useCallback(
    (data: AbstractProject, itemList: AbstractPortfolio[]) => {
      navigate(RootNames.DeFiDetail, {
        data,
        portfolioList: itemList,
        isSingleAddress: true,
      });
    },
    [],
  );
  const handlePressNft = (item: NFTItem) => {
    navigate(RootNames.NftDetail, { token: item, isSingleAddress: true });
  };
  const handleSwitchTab = (key: AsssetKey) => {
    setTimeout(() => {
      let index = 0;
      if (key === 'token') {
        index = 1;
      }
      if (key === 'defi') {
        index = dataList.findIndex(
          item =>
            item.type === 'defi_header' || item.type === 'toggle_defi_fold',
        );
      }
      if (key === 'nft') {
        index = dataList.findIndex(
          item => item.type === 'nft_header' || item.type === 'toggle_nft_fold',
        );
      }
      flatListRef.current?.scrollToIndex({
        animated: true,
        index: index,
        viewOffset: ASSETS_SECTION_HEADER,
      });
    }, 0);
  };

  const ListEmptyComponent = useMemo(() => {
    return loading ? (
      <PositionLoader length={7} space={8} />
    ) : hasAssets ? null : (
      <View style={styles.emptyHolder}>
        <EmptyHolder
          imgStyle={styles.emptyImg}
          textStyle={styles.emptyText}
          text="No Assets"
          type="default"
        />
      </View>
    );
  }, [
    loading,
    hasAssets,
    styles.emptyHolder,
    styles.emptyImg,
    styles.emptyText,
  ]);

  const icons = React.useMemo(
    () => ({
      unfoldDark: require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_unfold_dark.png'),
      unfoldLight: require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_unfold.png'),
      foldDark: require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_fold_dark.png'),
      foldLight: require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_fold.png'),
      pinDark: require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_pin_dark.png'),
      pinLight: require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_pin.png'),
      unpinDark: require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_un_dark.png'),
      unpinLight: require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_un_pin.png'),
    }),
    [],
  );

  const getTokenMenuActions = (data: AbstractPortfolioToken): MenuAction[] => {
    return [
      {
        title: data._isFold
          ? t('page.tokenDetail.action.unfold')
          : t('page.tokenDetail.action.fold'),
        icon: data._isFold
          ? isDarkTheme
            ? icons.unfoldDark
            : icons.unfoldLight
          : isDarkTheme
          ? icons.foldDark
          : icons.foldLight,
        androidIconName: data._isFold
          ? 'ic_rabby_menu_unfold'
          : 'ic_rabby_menu_fold',
        key: 'fold',
        action() {
          if (!currentAccount?.address) {
            return;
          }
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
          refreshTags();
        },
      },
      {
        title: data._isPined
          ? t('page.tokenDetail.action.unpin')
          : t('page.tokenDetail.action.pin'),
        icon: data._isPined
          ? isDarkTheme
            ? icons.unpinDark
            : icons.unpinLight
          : isDarkTheme
          ? icons.pinDark
          : icons.pinLight,
        androidIconName: data._isPined
          ? 'ic_rabby_menu_un_pin'
          : 'ic_rabby_menu_pin',
        key: 'pin',
        action() {
          if (!currentAccount?.address) {
            return;
          }
          if (data._isPined) {
            preferenceService.removePinedToken({
              tokenId: data._tokenId,
              chainId: data.chain,
            });
            toast.success(t('page.tokenDetail.actionsTips.unpin_success'));
          } else {
            preferenceService.pinToken({
              tokenId: data._tokenId,
              chainId: data.chain,
            });
            toast.success(t('page.tokenDetail.actionsTips.pin_success'));
          }
          refreshTags();
        },
      },
    ];
  };

  const renderItem = ({ item: _item }: { item: ActionItem }) => {
    const { type, data } = _item;
    switch (type) {
      case 'unfold_token':
      case 'fold_token':
        return (
          <TokenRow
            data={data}
            style={StyleSheet.flatten([
              styles.renderItemWrapper,
              isDarkTheme && styles.bg2,
            ])}
            onTokenPress={handleOpenTokenDetail}
            menuActions={getTokenMenuActions(data)}
            logoSize={46}
            chainLogoSize={18}
          />
        );
      case 'unfold_defi':
      case 'fold_defi':
        return (
          <DefiRow
            data={data}
            style={StyleSheet.flatten([
              styles.renderItemWrapper,
              isDarkTheme && styles.bg2,
            ])}
            logoSize={46}
            chainLogoSize={18}
            onPress={() =>
              handleOpenDefiDetail(data, [...(data._portfolios || [])])
            }
          />
        );
      case 'unfold_nft':
      case 'fold_nft':
        return (
          <NftRow
            style={StyleSheet.flatten([
              styles.renderItemWrapper,
              isDarkTheme && styles.bg2,
            ])}
            logoSize={46}
            chainLogoSize={18}
            item={data}
            onPress={() => handlePressNft(data)}
          />
        );
      /** header */
      case 'asset_header':
        return (
          <AssestAllHeader
            style={styles.assetHeader}
            onPress={handleSwitchTab}
          />
        );
      case 'toggle_token_fold':
        return (
          <TokenRowSectionHeader
            usdStr={getTotalFoldToken(sortTokens.filter(i => i._isFold))}
            fold={foldHideList}
            style={styles.sectionHeader}
            buttonStyle={StyleSheet.flatten([
              styles.buttonHeader,
              isDarkTheme && styles.bg2,
            ])}
            onPressFold={() => setFoldHideList(pre => !pre)}
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
            // TODO:
            usdStr={getTotalFoldToken(sortTokens.filter(i => i._isFold))}
            fold={foldDefi}
            style={styles.sectionHeader}
            buttonStyle={StyleSheet.flatten([
              styles.buttonHeader,
              isDarkTheme && styles.bg2,
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
            // TODO:
            usdStr={getTotalFoldToken(sortTokens.filter(i => i._isFold))}
            fold={foldNft}
            style={styles.sectionHeader}
            buttonStyle={StyleSheet.flatten([
              styles.buttonHeader,
              isDarkTheme && styles.bg2,
            ])}
            onPressFold={() => setFoldNft(pre => !pre)}
          />
        );
      default:
        return null;
    }
  };
  const { refreshTags } = useRefreshTags();

  const header = useCallback(() => <HomeTopArea />, []);
  const flatListRef = useRef<FlatList>(null);

  if (!currentAccount?.address) {
    return null;
  }

  return (
    <>
      <FlatList<ActionItem>
        data={dataList}
        ref={flatListRef}
        ListHeaderComponent={header}
        renderItem={renderItem}
        ItemSeparatorComponent={ItemSeparatorComponent}
        keyExtractor={item =>
          `${item.type}/${item.data?.id || ''}/${item.data?.chain}`
        }
        contentContainerStyle={styles.bgContainer}
        showsVerticalScrollIndicator={false}
        // windowSize={10}
        // getItemLayout={getItemLayout}
        ListEmptyComponent={ListEmptyComponent}
        stickyHeaderIndices={[1]}
        refreshControl={
          <RefreshControl
            style={styles.bgContainer}
            onRefresh={() => {
              refreshPositions();
              onRefresh();
            }}
            refreshing={refreshing}
          />
        }
      />
      <BottomSheetModalTokenDetail
        __shouldSwitchSceneAccountBeforeRedirect__
        nextTxRedirectAccount={currentAccount}
        ref={tokenDetailModalRef}
        token={focusingToken}
        isTestnet={isTestnetToken}
        onDismiss={() => {
          cleanFocusingToken({ noNeedCloseModal: true });
        }}
        onTriggerDismissFromInternal={() => {
          cleanFocusingToken();
        }}
      />
    </>
  );
};

const ItemSeparatorComponent = () => <View style={{ height: 8 }} />;

const getStyles = createGetStyles2024(ctx => ({
  bgContainer: {
    // backgroundColor: ctx.colors2024['neutral-bg-1'],
  },
  emptyHolder: {
    marginTop: 65,
  },
  emptyImg: {
    width: 160,
    height: 117,
  },
  emptyText: {
    marginTop: 21,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '400',
    fontFamily: 'SF Pro Rounded',
    color: ctx.colors2024['neutral-info'],
  },
  renderItemWrapper: {
    backgroundColor: ctx.colors2024['neutral-bg-1'],
    borderRadius: 16,
    height: ASSETS_ITEM_HEIGHT_NEW,
    paddingLeft: 12,
    paddingRight: 16,
  },
  bg2: {
    backgroundColor: ctx.colors2024['neutral-bg-2'],
  },
  sectionHeader: {
    backgroundColor: ctx.colors2024['neutral-bg-gray'],
    paddingRight: 8,
    height: ASSETS_SECTION_HEADER,
  },
  buttonHeader: {
    backgroundColor: ctx.colors2024['neutral-bg-1'],
  },
  assetHeader: {
    backgroundColor: ctx.colors2024['neutral-bg-gray'],
    height: ASSETS_SECTION_HEADER,
    paddingBottom: 8,
    paddingLeft: 12,
  },
  symbol: {
    fontSize: 16,
    height: ASSETS_SECTION_HEADER,
    lineHeight: ASSETS_SECTION_HEADER,
    paddingLeft: 9,
    fontWeight: '700',
    fontFamily: 'SF Pro Rounded',
    color: ctx.colors2024['neutral-secondary'],
    backgroundColor: ctx.colors2024['neutral-bg-gray'],
  },
}));
