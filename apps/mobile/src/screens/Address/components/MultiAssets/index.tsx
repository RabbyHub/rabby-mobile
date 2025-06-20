import React, { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { HEADER_CHART_HEIGHT, SWITCH_HEADER_HEIGHT } from '@/constant/layout';
import { useTheme2024 } from '@/hooks/theme';
import { createGetStyles2024 } from '@/utils/styles';
import { AddressList } from './AddressList';
import { Portfolios } from './Portfolios';
import { MultiChart } from './RenderRow/CurveChart';
import { useMultiCurve } from '@/hooks/useMultiCurve';
import { useAccountInfo } from './hooks';
import useAccountsBalance from '@/hooks/useAccountsBalance';
import { Tabs, MaterialTabItem } from 'react-native-collapsible-tab-view';
import { CustomMaterialTabBar } from '@/components2024/CustomTabs/CustomMaterialTabBar';
import { useSafeSetNavigationOptions } from '@/components/AppStatusBar';
import { HeaderTitle } from './HeaderTitle';
import { isTabsSwiping } from './hooks';

export const MultiAssets = ({
  onUpdateIsDecrease,
  onReachTopStatusChange,
}: {
  onUpdateIsDecrease: (isDecrease: boolean) => void;
  onReachTopStatusChange?: (status: boolean) => void;
}) => {
  const { styles, colors2024 } = useTheme2024({ getStyle: getStyles });
  const { t } = useTranslation();
  const { setNavigationOptions } = useSafeSetNavigationOptions();

  const { top10Addresses, list } = useAccountInfo();

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
  useEffect(() => {
    onUpdateIsDecrease(combineData.isLoss);
  }, [combineData.isLoss, onUpdateIsDecrease]);

  const renderTabItem = React.useCallback(
    (props: any) => (
      <MaterialTabItem {...props} pressOpacity={1} inactiveOpacity={1} />
    ),
    [],
  );

  const getHeaderTitle = useCallback(
    () => (
      <HeaderTitle
        netWorth={combineData.netWorth}
        changePercent={combineData.changePercent}
        isLoss={combineData.isLoss}
      />
    ),
    [combineData.changePercent, combineData.isLoss, combineData.netWorth],
  );

  const renderTabBar = React.useCallback(
    (props: any) => (
      <CustomMaterialTabBar
        {...props}
        tabStyle={styles.tabBar}
        indicatorStyle={styles.indicator}
        TabItemComponent={renderTabItem}
        activeColor={colors2024['neutral-title-1']}
        inactiveColor={colors2024['neutral-secondary']}
        labelStyle={styles.label}
      />
    ),
    [colors2024, renderTabItem, styles.indicator, styles.label, styles.tabBar],
  );

  const pathColor = useMemo(
    () =>
      !combineData.isLoss
        ? colors2024['green-default']
        : colors2024['red-default'],
    [colors2024, combineData.isLoss],
  );

  const handleScroll = useCallback(
    (y: number) => {
      // 10 is buffer
      const isHideHeader = y > HEADER_CHART_HEIGHT - 10;
      if (isHideHeader) {
        setNavigationOptions({
          headerTitle: getHeaderTitle,
          headerTitleAlign: 'left',
        });
      } else {
        setNavigationOptions({
          headerTitle: '',
          headerTitleAlign: 'left',
        });
      }
      onReachTopStatusChange?.(!isHideHeader);
    },
    [getHeaderTitle, onReachTopStatusChange, setNavigationOptions],
  );

  const renderHeader = useCallback(() => {
    return (
      <MultiChart
        isOffline={false}
        data={combineData}
        loading={isLoadingCurve}
        pathColor={pathColor}
        isNoAssets={false}
        handleScroll={handleScroll}
      />
    );
  }, [combineData, handleScroll, isLoadingCurve, pathColor]);

  const listLength = useMemo(() => {
    return list.length > 10 ? 10 : list.length;
  }, [list]);

  return (
    <Tabs.Container
      containerStyle={styles.container}
      minHeaderHeight={0}
      headerHeight={HEADER_CHART_HEIGHT}
      renderTabBar={renderTabBar}
      tabBarHeight={SWITCH_HEADER_HEIGHT - 16}
      renderHeader={renderHeader}
      pagerProps={{
        onPageScrollStateChanged: event => {
          isTabsSwiping.value = event?.nativeEvent?.pageScrollState !== 'idle';
        },
      }}
      headerContainerStyle={styles.tabBarWrap}>
      <Tabs.Tab
        label={`${t('page.multiAddressAssets.tabs.wallet', {
          count: listLength,
        })} ${listLength ? `(${listLength})` : ''}`}
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
    overflow: 'hidden',
  },
  tabBarWrap: {
    // backgroundColor: 'transparent',
    backgroundColor: ctx.isLight
      ? ctx.colors2024['neutral-bg-0']
      : ctx.colors2024['neutral-bg-1'],
    shadowColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
  },
  tabBar: {
    height: SWITCH_HEADER_HEIGHT - 16,
    backgroundColor: ctx.isLight
      ? ctx.colors2024['neutral-bg-0']
      : ctx.colors2024['neutral-bg-1'],
  },
  label: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '800',
    fontFamily: 'SF Pro Rounded',
    textTransform: 'none',
    textAlign: 'center',
  },
  indicator: {
    backgroundColor: ctx.colors2024['brand-default'],
    height: 4,
    borderRadius: 100,
  },
}));
