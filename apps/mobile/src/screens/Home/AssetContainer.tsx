import React, { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { RefreshControl } from 'react-native-gesture-handler';

import { KeyringAccountWithAlias, useCurrentAccount } from '@/hooks/account';
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
  ActionItem,
  DisplayNftItem,
} from './types';
import { findChain } from '@/utils/chain';
import { useGeneralTokenDetailSheetModal } from '@/components/TokenDetailPopup/hooks';
import {
  ASSETS_ITEM_HEIGHT_NEW,
  ASSETS_SECTION_HEADER,
  ASSETS_SEPARATOR_HEIGHT,
  HEADER_TOP_AREA_HEIGHT,
  RootNames,
} from '@/constant/layout';
import { useGetBinaryMode, useTheme2024 } from '@/hooks/theme';
import { MenuAction } from '@/components2024/ContextMenuView/ContextMenuView';

import {
  TokenRow,
  DefiRow,
  NftRow,
  TokenRowSectionHeader,
} from './components/AssetRenderItems';
import { HomeTopArea } from './components/HomeTopArea';
import { useTranslation } from 'react-i18next';
import { preferenceService } from '@/core/services';
import { toast } from '@/components2024/Toast';
import {
  AssestAllHeader,
  AsssetKey,
} from './components/AssetRenderItems/SectionHeaders';
import { DisplayedProject } from './utils/project';
import { flatListRefAtom } from './hooks/store';
import { useSetAtom } from 'jotai';
import { useFocusEffect } from '@react-navigation/native';
import useMemoizedFn from 'ahooks/lib/useMemoizedFn';
import { useTriggerTagAssets } from './hooks/refresh';
import { useAppOrmSyncEvents } from '@/databases/sync/_event';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import throttle from 'lodash/throttle';

const icons = {
  unfoldDark: require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_unfold_dark.png'),
  unfoldLight: require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_unfold.png'),
  foldDark: require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_fold_dark.png'),
  foldLight: require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_fold.png'),
  pinDark: require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_pin_dark.png'),
  pinLight: require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_pin.png'),
  unpinDark: require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_un_dark.png'),
  unpinLight: require('@/assets/icons/ios_ic_rabby_icons/ic_rabby_menu_un_pin.png'),
};

interface Props {
  onRefresh(): void;
}

