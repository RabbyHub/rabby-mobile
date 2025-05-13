import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
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
import { MultiChart } from './RenderRow/CurveChart';
import { useMultiCurve } from '@/hooks/useMultiCurve';
import { useAccountInfo } from './hooks';
import useAccountsBalance from '@/hooks/useAccountsBalance';
import {
  Tabs,
  MaterialTabBar,
  MaterialTabItem,
} from 'react-native-collapsible-tab-view';

export const MultiAssets = () => {
  const { styles, colors2024, colors } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();

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

  const renderTabItem = React.useCallback(
    (props: any) => <MaterialTabItem {...props} inactiveOpacity={1} />,
    [],
  );

  const renderTabBar = React.useCallback(
    (props: any) => (
      <MaterialTabBar
        {...props}
        scrollEnabled={false}
        indicatorStyle={styles.indicator}
        tabStyle={styles.tabBar}
        TabItemComponent={renderTabItem}
        activeColor={colors2024['brand-default']}
        inactiveColor={colors['neutral-body']}
        labelStyle={styles.label}
        indicatorContainerStyle={styles.tabBarIndicator}
      />
    ),
    [
      colors,
      colors2024,
      renderTabItem,
      styles.indicator,
      styles.label,
      styles.tabBar,
      styles.tabBarIndicator,
    ],
  );
  const pathColor = useMemo(
    () =>
      !combineData.isLoss
        ? colors2024['green-default']
        : colors2024['red-default'],
    [colors2024, combineData.isLoss],
  );

  const renderHeader = useCallback(() => {
    return (
      <MultiChart
        isOffline={false}
        data={combineData}
        loading={isLoadingCurve}
        pathColor={pathColor}
        isNoAssets={false}
      />
    );
  }, [combineData, isLoadingCurve, pathColor]);

  return (
    <Tabs.Container
      lazy
      containerStyle={styles.container}
      minHeaderHeight={0}
      renderTabBar={renderTabBar}
      tabBarHeight={SWITCH_HEADER_HEIGHT - 16}
      renderHeader={renderHeader}
      headerContainerStyle={styles.tabBarWrap}>
      <Tabs.Tab
        label={t('page.multiAddressAssets.tabs.address')}
        name="address">
        <AddressList />
      </Tabs.Tab>
      <Tabs.Tab
        label={t('page.multiAddressAssets.tabs.portfolio')}
        name="portfolios">
        <Portfolios />
      </Tabs.Tab>
    </Tabs.Container>
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
  tabBarWrap: {
    backgroundColor: 'transparent',
    shadowColor: 'transparent',
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
  tabBar: {
    height: SWITCH_HEADER_HEIGHT - 16,
    backgroundColor: ctx.isLight
      ? ctx.colors2024['neutral-bg-0']
      : ctx.colors2024['neutral-bg-1'],
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    textTransform: 'none',
  },
  indicator: {
    backgroundColor: ctx.colors['blue-default'],
    height: 2,
  },
  tabBarIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
}));
