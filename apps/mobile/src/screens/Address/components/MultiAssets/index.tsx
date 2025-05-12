import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Dimensions, View } from 'react-native';
import {
  TabView,
  SceneMap,
  SceneRendererProps,
  TabBar,
} from 'react-native-tab-view';
import {
  ASSETS_ITEM_HEIGHT_NEW,
  ASSETS_LIST_HEADER,
  ASSETS_SECTION_HEADER,
  ASSETS_SEPARATOR_HEIGHT,
  DEFI_ITEM_HEIGHT,
  SWITCH_HEADER_HEIGHT,
} from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { AddressList } from './AddressList';
import { Portfolios } from './Portfolios';
import Animated, { FadeIn } from 'react-native-reanimated';
import { MultiChart } from './RenderRow/CurveChart';
import { useMultiCurve } from '@/hooks/useMultiCurve';
import { useAccountInfo } from './hooks';
import useAccountsBalance from '@/hooks/useAccountsBalance';

export const MultiAssets = () => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();

  const [index, setIndex] = React.useState(0);

  const { top10Addresses } = useAccountInfo();

  const { getTotalBalance } = useAccountsBalance({
    cacheTime: 10 * 60 * 1000,
    accountsNoUnique: true, // balanceAccounts has filter same address accounts
  });

  const top10Balance = useMemo(() => {
    return getTotalBalance(top10Addresses);
  }, [top10Addresses, getTotalBalance]);

  const { combineData, isLoadingNew: isLoadingCurve } = useMultiCurve(
    top10Addresses,
    false,
    top10Balance,
  );
  const [routes] = React.useState([
    { key: 'first', title: t('page.multiAddressAssets.tabs.address') },
    { key: 'second', title: t('page.multiAddressAssets.tabs.portfolio') },
  ]);

  const addressListRender = useCallback(() => {
    return <AddressList />;
  }, []);
  const portfolioListRender = useCallback(() => {
    return <Portfolios />;
  }, []);

  const renderTabBar = useCallback(
    (sceneProps: SceneRendererProps) => {
      return (
        <Animated.View entering={FadeIn} style={[]}>
          <TabBar
            {...sceneProps}
            // indicatorStyle={}
            navigationState={{ index: 1, routes }}
            pressColor="transparent" // Android only
            style={styles.tabItem}
            tabStyle={styles.tabsContainer}
          />
        </Animated.View>
      );
    },
    [routes, styles.tabItem, styles.tabsContainer],
  );
  const pathColor = useMemo(
    () =>
      !combineData.isLoss
        ? colors2024['green-default']
        : colors2024['red-default'],
    [colors2024, combineData.isLoss],
  );

  return (
    <View style={styles.container}>
      <MultiChart
        isOffline={false}
        data={combineData}
        loading={isLoadingCurve}
        pathColor={pathColor}
        isNoAssets={false}
      />

      <TabView
        lazy
        navigationState={{ index, routes }} // 当前索引和 tab 列表
        renderScene={SceneMap({
          first: addressListRender,
          second: portfolioListRender,
        })} // 每个 tab 的内容
        onIndexChange={setIndex} // 切换时更新索引
        renderTabBar={renderTabBar}
        initialLayout={{ width: Dimensions.get('window').width }} // 初始宽度
      />
    </View>
  );
};

const getStyles = createGetStyles2024(ctx => ({
  container: {
    flex: 1,
    // alignItems: 'center',
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
  tabsContainer: {
    backgroundColor: 'transparent',
  },
  tabItem: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '800',
    color: ctx.colors2024['neutral-secondary'],
    fontFamily: 'SF Pro Rounded',
    textAlign: 'center',
    backgroundColor: 'transparent',
  },
}));
