import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Tabs } from 'react-native-collapsible-tab-view';

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
import { MenuAction } from '@/components2024/ContextMenuView/ContextMenuView';
import { icons } from '@/screens/Home/AssetContainer';
import { preferenceService } from '@/core/services';
import { toast } from '@/components2024/Toast';
import { useTriggerTagAssets } from '@/screens/Home/hooks/refresh';
import { isScamHidenToken } from '@/screens/Home/utils/collection';
import { ScamTokenHeader } from '@/screens/Home/components/AssetRenderItems/ScamTokenHeader';
import { RefreshControl } from 'react-native-gesture-handler';
import { isTabsSwiping } from './hooks';
import { getItemId } from '@/screens/Home/utils/listRenderId';
import { useCurrency } from '@/hooks/useCurrency';
import { KeyringAccountWithAlias } from '@/hooks/account';
import { EmptyAssets } from '@/screens/Home/components/AssetRenderItems/EmptyAssets';
import { TAB_HEADER_FULL_HEIGHT, TabName } from './TabsMultiAssets';
import {
  ListHeaderComponent,
  ListRenderFooter,
  ListRenderSeparator,
} from './RenderRow/Common';
import {
  useCheckIsExpireAndUpdate,
  useFindAccountByAddress,
  useIsFocusedCurrentTab,
} from './hooks/share';

const MemoizedTokenRow = React.memo(TokenRow);
const MemoizedScamTokenHeader = React.memo(ScamTokenHeader);
const MemoizedTokenRowSectionHeader = React.memo(TokenRowSectionHeader);
const MemoizedItemLoader = React.memo(ItemLoader);

interface Props {
  chain?: string;
  updateToken: (tokens: AbstractPortfolioToken[]) => void;
}

export const TokenList = ({ chain, updateToken }: Props) => {
  const { styles, isLight } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();

  const [foldHideList, setFoldHideList] = useState(true);
  const [foldScam, setFoldScam] = useState(true);

  const { currency } = useCurrency();

  const getAccountByAddress = useFindAccountByAddress();
  const { isFocused, isFocusing } = useIsFocusedCurrentTab(TabName.token);

  const { tokenRefresh } = useTriggerTagAssets();

  const { triggerUpdate } = useCheckIsExpireAndUpdate({
    isFocused,
    isFocusing,
    disableDefi: true,
    disableNFT: true,
  });

  const {
    tokens: _rawTokens,
    checkIsExpireAndUpdate,
    isLoading,
  } = useAssets({ hideCombined: !isFocusing });

  const tokens = useMemo(() => {
    return !isFocusing
      ? []
      : _rawTokens?.filter(item =>
          chain && item?.chain ? item.chain === chain : true,
        );
  }, [isFocusing, _rawTokens, chain]);

  useEffect(() => {
    if (_rawTokens && !isLoading) {
      updateToken(_rawTokens);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [_rawTokens?.length, isLoading, updateToken]);

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

  const handleOpenTokenDetail = useCallback(
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

  const onRefresh = useCallback(async () => {
    try {
      await Promise.all([
        triggerUpdate(true),
        checkIsExpireAndUpdate(true, { disableNFT: true, disableDefi: true }),
      ]);
    } catch (error) {
      console.error('Refresh failed:', error);
    }
  }, [checkIsExpireAndUpdate, triggerUpdate]);

  // if (!isFocusing) {
  //   return null;
  // }

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
      removeClippedSubviews
      maxToRenderPerBatch={15}
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
    marginTop: TAB_HEADER_FULL_HEIGHT,
  },
  list: {
    marginTop: -TAB_HEADER_FULL_HEIGHT,
    paddingHorizontal: 16,
  },
  bgContainer: {
    paddingHorizontal: 16,
  },
  tokenSectionHeader: {
    paddingLeft: 0,
    paddingRight: 0,
    backgroundColor: 'transparent',
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
