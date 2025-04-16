import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
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
  ASSETS_EMPTY_ROW_HIGHT,
  ASSETS_ITEM_HEIGHT_NEW,
  ASSETS_SECTION_HEADER,
  ASSETS_SEPARATOR_HEIGHT,
  DEFI_ITEM_HEIGHT,
  DEFI_SEPARATOR_HEIGHT,
  HEADER_CHART_HEIGHT,
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
} from '@/screens/Home/types';
import {
  getAllDefiCount,
  getTotalFoldToken,
} from '@/screens/Home/utils/converAssets';
import { navigate } from '@/utils/navigation';
import { createGetStyles2024 } from '@/utils/styles';
import { useAssets } from '@/screens/Search/useAssets';
import { PositionLoader } from '@/screens/Search/components/Skeleton';
import { ICombineItem } from '@/screens/Home/hooks/store';
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

const SCREEN_WIDTH = Dimensions.get('window').width;

interface Props {
  filterText?: string;
}

const ViewTypes = {
  HEADER: 0,
  BODY: 1,
  OVERVIEW: 2,
  EMPTY_TOKEN: 3,
  EMPTY_ASSETS: 4,
  EMPTY_DEFI: 5,
  DEFI: 6,
  SWITCH_HEADER: 7,
};

export const MultiAssets: React.FC<Props> = ({ filterText }) => {
  const { styles, isLight, colors2024 } = useTheme2024({ getStyle: getStyles });

  const {
    top10Addresses,
    tokens,
    portfolios,
    getCacheTop10Assets,
    checkIsExpireAndUpdate,
    refreshing,
    isLoading,
  } = useAssets(filterText);

  const { t } = useTranslation();
  const [firstRowType, setFirstRowType] = useState('');
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
  }>({
    currentTab: TabType.portfolio,
  });
  const [listData, setListData] = useState(() =>
    dataProvider.cloneWithRows([]),
  );

  const dataList = useMemo(() => {
    // TODO: chain filter
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
    const itemData: Array<{
      show: boolean;
      data: ActionItem[];
    }> = [
      {
        show: true,
        data: [
          { type: 'overview' },
          { type: 'switch_tabs' },
          {
            type: 'asset_header',
          },
          ...unFoldList,
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
  }, [foldDefi, foldHideList, isLoading, portfolios, t, tokens]);

  useEffect(() => {
    setListData(dataProvider.cloneWithRows(dataList));
  }, [dataList, dataProvider]);

  const { combineData, refresh, loading } = useMultiCurve(top10Addresses);
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

  const renderItem = (_type, _data) => {
    const { type, data } = _data;
    switch (type) {
      case 'overview':
        return (
          <MultiChart
            isOffline={false}
            data={combineData}
            loading={loading}
            pathColor={pathColor}
            isNoAssets={false}
          />
        );
      case 'switch_tabs':
        return (
          <SwitchHeader
            currentTab={extendedState.currentTab}
            onChangeTab={tab =>
              setExtendedState(pre => ({
                ...pre,
                currentTab: tab,
              }))
            }
          />
        );

      case 'unfold_token':
      case 'fold_token':
        return (
          <TokenRow
            data={data}
            onTokenPress={handleOpenTokenDetail}
            filterText={filterText}
            logoSize={46}
            style={styles.renderItemWrapper}
            chainLogoSize={18}
            hideFoldTag
            disableMenu
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
          <Text style={styles.sectionHeader}>
            {t('page.search.sectionHeader.token')}
          </Text>
        );
      case 'toggle_token_fold':
        return (
          <TokenRowSectionHeader
            str={getTotalFoldToken(tokens.filter(i => i._isFold))}
            fold={foldHideList}
            onPressFold={() => setFoldHideList(pre => !pre)}
          />
        );
      case 'defi_header':
        return (
          <Text style={styles.sectionHeader}>
            {t('page.search.sectionHeader.Defi')}
          </Text>
        );
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
        if (
          item?.type?.includes('_header') ||
          item?.type?.includes('toggle_')
        ) {
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
          case ViewTypes.HEADER:
            dim.width = SCREEN_WIDTH - 32;
            dim.height = ASSETS_SECTION_HEADER + ASSETS_SEPARATOR_HEIGHT;
            break;
          case ViewTypes.EMPTY_TOKEN:
            dim.width = SCREEN_WIDTH;
            dim.height = TOKEN_EMPTY_ROW_HIGHT + ASSETS_SEPARATOR_HEIGHT;
            break;
          case ViewTypes.EMPTY_ASSETS:
          case ViewTypes.EMPTY_DEFI:
            dim.width = SCREEN_WIDTH;
            dim.height = ASSETS_EMPTY_ROW_HIGHT + ASSETS_SEPARATOR_HEIGHT;
            break;
          case ViewTypes.DEFI:
            dim.width = SCREEN_WIDTH - 32;
            dim.height = DEFI_ITEM_HEIGHT + DEFI_SEPARATOR_HEIGHT;
            break;
          case ViewTypes.SWITCH_HEADER:
            dim.width = SCREEN_WIDTH - 32;
            dim.height = SWITCH_HEADER_HEIGHT;
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
  }, []);

  if (isLoading && !listData.getSize()) {
    return (
      <View style={styles.bgContainer}>
        <PositionLoader />
      </View>
    );
  }
  if (!listData.getSize()) {
    return null;
  }
  console.log('🔍 CUSTOM_LOGGER:=>: firstRowType', firstRowType);

  return (
    <View style={styles.container}>
      {firstRowType?.includes('_header') ||
      firstRowType?.includes('toggle_') ? null : (
        <Animated.View style={[styles.bgContainer, styles.stickyHeader]}>
          {renderStickHeader(firstRowType)}
        </Animated.View>
      )}
      <RecyclerListView
        style={styles.list}
        dataProvider={listData}
        extendedState={extendedState}
        layoutProvider={layoutProvider}
        rowRenderer={renderItem}
        onVisibleIndicesChanged={indexes => {
          if (listData.getDataForIndex(indexes[0])?.type) {
            setFirstRowType(listData.getDataForIndex(indexes[0]).type);
          }
        }}
        onScroll={() => {
          Keyboard.dismiss();
        }}
        scrollViewProps={{
          refreshControl: (
            <RefreshControl
              style={styles.bgContainer}
              onRefresh={() => {
                checkIsExpireAndUpdate(true);
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
    height: ASSETS_SECTION_HEADER,
    zIndex: 1,
  },
  bgContainer: {
    // backgroundColor: ctx.isLight
    //   ? ctx.colors2024['neutral-bg-0']
    //   : ctx.colors2024['neutral-bg-1'],
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
    backgroundColor: ctx.isLight
      ? ctx.colors2024['neutral-bg-0']
      : ctx.colors2024['neutral-bg-1'],
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
}));
