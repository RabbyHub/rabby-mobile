import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Animated,
  Dimensions,
  ImageBackground,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { RefreshControl } from 'react-native-gesture-handler';

import {
  ADDRESS_ENTRY_GAP,
  ADDRESS_ENTRY_HEIGHT,
  AppRootName,
  ASSETS_EMPTY_ROW_HIGHT,
  ASSETS_ITEM_HEIGHT_NEW,
  ASSETS_LIST_HEADER,
  ASSETS_SECTION_HEADER,
  ASSETS_SEPARATOR_HEIGHT,
  DEFI_ITEM_HEIGHT,
  DEFI_SEPARATOR_HEIGHT,
  HEADER_CHART_HEIGHT,
  RootNames,
  SWITCH_HEADER_GAP,
  SWITCH_HEADER_HEIGHT,
  TOGGLE_SPLIT_HEIGHT,
  TOKEN_EMPTY_ROW_HIGHT,
} from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';
import {
  DefiRow,
  TokenRow,
  TokenRowSectionHeader,
} from '@/screens/Home/components/AssetRenderItems';
import {
  AbstractPortfolio,
  AbstractPortfolioToken,
  AbstractProject,
  ActionItem,
} from '@/screens/Home/types';
import {
  getAllDefiCount,
  getTotalFoldToken,
} from '@/screens/Home/utils/converAssets';
import { navigate } from '@/utils/navigation';
import { createGetStyles2024 } from '@/utils/styles';
import { useAssets } from '@/screens/Search/useAssets';
import { ItemLoader } from '@/screens/Search/components/Skeleton';
import {
  RecyclerListView,
  DataProvider,
  LayoutProvider,
} from 'recyclerlistview';
import { getItemId } from '@/screens/Home/utils/listRenderId';
import { chunk } from 'lodash';
import { MultiChart } from './RenderRow/CurveChart';
import { useMultiCurve } from '@/hooks/useMultiCurve';
import { TabType, SwitchHeader } from './RenderRow/SwtichHeader';
import { AddressEntry } from './RenderRow/AddressEntry';
import { OtherAddressNav } from '../OtherAddressNav';
import { StackActions, useNavigation } from '@react-navigation/native';
import { CurrentAddressProps } from '../AddressListScreenContainer';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import { useAccountInfo } from './hooks';
import { formChartData } from '@/hooks/useCurve';
import { trigger } from 'react-native-haptic-feedback';
import { EmptyAssets } from '@/screens/Home/components/AssetRenderItems/EmptyAssets';
import { DefiItemLoader } from '@/screens/Home/components/Skeleton';
import useAccountsBalance from '@/hooks/useAccountsBalance';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { useBalanceUpdate } from './hooks/balance';
import { MenuAction } from '@/components2024/ContextMenuView/ContextMenuView';
import { icons } from '@/screens/Home/AssetContainer';
import { preferenceService } from '@/core/services';
import { toast } from '@/components2024/Toast';
import { useTriggerTagAssets } from '@/screens/Home/hooks/refresh';
import { DisplayedProject } from '@/screens/Home/utils/project';
import { Card } from '@/components2024/Card';
import PlusSVG from '@/assets2024/icons/common/plus-cc.svg';
import { useSetPasswordFirst } from '@/hooks/useLock';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS, useSharedValue } from 'react-native-reanimated';

const END_POSITION = 60;
const SCREEN_WIDTH = Dimensions.get('window').width;
type RecyclerListViewRef = React.ElementRef<typeof RecyclerListView>;

const ViewTypes = {
  HEADER: 0,
  BODY: 1,
  OVERVIEW: 2,
  EMPTY_TOKEN: 3,
  EMPTY_ASSETS: 4,
  EMPTY_DEFI: 5,
  DEFI: 6,
  SWITCH_HEADER: 7,
  ADDRESS_ENTRY: 8,
  SAFE_ADDRESS_NAV: 9,
  WATCH_ADDRESS_NAV: 10,
  ASSET_HEADER: 11,
};

