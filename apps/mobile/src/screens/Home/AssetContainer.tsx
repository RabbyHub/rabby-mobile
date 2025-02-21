import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Animated, Dimensions, StyleSheet, Text, View } from 'react-native';
import { RefreshControl } from 'react-native-gesture-handler';

import { KeyringAccountWithAlias, useCurrentAccount } from '@/hooks/account';
import { navigate } from '@/utils/navigation';
import { createGetStyles2024 } from '@/utils/styles';
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
import {
  ASSETS_ITEM_HEIGHT_NEW,
  ASSETS_SECTION_HEADER,
  ASSETS_SEPARATOR_HEIGHT,
  HEADER_TOP_AREA_HEIGHT,
  RootNames,
  TOKEN_EMPTY_ROW_HIGHT,
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
import {
  StackActions,
  useFocusEffect,
  useNavigation,
} from '@react-navigation/native';
import useMemoizedFn from 'ahooks/lib/useMemoizedFn';
import { useTriggerTagAssets } from './hooks/refresh';
import { useAppOrmSyncEvents } from '@/databases/sync/_event';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import throttle from 'lodash/throttle';
import {
  RecyclerListView,
  DataProvider,
  LayoutProvider,
} from 'recyclerlistview';
import { EmptyTokenRow } from './components/AssetRenderItems/EmptyToken';
import { useSwitchSceneCurrentAccount } from '@/hooks/accountsSwitcher';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamsList } from '@/navigation-type';
import { trigger } from 'react-native-haptic-feedback';

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

const ViewTypes = {
  HEADER: 0,
  BODY: 1,
  OVERVIEW: 2,
  EMPTY_TOKEN: 3,
};

const SCREEN_WIDTH = Dimensions.get('window').width - 32;

type RecyclerListViewRef = React.ElementRef<typeof RecyclerListView>;
interface Props {
  onRefresh(): void;
}
const FOOTER_HEIGHT = 56;

const getItemId = item => {
  return `${item.type}/${item.data?.chain || ''}/${item.data?.symbol || ''}/${
    item.data?._tokenId || ''
  }/${item.data?.id || ''}/${item.data?.price_24h_change || ''}/${
    item.data?.price || ''
  }/${item.data?.time_at || ''}/${item.data?._isFold ? 'fold' : 'unfold'}/${
    item.data?._isPined ? 'pin' : 'unpin'
  }`;
};

