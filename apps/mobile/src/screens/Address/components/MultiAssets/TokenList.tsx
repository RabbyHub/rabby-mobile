import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Tabs, useFocusedTab } from 'react-native-collapsible-tab-view';

import { isSameAddress } from '@rabby-wallet/base-utils/dist/isomorphic/address';

import { ASSETS_ITEM_HEIGHT_NEW, RootNames } from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';
import {
  TokenRow,
  TokenRowSectionHeader,
} from '@/screens/Home/components/AssetRenderItems';
import {
  AbstractPortfolioToken,
  ActionItem,
  CombineToken,
} from '@/screens/Home/types';
import { getTotalFoldToken } from '@/screens/Home/utils/converAssets';
import { navigateDeprecated } from '@/utils/navigation';
import { createGetStyles2024 } from '@/utils/styles';
import { useAssets } from '@/screens/Search/useAssets';
import { ItemLoader } from '@/screens/Search/components/Skeleton';
import { useAccountInfo } from './hooks';
import useAccountsBalance from '@/hooks/useAccountsBalance';
import { MenuAction } from '@/components2024/ContextMenuView/ContextMenuView';
import { icons } from '@/screens/Home/AssetContainer';
import { preferenceService } from '@/core/services';
import { toast } from '@/components2024/Toast';
import { useTriggerTagAssets } from '@/screens/Home/hooks/refresh';
import { isScamHidenToken } from '@/screens/Home/utils/collection';
import { ScamTokenHeader } from '@/screens/Home/components/AssetRenderItems/ScamTokenHeader';
import { RefreshControl } from 'react-native-gesture-handler';
import { isTabsSwiping } from './hooks';
import { useTriggerUpdate } from './hooks/triggerUpdate';
import { getItemId } from '@/screens/Home/utils/listRenderId';
import { useCurrency } from '@/hooks/useCurrency';
import { KeyringAccountWithAlias, useMyAccounts } from '@/hooks/account';
import { EmptyAssets } from '@/screens/Home/components/AssetRenderItems/EmptyAssets';
import { TabName } from './TabsMultiAssets';
import {
  ListHeaderComponent,
  ListRenderFooter,
  ListRenderSeparator,
} from './RenderRow/Common';

const MemoizedTokenRow = React.memo(TokenRow);
const MemoizedScamTokenHeader = React.memo(ScamTokenHeader);
const MemoizedTokenRowSectionHeader = React.memo(TokenRowSectionHeader);
const MemoizedItemLoader = React.memo(ItemLoader);

