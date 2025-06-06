import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import { Tabs, useFocusedTab } from 'react-native-collapsible-tab-view';

import {
  ASSETS_EMPTY_ROW_HIGHT,
  ASSETS_ITEM_HEIGHT_NEW,
  ASSETS_LIST_HEADER,
  ASSETS_SECTION_HEADER,
  ASSETS_SEPARATOR_HEIGHT,
  DEFI_ITEM_HEIGHT,
  RootNames,
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
  CombineToken,
} from '@/screens/Home/types';
import {
  getAllDefiCount,
  getTotalFoldToken,
} from '@/screens/Home/utils/converAssets';
import { navigate } from '@/utils/navigation';
import { createGetStyles2024 } from '@/utils/styles';
import { useAssets } from '@/screens/Search/useAssets';
import { ItemLoader } from '@/screens/Search/components/Skeleton';
import { chunk } from 'lodash';
import { useAccountInfo } from './hooks';
import { EmptyAssets } from '@/screens/Home/components/AssetRenderItems/EmptyAssets';
import { DefiItemLoader } from '@/screens/Home/components/Skeleton';
import useAccountsBalance from '@/hooks/useAccountsBalance';
import { MenuAction } from '@/components2024/ContextMenuView/ContextMenuView';
import { icons } from '@/screens/Home/AssetContainer';
import { preferenceService } from '@/core/services';
import { toast } from '@/components2024/Toast';
import { useTriggerTagAssets } from '@/screens/Home/hooks/refresh';
import { DisplayedProject } from '@/screens/Home/utils/project';
import { isScamHidenToken } from '@/screens/Home/utils/collection';
import { ScamTokenHeader } from '@/screens/Home/components/AssetRenderItems/ScamTokenHeader';
import { RefreshControl } from 'react-native-gesture-handler';
import { useMultiCurve } from '@/hooks/useMultiCurve';
import { isTabsSwiping } from './hooks';
import { EmptyTokenRow } from '@/screens/Home/components/AssetRenderItems/EmptyToken';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import { StackActions } from '@react-navigation/native';

const SPACING_HEIGHT = 8;
const FOOTER_HEIGHT = 58;
const HEADER_PADDING_HEIGHT = 16;