export const AssetContainer: React.FC<Props> = ({ onRefresh }) => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();
  const isDarkTheme = useGetBinaryMode() === 'dark';
  const [firstRowType, setFirstRowType] = useState('');

  const { currentAccount, switchAccount } = useCurrentAccount();
  const navigation =
    useNavigation<NativeStackScreenProps<RootStackParamsList>['navigation']>();
  const [showScrollIndicator, setShowScrollIndicator] = useState(false);
  const {
    tokens,
    refreshPositions,
    portfolios,
    nftList,
    loadingToken,
    refreshing,
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
  const dataProvider = useMemo(
    () =>
      new DataProvider((r1, r2) => {
        return getItemId(r1) !== getItemId(r2);
      }),
    [],
  );

  const [listData, setListData] = useState(() =>
    dataProvider.cloneWithRows([]),
  );

  const layoutProvider = useMemo(() => {
    return new LayoutProvider(
      index => {
        const item = listData.getDataForIndex(index);
        if (item.type === 'overview') {
          return ViewTypes.OVERVIEW;
        }
        if (item.type === 'empty-token') {
          return ViewTypes.EMPTY_TOKEN;
        }
        if (
          item?.type?.includes('_header') ||
          item?.type?.includes('toggle_')
        ) {
          return ViewTypes.HEADER;
        }
        return ViewTypes.BODY;
      },
      (type, dim) => {
        switch (type) {
          case ViewTypes.OVERVIEW:
            dim.width = SCREEN_WIDTH;
            dim.height = HEADER_TOP_AREA_HEIGHT;
            break;
          case ViewTypes.HEADER:
            dim.width = SCREEN_WIDTH;
            dim.height = ASSETS_SECTION_HEADER + ASSETS_SEPARATOR_HEIGHT;
            break;
          case ViewTypes.EMPTY_TOKEN:
            dim.width = SCREEN_WIDTH;
            dim.height = TOKEN_EMPTY_ROW_HIGHT + ASSETS_SEPARATOR_HEIGHT;
            break;
          default:
            dim.width = SCREEN_WIDTH;
            dim.height = ASSETS_ITEM_HEIGHT_NEW + ASSETS_SEPARATOR_HEIGHT;
        }
      },
    );
  }, [listData]);

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
  const { switchSceneCurrentAccount } = useSwitchSceneCurrentAccount();

  useAppOrmSyncEvents({
    taskFor: ['token', 'nfts', 'protocols'],
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
          case 'protocols':
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
          { type: 'overview' },
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
        show: !loadingToken && !sortTokens.length,
        data: [
          {
            type: 'empty-token',
          },
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
  }, [
    foldDefi,
    foldHideList,
    foldNft,
    loadingToken,
    nftList,
    portfolios,
    sortTokens,
  ]);

  useEffect(() => {
    setListData(dataProvider.cloneWithRows(dataList));
  }, [dataList, dataProvider]);

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
  const handlePressNft = (item: DisplayNftItem) => {
    navigate(RootNames.NftDetail, {
      token: item,
      isSingleAddress: true,
      account: currentAccount as any,
    });
  };
  const handleSwitchTab = (key: AsssetKey) => {
    if (loadingToken || refreshing) {
      toast.info(
        "Ops! The asset wasn't shown yet, please scroll down manually",
      );
      return;
    }
    setFoldHideList(true);
    setTimeout(() => {
      listRef.current?.forceUpdate(() => {
        const data = (listRef.current?.props.dataProvider.getAllData() ||
          []) as ActionItem[];
        let index = 1;
        if (key === 'defi') {
          index = data.findIndex(item => item.type === 'defi_header');
        }
        if (key === 'nft') {
          index = data.findIndex(item => item.type === 'nft_header');
        }
        listRef.current?.scrollToIndex(index, true);
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

  const handleOnReceive = async () => {
    trigger('impactLight', {
      enableVibrateFallback: true,
      ignoreAndroidSystemSettings: false,
    });
    if (!currentAccount?.address) {
      return;
    }
    await switchSceneCurrentAccount('MakeTransactionAbout', currentAccount);
    navigation.dispatch(
      StackActions.push(RootNames.StackTransaction, {
        screen: RootNames.Receive,
      }),
    );
  };

  const handleOnBuy = async () => {
    trigger('impactLight', {
      enableVibrateFallback: true,
      ignoreAndroidSystemSettings: false,
    });
    if (!currentAccount?.address) {
      return;
    }
    await switchSceneCurrentAccount('MakeTransactionAbout', currentAccount);
    navigation.push(RootNames.StackTransaction, {
      screen: RootNames.Buy,
      params: {},
    });
  };

  const renderItem = (_type, _data) => {
    const { type, data } = _data;
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
            currentSection={currentSection}
            hasToken={!!tokens?.length}
            hasDefi={!!portfolios.length}
            hasNft={!!nftList?.length}
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
      case 'overview':
        return <HomeTopArea currentAccount={currentAccount} />;
      case 'empty-token':
        return (
          <EmptyTokenRow onReceive={handleOnReceive} onBuy={handleOnBuy} />
        );
      default:
        return null;
    }
  };

  const listRef = useRef<RecyclerListViewRef>(null);
  const preAccount = useRef<KeyringAccountWithAlias | null>(null);

  const currentSection = useMemo(() => {
    if (firstRowType.includes('token')) {
      return 'token';
    }
    if (firstRowType.includes('defi')) {
      return 'defi';
    }
    if (firstRowType.includes('nft')) {
      return 'nft';
    }
    return 'token';
  }, [firstRowType]);

  useFocusEffect(
    useMemoizedFn(() => {
      if (preAccount.current) {
        switchAccount(preAccount.current);
      } else {
        preAccount.current = currentAccount;
      }
    }),
  );

  const renderStickHeader = (type: string) => {
    switch (type) {
      case 'fold_token':
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
      case 'fold_defi':
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
      case 'fold_nft':
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

  if (!currentAccount?.address) {
    return null;
  }

  return (
    <View style={styles.container}>
      {firstRowType !== 'asset_header' && (
        <Animated.View style={[styles.bgContainer, styles.stickyHeader]}>
          <AssestAllHeader
            style={styles.assetHeader}
            currentSection={currentSection}
            hasToken={!!tokens?.length}
            hasDefi={!!portfolios.length}
            hasNft={!!nftList?.length}
            onPress={handleSwitchTab}
          />
          {renderStickHeader(firstRowType)}
        </Animated.View>
      )}
      <RecyclerListView
        style={[styles.bgContainer, styles.list]}
        dataProvider={listData}
        layoutProvider={layoutProvider}
        rowRenderer={renderItem}
        ref={listRef}
        onVisibleIndicesChanged={indexes => {
          if (listData.getDataForIndex(indexes[1])?.type) {
            setFirstRowType(listData.getDataForIndex(indexes[1]).type);
          }
        }}
        onScroll={event => {
          if (
            event.nativeEvent.contentSize &&
            event.nativeEvent.layoutMeasurement
          ) {
            const reachEnd =
              event.nativeEvent.contentSize.height -
                event.nativeEvent.layoutMeasurement.height -
                event.nativeEvent.contentOffset.y <=
              FOOTER_HEIGHT;
            const reachTop =
              event.nativeEvent.contentOffset.y <= HEADER_TOP_AREA_HEIGHT;
            setShowScrollIndicator(!reachEnd && !reachTop);
          }
        }}
        renderFooter={() => <View style={styles.footer} />}
        scrollViewProps={{
          showsVerticalScrollIndicator: showScrollIndicator,
          refreshControl: (
            <RefreshControl
              style={styles.bgContainer}
              onRefresh={() => {
                refreshPositions(true);
                onRefresh();
              }}
              refreshing={refreshing}
            />
          ),
        }}
      />
    </View>
  );
};

const getStyles = createGetStyles2024(ctx => ({
  container: {
    flex: 1,
  },
  list: {
    flex: 1,
    paddingHorizontal: 16,
  },
  stickyHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: ASSETS_SECTION_HEADER,
    paddingHorizontal: 16,
    zIndex: 1,
  },
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
  footer: {
    height: FOOTER_HEIGHT,
  },
}));
