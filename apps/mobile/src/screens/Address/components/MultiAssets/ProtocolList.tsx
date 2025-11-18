import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Tabs, useFocusedTab } from 'react-native-collapsible-tab-view';

import {
  ASSETS_ITEM_HEIGHT_NEW,
  ASSETS_LIST_HEADER,
  ASSETS_SECTION_HEADER,
  RootNames,
  SWITCH_HEADER_HEIGHT,
} from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';
import { FullDefiRenderItem } from '@/screens/Home/components/AssetRenderItems';
import { AbstractProject, ActionItem } from '@/screens/Home/types';
import { createGetStyles2024 } from '@/utils/styles';
import { useAssets } from '@/screens/Search/useAssets';
import { ItemLoader } from '@/screens/Search/components/Skeleton';
import { useAccountInfo } from './hooks';
import { EmptyAssets } from '@/screens/Home/components/AssetRenderItems/EmptyAssets';
import { DefiItemLoader } from '@/screens/Home/components/Skeleton';
import useAccountsBalance from '@/hooks/useAccountsBalance';
import { DisplayedProject } from '@/screens/Home/utils/project';
import { RefreshControl } from 'react-native-gesture-handler';
import { EmptyTokenRow } from '@/screens/Home/components/AssetRenderItems/EmptyToken';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import { StackActions } from '@react-navigation/native';
import { useTriggerUpdate } from './hooks/triggerUpdate';
import { getItemId } from '@/screens/Home/utils/listRenderId';
import { KeyringAccountWithAlias, useMyAccounts } from '@/hooks/account';
import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';
import useLoadMoreData from './hooks/useLoadMoreData';

const SPACING_HEIGHT = 8;
const FOOTER_HEIGHT = 158;
const HEADER_PADDING_HEIGHT = 16;

const MemoizedFullDefiRenderItem = React.memo(FullDefiRenderItem);
const MemoizedEmptyAssets = React.memo(EmptyAssets);
const MemoizedItemLoader = React.memo(ItemLoader);
const MemoizedDefiItemLoader = React.memo(DefiItemLoader);
const MemoizedEmptyTokenRow = React.memo(EmptyTokenRow);

interface Props {
  chain?: string;
  onRefresh?: () => void;
  updatePortfolio?: (portfolios: DisplayedProject[]) => void;
}
export const ProtocolList = ({
  chain,
  onRefresh: onRefreshProps,
  updatePortfolio,
}: Props) => {
  const { styles } = useTheme2024({ getStyle: getStyles });
  const { top10Addresses } = useAccountInfo();
  const { triggerUpdate, getTotalBalance } = useAccountsBalance({
    cacheTime: 10 * 60 * 1000,
    accountsNoUnique: true,
  });
  const hasBeenFocusedRef = useRef(false);
  const { accounts } = useMyAccounts();
  const focusedTab = useFocusedTab();
  const getAccountByAddress = useCallback(
    (address: string) => {
      return accounts.find(account => isSameAddress(account?.address, address));
    },
    [accounts],
  );

  const isFocused = useMemo(() => {
    const currentFocused = focusedTab === 'defi';
    if (currentFocused) {
      hasBeenFocusedRef.current = true;
    }
    return hasBeenFocusedRef.current;
  }, [focusedTab]);

  const { triggerUpdate: triggerRefresh, setTriggerUpdate: setTriggerRefresh } =
    useTriggerUpdate();

  const {
    portfolios: _rawPortfolios,
    getCacheTop10Assets,
    checkIsExpireAndUpdate,
    isLoading,
  } = useAssets({ hideCombined: !isFocused });
  useEffect(() => {
    if (_rawPortfolios && !isLoading) {
      updatePortfolio?.(_rawPortfolios);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [_rawPortfolios?.length, isLoading, updatePortfolio]);

  const portfolios = useMemo(
    () =>
      _rawPortfolios.filter(item =>
        chain && item?.chain ? item.chain === chain : true,
      ),
    [_rawPortfolios, chain],
  );

  console.log('CUSTOM_LOGGER:=>: portfolios', portfolios.length, isFocused);

  const { navigation } = useSafeSetNavigationOptions();

  const { t } = useTranslation();

  const top10Balance = useMemo(() => {
    return getTotalBalance(top10Addresses);
  }, [top10Addresses, getTotalBalance]);

  const {
    data: portfoliosData,
    loadMore: loadMorePortfolios,
    hasMore: hasMorePortfolios,
  } = useLoadMoreData(portfolios);

  const portfolioListData = useMemo(() => {
    const itemData: Array<{
      show: boolean;
      data: ActionItem[];
    }> = [
      {
        show: true,
        data: [
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
  }, [isLoading, t, portfoliosData, portfolios.length]);

  const hasNotAssets = useMemo(() => {
    return portfolios.length === 0 && !isLoading && isFocused;
  }, [portfolios.length, isLoading, isFocused]);

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

  const renderItem = useCallback(
    ({ item }) => {
      const { type, data } = item;
      switch (type) {
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
        case 'empty-assets':
        case 'empty-defi':
          return (
            <MemoizedEmptyAssets
              style={styles.emptyAssets}
              desc={data}
              type={type}
            />
          );
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
      getAccountByAddress,
      handleOnImport,
      handleOnReceive,
      styles.defiLoading,
      styles.emptyAssets,
      styles.emptyTokenHolder,
      styles.fullDefi,
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
        disableToken: true,
        realTimeAddresses: top10Addresses,
      });
      checkIsExpireAndUpdate(false, {
        disableNFT: true,
        disableToken: true,
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
        checkIsExpireAndUpdate(true, { disableToken: true, disableNFT: true }),
      ]);
    } catch (error) {
      console.error('Refresh failed:', error);
    }
  }, [checkIsExpireAndUpdate, triggerUpdate]);

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
      data={
        hasNotAssets
          ? [
              {
                type: 'empty-defi',
                data: t('page.singleHome.sectionHeader.NoData', {
                  name: t('page.singleHome.sectionHeader.Defi'),
                }),
              },
            ]
          : portfolioListData
      }
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