export const AssetContainer: React.FC<Props> = ({ onRefresh }) => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();
  const isDarkTheme = useGetBinaryMode() === 'dark';

  const { currentAccount, switchAccount } = useCurrentAccount();
  const {
    tokens,
    refreshPositions,
    portfolios,
    nftList,
    loading,
    refreshing,
    hasAssets,
    updateTokens,
    updatePortfolio,
    reloadNftList,
  } = useQueryProjects(currentAccount?.address);
  const sortTokens = useSortToken(tokens);
  const { singleDeFiRefresh, singleNFTRefresh, singleTokenRefresh } =
    useTriggerTagAssets();
  const [foldHideList, setFoldHideList] = useState(true);
  const [foldNft, setFoldNft] = useState(true);
  const [foldDefi, setFoldDefi] = useState(true);
  const [currentSection, setCurrentSection] = useState<AsssetKey>('token');
  const throttleUpdateTokens = useCallback(
    () => throttle(updateTokens, 4000),
    [updateTokens],
  );
  const throttleUpdatePortfolio = useCallback(
    () => throttle(updatePortfolio, 4000),
    [updatePortfolio],
  );
  const throttleReloadNftList = useCallback(
    () => throttle(reloadNftList, 4000),
    [reloadNftList],
  );

  useAppOrmSyncEvents({
    taskFor: ['token', 'nfts', 'portocols'],
    onRemoteDataUpserted: useCallback(
      ctx => {
        if (
          !currentAccount?.address ||
          !isSameAddress(ctx.owner_addr, currentAccount?.address) ||
          !ctx.success
        ) {
          return;
        }
        switch (ctx.taskFor) {
          case 'token':
            throttleUpdateTokens();
            break;
          case 'nfts':
            throttleReloadNftList();
            break;
          case 'portocols':
            throttleUpdatePortfolio();
            break;
          default:
            break;
        }
      },
      [
        currentAccount?.address,
        throttleReloadNftList,
        throttleUpdatePortfolio,
        throttleUpdateTokens,
      ],
    ),
  });

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
        show: true,
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
        show: !!portfolios.length,
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
        show: !!nftList.length,
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
          isSingleAddress: true,
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
        account: currentAccount,
        isSingleAddress: true,
      });
    },
    [currentAccount],
  );
  const handlePressNft = (item: DisplayNftItem) => {
    navigate(RootNames.NftDetail, {
      token: item,
      isSingleAddress: true,
      account: currentAccount as any,
    });
  };
  const handleSwitchTab = (key: AsssetKey) => {
    if (loading || refreshing) {
      toast.info(
        "Ops! The asset wasn't shown yet, please scroll down manually",
      );
      return;
    }
    setFoldHideList(true);
    setTimeout(() => {
      flatListRef.current?.forceUpdate(() => {
        const data = (flatListRef.current?.props.data || []) as ActionItem[];
        let offset = HEADER_TOP_AREA_HEIGHT;
        let index = 0;
        if (key === 'defi') {
          index = data.findIndex(item => item.type === 'defi_header');
        }
        if (key === 'nft') {
          index = data.findIndex(item => item.type === 'nft_header');
        }
        const headerLength = data.slice(0, index).filter(i => !i.data).length;
        if (index > -1 && key !== 'token') {
          offset +=
            index * (ASSETS_ITEM_HEIGHT_NEW + ASSETS_SEPARATOR_HEIGHT) -
            (ASSETS_ITEM_HEIGHT_NEW - ASSETS_SECTION_HEADER) *
              (headerLength + 1);
        }
        flatListRef.current?.scrollToOffset({
          animated: true,
          offset,
        });
      });
    }, 0);
  };

  const getTokenMenuActions = useCallback(
    (data: AbstractPortfolioToken): MenuAction[] => {
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
              flatListRef.current?.scrollToOffset({
                animated: true,
                offset: HEADER_TOP_AREA_HEIGHT,
              });
              toast.success(t('page.tokenDetail.actionsTips.pin_success'));
            }
            singleTokenRefresh();
          },
        },
      ];
    },
    [isDarkTheme, singleTokenRefresh, t],
  );
  const getDefiOrNftMenuAction = useCallback(
    (
      type: 'nft' | 'defi',
      data: DisplayedProject | DisplayNftItem,
    ): MenuAction[] => {
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
            if (data._isFold) {
              if (type === 'defi') {
                preferenceService.manualUnFoldDefi(data.id);
                toast.success(t('page.tokenDetail.actionsTips.unfold_success'));
              } else if (type === 'nft' && data.chain) {
                preferenceService.manualUnFoldNft({
                  chain: data.chain,
                  id: data.id,
                });
                toast.success(t('page.tokenDetail.actionsTips.unfold_success'));
              }
            } else {
              if (type === 'defi') {
                preferenceService.manualFoldDefi(data.id);
                toast.success(t('page.tokenDetail.actionsTips.fold_success'));
              } else if (type === 'nft' && data.chain) {
                preferenceService.manualFoldNft({
                  chain: data.chain,
                  id: data.id,
                });
                toast.success(t('page.tokenDetail.actionsTips.fold_success'));
              }
            }
            if (type === 'defi') {
              singleDeFiRefresh();
            } else if (type === 'nft') {
              singleNFTRefresh();
            }
          },
        },
      ];
    },
    [isDarkTheme, singleDeFiRefresh, singleNFTRefresh, t],
  );

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
            menuActions={getDefiOrNftMenuAction('defi', data)}
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
            menuActions={getDefiOrNftMenuAction('nft', data)}
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
            showToken={!!tokens?.length}
            hasAssets={hasAssets}
            loading={loading}
            currentSection={currentSection}
            setCurrentSection={setCurrentSection}
            showDefi={!!portfolios.length}
            showNft={!!nftList?.length}
            onPress={handleSwitchTab}
          />
        );
      case 'toggle_token_fold':
        return (
          <TokenRowSectionHeader
            str={getTotalFoldToken(sortTokens.filter(i => i._isFold))}
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
            str={getAllDefiCount(portfolios.filter(i => i._isFold))}
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
            str={'' + getAllNftCount(nftList.filter(i => i._isFold))}
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

  const header = useCallback(
    () => <HomeTopArea currentAccount={currentAccount} />,
    [currentAccount],
  );
  const flatListRef = useRef<FlatList>(null);
  const preAccount = useRef<KeyringAccountWithAlias | null>(null);

  const setFlatListRef = useSetAtom(flatListRefAtom);

  React.useEffect(() => {
    setFlatListRef(flatListRef);
  }, [flatListRef, setFlatListRef]);

  useFocusEffect(
    useMemoizedFn(() => {
      if (preAccount.current) {
        switchAccount(preAccount.current);
      } else {
        preAccount.current = currentAccount;
      }
    }),
  );

  const viewabilityConfigRef = useRef({
    viewAreaCoveragePercentThreshold: 300,
    minimumViewTime: 100,
    waitForInteraction: false,
  });
  const onViewableItemsChanged = useCallback(({ viewableItems, changed }) => {
    if (!changed) {
      return;
    }
    const type = (viewableItems?.[0]?.item?.type || '') as string;
    if (type.includes('token')) {
      setCurrentSection('token');
      return;
    }
    if (type.includes('defi')) {
      setCurrentSection('defi');
      return;
    }
    if (type.includes('nft')) {
      setCurrentSection('nft');
      return;
    }
  }, []);

  if (!currentAccount?.address) {
    return null;
  }

  return (
    <>
      <FlatList<ActionItem>
        data={dataList}
        ref={flatListRef}
        viewabilityConfig={viewabilityConfigRef.current}
        onViewableItemsChanged={onViewableItemsChanged}
        ListHeaderComponent={header}
        renderItem={renderItem}
        ItemSeparatorComponent={ItemSeparatorComponent}
        keyExtractor={item =>
          `${item.type}/${item.data?._tokenId || ''}/${item.data?.id || ''}/${
            item.data?.chain || ''
          }`
        }
        contentContainerStyle={styles.bgContainer}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[1]}
        windowSize={10}
        onScrollToIndexFailed={info => {
          console.warn('Scroll to index failed', info);
          if (info.highestMeasuredFrameIndex < info.index) {
            toast.info(
              `Ops! The asset wasn't shown yet, please scroll down manually`,
            );
          }
        }}
        refreshControl={
          <RefreshControl
            style={styles.bgContainer}
            onRefresh={() => {
              refreshPositions(true);
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
