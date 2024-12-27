import React, { useCallback, useMemo, useState } from 'react';
import { SectionList, View } from 'react-native';
import { RefreshControl } from 'react-native-gesture-handler';

import { useCurrentAccount } from '@/hooks/account';
import { navigate } from '@/utils/navigation';
import { createGetStyles2024 } from '@/utils/styles';
import { BottomSheetModalTokenDetail } from '@/components/TokenDetailPopup/BottomSheetModalTokenDetail';
import { useQueryProjects } from './hooks';
import useSortToken from './hooks/useSortTokens';
import {
  getTotalFoldToken,
  getAllDefiCount,
  getAllNftCount,
} from './utils/converAssets';
import {
  AbstractPortfolio,
  AbstractPortfolioToken,
  AbstractProject,
} from './types';
import { DEFI_ID, NFT_ID, SMALL_TOKEN_ID } from '@/utils/token';
import { findChain } from '@/utils/chain';
import { useGeneralTokenDetailSheetModal } from '@/components/TokenDetailPopup/hooks';
import { ASSETS_ITEM_HEIGHT, RootNames } from '@/constant/layout';
import { useGetBinaryMode, useTheme2024 } from '@/hooks/theme';
import { PositionLoader } from './components/Skeleton';
import { EmptyHolder } from '@/components/EmptyHolder';
import { MenuAction } from '@/components2024/ContextMenuView/ContextMenuView';

import {
  TokenRow,
  DefiRow,
  NftRow,
  TokenRowSectionHeader,
  DefiSectionHeader,
  NftSectionHeader,
} from './components/AssetRenderItems';
import { NFTItem } from '@rabby-wallet/rabby-api/dist/types';
import { HomeTopArea } from './components/HomeTopArea';
import { useTranslation } from 'react-i18next';
import { useRefreshTags } from './hooks/token';
import { preferenceService } from '@/core/services';
import { toast } from '@/components2024/Toast';

interface Props {
  onRefresh(): void;
}

export const AssetContainer: React.FC<Props> = ({ onRefresh }) => {
  const { styles } = useTheme2024({ getStyle: getStyles });

  const { currentAccount } = useCurrentAccount();
  const {
    tokens,
    refreshPositions,
    portfolios,
    nftList,
    loading,
    refreshing,
    hasAssets,
  } = useQueryProjects(currentAccount?.address, false, true);
  const sortTokens = useSortToken(tokens);

  const [foldHideList, setFoldHideList] = useState(true);
  const [foldDefi, setFoldDefi] = useState(true);
  const [foldNft, setFoldNft] = useState(true);

  const {
    sheetModalRef: tokenDetailModalRef,
    openTokenDetailPopup,
    cleanFocusingToken,
    focusingToken,
    isTestnetToken,
  } = useGeneralTokenDetailSheetModal();
  const { t } = useTranslation();
  const isDarkTheme = useGetBinaryMode() === 'dark';

  const sections = useMemo(() => {
    const unFoldList = sortTokens.filter(i => !i._isFold);
    const foldList = sortTokens.filter(i => i._isFold);
    return [
      {
        type: 'unfold_token',
        originData: unFoldList,
        data: unFoldList,
      },
      {
        type: 'fold_token',
        originData: foldList,
        data: foldHideList ? [] : foldList,
      },
      {
        type: 'defi',
        originData: portfolios,
        data: foldDefi ? [] : portfolios || [],
      },
      {
        type: 'nft',
        originData: nftList,
        data: foldNft ? [] : nftList || [],
      },
    ];
  }, [foldDefi, foldHideList, foldNft, nftList, portfolios, sortTokens]);

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
      navigate(RootNames.DeFiDetail, { data, portfolioList: itemList });
    },
    [],
  );

  const handlePressNft = (item: NFTItem) => {
    navigate(RootNames.NftDetail, { token: item });
  };

  const ListEmptyComponent = useMemo(() => {
    return loading ? (
      <PositionLoader space={8} />
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
            preferenceService.manualUnFoldToken(currentAccount.address, {
              tokenId: data._tokenId,
              chainId: data.chain,
            });
            toast.success(t('page.tokenDetail.actionsTips.unfold_success'));
          } else {
            preferenceService.manualFoldToken(currentAccount.address, {
              tokenId: data._tokenId,
              chainId: data.chain,
            });
            toast.success(t('page.tokenDetail.actionsTips.fold_success'));
          }
          refreshTags(currentAccount?.address);
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
            preferenceService.removePinedToken(currentAccount?.address, {
              tokenId: data._tokenId,
              chainId: data.chain,
            });
            toast.success(t('page.tokenDetail.actionsTips.unpin_success'));
          } else {
            preferenceService.pinToken(currentAccount?.address, {
              tokenId: data._tokenId,
              chainId: data.chain,
            });
            toast.success(t('page.tokenDetail.actionsTips.pin_success'));
          }
          refreshTags(currentAccount?.address);
        },
      },
    ];
  };

  const renderItem = ({ item, section }) => {
    switch (section.type) {
      case 'unfold_token':
        return (
          <TokenRow
            data={item}
            onTokenPress={handleOpenTokenDetail}
            menuActions={getTokenMenuActions(item)}
            logoSize={40}
          />
        );
      case 'fold_token':
        return (
          <TokenRow
            data={item}
            onTokenPress={handleOpenTokenDetail}
            menuActions={getTokenMenuActions(item)}
            logoSize={40}
          />
        );
      case 'nft':
        return <NftRow item={item} onPress={() => handlePressNft(item)} />;
      case 'defi':
        return (
          <DefiRow
            data={item}
            onPress={() =>
              handleOpenDefiDetail(item, [...(item._portfolios || [])])
            }
          />
        );
      default:
        return null;
    }
  };
  const { refreshTags } = useRefreshTags();

  const renderSectionHeader = ({ section }) => {
    switch (section.type) {
      case 'fold_token':
        return (
          <TokenRowSectionHeader
            usdStr={getTotalFoldToken(sortTokens.filter(i => i._isFold))}
            fold={foldHideList}
            onPressFold={() => setFoldHideList(pre => !pre)}
          />
        );
      case 'defi':
        return (
          <DefiSectionHeader
            usdStr={getAllDefiCount(portfolios || [])}
            fold={foldDefi}
            onPress={() => setFoldDefi(pre => !pre)}
          />
        );
      case 'nft':
        return (
          <NftSectionHeader
            amount={getAllNftCount(nftList || [])}
            fold={foldNft}
            onPress={() => setFoldNft(pre => !pre)}
          />
        );
      default:
        return <View style={{ height: 0 }} />;
    }
  };

  const getItemLayout = useCallback(
    (_data: any, index: number) => ({
      length: ASSETS_ITEM_HEIGHT,
      offset: ASSETS_ITEM_HEIGHT * index,
      index,
    }),
    [],
  );
  const header = useCallback(() => <HomeTopArea />, []);

  if (!currentAccount?.address) {
    return null;
  }

  return (
    <>
      <SectionList
        sections={sections.filter(i => !!i.originData?.length)}
        renderItem={renderItem}
        ListHeaderComponent={header}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.bgContainer}
        keyExtractor={item => `${item.chain}/${item.symbol || ''}/${item.id}`}
        windowSize={10}
        getItemLayout={getItemLayout}
        ListEmptyComponent={ListEmptyComponent}
        stickySectionHeadersEnabled={!foldDefi || !foldNft || !foldHideList}
        renderSectionHeader={renderSectionHeader}
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

const getStyles = createGetStyles2024(ctx => ({
  bgContainer: {
    backgroundColor: ctx.colors2024['neutral-bg-1'],
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
}));