export const MultiAssets = ({
  onUpdateIsDecrease,
  onReachTopStatusChange,
}: {
  onUpdateIsDecrease: (isDecrease: boolean) => void;
  onReachTopStatusChange?: (status: boolean) => void;
}) => {
  const { styles, isLight, colors2024 } = useTheme2024({ getStyle: getStyles });
  const isTriggered = useSharedValue(false);
  const {
    top10Addresses,
    list: _rawList,
    hasWatchAddress,
    hasSafeAddress,
    fetchAccounts,
  } = useAccountInfo();

  const { triggerUpdate, getTotalBalance, balanceAccounts } =
    useAccountsBalance({
      cacheTime: 10 * 60 * 1000,
      accountsNoUnique: true, // balanceAccounts has filter same address accounts
    });

  const top10Balance = useMemo(() => {
    return getTotalBalance(top10Addresses);
  }, [top10Addresses, getTotalBalance]);

  const list = useMemo(() => {
    return _rawList.map(item => {
      const account = balanceAccounts.find(acc =>
        isSameAddress(acc.address, item.address),
      );
      return {
        ...item,
        balance: account?.balance || item.balance || 0,
      };
    });
  }, [balanceAccounts, _rawList]);

  const {
    tokens,
    portfolios,
    getCacheTop10Assets,
    checkIsExpireAndUpdate,
    refreshing,
    isLoading,
  } = useAssets();

  const {
    multiTimeStamp,
    combineData,
    refresh: refreshCurve,
    isLoadingNew: isLoadingCurve,
  } = useMultiCurve(top10Addresses, false, top10Balance);

  const listRef = useRef<RecyclerListViewRef>(null);
  const [firstRowType, setFirstRowType] = useState('');

  const navigation = useNavigation<CurrentAddressProps['navigation']>();

  const { t } = useTranslation();
  const dataProvider = useMemo(
    () =>
      new DataProvider((r1, r2) => {
        return getItemId(r1) !== getItemId(r2);
      }),
    [],
  );

  const [foldHideList, setFoldHideList] = useState(true);
  const [foldDefi, setFoldDefi] = useState(true);
  const [extendedState, setExtendedState] = useState<{
    currentTab: TabType;
    isLight: boolean;
    combineData?: any;
  }>({
    currentTab: TabType.address,
    combineData,
    isLight: isLight,
  });

  useEffect(() => {
    setExtendedState(prev => ({ ...prev, isLight, combineData }));
  }, [isLight, combineData]);

  useEffect(() => {
    onUpdateIsDecrease(combineData.isLoss);
  }, [combineData.isLoss, onUpdateIsDecrease]);

  const [listData, setListData] = useState(() =>
    dataProvider.cloneWithRows([{ type: 'overview' }, { type: 'switch_tabs' }]),
  );
  useBalanceUpdate(triggerUpdate);

  const dataList = useMemo(() => {
    const unFoldList: ActionItem[] = tokens
      .filter(i => !i._isFold)
      .map(item => ({
        type: 'unfold_token',
        data: item,
      }));
    const foldAndIncludeBalanceTokenList: ActionItem[] = tokens
      .filter(i => i._isFold && !i._isExcludeBalance && i._realUsdValue > 0)
      .map(item => ({
        type: 'fold_token',
        data: item,
      }));
    const foldAndExcludeBalanceTokenList: ActionItem[] = tokens
      .filter(i => i._isFold && (i._isExcludeBalance || i._realUsdValue === 0))
      .map(item => ({
        type: 'fold_token',
        data: item,
      }));
    const foldTokenList = [
      ...foldAndIncludeBalanceTokenList,
      ...foldAndExcludeBalanceTokenList,
    ];
    const foldAndIncludeBalanceDefiList = portfolios.filter(
      i => i._isFold && !i._isExcludeBalance && i.netWorth > 0,
    );
    const foldAndExcludeBalanceDefiList = portfolios.filter(
      i => i._isFold && (i._isExcludeBalance || i.netWorth === 0),
    );
    const foldDefiList: ActionItem[] = chunk(
      [...foldAndIncludeBalanceDefiList, ...foldAndExcludeBalanceDefiList],
      2,
    ).map(item => ({
      type: 'fold_defi',
      data: item,
    }));
    const unFoldDefiList: ActionItem[] = chunk(
      portfolios.filter(i => !i._isFold),
      2,
    ).map(item => ({
      type: 'unfold_defi',
      data: item,
    }));
    const showPortfolios = extendedState.currentTab === TabType.portfolio;
    const itemData: Array<{
      show: boolean;
      data: ActionItem[];
    }> = [
      {
        show: true,
        data: [{ type: 'overview' }, { type: 'switch_tabs' }],
      },
      {
        show: showPortfolios,
        data: [...unFoldList],
      },
      {
        show: !showPortfolios,
        data: showPortfolios
          ? []
          : list.map(item => {
              const hasChangeData = multiTimeStamp[
                item.address.toLocaleLowerCase()
              ]?.data?.some(i => i.usd_value !== 0);
              const chartData = formChartData(
                multiTimeStamp[item.address.toLocaleLowerCase()]?.data || [],
                item.balance,
                new Date().getTime(),
              );
              return {
                type: 'address_entry',
                data: {
                  ...item,
                  changPercent: hasChangeData
                    ? chartData?.changePercent
                    : undefined,
                  isLoss: hasChangeData ? chartData?.isLoss : undefined,
                },
              };
            }),
      },
      {
        show: showPortfolios && !!foldTokenList.length,
        data: [
          { type: 'toggle_token_fold' },
          ...(foldHideList ? [] : foldTokenList),
        ],
      },
      {
        show: showPortfolios && !!isLoading && !tokens.length,
        data: Array.from({ length: 5 }, () => ({
          type: 'loading-skeleton',
        })),
      },
      {
        show: showPortfolios && !isLoading && !tokens.length,
        data: [
          {
            type: 'empty-assets',
            data: t('page.singleHome.sectionHeader.NoData', {
              name: t('page.singleHome.sectionHeader.Token'),
            }),
          },
        ],
      },
      {
        show: showPortfolios,
        data: [{ type: 'defi_header' }, ...unFoldDefiList],
      },
      {
        show: showPortfolios && !!foldDefiList.length,
        data: [
          {
            type: 'toggle_defi_fold',
          },
          ...(foldDefi ? [] : foldDefiList),
        ],
      },
      {
        show: showPortfolios && !!isLoading && !portfolios.length,
        data: Array.from({ length: 2 }, () => ({
          type: 'loading-defi-skeleton',
        })),
      },
      {
        show: showPortfolios && !isLoading && portfolios.length === 0,
        data: [
          {
            type: 'empty-defi',
            data: t('page.singleHome.sectionHeader.NoData', {
              name: t('page.singleHome.sectionHeader.Defi'),
            }),
          },
        ],
      },
    ];
    return itemData
      .filter(item => item.show)
      .map(item => item.data)
      .flat();
  }, [
    extendedState.currentTab,
    foldDefi,
    foldHideList,
    isLoading,
    list,
    multiTimeStamp,
    portfolios,
    t,
    tokens,
  ]);

  useEffect(() => {
    setListData(dataProvider.cloneWithRows(dataList));
  }, [dataList, dataProvider]);

  const pathColor = !combineData.isLoss
    ? colors2024['green-default']
    : colors2024['red-default'];

  const handleOpenTokenDetail = React.useCallback(
    (token: AbstractPortfolioToken) => {
      navigate(RootNames.TokenDetail, {
        token: token,
        unHold: token._unHold,
        needUseCacheToken: true,
      });
    },
    [],
  );

  const handleOpenDefiDetail = useCallback(
    (data: AbstractProject, itemList: AbstractPortfolio[]) => {
      navigate(RootNames.DeFiDetail, {
        data,
        portfolioList: itemList,
        cache: true,
      });
    },
    [],
  );

  const onGotoWatchAddress = React.useCallback(() => {
    navigation.push(RootNames.StackAddress, {
      screen: RootNames.WatchAddressList,
    });
  }, [navigation]);

  const onGotoSafeAddress = React.useCallback(() => {
    navigation.push(RootNames.StackAddress, {
      screen: RootNames.SafeAddressList,
    });
  }, [navigation]);

  const { shouldRedirectToSetPasswordBefore2024 } = useSetPasswordFirst();
  const gotoAddAddress = React.useCallback(() => {
    const id = createGlobalBottomSheetModal2024({
      name: MODAL_NAMES.ADD_ADDRESS_SELECT_METHOD,
      onDone: () => {
        removeGlobalBottomSheetModal2024(id);
      },
      shouldRedirectToSetPasswordBefore2024,
      navigateTo: (screen: AppRootName, params?: object) => {
        navigation.dispatch(
          StackActions.push(RootNames.StackAddress, {
            screen,
            params,
          }),
        );
      },
    });
  }, [shouldRedirectToSetPasswordBefore2024, navigation]);
  const scrollToTop = () => {
    setFoldHideList(true);
    setTimeout(() => {
      listRef.current?.scrollToOffset(0, 0, true);
    }, 200);
  };
  const { tokenRefresh } = useTriggerTagAssets();

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
            tokenRefresh();
          },
        },
      ];
    },
    [isLight, tokenRefresh, t],
  );
  const getDefiOrNftMenuAction = useCallback(
    (type: 'defi', data: DisplayedProject): MenuAction[] => {
      const isFold = data._isFold;
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
              preferenceService.manualUnFoldDefi(data.id);
              toast.success(t('page.tokenDetail.actionsTips.unfold_success'));
            } else {
              preferenceService.manualFoldDefi(data.id);
              toast.success(t('page.tokenDetail.actionsTips.fold_success'));
            }
            tokenRefresh();
          },
        },
      ];
    },
    [isLight, t, tokenRefresh],
  );

  const renderItem = (_type, _data) => {
    const { type, data } = _data;
    switch (type) {
      case 'overview':
        return (
          <MultiChart
            isOffline={false}
            data={combineData}
            loading={isLoadingCurve}
            pathColor={pathColor}
            isNoAssets={false}
          />
        );
      case 'address_entry':
        return <AddressEntry data={data} />;
      case 'switch_tabs':
        return (
          <SwitchHeader
            currentTab={extendedState.currentTab}
            addressLength={list.length}
            onChangeTab={tab => {
              trigger('impactLight', {
                enableVibrateFallback: true,
                ignoreAndroidSystemSettings: false,
              });
              setExtendedState(pre => ({
                ...pre,
                currentTab: tab,
              }));
            }}
          />
        );

      case 'unfold_token':
      case 'fold_token':
        return (
          <TokenRow
            data={data}
            onTokenPress={handleOpenTokenDetail}
            logoSize={46}
            style={styles.renderItemWrapper}
            chainLogoSize={18}
            menuActions={getTokenMenuActions(data)}
          />
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
                handleOpenDefiDetail(data[0], [...(data[0]._portfolios || [])])
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
      case 'toggle_token_fold':
        return (
          <TokenRowSectionHeader
            style={styles.tokenSectionHeader}
            str={getTotalFoldToken(tokens.filter(i => i._isFold))}
            fold={foldHideList}
            onPressFold={() => setFoldHideList(pre => !pre)}
          />
        );
      case 'defi_header':
        return (
          <Text style={[styles.sectionHeader, styles.sectionTextHeader]}>
            {t('page.search.sectionHeader.Defi')}
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
              !isLight && styles.bg2,
            ])}
            onPressFold={() => setFoldDefi(pre => !pre)}
          />
        );
      case 'empty-assets':
      case 'empty-defi':
        return (
          <EmptyAssets style={styles.emptyAssets} desc={data} type={type} />
        );
      case 'loading-skeleton':
        return <ItemLoader style={{ height: ASSETS_ITEM_HEIGHT_NEW }} />;
      case 'loading-defi-skeleton':
        return <DefiItemLoader style={styles.defiLoading} />;
      default:
        return null;
    }
  };

  const layoutProvider = useMemo(() => {
    return new LayoutProvider(
      index => {
        const item = listData.getDataForIndex(index);
        if (item.type === 'overview') {
          return ViewTypes.OVERVIEW;
        }
        if (item.type === 'address_entry') {
          return ViewTypes.ADDRESS_ENTRY;
        }
        if (item.type === 'empty-token') {
          return ViewTypes.EMPTY_TOKEN;
        }
        if (item.type === 'empty-assets') {
          return ViewTypes.EMPTY_ASSETS;
        }
        if (item.type === 'empty-defi') {
          return ViewTypes.EMPTY_DEFI;
        }
        if (
          item.type === 'fold_defi' ||
          item.type === 'unfold_defi' ||
          item.type === 'loading-defi-skeleton'
        ) {
          return ViewTypes.DEFI;
        }
        if (item?.type?.includes('_header')) {
          return ViewTypes.ASSET_HEADER;
        }
        if (item?.type?.includes('toggle_')) {
          return ViewTypes.HEADER;
        }
        if (item.type === 'switch_tabs') {
          return ViewTypes.SWITCH_HEADER;
        }
        return ViewTypes.BODY;
      },
      (type, dim) => {
        switch (type) {
          case ViewTypes.OVERVIEW:
            dim.width = SCREEN_WIDTH - 32;
            dim.height = HEADER_CHART_HEIGHT;
            break;
          case ViewTypes.ASSET_HEADER:
            dim.width = SCREEN_WIDTH - 32;
            dim.height = ASSETS_LIST_HEADER + ASSETS_SEPARATOR_HEIGHT;
            break;
          case ViewTypes.HEADER:
            dim.width = SCREEN_WIDTH - 32;
            dim.height = ASSETS_SECTION_HEADER + TOGGLE_SPLIT_HEIGHT;
            break;
          case ViewTypes.EMPTY_TOKEN:
            dim.width = SCREEN_WIDTH - 32;
            dim.height = TOKEN_EMPTY_ROW_HIGHT + ASSETS_SEPARATOR_HEIGHT;
            break;
          case ViewTypes.EMPTY_ASSETS:
          case ViewTypes.EMPTY_DEFI:
            dim.width = SCREEN_WIDTH - 32;
            dim.height = ASSETS_EMPTY_ROW_HIGHT + ASSETS_SEPARATOR_HEIGHT;
            break;
          case ViewTypes.DEFI:
            dim.width = SCREEN_WIDTH - 32;
            dim.height = DEFI_ITEM_HEIGHT + DEFI_SEPARATOR_HEIGHT;
            break;
          case ViewTypes.SWITCH_HEADER:
            dim.width = SCREEN_WIDTH - 32;
            dim.height = SWITCH_HEADER_HEIGHT + SWITCH_HEADER_GAP;
            break;
          case ViewTypes.ADDRESS_ENTRY:
            dim.width = SCREEN_WIDTH - 32;
            dim.height = ADDRESS_ENTRY_HEIGHT + ADDRESS_ENTRY_GAP;
            break;
          default:
            dim.width = SCREEN_WIDTH - 32;
            dim.height = ASSETS_ITEM_HEIGHT_NEW + ASSETS_SEPARATOR_HEIGHT;
        }
      },
    );
  }, [listData]);
  const topBg = useMemo(() => {
    if (combineData.isLoss) {
      if (isLight) {
        return require('@/assets2024/singleHome/home-loss-bg-2.png');
      } else {
        return require('@/assets2024/singleHome/home-loss-dark-bg-2.png');
      }
    } else {
      if (isLight) {
        return require('@/assets2024/singleHome/home-profit-bg-2.png');
      } else {
        return require('@/assets2024/singleHome/home-profit-dark-bg-2.png');
      }
    }
  }, [combineData.isLoss, isLight]);

  useLayoutEffect(() => {
    getCacheTop10Assets({
      disableNFT: true,
      realTimeAddresses: top10Addresses,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [top10Addresses.length]);

  useEffect(() => {
    const id = setTimeout(() => {
      checkIsExpireAndUpdate(false, {
        disableNFT: true,
        realTimeAddresses: top10Addresses,
      });
    }, 500);
    return () => {
      clearTimeout(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [top10Addresses.length]);

  const switchTab = (type: TabType) => {
    if (isTriggered.value) return;
    isTriggered.value = true;
    setExtendedState(pre => ({
      ...pre,
      currentTab: type,
    }));
    scrollToTop();
  };

  const panGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-20, 20])
    .hitSlop({ left: -40 })
    .simultaneousWithExternalGesture(listRef as any)
    .onUpdate(e => {
      if (e.translationX <= -END_POSITION) {
        if (extendedState.currentTab === TabType.address) {
          runOnJS(switchTab)(TabType.portfolio);
        }
      }
      if (e.translationX > -END_POSITION) {
        if (extendedState.currentTab === TabType.portfolio) {
          runOnJS(switchTab)(TabType.address);
        }
      }
    })
    .onEnd(e => {
      isTriggered.value = false;
    });
  const fadeAnim = React.useRef(new Animated.Value(1)).current;
  const handleReachTopStatusChange = (status: boolean) => {
    Animated.timing(fadeAnim, {
      toValue: status ? 1 : 0,
      duration: 100,
      useNativeDriver: true,
    }).start();
    onReachTopStatusChange?.(status);
  };

  return (
    <GestureDetector gesture={panGesture}>
      <View style={styles.container}>
        {firstRowType === 'overview' ||
        firstRowType === '' ||
        !list.length ? null : (
          <Animated.View style={[styles.bgContainer, styles.stickyHeader]}>
            <Animated.View style={{ opacity: fadeAnim }}>
              <ImageBackground
                source={topBg}
                resizeMode="cover"
                // eslint-disable-next-line react-native/no-inline-styles
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: SCREEN_WIDTH,
                  height: 150,
                }}
              />
            </Animated.View>
            <SwitchHeader
              currentTab={extendedState.currentTab}
              addressLength={list.length}
              onChangeTab={tab => {
                setExtendedState(pre => ({
                  ...pre,
                  currentTab: tab,
                }));
                scrollToTop();
              }}
            />
          </Animated.View>
        )}
        <RecyclerListView
          style={styles.list}
          dataProvider={listData}
          extendedState={extendedState}
          layoutProvider={layoutProvider}
          ref={listRef}
          rowRenderer={renderItem}
          onVisibleIndicesChanged={indexes => {
            if (listData.getDataForIndex(indexes[0])?.type) {
              setFirstRowType(listData.getDataForIndex(indexes[0]).type);
            }
          }}
          onScroll={event => {
            if (
              event.nativeEvent.contentSize &&
              event.nativeEvent.layoutMeasurement
            ) {
              if (event.nativeEvent.contentOffset.y <= 0) {
                handleReachTopStatusChange(true);
              } else {
                handleReachTopStatusChange(false);
              }
            }
          }}
          renderFooter={() =>
            extendedState.currentTab === TabType.address ? (
              <View>
                <Card style={styles.footerCard} onPress={gotoAddAddress}>
                  <View style={styles.footerMain}>
                    <PlusSVG
                      width={20}
                      height={20}
                      color={colors2024['neutral-secondary']}
                    />
                    <Text style={styles.footerCardText}>
                      {t('page.addressDetail.addressListScreen.addAddress')}
                    </Text>
                  </View>
                </Card>
                {hasSafeAddress && (
                  <OtherAddressNav
                    onPress={onGotoSafeAddress}
                    text={t(
                      'page.addressDetail.addressListScreen.importSafeAddress',
                    )}
                  />
                )}
                {hasWatchAddress && (
                  <OtherAddressNav
                    onPress={onGotoWatchAddress}
                    text={t(
                      'page.addressDetail.addressListScreen.importWatchAddress',
                    )}
                  />
                )}
                <View style={styles.footerGap} />
              </View>
            ) : (
              <View style={styles.footerGap} />
            )
          }
          scrollViewProps={{
            refreshControl: (
              <RefreshControl
                style={styles.bgContainer}
                onRefresh={() => {
                  triggerUpdate(true);
                  fetchAccounts();
                  checkIsExpireAndUpdate(true, { disableNFT: true });
                  refreshCurve(true);
                }}
                refreshing={refreshing}
              />
            ),
          }}
        />
      </View>
    </GestureDetector>
  );
};

const getStyles = createGetStyles2024(ctx => ({
  container: {
    flex: 1,
    // marginTop: -10,
  },
  list: {
    flex: 1,
    backgroundColor: ctx.isLight
      ? ctx.colors2024['neutral-bg-0']
      : ctx.colors2024['neutral-bg-1'],
    paddingHorizontal: 16,
  },
  stickyHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: SWITCH_HEADER_HEIGHT,
    overflow: 'hidden',
    backgroundColor: ctx.colors2024['neutral-bg-0'],
    // height: ASSETS_SECTION_HEADER,
    zIndex: 1,
  },
  bgContainer: {
    backgroundColor: ctx.isLight
      ? ctx.colors2024['neutral-bg-0']
      : ctx.colors2024['neutral-bg-1'],
    paddingHorizontal: 16,
    // paddingBottom: 12,
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
  sectionHeader: {
    fontFamily: 'SF Pro Rounded',
    fontSize: 18,
    fontWeight: '500',
    lineHeight: 22,
    height: ASSETS_SECTION_HEADER,
    color: ctx.colors2024['neutral-secondary'],
    paddingLeft: 0,
    paddingRight: 0,
    backgroundColor: ctx.isLight
      ? ctx.colors2024['neutral-bg-0']
      : ctx.colors2024['neutral-bg-1'],
  },
  sectionTextHeader: {
    height: ASSETS_LIST_HEADER,
  },
  tokenSectionHeader: {
    paddingLeft: 0,
    paddingRight: 0,
  },
  emptyAssets: {
    marginHorizontal: 0,
  },
  defiLoading: {
    paddingHorizontal: 0,
  },
  renderItemWrapper: {
    height: ASSETS_ITEM_HEIGHT_NEW,
    // marginBottom: 8,
  },
  footer: {
    minHeight: 400,
  },
  defiGroups: {
    flexDirection: 'row',
    height: DEFI_ITEM_HEIGHT,
    gap: 12,
    justifyContent: 'flex-start',
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
  buttonHeader: {
    backgroundColor: ctx.colors2024['neutral-bg-1'],
  },
  footerGap: {
    height: 70,
  },
  footerCard: {
    backgroundColor: ctx.colors2024['neutral-bg-2'],
    marginBottom: 22,
    padding: 16,
    borderRadius: 20,
  },
  footerMain: {
    height: 46,
    justifyContent: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  footerCardText: {
    color: ctx.colors2024['neutral-secondary'],
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 20,
    fontFamily: 'SF Pro Rounded',
  },
}));
