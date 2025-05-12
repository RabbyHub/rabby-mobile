import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Dimensions, StyleSheet, Text, View } from 'react-native';

import {
  ASSETS_EMPTY_ROW_HIGHT,
  ASSETS_ITEM_HEIGHT_NEW,
  ASSETS_LIST_HEADER,
  ASSETS_SECTION_HEADER,
  ASSETS_SEPARATOR_HEIGHT,
  DEFI_ITEM_HEIGHT,
  DEFI_SEPARATOR_HEIGHT,
  RootNames,
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
import {
  RecyclerListView,
  DataProvider,
  LayoutProvider,
} from 'recyclerlistview';
import { getItemId } from '@/screens/Home/utils/listRenderId';
import { chunk } from 'lodash';
import { useAccountInfo } from './hooks';
import { EmptyAssets } from '@/screens/Home/components/AssetRenderItems/EmptyAssets';
import { DefiItemLoader } from '@/screens/Home/components/Skeleton';
import useAccountsBalance from '@/hooks/useAccountsBalance';
import { useBalanceUpdate } from './hooks/balance';
import { MenuAction } from '@/components2024/ContextMenuView/ContextMenuView';
import { icons } from '@/screens/Home/AssetContainer';
import { preferenceService } from '@/core/services';
import { toast } from '@/components2024/Toast';
import { useTriggerTagAssets } from '@/screens/Home/hooks/refresh';
import { DisplayedProject } from '@/screens/Home/utils/project';
import { isScamHidenToken } from '@/screens/Home/utils/collection';
import { ScamTokenHeader } from '@/screens/Home/components/AssetRenderItems/ScamTokenHeader';

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

export const Portfolios = ({ isRefreshing }: { isRefreshing?: boolean }) => {
  const { styles, isLight } = useTheme2024({ getStyle: getStyles });
  const { top10Addresses } = useAccountInfo();

  const { triggerUpdate } = useAccountsBalance({
    cacheTime: 10 * 60 * 1000,
    accountsNoUnique: true, // balanceAccounts has filter same address accounts
  });

  const {
    tokens,
    portfolios,
    getCacheTop10Assets,
    checkIsExpireAndUpdate,
    refreshing,
    isLoading,
  } = useAssets();

  const listRef = useRef<RecyclerListViewRef>(null);
  const [isListVisable, setIsListVisable] = useState(false);

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
  const [foldScam, setFoldScam] = useState(true);
  const [extendedState, setExtendedState] = useState<{
    isLight: boolean;
  }>({
    isLight: isLight,
  });

  useEffect(() => {
    setExtendedState(prev => ({ ...prev, isLight }));
  }, [isLight]);

  const [listData, setListData] = useState(() =>
    dataProvider.cloneWithRows([]),
  );
  useBalanceUpdate(triggerUpdate);

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
      data: item,
    }));
    const unFoldDefiList: ActionItem[] = chunk(
      portfolios.filter(i => !i._isFold),
      2,
    ).map(item => ({
      type: 'unfold_defi',
      data: item,
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

  useEffect(() => {
    if (isRefreshing) {
      return;
    }
    setListData(dataProvider.cloneWithRows(portfolioListData));
  }, [dataProvider, isRefreshing, portfolioListData]);

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
        return ViewTypes.BODY;
      },
      (type, dim) => {
        switch (type) {
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
          default:
            dim.width = SCREEN_WIDTH - 32;
            dim.height = ASSETS_ITEM_HEIGHT_NEW + ASSETS_SEPARATOR_HEIGHT;
        }
      },
    );
  }, [listData]);

  useEffect(() => {
    const id = setTimeout(() => {
      if (!isListVisable) {
        return;
      }
      getCacheTop10Assets({
        disableNFT: true,
        realTimeAddresses: top10Addresses,
      }).finally(() => {
        checkIsExpireAndUpdate(false, {
          disableNFT: true,
          realTimeAddresses: top10Addresses,
        });
      });
    }, 200);
    return () => {
      id && clearTimeout(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [top10Addresses.length, isListVisable]);

  return (
    <RecyclerListView
      style={styles.list}
      dataProvider={listData}
      extendedState={extendedState}
      layoutProvider={layoutProvider}
      ref={listRef}
      onVisibleIndicesChanged={() => {
        setIsListVisable(true);
      }}
      rowRenderer={renderItem}
    />
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
  rowWrap: {
    height: ASSETS_ITEM_HEIGHT_NEW,
    marginBottom: ASSETS_SEPARATOR_HEIGHT,
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
