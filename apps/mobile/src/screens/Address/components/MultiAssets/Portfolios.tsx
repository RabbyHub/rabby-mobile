import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { Tabs, useFocusedTab } from 'react-native-collapsible-tab-view';

import {
  ASSETS_ITEM_HEIGHT_NEW,
  ASSETS_LIST_HEADER,
  ASSETS_SECTION_HEADER,
  RootNames,
  SWITCH_HEADER_HEIGHT,
} from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';
import {
  TokenRow,
  TokenRowSectionHeader,
  FullDefiRenderItem,
} from '@/screens/Home/components/AssetRenderItems';
import {
  AbstractPortfolioToken,
  AbstractProject,
  ActionItem,
  CombineToken,
} from '@/screens/Home/types';
import { getTotalFoldToken } from '@/screens/Home/utils/converAssets';
import { navigateDeprecated } from '@/utils/navigation';
import { createGetStyles2024 } from '@/utils/styles';
import { useAssets } from '@/screens/Search/useAssets';
import { ItemLoader } from '@/screens/Search/components/Skeleton';
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
import { StackActions, useIsFocused } from '@react-navigation/native';
import { useTriggerUpdate } from './hooks/triggerUpdate';
import { getItemId } from '@/screens/Home/utils/listRenderId';
import { useCurrency } from '@/hooks/useCurrency';
import { KeyringAccountWithAlias, useMyAccounts } from '@/hooks/account';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import useLoadMoreData from './hooks/useLoadMoreData';

const SPACING_HEIGHT = 8;
const FOOTER_HEIGHT = 58;
const HEADER_PADDING_HEIGHT = 16;

const MemoizedTokenRow = React.memo(TokenRow);
const MemoizedFullDefiRenderItem = React.memo(FullDefiRenderItem);
const MemoizedScamTokenHeader = React.memo(ScamTokenHeader);
const MemoizedTokenRowSectionHeader = React.memo(TokenRowSectionHeader);
const MemoizedEmptyAssets = React.memo(EmptyAssets);
const MemoizedItemLoader = React.memo(ItemLoader);
const MemoizedDefiItemLoader = React.memo(DefiItemLoader);
const MemoizedEmptyTokenRow = React.memo(EmptyTokenRow);