interface Props {
  chain?: string;
  onRefresh?: () => void;
  updateToken: (tokens: AbstractPortfolioToken[]) => void;
}
export const TokenList = ({
  chain,
  onRefresh: onRefreshProps,
  updateToken,
}: Props) => {
  const { styles, isLight } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();

  const [foldHideList, setFoldHideList] = useState(true);
  const [foldScam, setFoldScam] = useState(true);

  const { top10Addresses } = useAccountInfo();
  const { triggerUpdate, getTotalBalance } = useAccountsBalance({
    cacheTime: 10 * 60 * 1000,
    accountsNoUnique: true,
  });
  const hasBeenFocusedRef = useRef(false);
  const { currency } = useCurrency();
  const { accounts } = useMyAccounts();
  const focusedTab = useFocusedTab();

  const getAccountByAddress = useCallback(
    (address: string) => {
      return accounts.find(account => isSameAddress(account?.address, address));
    },
    [accounts],
  );

  const isFocused = useMemo(() => {
    const currentFocused = focusedTab === TabName.token;
    if (currentFocused) {
      hasBeenFocusedRef.current = true;
    }
    return hasBeenFocusedRef.current;
  }, [focusedTab]);

  const { triggerUpdate: triggerRefresh, setTriggerUpdate: setTriggerRefresh } =
    useTriggerUpdate();
  const { tokenRefresh } = useTriggerTagAssets();

  const {
    tokens: _rawTokens,
    checkIsExpireAndUpdate,
    isLoading,
  } = useAssets({ hideCombined: !isFocused });

  const tokens = useMemo(() => {
    return _rawTokens?.filter(item =>
      chain && item?.chain ? item.chain === chain : true,
    );
  }, [_rawTokens, chain]);
  console.log('CUSTOM_LOGGER:=>: tokens', tokens.length, isFocused);

  useEffect(() => {
    if (_rawTokens && !isLoading) {
      updateToken(_rawTokens);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [_rawTokens?.length, isLoading, updateToken]);

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
        data: Array.from({ length: 10 }, (_, index) => ({
          type: 'loading-skeleton',
          data: index.toString(),
        })),
      },
      {
        show: !isLoading && !tokens.length,
        data: [
          {
            type: 'empty-token',
            data: t('page.singleHome.sectionHeader.NoData', {
              name: t('page.singleHome.sectionHeader.Token'),
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
  ]);

  const hasNotAssets = useMemo(() => {
    return tokens.length === 0 && !isLoading && isFocused;
  }, [tokens.length, isLoading, isFocused]);

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

  const handleOpenScamToken = useCallback(() => {
    setFoldScam(false);
  }, []);

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
        case 'empty-assets':
        case 'loading-skeleton':
          return <MemoizedItemLoader style={styles.loadingItem} />;
        case 'empty-token':
          return (
            <EmptyAssets style={styles.emptyAssets} desc={data} type={type} />
          );
        default:
          return null;
      }
    },
    [
      foldHideList,
      getAccountByAddress,
      getTokenMenuActions,
      handleOpenScamToken,
      handleOpenTokenDetail,
      handleToggleTokenFold,
      styles.emptyAssets,
      styles.loadingItem,
      styles.renderItemWrapper,
      styles.rowWrap,
      styles.tokenSectionHeader,
    ],
  );

  const initRef = useRef(false);

  useEffect(() => {
    initRef.current = false;
  }, [top10Addresses.length]);

  useEffect(() => {
    const cacheTop10AssetsId = setTimeout(() => {
      if (!isFocused) {
        return;
      }
      if (initRef.current) {
        return;
      }
      initRef.current = true;
      checkIsExpireAndUpdate(false, {
        disableDefi: true,
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

  const onRefresh = useCallback(async () => {
    try {
      await Promise.all([
        triggerUpdate(true),
        checkIsExpireAndUpdate(true, { disableNFT: true, disableDefi: true }),
      ]);
      onRefreshProps?.();
    } catch (error) {
      console.error('Refresh failed:', error);
    }
  }, [checkIsExpireAndUpdate, triggerUpdate, onRefreshProps]);

  useEffect(() => {
    if (triggerRefresh) {
      onRefresh();
      setTriggerRefresh(false);
    }
  }, [onRefresh, setTriggerRefresh, triggerRefresh]);

  return (
    <Tabs.FlatList
      keyExtractor={getItemId}
      data={
        hasNotAssets
          ? [
              {
                type: 'empty-token',
                data: t('page.singleHome.sectionHeader.NoData', {
                  name: t('page.singleHome.sectionHeader.Token'),
                }),
              },
            ]
          : portfolioListData
      }
      renderItem={renderItem}
      initialNumToRender={15}
      windowSize={15}
      maxToRenderPerBatch={15}
      removeClippedSubviews
      ItemSeparatorComponent={ListRenderSeparator}
      ListHeaderComponent={ListHeaderComponent}
      ListFooterComponent={ListRenderFooter}
      showsVerticalScrollIndicator={false}
      showsHorizontalScrollIndicator={false}
      style={styles.container}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl
          style={styles.bgContainer}
          onRefresh={onRefresh}
          refreshing={false}
        />
      }
    />
  );
};

const getStyles = createGetStyles2024(() => ({
  container: {
    flex: 1,
  },
  list: {
    paddingHorizontal: 16,
  },
  bgContainer: {
    paddingHorizontal: 16,
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
  rowWrap: {
    height: ASSETS_ITEM_HEIGHT_NEW,
  },
  renderItemWrapper: {
    height: ASSETS_ITEM_HEIGHT_NEW,
  },
}));
