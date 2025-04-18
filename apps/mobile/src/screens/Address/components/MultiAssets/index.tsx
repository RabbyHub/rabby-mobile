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
  Keyboard,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { RefreshControl } from 'react-native-gesture-handler';

import {
  ADDRESS_ENTRY_GAP,
  ADDRESS_ENTRY_HEUGHT,
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
import {
  ItemLoader,
  PositionLoader,
} from '@/screens/Search/components/Skeleton';
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
import { OtherAddressNav } from '../../AddressAssetsOverviewScreen';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { CurrentAddressProps } from '../AddressListScreenContainer';
import { ChainListItem } from '@/components2024/SelectChainWithDistribute';
import {
  createGlobalBottomSheetModal2024,
  removeGlobalBottomSheetModal2024,
} from '@/components2024/GlobalBottomSheetModal';
import { MODAL_NAMES } from '@/components2024/GlobalBottomSheetModal/types';
import { useAccountInfo } from './hooks';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import { HeaderTitle } from './HeaderTitle';
import { formChartData } from '@/hooks/useCurve';
import { trigger } from 'react-native-haptic-feedback';
import { EmptyTokenRow } from '@/screens/Home/components/AssetRenderItems/EmptyToken';
import { EmptyAssets } from '@/screens/Home/components/AssetRenderItems/EmptyAssets';
import { DefiItemLoader } from '@/screens/Home/components/Skeleton';
import useAccountsBalance from '@/hooks/useAccountsBalance';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import { useBalanceUpdate } from './hooks/balance';

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

export const MultiAssets = () => {
  const { styles, isLight, colors2024 } = useTheme2024({ getStyle: getStyles });

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
    tokens: _rawTokens,
    portfolios: _rawPortfolios,
    getCacheTop10Assets,
    checkIsExpireAndUpdate,
    refreshing,
    chainsInfo,
    isLoading,
  } = useAssets();

  const {
    multiTimeStamp,
    combineData,
    refresh: refreshCurve,
    isLoadingNew: isLoadingCurve,
  } = useMultiCurve(top10Addresses, false, top10Balance);

  const [selectChainItem, setSelectChainItem] = useState<
    ChainListItem | undefined
  >();
  const listRef = useRef<RecyclerListViewRef>(null);
  const [firstRowType, setFirstRowType] = useState('');

  const { tokens, portfolios } = useMemo(() => {
    return {
      tokens: _rawTokens?.filter(item =>
        selectChainItem?.chain && item?.chain
          ? item.chain === selectChainItem.chain
          : true,
      ),
      portfolios: _rawPortfolios.filter(item =>
        selectChainItem?.chain && item?.chain
          ? item.chain === selectChainItem.chain
          : true,
      ),
    };
  }, [_rawPortfolios, _rawTokens, selectChainItem?.chain]);

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
    currentTab: TabType.portfolio,
    combineData,
    isLight: isLight,
  });
  const { setNavigationOptions } = useSafeSetNavigationOptions();

  useEffect(() => {
    setExtendedState(prev => ({ ...prev, isLight, combineData }));
  }, [isLight, combineData]);

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
        data: [
          {
            type: 'asset_header',
          },
          ...unFoldList,
        ],
      },
      {
        show: !showPortfolios,
        data: list.map(item => {
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
    navigation.navigate(RootNames.StackAddress, {
      screen: RootNames.WatchAddressList,
    });
  }, [navigation]);

  const onGotoSafeAddress = React.useCallback(() => {
    navigation.navigate(RootNames.StackAddress, {
      screen: RootNames.SafeAddressList,
    });
  }, [navigation]);

  const handleOnChainClick = useCallback(
    (clear: boolean) => {
      if (clear) {
        setSelectChainItem(undefined);
        setExtendedState(prev => ({ ...prev, selectedChain: undefined }));
        return;
      }

      const id = createGlobalBottomSheetModal2024({
        name: MODAL_NAMES.SELECT_CHAIN_WITH_DISTRIBUTE,
        value: selectChainItem,
        bottomSheetModalProps: {
          // enableContentPanningGesture: true,
          enablePanDownToClose: true,
          handleStyle: {
            backgroundColor: isLight
              ? colors2024['neutral-bg-0']
              : colors2024['neutral-bg-1'],
          },
        },
        chainList: chainsInfo.chainAssets,
        titleText: t('page.receiveAddressList.selectChainTitle'),
        onChange: (v: ChainListItem) => {
          setSelectChainItem(v);
          setExtendedState(prev => ({ ...prev, selectedChain: v }));
          removeGlobalBottomSheetModal2024(id);
        },
        onClose: () => {
          removeGlobalBottomSheetModal2024(id);
        },
      });
    },
    [chainsInfo.chainAssets, colors2024, isLight, selectChainItem, t],
  );
  const scrollToTop = () => {
    setFoldHideList(true);
    setTimeout(() => {
      listRef.current?.forceUpdate(() => {
        const data = (listRef.current?.props.dataProvider.getAllData() ||
          []) as ActionItem[];
        const index = data.findIndex(item => item.type === 'switch_tabs');
        listRef.current?.scrollToIndex(index || 0, true);
      });
    }, 200);
  };

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
            chainServerId={selectChainItem?.chain}
            addressLength={list.length}
            onChainClick={handleOnChainClick}
            chainLength={chainsInfo.chainLength}
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
            hideFoldTag
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
              // menuActions={getDefiOrNftMenuAction('defi', data[0])}
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
                // menuActions={getDefiOrNftMenuAction('defi', data[1])}
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
      case 'asset_header':
        return (
          <Text style={[styles.sectionHeader, styles.sectionTextHeader]}>
            {t('page.search.sectionHeader.token')}
          </Text>
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

  const renderStickHeader = (type: string) => {
    switch (type) {
      /** header */
      case 'fold_token':
        return (
          <TokenRowSectionHeader
            str={getTotalFoldToken(tokens.filter(i => i._isFold))}
            fold={foldHideList}
            style={styles.sectionHeader}
            buttonStyle={StyleSheet.flatten([
              styles.buttonHeader,
              !isLight && styles.bg2,
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
              !isLight && styles.bg2,
            ])}
            onPressFold={() => setFoldDefi(pre => !pre)}
          />
        );
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
            dim.width = SCREEN_WIDTH;
            dim.height = HEADER_CHART_HEIGHT;
            break;
          case ViewTypes.ASSET_HEADER:
            dim.width = SCREEN_WIDTH - 32;
            dim.height = ASSETS_LIST_HEADER + ASSETS_SEPARATOR_HEIGHT;
            break;
          case ViewTypes.HEADER:
            dim.width = SCREEN_WIDTH - 32;
            dim.height = ASSETS_SECTION_HEADER + ASSETS_SEPARATOR_HEIGHT;
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
            dim.height = ADDRESS_ENTRY_HEUGHT + ADDRESS_ENTRY_GAP;
            break;
          default:
            dim.width = SCREEN_WIDTH - 32;
            dim.height = ASSETS_ITEM_HEIGHT_NEW + ASSETS_SEPARATOR_HEIGHT;
        }
      },
    );
  }, [listData]);

  useLayoutEffect(() => {
    getCacheTop10Assets({ disableNFT: true }).then(() => {
      checkIsExpireAndUpdate(false, { disableNFT: true });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [top10Addresses.length]);

  // if (isLoading && !listData.getSize()) {
  //   return (
  //     <View style={styles.bgContainer}>
  //       <PositionLoader />
  //     </View>
  //   );
  // }
  // if (!listData.getSize()) {
  //   return null;
  // }

  console.log('🔍 CUSTOM_LOGGER:=>: listData', listData.getSize());
  return (
    <View style={styles.container}>
      {firstRowType === 'overview' ||
      firstRowType === 'switch_tabs' ||
      firstRowType === '' ||
      !list.length ? null : (
        <Animated.View style={[styles.bgContainer, styles.stickyHeader]}>
          <SwitchHeader
            currentTab={extendedState.currentTab}
            chainServerId={selectChainItem?.chain}
            addressLength={list.length}
            onChainClick={handleOnChainClick}
            chainLength={chainsInfo.chainLength}
            onChangeTab={tab => {
              trigger('impactLight', {
                enableVibrateFallback: true,
                ignoreAndroidSystemSettings: false,
              });
              setExtendedState(pre => ({
                ...pre,
                currentTab: tab,
              }));
              scrollToTop();
            }}
          />
          {renderStickHeader(firstRowType)}
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
          const scrollOffset = event.nativeEvent.contentOffset.y;
          if (scrollOffset > 80) {
            setNavigationOptions({
              headerTitle: () => (
                <HeaderTitle
                  netWorth={combineData.netWorth}
                  changePercent={combineData.changePercent}
                  isLoss={combineData.isLoss}
                />
              ),
              headerTitleAlign: 'left',
            });
          } else {
            setNavigationOptions({
              headerTitle: '',
              headerTitleAlign: 'left',
            });
          }
          Keyboard.dismiss();
        }}
        renderFooter={() =>
          extendedState.currentTab === TabType.address ? (
            <View style={styles.footer}>
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
  );
};

const getStyles = createGetStyles2024(ctx => ({
  container: {
    flex: 1,
    marginTop: -10,
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
    // height: ASSETS_SECTION_HEADER,
    zIndex: 1,
  },
  bgContainer: {
    backgroundColor: ctx.isLight
      ? ctx.colors2024['neutral-bg-0']
      : ctx.colors2024['neutral-bg-1'],
    paddingHorizontal: 16,
    paddingBottom: 2,
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
    marginBottom: 8,
  },
  footer: {
    height: 200,
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
}));