export const Portfolios = () => {
  const { styles, isLight } = useTheme2024({ getStyle: getStyles });
  const { top10Addresses } = useAccountInfo();
  const focusedTab = useFocusedTab();
  const isFocused = focusedTab === 'portfolios';

  const { triggerUpdate, getTotalBalance } = useAccountsBalance({
    cacheTime: 10 * 60 * 1000,
    accountsNoUnique: true,
  });

  const {
    tokens,
    portfolios,
    getCacheTop10Assets,
    checkIsExpireAndUpdate,
    isLoading,
  } = useAssets();

  const { navigation } = useSafeSetNavigationOptions();
  const [isListVisable, setIsListVisable] = useState(false);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const { t } = useTranslation();

  const [foldHideList, setFoldHideList] = useState(true);
  const [foldDefi, setFoldDefi] = useState(true);
  const [foldScam, setFoldScam] = useState(true);

  const portfolioListData = useMemo(() => {
    const unFoldList: ActionItem[] = tokens
      .filter(i => !i._isFold)
      .map(item => ({
        type: 'unfold_token',
        data: item,
      }));
    const foldAndIncludeBalanceTokenList: ActionItem[] = tokens
      .filter(
        i =>
          !isScamHidenToken(i) &&
          i._isFold &&
          !i._isExcludeBalance &&
          i._realUsdValue > 0,
      )
      .map(item => ({
        type: 'fold_token',
        data: item,
      }));
    const foldAndExcludeBalanceTokenList: ActionItem[] = tokens
      .filter(
        i =>
          !isScamHidenToken(i) &&
          i._isFold &&
          (i._isExcludeBalance || i._realUsdValue === 0),
      )
      .map(item => ({
        type: 'fold_token',
        data: item,
      }));
    const scamTokens: ActionItem[] = tokens
      .filter(isScamHidenToken)
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
      data: item as unknown as DisplayedProject[],
    }));
    const unFoldDefiList: ActionItem[] = chunk(
      portfolios.filter(i => !i._isFold),
      2,
    ).map(item => ({
      type: 'unfold_defi',
      data: item as unknown as DisplayedProject[],
    }));
    const itemData: Array<{
      show: boolean;
      data: ActionItem[];
    }> = [
      {
        show: true,
        data: [...unFoldList],
      },
      {
        show: !!foldTokenList.length,
        data: [
          { type: 'toggle_token_fold' },
          ...(foldHideList ? [] : foldTokenList),
        ],
      },
      {
        show: !foldHideList && !!scamTokens.length,
        data: foldScam
          ? [
              {
                type: 'scam_token',
                data: {
                  total: scamTokens.length,
                  logoUrls: (scamTokens as CombineToken[])
                    .slice(0, 3)
                    .map(i => i.data?.logo_url),
                },
              },
            ]
          : scamTokens,
      },
      {
        show: !!isLoading && !tokens.length,
        data: Array.from({ length: 5 }, () => ({
          type: 'loading-skeleton',
        })),
      },
      {
        show: !isLoading && !tokens.length,
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
        show: true,
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
        show: !!isLoading && !portfolios.length,
        data: Array.from({ length: 2 }, () => ({
          type: 'loading-defi-skeleton',
        })),
      },
      {
        show: !isLoading && portfolios.length === 0,
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
  }, [foldDefi, foldHideList, foldScam, isLoading, portfolios, t, tokens]);

  const handleOpenTokenDetail = React.useCallback(
    (token: AbstractPortfolioToken) => {
      if (isTabsSwiping.value) {
        return;
      }
      navigate(RootNames.TokenDetail, {
        token: token,
        unHold: token._unHold,
        needUseCacheToken: true,
      });
    },
    [],
  );

  const top10Balance = useMemo(() => {
    return getTotalBalance(top10Addresses);
  }, [top10Addresses, getTotalBalance]);

  const { refresh: refreshCurve } = useMultiCurve(
    top10Addresses,
    false,
    top10Balance,
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
    [t, isLight, tokenRefresh],
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

  const hasNotAssets = useMemo(() => {
    return tokens.length === 0 && portfolios.length === 0 && !isLoading;
  }, [tokens.length, portfolios.length, isLoading]);

  const handleOnReceive = useCallback(() => {
    navigation.dispatch(
      StackActions.push(RootNames.StackAddress, {
        screen: RootNames.ReceiveAddressList,
        params: {},
      }),
    );
  }, [navigation]);

  const handleOnBuy = useCallback(() => {
    navigation.push(RootNames.StackTransaction, {
      screen: RootNames.MultiBuy,
      params: {},
    });
  }, [navigation]);

  const handleOnImport = useCallback(() => {
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
    ({ item }) => {
      const { type, data } = item;
      switch (type) {
        case 'unfold_token':
        case 'fold_token':
          return (
            <View style={styles.rowWrap}>
              <TokenRow
                data={data}
                onTokenPress={handleOpenTokenDetail}
                logoSize={46}
                style={styles.renderItemWrapper}
                chainLogoSize={18}
                menuActions={getTokenMenuActions(data)}
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
          );
        case 'toggle_token_fold':
          return (
            <TokenRowSectionHeader
              style={styles.tokenSectionHeader}
              str={getTotalFoldToken(tokens.filter(i => i._isFold))}
              fold={foldHideList}
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
            <Text style={[styles.sectionHeader, styles.sectionTextHeader]}>
              {t('page.search.sectionHeader.Defi')}
            </Text>
          );
        case 'toggle_defi_fold':
          return (
            <TokenRowSectionHeader
              str={getAllDefiCount(
                portfolios.filter(
                  i => i._isFold,
                ) as unknown as DisplayedProject[],
              )}
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
        case 'empty-token':
          return (
            <EmptyTokenRow
              style={styles.emptyTokenHolder}
              onReceive={handleOnReceive}
              onBuy={handleOnBuy}
              onImport={handleOnImport}
            />
          );
        default:
          return null;
      }
    },
    [
      foldDefi,
      foldHideList,
      getDefiOrNftMenuAction,
      getTokenMenuActions,
      handleOnBuy,
      handleOnImport,
      handleOnReceive,
      handleOpenDefiDetail,
      handleOpenTokenDetail,
      isLight,
      portfolios,
      styles.bg2,
      styles.buttonHeader,
      styles.defiGroups,
      styles.defiLoading,
      styles.emptyAssets,
      styles.emptyTokenHolder,
      styles.renderDefiItemWrapper,
      styles.renderItemWrapper,
      styles.rowWrap,
      styles.sectionHeader,
      styles.sectionTextHeader,
      styles.tokenSectionHeader,
      t,
      tokens,
    ],
  );

  const inited = useRef(false);

  useEffect(() => {
    inited.current = false;
  }, [top10Addresses.length]);

  useEffect(() => {
    if (!isFocused) {
      return;
    }
    const id = setTimeout(() => {
      if (inited.current) {
        return;
      }
      inited.current = true;
      checkIsExpireAndUpdate(false, {
        disableNFT: true,
        realTimeAddresses: top10Addresses,
        ignoreLoading: !top10Balance,
      });
    }, 200);
    return () => {
      id && clearTimeout(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocused, top10Addresses.length]);

  useEffect(() => {
    const id = setTimeout(() => {
      if (!isListVisable) {
        return;
      }
      getCacheTop10Assets({
        disableNFT: true,
        realTimeAddresses: top10Addresses,
      });
    }, 100);
    return () => {
      id && clearTimeout(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [top10Addresses.length, isListVisable]);

  const getItemType = useCallback((item: ActionItem) => {
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
  }, []);

  const overrideItemLayout = useCallback(
    (layout: { span?: number; size?: number }, item: ActionItem) => {
      const type = getItemType(item);
      switch (type) {
        case 'asset_header':
          layout.size = ASSETS_LIST_HEADER;
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
    },
    [getItemType],
  );

  const ListRenderSeparator = useCallback(() => {
    return <View style={{ height: SPACING_HEIGHT }} />;
  }, []);
  const ListRenderFooter = useCallback(() => {
    return <View style={{ height: FOOTER_HEIGHT }} />;
  }, []);

  return (
    <Tabs.FlashList
      data={hasNotAssets ? [{ type: 'empty-token' }] : portfolioListData}
      renderItem={renderItem}
      estimatedItemSize={ASSETS_ITEM_HEIGHT_NEW + ASSETS_SEPARATOR_HEIGHT}
      getItemType={getItemType}
      overrideItemLayout={overrideItemLayout}
      ItemSeparatorComponent={ListRenderSeparator}
      onViewableItemsChanged={() => {
        setIsListVisable(true);
      }}
      ListHeaderComponent={<View style={{ height: HEADER_PADDING_HEIGHT }} />}
      ListFooterComponent={ListRenderFooter}
      showsVerticalScrollIndicator={false}
      showsHorizontalScrollIndicator={false}
      style={styles.container}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl
          style={styles.bgContainer}
          onRefresh={async () => {
            setIsRefreshing(true);
            try {
              await Promise.all([
                triggerUpdate(true),
                refreshCurve(true),
                checkIsExpireAndUpdate(true, { disableNFT: true }),
              ]);
              setIsRefreshing(false);
            } catch (error) {
              console.error('Refresh failed:', error);
              setIsRefreshing(false);
            }
          }}
          refreshing={isRefreshing}
        />
      }
    />
  );
};

const getStyles = createGetStyles2024(ctx => ({
  container: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'red',
  },
  list: {
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
    zIndex: 1,
  },
  bgContainer: {
    backgroundColor: ctx.isLight
      ? ctx.colors2024['neutral-bg-0']
      : ctx.colors2024['neutral-bg-1'],
    paddingHorizontal: 16,
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
  emptyTokenHolder: {
    paddingHorizontal: 0,
  },
  defiLoading: {
    paddingHorizontal: 0,
  },
  rowWrap: {
    height: ASSETS_ITEM_HEIGHT_NEW,
  },
  renderItemWrapper: {
    height: ASSETS_ITEM_HEIGHT_NEW,
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