export const Portfolios = () => {
  const { styles, isLight } = useTheme2024({ getStyle: getStyles });
  const { top10Addresses } = useAccountInfo();
  const { triggerUpdate, getTotalBalance } = useAccountsBalance({
    cacheTime: 10 * 60 * 1000,
    accountsNoUnique: true,
  });
  const focusedTab = useFocusedTab();
  const hasBeenFocusedRef = useRef(false);
  const { currency } = useCurrency();
  const { accounts } = useMyAccounts();

  const getAccountByAddress = useCallback(
    (address: string) => {
      return accounts.find(account => isSameAddress(account?.address, address));
    },
    [accounts],
  );

  const isFocused = useMemo(() => {
    const currentFocused = focusedTab === 'portfolios';
    if (currentFocused) {
      hasBeenFocusedRef.current = true;
    }
    return hasBeenFocusedRef.current;
  }, [focusedTab]);

  const { triggerUpdate: triggerRefresh, setTriggerUpdate: setTriggerRefresh } =
    useTriggerUpdate();

  const {
    tokens,
    portfolios,
    getCacheTop10Assets,
    checkIsExpireAndUpdate,
    isLoading,
  } = useAssets({ hideCombined: !isFocused });

  const { navigation } = useSafeSetNavigationOptions();

  const { t } = useTranslation();

  const [foldHideList, setFoldHideList] = useState(true);
  const [foldDefi, setFoldDefi] = useState(true);
  const [foldScam, setFoldScam] = useState(true);

  const top10Balance = useMemo(() => {
    return getTotalBalance(top10Addresses);
  }, [top10Addresses, getTotalBalance]);

  const tokenLists = useMemo(() => {
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

    return {
      unFoldList,
      foldAndIncludeBalanceTokenList,
      foldAndExcludeBalanceTokenList,
      scamTokens,
    };
  }, [tokens]);

  const {
    data: portfoliosData,
    loadMore: loadMorePortfolios,
    hasMore: hasMorePortfolios,
  } = useLoadMoreData(portfolios);

  const portfolioListData = useMemo(() => {
    const foldTokenList = [
      ...tokenLists.foldAndIncludeBalanceTokenList,
      ...tokenLists.foldAndExcludeBalanceTokenList,
    ];

    const itemData: Array<{
      show: boolean;
      data: ActionItem[];
    }> = [
      {
        show: true,
        data: [...tokenLists.unFoldList],
      },
      {
        show: !!foldTokenList.length,
        data: [
          {
            type: 'toggle_token_fold',
            data: getTotalFoldToken(
              tokens.filter(i => i._isFold),
              currency.usd_rate,
              currency.symbol,
            ),
          },
          ...(foldHideList ? [] : foldTokenList),
        ],
      },
      {
        show: !foldHideList && !!tokenLists.scamTokens.length,
        data: foldScam
          ? [
              {
                type: 'scam_token',
                data: {
                  total: tokenLists.scamTokens.length,
                  logoUrls: (tokenLists.scamTokens as CombineToken[])
                    .slice(0, 3)
                    .map(i => i.data?.logo_url),
                },
              },
            ]
          : tokenLists.scamTokens,
      },
      {
        show: !!isLoading && !tokens.length,
        data: Array.from({ length: 5 }, (_, index) => ({
          type: 'loading-skeleton',
          data: index.toString(),
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
        data: [
          { type: 'defi_header' },
          ...portfoliosData.map(item => ({
            type: 'unfold_defi' as const,
            data: item as unknown as DisplayedProject,
          })),
        ],
      },
      {
        show: !!isLoading && !portfolios.length,
        data: Array.from({ length: 2 }, (_, index) => ({
          type: 'loading-defi-skeleton',
          data: index.toString(),
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
  }, [
    tokenLists.foldAndIncludeBalanceTokenList,
    tokenLists.foldAndExcludeBalanceTokenList,
    tokenLists.unFoldList,
    tokenLists.scamTokens,
    tokens,
    currency.usd_rate,
    currency.symbol,
    foldHideList,
    foldScam,
    isLoading,
    t,
    portfoliosData,
    portfolios.length,
  ]);

  const handleOpenTokenDetail = React.useCallback(
    (token: AbstractPortfolioToken, account?: KeyringAccountWithAlias) => {
      if (isTabsSwiping.value) {
        return;
      }
      navigateDeprecated(RootNames.TokenDetail, {
        token: token,
        unHold: token._unHold,
        needUseCacheToken: true,
        account,
      });
    },
    [],
  );

  const isNavFocused = useIsFocused();
  const { refresh: refreshCurve } = useMultiCurve(top10Addresses, {
    isNavigationFocused: isNavFocused,
    disableAutoFetch: true,
    totalBalance: top10Balance.total,
    totalEvmBalance: top10Balance.totalEvm,
  });

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

  const hasNotAssets = useMemo(() => {
    return (
      tokens.length === 0 && portfolios.length === 0 && !isLoading && isFocused
    );
  }, [tokens.length, portfolios.length, isLoading, isFocused]);

  const handleOnReceive = useCallback(() => {
    navigation.dispatch(
      StackActions.push(RootNames.StackAddress, {
        screen: RootNames.ReceiveAddressList,
        params: {},
      }),
    );
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

  const handleOpenScamToken = useCallback(() => {
    setFoldScam(false);
  }, []);

  const handleToggleDefiFold = useCallback(() => {
    setFoldDefi(pre => !pre);
  }, [setFoldDefi]);

  const handleToggleTokenFold = useCallback(() => {
    if (!foldHideList) {
      setFoldScam(true);
    }
    setFoldHideList(pre => !pre);
  }, [foldHideList]);

  const renderItem = useCallback(
    ({ item }) => {
      const { type, data } = item;
      switch (type) {
        case 'unfold_token':
        case 'fold_token':
          return (
            <View style={styles.rowWrap}>
              <MemoizedTokenRow
                data={data}
                onTokenPress={token =>
                  handleOpenTokenDetail(
                    token,
                    getAccountByAddress(data?.address),
                  )
                }
                logoSize={46}
                style={styles.renderItemWrapper}
                chainLogoSize={18}
                account={getAccountByAddress(data?.address)}
                getMenuActions={getTokenMenuActions}
              />
            </View>
          );
        case 'unfold_defi':
        case 'fold_defi':
          return (
            <MemoizedFullDefiRenderItem
              data={data as unknown as AbstractProject}
              showAccount
              style={styles.fullDefi}
              disableAction={isLoading}
              account={
                getAccountByAddress(
                  data?.address,
                ) as unknown as KeyringAccountWithAlias
              }
            />
          );
        case 'scam_token':
          return (
            <MemoizedScamTokenHeader
              total={data.total}
              logoUrls={data.logoUrls}
              style={styles.renderItemWrapper}
              onPress={handleOpenScamToken}
            />
          );
        case 'toggle_token_fold':
          return (
            <MemoizedTokenRowSectionHeader
              style={styles.tokenSectionHeader}
              str={data}
              fold={foldHideList}
              onPressFold={handleToggleTokenFold}
            />
          );
        case 'defi_header':
          return (
            <Text style={styles.sectionTextHeader}>
              {t('page.search.sectionHeader.Defi')}
            </Text>
          );
        case 'toggle_defi_fold':
          return (
            <MemoizedTokenRowSectionHeader
              str={data}
              fold={foldDefi}
              style={styles.sectionHeader}
              buttonStyle={styles.buttonHeader}
              onPressFold={handleToggleDefiFold}
            />
          );
        case 'empty-assets':
        case 'empty-defi':
          return (
            <MemoizedEmptyAssets
              style={styles.emptyAssets}
              desc={data}
              type={type}
            />
          );
        case 'loading-skeleton':
          return <MemoizedItemLoader style={styles.loadingItem} />;
        case 'loading-defi-skeleton':
          return <MemoizedDefiItemLoader style={styles.defiLoading} />;
        case 'empty-token':
          return (
            <MemoizedEmptyTokenRow
              style={styles.emptyTokenHolder}
              onReceive={handleOnReceive}
              onImport={handleOnImport}
            />
          );
        default:
          return null;
      }
    },
    [
      isLoading,
      foldDefi,
      foldHideList,
      getAccountByAddress,
      getTokenMenuActions,
      handleOnImport,
      handleOnReceive,
      handleOpenScamToken,
      handleOpenTokenDetail,
      handleToggleDefiFold,
      handleToggleTokenFold,
      styles.buttonHeader,
      styles.defiLoading,
      styles.emptyAssets,
      styles.emptyTokenHolder,
      styles.fullDefi,
      styles.loadingItem,
      styles.renderItemWrapper,
      styles.rowWrap,
      styles.sectionHeader,
      styles.sectionTextHeader,
      styles.tokenSectionHeader,
      t,
    ],
  );

  const inited = useRef(false);

  useEffect(() => {
    inited.current = false;
  }, [top10Addresses.length]);

  useEffect(() => {
    const cacheTop10AssetsId = setTimeout(() => {
      if (!isFocused) {
        return;
      }
      if (inited.current) {
        return;
      }
      inited.current = true;
      getCacheTop10Assets({
        disableNFT: true,
        realTimeAddresses: top10Addresses,
      });
      checkIsExpireAndUpdate(false, {
        disableNFT: true,
        realTimeAddresses: top10Addresses,
        ignoreLoading: !top10Balance,
      });
    }, 50);
    return () => {
      cacheTop10AssetsId && clearTimeout(cacheTop10AssetsId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocused, !top10Balance, top10Addresses.length]);

  const ListRenderSeparator = useCallback(() => {
    return <View style={{ height: SPACING_HEIGHT }} />;
  }, []);
  const ListRenderFooter = useCallback(() => {
    return hasMorePortfolios ? (
      <MemoizedItemLoader style={[styles.loadingMore]} />
    ) : (
      <View style={{ height: FOOTER_HEIGHT }} />
    );
  }, [hasMorePortfolios, styles.loadingMore]);

  const onRefresh = useCallback(async () => {
    try {
      await Promise.all([
        triggerUpdate(true),
        refreshCurve(true),
        checkIsExpireAndUpdate(true, { disableNFT: true }),
      ]);
    } catch (error) {
      console.error('Refresh failed:', error);
    }
  }, [checkIsExpireAndUpdate, refreshCurve, triggerUpdate]);

  useEffect(() => {
    if (triggerRefresh) {
      onRefresh();
      setTriggerRefresh(false);
    }
  }, [onRefresh, setTriggerRefresh, triggerRefresh]);

  const keyExtractor = useCallback((item: ActionItem) => {
    return getItemId(item);
  }, []);

  return (
    <Tabs.FlatList
      keyExtractor={keyExtractor}
      data={hasNotAssets ? [{ type: 'empty-token' }] : portfolioListData}
      renderItem={renderItem}
      ItemSeparatorComponent={ListRenderSeparator}
      initialNumToRender={15}
      windowSize={15}
      maxToRenderPerBatch={15}
      removeClippedSubviews
      ListHeaderComponent={<View style={{ height: HEADER_PADDING_HEIGHT }} />}
      ListFooterComponent={ListRenderFooter}
      showsVerticalScrollIndicator={false}
      showsHorizontalScrollIndicator={false}
      style={styles.container}
      contentContainerStyle={styles.list}
      onEndReached={loadMorePortfolios}
      onEndReachedThreshold={0.5}
      refreshControl={
        <RefreshControl
          style={styles.bgContainer}
          onRefresh={() => {
            onRefresh();
          }}
          refreshing={false}
        />
      }
    />
  );
};

const getStyles = createGetStyles2024(ctx => ({
  container: {
    flex: 1,
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
    fontFamily: 'SF Pro Rounded',
    fontSize: 18,
    fontWeight: '500',
    lineHeight: 22,
    color: ctx.colors2024['neutral-secondary'],
    paddingLeft: 0,
    paddingRight: 0,
    backgroundColor: ctx.isLight
      ? ctx.colors2024['neutral-bg-0']
      : ctx.colors2024['neutral-bg-1'],

    height: ASSETS_LIST_HEADER,
  },
  tokenSectionHeader: {
    paddingLeft: 0,
    paddingRight: 0,
  },
  emptyAssets: {
    marginHorizontal: 0,
  },
  loadingItem: {
    height: ASSETS_ITEM_HEIGHT_NEW,
  },
  emptyTokenHolder: {
    paddingHorizontal: 0,
  },
  defiLoading: {
    paddingHorizontal: 0,
  },
  loadingMore: {
    marginTop: 16,
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
  fullDefi: {
    marginHorizontal: 0,
    marginTop: 8,
  },
}));
